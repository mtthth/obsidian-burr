import { StateEffect, StateField } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, hoverTooltip } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { analyze } from "../analyze.ts";
import { PALETTE_SIZE, assignColors } from "../colors.ts";
import type { ColorMemory } from "../colors.ts";
import type { Highlight } from "../detectors/types.ts";
import type { BurrSettings } from "../settings.ts";

/** Attente après la dernière frappe avant de relancer l'analyse. */
const DEBOUNCE_MS = 250;

/** Résultat d'une analyse, à poser dans l'état de l'éditeur. */
const setHighlights = StateEffect.define<DecorationSet>();

/** Demande une nouvelle analyse tout de suite (réglages modifiés). */
export const refreshHighlights = StateEffect.define<null>();

/** Les classes CSS par couleur puis par intensité (1 à 3). */
const classes = Array.from({ length: PALETTE_SIZE }, (_, color) =>
	[1, 2, 3].map((level) => `burr-repetition burr-repetition-${level} burr-color-${color}`),
);

/** Le passage sous le pointeur, avec de quoi écrire son infobulle. */
interface Hovered {
	from: number;
	to: number;
	explain: Highlight["explain"];
}

// Entre deux analyses, les surlignages suivent le texte que l'on tape : sans cela
// ils glisseraient sous le curseur pendant les 250 ms d'attente.
const highlightField = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update(value, transaction) {
		value = value.map(transaction.changes);
		for (const effect of transaction.effects) {
			if (effect.is(setHighlights)) value = effect.value;
		}
		return value;
	},
	provide: (field) => EditorView.decorations.from(field),
});

function buildDecorations(text: string, settings: BurrSettings, memory: ColorMemory): DecorationSet {
	const highlights = analyze(text, settings);
	const colors = assignColors(highlights, memory);
	const ranges = highlights.map((h, i) =>
		// La décoration porte aussi l'explication, que l'infobulle retrouve par sa position.
		Decoration.mark({ class: classes[colors[i]][h.intensity - 1], explain: h.explain }).range(h.from, h.to),
	);
	return Decoration.set(ranges, true);
}

/**
 * Au survol d'un passage surligné, dit ce qui ne va pas. Les plages ne se
 * chevauchent pas ; la décoration suit le texte pendant la frappe, l'infobulle aussi.
 */
const explanation = hoverTooltip(
	(view, pos, side) => {
		let hovered = null as Hovered | null;
		view.state.field(highlightField).between(pos, pos, (from, to, value) => {
			// À la limite de deux passages, le pointeur est sur celui du côté où il se trouve.
			if ((from === pos && side < 0) || (to === pos && side > 0)) return;
			hovered = { from, to, explain: value.spec.explain };
			return false;
		});
		if (!hovered) return null;
		const { from, to, explain } = hovered as Hovered;
		return {
			pos: from,
			end: to,
			above: true,
			create: (editor) => {
				const dom = editor.dom.ownerDocument.createElement("div");
				dom.className = "burr-tooltip";
				dom.textContent = explain();
				return { dom };
			},
		};
	},
	{ hideOnChange: true },
);

/** Surligne les répétitions du document, en mode source comme en aperçu en direct. */
export function burrHighlighter(getSettings: () => BurrSettings): Extension {
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
				const decorations = settings.enabled
					? buildDecorations(this.view.state.doc.toString(), settings, this.colors)
					: Decoration.none;
				this.view.dispatch({ effects: setHighlights.of(decorations) });
			}
		},
	);
	return [highlightField, explanation, scheduler];
}
