import type { Language } from "../lang/types.ts";

export type Span = [from: number, to: number];

/** Motifs en ligne : code, formules, commentaires, adresses et cibles de liens. */
const INLINE_PATTERNS: readonly RegExp[] = [
	/(`+)[^\n]*?\1/g, // code en ligne
	/\$\$[\s\S]*?\$\$/g, // formule en bloc
	/<!--[\s\S]*?-->/g, // commentaire HTML
	/%%[\s\S]*?%%/g, // commentaire Obsidian
	/!\[\[[^\]\n]*\]\]/g, // fichier intégré
	/\[\[[^\]|\n]*\|/g, // cible d'un lien [[cible|texte affiché]]
	/\]\([^)\n]*\)/g, // cible d'un lien [texte](cible)
	/https?:\/\/[^\s)>\]]+/g, // adresse web
];

/** Frontmatter YAML (seulement s'il est refermé) et blocs de code clôturés. */
function blockSpans(text: string): Span[] {
	const spans: Span[] = [];
	let fence: { char: string; length: number; start: number } | null = null;

	const frontmatter = /^---[ \t]*\n[\s\S]*?\n(?:---|\.\.\.)[ \t]*(?=\n|$)/.exec(text);
	let pos = 0;
	if (frontmatter) {
		spans.push([0, frontmatter[0].length]);
		pos = frontmatter[0].length;
	}

	while (pos <= text.length) {
		let eol = text.indexOf("\n", pos);
		if (eol === -1) eol = text.length;
		const line = text.slice(pos, eol);

		if (fence) {
			const closing = new RegExp(`^[ \\t]{0,3}${fence.char}{${fence.length},}[ \\t]*$`);
			if (closing.test(line)) {
				spans.push([fence.start, eol]);
				fence = null;
			}
		} else {
			const opening = /^[ \t]{0,3}(`{3,}|~{3,})/.exec(line);
			if (opening) fence = { char: opening[1][0], length: opening[1].length, start: pos };
		}

		if (eol === text.length) break;
		pos = eol + 1;
	}

	// Un bloc de code jamais refermé court jusqu'à la fin, comme dans l'éditeur.
	if (fence) spans.push([fence.start, text.length]);
	return spans;
}

function mergeSpans(spans: Span[]): Span[] {
	spans.sort((a, b) => a[0] - b[0]);
	const merged: Span[] = [];
	for (const span of spans) {
		const last = merged[merged.length - 1];
		if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
		else merged.push([span[0], span[1]]);
	}
	return merged;
}

export interface IgnoreOptions {
	ignoreDialogue: boolean;
}

/** Plages du texte qui ne sont pas de la prose à relire, triées et fusionnées. */
export function ignoredSpans(text: string, language: Language, options: IgnoreOptions): Span[] {
	const spans = blockSpans(text);
	const patterns = options.ignoreDialogue ? [...INLINE_PATTERNS, ...language.dialogue] : INLINE_PATTERNS;
	for (const pattern of patterns) {
		for (const match of text.matchAll(pattern)) {
			spans.push([match.index as number, (match.index as number) + match[0].length]);
		}
	}
	return mergeSpans(spans);
}

/**
 * Remplace les plages ignorées par des sauts de ligne, sans changer la
 * longueur du texte. Le saut de ligne joue aussi le rôle de coupure : deux mots
 * de part et d'autre d'une zone ignorée ne forment jamais une expression.
 */
export function maskSpans(text: string, spans: readonly Span[]): string {
	if (spans.length === 0) return text;
	const parts: string[] = [];
	let pos = 0;
	for (const [from, to] of spans) {
		parts.push(text.slice(pos, from), "\n".repeat(to - from));
		pos = to;
	}
	parts.push(text.slice(pos));
	return parts.join("");
}
