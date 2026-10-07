import type { Highlight } from "./detectors/types.ts";

/** Identifie un type de problème (catégorie et famille), d'une analyse à l'autre : ce que l'auteur ignore. */
export function problemKey(highlight: Pick<Highlight, "category" | "family">): string {
	return `${highlight.category}:${highlight.family}`;
}

/** Characters of context kept on each side of a passage, to recognise it after edits elsewhere in the note. */
const CONTEXT = 16;

const squeeze = (text: string): string => text.replace(/\s+/g, " ").toLowerCase().normalize("NFC");

/** Where a sentence ends: the context stops there, so writing the next sentence leaves the anchor alone. */
const SENTENCE_END = /[.!?…\n]/;

/**
 * A passage identified by its words and their surroundings within its sentence, not by its position:
 * it survives edits elsewhere in the note, and stops matching once its own sentence is rewritten.
 */
export function anchorOf(text: string, span: { from: number; to: number }): string {
	let before = text.slice(Math.max(0, span.from - CONTEXT), span.from);
	for (let i = before.length - 1; i >= 0; i--) {
		if (SENTENCE_END.test(before[i])) {
			before = before.slice(i + 1);
			break;
		}
	}
	let after = text.slice(span.to, span.to + CONTEXT);
	const end = after.search(SENTENCE_END);
	if (end >= 0) after = after.slice(0, end + 1);
	return [before, text.slice(span.from, span.to), after].map(squeeze).join("\u0001");
}

/** A problem ignored in one place only: its key, and the anchors of the passages it had then. */
export interface IgnoredPassage {
	key: string;
	anchors: string[];
}

/** What the author set aside in a note: whole problem types, and problems in one place only. */
export interface Ignored {
	keys: ReadonlySet<string>;
	passages: readonly IgnoredPassage[];
}

export const NOTHING_IGNORED: Ignored = { keys: new Set(), passages: [] };

/**
 * Tells whether a highlight is set aside, or null when nothing is. Passages are matched one by one:
 * a new occurrence typed next to ignored ones is still shown.
 */
export function ignoredTest(text: string, ignored: Ignored): ((highlight: Highlight) => boolean) | null {
	if (ignored.keys.size === 0 && ignored.passages.length === 0) return null;
	const anchored = new Set(ignored.passages.flatMap((passage) => passage.anchors.map((anchor) => `${passage.key}\u0000${anchor}`)));
	return (highlight) => {
		const key = problemKey(highlight);
		return ignored.keys.has(key) || (anchored.size > 0 && anchored.has(`${key}\u0000${anchorOf(text, highlight)}`));
	};
}

/** Does this ignored passage cover the problem (same key, at least one passage in common)? */
export function coversProblem(passage: IgnoredPassage, problem: IgnoredPassage): boolean {
	return passage.key === problem.key && problem.anchors.some((anchor) => passage.anchors.includes(anchor));
}
