import { EditorSelection, StateEffect, StateField } from "@codemirror/state";
import type { ChangeDesc, Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, closeHoverTooltips, hoverTooltip } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { analyze } from "../analyze.ts";
import { PALETTE_SIZE, assignColors } from "../colors.ts";
import type { ColorMemory } from "../colors.ts";
import type { Explanation, Highlight } from "../detectors/types.ts";
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
	provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
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
	const ranges = highlights.map((h, i) =>
		// La décoration porte aussi l'explication et sa cible, que l'infobulle retrouve par sa position.
		Decoration.mark({
			class: classesFor(h.category)[colors[i]][h.intensity - 1],
			explain: h.explain,
			target: h.target,
		}).range(h.from, h.to),
	);
	return Decoration.set(ranges, true);
}

/**
 * Encadre un passage (cadre rouge creux, clignotant) et les autres de sa famille (le même cadre, fixe),
 * jusqu'à ce que le texte change ou que la sélection quitte le premier.
 */
const setFocus = StateEffect.define<{ main: Span; others: Span[] } | null>();
const focusMark = Decoration.mark({ class: "burr-focus" });
const focusOtherMark = Decoration.mark({ class: "burr-focus-other" });

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
	provide: (field) => EditorView.decorations.from(field),
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
function renderExplanation(view: EditorView, { text, link }: Explanation, target: Span | undefined): HTMLElement {
	const doc = view.dom.ownerDocument;
	const dom = doc.createElement("div");
	dom.className = "burr-tooltip";
	if (!link || !target) {
		dom.textContent = text;
		return dom;
	}
	const jump = doc.createElement("span");
	jump.className = "burr-jump";
	jump.textContent = text.slice(link[0], link[1]);
	// Sans cela, le clic ôterait le focus à l'éditeur avant de sauter.
	jump.addEventListener("mousedown", (event) => event.preventDefault());
	jump.addEventListener("click", () => jumpTo(view, target));
	dom.append(text.slice(0, link[0]), jump, text.slice(link[1]));
	return dom;
}

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
			hovered = { from, to, explain: value.spec.explain, target: value.spec.target };
			return false;
		});
		if (!hovered) return null;
		const { from, to, explain } = hovered as Hovered;
		let target = (hovered as Hovered).target;
		// La cible date de l'analyse ; on la ramène au texte actuel. L'infobulle se ferme
		// à la moindre frappe (`hideOnChange`), elle reste donc juste tant qu'elle est ouverte.
		if (target && since) {
			const start = since.mapPos(target.from, 1);
			target = { from: start, to: Math.max(start, since.mapPos(target.to, -1)) };
		}
		return {
			pos: from,
			end: to,
			above: true,
			create: (editor) => {
				// Marginal Notes, s'il est là, repère ces passages dans sa minipage tant que l'infobulle reste ouverte.
				const point = (ranges: Span[]) => editor.dom.dispatchEvent(new CustomEvent("burr:point", { detail: { ranges } }));
				point(target ? [{ from, to }, target] : [{ from, to }]);
				return { dom: renderExplanation(editor, explain(), target), destroy: () => point([]) };
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
				const decorations = (settings.enabled || settings.echoes || settings.weakWords) && !isExcluded(this.view)
					? buildDecorations(this.view.state.doc.toString(), settings, this.colors, getLexicon(), getIgnored(this.view))
					: Decoration.none;
				this.view.dispatch({ effects: setHighlights.of(decorations) });
			}
		},
	);
	return [highlightField, focusField, explanation, scheduler];
}
