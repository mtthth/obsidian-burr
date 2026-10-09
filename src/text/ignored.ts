import type { Language } from "../lang/types.ts";

export type Span = [from: number, to: number];

/** Motifs en ligne, cherchés hors du code et des commentaires : formules, liens, adresses, balises. */
const INLINE_PATTERNS: readonly RegExp[] = [
	/\$\$[\s\S]*?\$\$/g, // formule en bloc
	/\$(?=\S)(?:\\\$|[^$\n])*?(?<=[^\s\\])\$(?!\d)/g, // formule en ligne : « $x^2$ », pas « 5 $ ou 10 $ »
	/!\[\[[^\]\n]*\]\]/g, // fichier intégré
	/\[\[[^\]|\n]*\|/g, // cible d'un lien [[cible|texte affiché]]
	/\]\([^)\n]*\)/g, // cible d'un lien [texte](cible)
	/(?:https?:\/\/|\bwww\.)[^\s)>\]]+/g, // adresse web
	/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu, // adresse électronique
	/(?<!\S)#[\p{L}\p{N}_/-]*[\p{L}_/-][\p{L}\p{N}_/-]*/gu, // balise (« #personnage », pas « #1 » ni un titre « # Titre »)
	/<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/g, // balise HTML (« <span class="note"> »), pas ce qu'elle entoure
	/(?<=^[ \t]*(?:>[ \t]*)+)\[![^\]\n]*\][+-]?/gm, // type d'un encadré (« > [!note] »)
];

/** Le début d'une ligne de citation ou d'encadré (« > », « > > ») : un bloc de code peut s'y ouvrir. */
const QUOTE = "(?:[ \\t]{0,3}>)*";
const FENCE_OPENING = new RegExp(`^${QUOTE}[ \\t]{0,3}(\`{3,}|~{3,})`);

/** Frontmatter YAML (seulement s'il est refermé) et blocs de code clôturés, cités compris. */
function blockSpans(text: string): Span[] {
	const spans: Span[] = [];
	let fence: { closing: RegExp; start: number } | null = null;

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
			if (fence.closing.test(line)) {
				spans.push([fence.start, eol]);
				fence = null;
			}
		} else {
			const opening = FENCE_OPENING.exec(line);
			if (opening) {
				const closing = new RegExp(`^${QUOTE}[ \\t]{0,3}${opening[1][0]}{${opening[1].length},}[ \\t]*$`);
				fence = { closing, start: pos };
			}
		}

		if (eol === text.length) break;
		pos = eol + 1;
	}

	// Un bloc de code jamais refermé court jusqu'à la fin, comme dans l'éditeur.
	if (fence) spans.push([fence.start, text.length]);
	return spans;
}

/**
 * Code en ligne et commentaires, lus de gauche à droite : le premier ouvert l'emporte.
 * Un « %% » écrit dans du code n'ouvre pas de commentaire ; un commentaire jamais
 * refermé court jusqu'à la fin, comme dans l'éditeur.
 */
function codeAndCommentSpans(text: string): Span[] {
	const spans: Span[] = [];
	const opener = /`+|%%|<!--/g;
	for (let match = opener.exec(text); match; match = opener.exec(text)) {
		const start = match.index;
		let end: number;
		if (match[0][0] === "`") {
			// Du code s'il se referme par autant d'accents graves sur la même ligne ; sinon, un accent seul.
			const code = new RegExp(`${match[0]}[^\\n]*?${match[0]}`, "y");
			code.lastIndex = start;
			if (!code.test(text)) continue;
			end = code.lastIndex;
		} else {
			const close = match[0] === "%%" ? "%%" : "-->";
			const found = text.indexOf(close, start + match[0].length);
			end = found < 0 ? text.length : found + close.length;
		}
		spans.push([start, end]);
		opener.lastIndex = end;
	}
	return spans;
}

/** Les plages de `text` où l'un des motifs (drapeau `g`) est trouvé. */
function matchSpans(text: string, patterns: readonly RegExp[]): Span[] {
	const spans: Span[] = [];
	for (const pattern of patterns) {
		for (const match of text.matchAll(pattern)) {
			spans.push([match.index as number, (match.index as number) + match[0].length]);
		}
	}
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

/**
 * Ce qui, dans du Markdown, n'est pas du texte que l'on lit : blocs (frontmatter, code),
 * code en ligne et commentaires, puis le reste (formules, liens, adresses, balises),
 * chaque passe ne cherchant que hors de ce que les précédentes ont trouvé. Triées, fusionnées.
 */
export function markupSpans(text: string): Span[] {
	const blocks = mergeSpans(blockSpans(text));
	const outsideBlocks = maskSpans(text, blocks);
	const code = codeAndCommentSpans(outsideBlocks);
	const outsideCode = maskSpans(outsideBlocks, code);
	return mergeSpans([...blocks, ...code, ...matchSpans(outsideCode, INLINE_PATTERNS)]);
}

/** Plages du texte qui ne sont pas de la prose à relire, triées et fusionnées. */
export function ignoredSpans(text: string, language: Language, options: IgnoreOptions): Span[] {
	const spans = markupSpans(text);
	if (!options.ignoreDialogue) return spans;
	return mergeSpans([...spans, ...matchSpans(maskSpans(text, spans), language.dialogue)]);
}

/** Le caractère qui recouvre les zones ignorées : ni lettre, ni ponctuation, ni espace. */
export const MASK = "\u0000";

/**
 * Recouvre les plages ignorées de `MASK`, sans changer la longueur du texte.
 * Une zone ignorée coupe : deux mots de part et d'autre ne forment jamais une
 * expression. Elle ne dit rien, en revanche, du début d'une phrase : c'est la
 * ponctuation autour qui le dit (« Il vit [[Paris|Paris]] » : Paris est en milieu de phrase).
 */
export function maskSpans(text: string, spans: readonly Span[]): string {
	if (spans.length === 0) return text;
	const parts: string[] = [];
	let pos = 0;
	for (const [from, to] of spans) {
		parts.push(text.slice(pos, from), MASK.repeat(to - from));
		pos = to;
	}
	parts.push(text.slice(pos));
	return parts.join("");
}
