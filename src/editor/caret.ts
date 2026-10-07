import { EditorSelection } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import { EditorView, RectangleMarker, layer } from "@codemirror/view";
import type { BurrSettings } from "../settings.ts";
import { refreshHighlights } from "./highlight.ts";

/**
 * A wider, coloured text caret. CSS cannot widen the native caret, so it is hidden (as is CodeMirror's own,
 * should the editor draw one) and drawn here, like CodeMirror's: one bar per empty selection range,
 * only while the editor has focus, under the text as the selection is, so that it never hides a letter.
 * Width and colour are CSS variables set on the editor (see styles.css).
 */
export function burrCaret(getSettings: () => BurrSettings): Extension {
	const caretLayer = layer({
		above: false,
		class: "burr-caret-layer",
		markers(view) {
			if (!getSettings().caret || !view.hasFocus) return [];
			const markers: RectangleMarker[] = [];
			for (const range of view.state.selection.ranges) {
				if (range.empty) markers.push(...RectangleMarker.forRange(view, "burr-caret", EditorSelection.cursor(range.head, range.assoc)));
			}
			return markers;
		},
		update(update, dom) {
			// Every move restarts the blink, visible first: two identical animations, swapped, as CodeMirror does.
			if (update.transactions.some((tr) => tr.selection)) {
				dom.style.animationName = dom.style.animationName === "burr-caret-blink" ? "burr-caret-blink2" : "burr-caret-blink";
			}
			return (
				update.docChanged ||
				update.selectionSet ||
				update.focusChanged ||
				update.transactions.some((tr) => tr.effects.some((effect) => effect.is(refreshHighlights)))
			);
		},
	});

	const attributes = EditorView.editorAttributes.of(() => {
		const { caret, caretWidth, caretColor } = getSettings();
		if (!caret) return null;
		const color = caretColor ? ` --burr-caret-color: ${caretColor};` : "";
		return { class: "burr-caret-on", style: `--burr-caret-width: ${caretWidth}px;${color}` };
	});

	// Inline, on this editor's own content: it beats the theme's rule, and leaves nested editors (table cells) alone.
	const hideNative = EditorView.contentAttributes.of(() => (getSettings().caret ? { style: "caret-color: transparent" } : null));

	return [attributes, hideNative, caretLayer];
}
