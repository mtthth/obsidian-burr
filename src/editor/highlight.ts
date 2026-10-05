import { EditorSelection, StateEffect, StateField } from "@codemirror/state";
import type { ChangeDesc, Extension } from "@codemirror/state";
import { Decoration, EditorView, RectangleMarker, ViewPlugin, closeHoverTooltips, hoverTooltip, layer } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { analyze } from "../analyze.ts";
import { PALETTE_SIZE, assignColors } from "../colors.ts";
import type { ColorMemory } from "../colors.ts";
import type { Explanation, Highlight } from "../detectors/types.ts";
import { prioritize } from "../priorities.ts";
import type { BurrSettings } from "../settings.ts";
import type { Lexicon } from "../weak/lexicon.ts";

/** Attente après la dernière frappe avant de relancer l'analyse. */
const DEBOUNCE_MS = 250;

/** Résultat d'une analyse, à poser dans l'état de l'éditeur. */
const setHighlights = StateEffect.define<DecorationSet>();

/** Demande une nouvelle analyse tout de suite (réglages modifiés). */
export const refreshHighlights = StateEffect.define<null>();

/** Les classes CSS de chaque catégorie (`burr-repetition`, `burr-echo`…), par couleur puis par intensité (1 à 3). */
const classCache = new Map<string, string[][]>();

function classesFor(category: string): string[][] {
	let classes = classCache.get(category);
	if (!classes) {
		const base = `burr-${category}`;
		classes = Array.from({ length: PALETTE_SIZE }, (_, color) =>
			[1, 2, 3].map((level) => `${base} ${base}-${level} burr-color-${color}`),
		);
		classCache.set(category, classes);
	}
	return classes;
}

type Span = NonNullable<Highlight["target"]>;

/** Le passage sous le pointeur, avec de quoi écrire son infobulle. */
interface Hovered {
	from: number;
	to: number;
	explain: Highlight["explain"];
	target?: Span;
	/** Tous les passages de son problème, positions de l'analyse. */
	problem?: Span[];
}

interface Highlights {
	decorations: DecorationSet;
	/** Ce qui a changé dans le texte depuis l'analyse : de quoi ramener les cibles des liens au texte actuel. */
	since: ChangeDesc | null;
}

// Entre deux analyses, les surlignages suivent le texte que l'on tape : sans cela
// ils glisseraient sous le curseur pendant les 250 ms d'attente.
const highlightField = StateField.define<Highlights>({
	create: () => ({ decorations: Decoration.none, since: null }),
	update(value, transaction) {
		for (const effect of transaction.effects) {
			if (effect.is(setHighlights)) return { decorations: effect.value, since: null };
		}
		if (!transaction.docChanged) return value;
		const changes = transaction.changes.desc;
		return {
			decorations: value.decorations.map(transaction.changes),
			since: value.since ? value.since.composeDesc(changes) : changes,
		};
	},
});

function buildDecorations(
	text: string,
	settings: BurrSettings,
	memory: ColorMemory,
	lexicon: Lexicon | undefined,
	ignored: ReadonlySet<string>,
): DecorationSet {
	const highlights = analyze(text, settings, lexicon, ignored);
	const colors = assignColors(highlights, memory);
	// Tous les passages du problème de chacun (un mot repris cinq fois : les cinq), pour les repérer ensemble au survol.
	const problemOf = new Map<number, Span[]>();
	for (const problem of prioritize(text, highlights)) {
		for (const span of problem.spans) problemOf.set(span.from, problem.spans);
	}
	const ranges = highlights.map((h, i) =>
		// La décoration porte aussi l'explication, sa cible et son problème, que l'infobulle retrouve par sa position.
		Decoration.mark({
			class: classesFor(h.category)[colors[i]][h.intensity - 1],
			explain: h.explain,
			target: h.target,
			problem: problemOf.get(h.from),
		}).range(h.from, h.to),
	);
	return Decoration.set(ranges, true);
}

/**
 * Encadre un passage (cadre rouge creux, clignotant) et les autres de sa famille (le même cadre, fixe),
 * jusqu'à ce que le texte change ou que la sélection quitte le premier. Les marques ne dessinent rien :
 * elles disent où tracer les cadres (`focusFrames`) et où taire les surlignages (`visibleHighlights`).
 */
const setFocus = StateEffect.define<{ main: Span; others: Span[] } | null>();
const focusMark = Decoration.mark({});
const focusOtherMark = Decoration.mark({});

