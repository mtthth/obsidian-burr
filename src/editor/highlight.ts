import { StateEffect, StateField } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { analyze } from "../analyze.ts";
import type { BurrSettings } from "../settings.ts";

/** Attente après la dernière frappe avant de relancer l'analyse. */
const DEBOUNCE_MS = 250;

/** Résultat d'une analyse, à poser dans l'état de l'éditeur. */
const setHighlights = StateEffect.define<DecorationSet>();

/** Demande une nouvelle analyse tout de suite (réglages modifiés). */
export const refreshHighlights = StateEffect.define<null>();

/** Une décoration par intensité (indice 1 à 3), partagées entre toutes les plages. */
const marks = [1, 2, 3].map((level) => Decoration.mark({ class: `burr-repetition burr-repetition-${level}` }));

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

function buildDecorations(text: string, settings: BurrSettings): DecorationSet {
	const ranges = analyze(text, settings).map((h) => marks[h.intensity - 1].range(h.from, h.to));
	return Decoration.set(ranges, true);
}

/** Surligne les répétitions du document, en mode source comme en aperçu en direct. */
export function burrHighlighter(getSettings: () => BurrSettings): Extension {
	const scheduler = ViewPlugin.fromClass(
		class {
			private view: EditorView;
			private timer: number | null = null;

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
				const decorations = settings.enabled ? buildDecorations(this.view.state.doc.toString(), settings) : Decoration.none;
				this.view.dispatch({ effects: setHighlights.of(decorations) });
			}
		},
	);
	return [highlightField, scheduler];
}
