import { EditorSelection } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import { EditorView, RectangleMarker, layer } from "@codemirror/view";
import type { BurrSettings } from "../settings.ts";
import { refreshHighlights } from "./highlight.ts";

/** Code spans and blocks paint a background that would hide a caret drawn under the text. */
const CODE_SELECTOR = ".cm-inline-code, .HyperMD-codeblock, .cm-hmd-codeblock";

function inCode(view: EditorView, pos: number): boolean {
	const { node, offset } = view.domAtPos(pos);
	const candidates: (Node | null | undefined)[] = node.nodeType === Node.TEXT_NODE ? [node] : [node.childNodes[offset - 1], node.childNodes[offset], node];
	return candidates.some((candidate) => {
		const element = candidate instanceof Element ? candidate : candidate?.parentElement;
		return !!element?.closest(CODE_SELECTOR);
	});
}

/**
 * A wider, coloured text caret. CSS cannot widen the native caret, so it is hidden (as is CodeMirror's own,
 * should the editor draw one) and drawn here, like CodeMirror's: one bar per empty selection range,
 * only while the editor has focus. It sits under the text, as the selection does, so that it never hides a letter,
 * except in code, whose background would cover it: there it is drawn in a second layer, above.
 * Width and colour are CSS variables set on the editor (see styles.css).
 */
export function burrCaret(getSettings: () => BurrSettings): Extension {
	const caretLayer = (above: boolean) =>
		layer({
			above,
			class: "burr-caret-layer",
			markers(view) {
				if (!getSettings().caret || !view.hasFocus) return [];
				const markers: RectangleMarker[] = [];
				for (const range of view.state.selection.ranges) {
					if (range.empty && inCode(view, range.head) === above) {
						markers.push(...RectangleMarker.forRange(view, "burr-caret", EditorSelection.cursor(range.head, range.assoc)));
					}
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

	return [attributes, hideNative, caretLayer(false), caretLayer(true)];
}