const focusField = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update(value, transaction) {
		for (const effect of transaction.effects) {
			if (!effect.is(setFocus)) continue;
			const focus = effect.value;
			if (!focus) return Decoration.none;
			const ranges = [focusMark.range(focus.main.from, focus.main.to)];
			for (const other of focus.others) {
				if (other.to > other.from) ranges.push(focusOtherMark.range(other.from, other.to));
			}
			return focus.main.to > focus.main.from ? Decoration.set(ranges, true) : Decoration.none;
		}
		if (transaction.docChanged) return Decoration.none;
		if (transaction.selection && value.size > 0) {
			// Une sélection ailleurs, ou plus étroite que le passage encadré : les cadres n'ont plus lieu d'être.
			const { from, to } = transaction.state.selection.main;
			let kept = false;
			value.between(from, to, (start, end, mark) => {
				if (start === from && end === to && mark === focusMark) kept = true;
			});
			return kept ? value : Decoration.none;
		}
		return value;
	},
});

/**
 * Les cadres rouges, tracés comme la sélection d'Obsidian (`RectangleMarker.forRange`, sous le texte) :
 * le cadre du passage choisi épouse exactement sa sélection, au pixel près, quels que soient police et zoom.
 */
const focusFrames = layer({
	above: false,
	class: "burr-focus-layer",
	markers(view) {
		const markers: RectangleMarker[] = [];
		view.state.field(focusField).between(0, view.state.doc.length, (from, to, mark) => {
			const className = mark === focusMark ? "burr-focus" : "burr-focus-other";
			markers.push(...RectangleMarker.forRange(view, className, EditorSelection.range(from, to)));
		});
		return markers;
	},
	update: (update) =>
		update.docChanged ||
		update.selectionSet ||
		update.viewportChanged ||
		update.startState.field(focusField) !== update.state.field(focusField),
});

/**
 * Les surlignages, sauf sous les cadres : la couleur, moins haute que la ligne, y ferait
 * un rectangle de plus, décalé de quelques pixels. Ils reviennent quand les cadres s'en vont.
 */
const visibleHighlights = EditorView.decorations.compute([highlightField, focusField], (state) => {
	const { decorations } = state.field(highlightField);
	const focus = state.field(focusField);
	if (focus.size === 0) return decorations;
	return decorations.update({
		filter: (from, to) => {
			let framed = false;
			focus.between(from, to, (start, end) => {
				if (start >= to || end <= from) return;
				framed = true;
				return false;
			});
			return !framed;
		},
	});
});

/** Montre un passage : on le sélectionne, on le centre à l'écran, et on l'encadre en rouge, avec `others` en cadre fixe. */
export function showPassage(view: EditorView, span: Span, others: readonly Span[] = []) {
	const length = view.state.doc.length;
	const clamp = (s: Span): Span => ({ from: Math.min(s.from, length), to: Math.min(s.to, length) });
	const main = clamp(span);
	view.dispatch({
		selection: EditorSelection.single(main.from, main.to),
		effects: [EditorView.scrollIntoView(main.from, { y: "center" }), setFocus.of({ main, others: others.map(clamp) })],
	});
}

/** Sélectionne l'autre occurrence et la montre au milieu de l'écran. */
function jumpTo(view: EditorView, target: Span) {
	view.dispatch({
		selection: EditorSelection.single(target.from, target.to),
		effects: [EditorView.scrollIntoView(target.from, { y: "center" }), closeHoverTooltips],
	});
	view.focus();
}

/** La phrase de l'infobulle ; son passage lié (« 12 mots plus haut ») mène à l'autre occurrence. */
function renderExplanation(
	view: EditorView,
	{ text, link }: Explanation,
	target: Span | undefined,
	current: Span,
	occurrences: readonly Span[],
): HTMLElement {
	const doc = view.dom.ownerDocument;
	const dom = doc.createElement("div");
	dom.className = "burr-tooltip";
	// Sans cela, le clic ôterait le focus à l'éditeur avant de sauter.
	const clickable = (label: string, span: Span) => {
		const jump = doc.createElement("span");
		jump.className = "burr-jump";
		jump.textContent = label;
		jump.addEventListener("mousedown", (event) => event.preventDefault());
		jump.addEventListener("click", () => jumpTo(view, span));
		return jump;
	};
	const sentence = doc.createElement("div");
	if (link && target) sentence.append(text.slice(0, link[0]), clickable(text.slice(link[0], link[1]), target), text.slice(link[1]));
	else sentence.textContent = text;
	dom.append(sentence);

	// Au-delà de deux passages, le nombre et la liste (mot et ligne), chacun menant à son passage.
	if (occurrences.length > 2) {
		const list = doc.createElement("div");
		list.className = "burr-occurrences";
		list.append(`${occurrences.length} occurrences : `);
		occurrences.slice(0, MAX_LISTED).forEach((span, i) => {
			if (i > 0) list.append(" · ");
			const label = `${view.state.sliceDoc(span.from, span.to)} (l. ${view.state.doc.lineAt(span.from).number})`;
			if (span.from === current.from) {
				const here = doc.createElement("strong");
				here.textContent = label;
				list.append(here);
			} else list.append(clickable(label, span));
		});
		if (occurrences.length > MAX_LISTED) list.append(" …");
		dom.append(list);
	}
	return dom;
}

/** Au plus ce nombre de passages listés dans l'infobulle. */
const MAX_LISTED = 12;

/**
 * Au survol d'un passage surligné, dit ce qui ne va pas. Les plages ne se
 * chevauchent pas ; la décoration suit le texte pendant la frappe, l'infobulle aussi.
 */
const explanation = hoverTooltip(
	(view, pos, side) => {
		const { decorations, since } = view.state.field(highlightField);
		let hovered = null as Hovered | null;
		decorations.between(pos, pos, (from, to, value) => {
			// À la limite de deux passages, le pointeur est sur celui du côté où il se trouve.
			if ((from === pos && side < 0) || (to === pos && side > 0)) return;
			hovered = { from, to, explain: value.spec.explain, target: value.spec.target, problem: value.spec.problem };
			return false;
		});
		if (!hovered) return null;
		const { from, to, explain, problem } = hovered as Hovered;
		let target = (hovered as Hovered).target;
		// Les positions de l'analyse sont ramenées au texte actuel. L'infobulle se ferme
		// à la moindre frappe (`hideOnChange`), elles restent donc justes tant qu'elle est ouverte.
		const current = (span: Span): Span => {
			if (!since) return span;
			const start = since.mapPos(span.from, 1);
			return { from: start, to: Math.max(start, since.mapPos(span.to, -1)) };
		};
		if (target) target = current(target);
		// Les autres passages du problème survolé ; à défaut, la seule cible.
		const occurrences = problem ? problem.map(current) : [];
		const others = problem ? occurrences.filter((span) => span.from !== from) : target ? [target] : [];
		return {
			pos: from,
			end: to,
			above: true,
			create: (editor) => {
				// Marginal Notes, s'il est là, repère ces passages dans sa minipage tant que l'infobulle reste ouverte.
				const point = (ranges: Span[]) => editor.dom.dispatchEvent(new CustomEvent("burr:point", { detail: { ranges } }));
				point([{ from, to }, ...others]);
				return { dom: renderExplanation(editor, explain(), target, { from, to }, occurrences), destroy: () => point([]) };
			},
		};
	},
	{ hideOnChange: true },
);

/**
 * Surligne les répétitions du document, en mode source comme en aperçu en direct.
 * `isExcluded` dit si la note de cet éditeur est laissée de côté (dossier, balise du YAML) ;
 * `getIgnored` donne les types de problèmes que l'auteur a écartés pour cette note.
 */
export function burrHighlighter(
	getSettings: () => BurrSettings,
	isExcluded: (view: EditorView) => boolean,
	getLexicon: () => Lexicon | undefined,
	getIgnored: (view: EditorView) => ReadonlySet<string>,
): Extension {
	const scheduler = ViewPlugin.fromClass(
		class {
			private view: EditorView;
			private timer: number | null = null;
			// Une famille garde sa couleur d'une analyse à l'autre, dans cet éditeur.
			private colors: ColorMemory = new Map();

			constructor(view: EditorView) {
				this.view = view;
				// Pas de dispatch pendant la construction : on diffère.
				this.schedule(0);
			}

			update(update: ViewUpdate) {
				const forced = update.transactions.some((tr) => tr.effects.some((e) => e.is(refreshHighlights)));
				if (forced) this.schedule(0);
				else if (update.docChanged) this.schedule(DEBOUNCE_MS);
			}

			destroy() {
				this.cancel();
			}

			private schedule(delay: number) {
				this.cancel();
				this.timer = window.setTimeout(() => this.run(), delay);
			}

			private cancel() {
				if (this.timer !== null) window.clearTimeout(this.timer);
				this.timer = null;
			}

			private run() {
				this.timer = null;
				const settings = getSettings();
				const decorations = (settings.enabled || settings.echoes || settings.weakWords || settings.openings) && !isExcluded(this.view)
					? buildDecorations(this.view.state.doc.toString(), settings, this.colors, getLexicon(), getIgnored(this.view))
					: Decoration.none;
				this.view.dispatch({ effects: setHighlights.of(decorations) });
			}
		},
	);
	return [highlightField, focusField, visibleHighlights, focusFrames, explanation, scheduler];
}
