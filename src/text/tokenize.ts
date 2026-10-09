import type { Language } from "../lang/types.ts";
import { MASK, ignoredSpans, maskSpans } from "./ignored.ts";
import type { IgnoreOptions } from "./ignored.ts";
import { normalizeText } from "./normalize.ts";

export interface Token {
	/** Position dans le texte d'origine (le document CodeMirror). */
	from: number;
	to: number;
	/** Forme de comparaison : minuscules, NFC. */
	norm: string;
	/** Le mot commence par une majuscule. */
	capitalized: boolean;
	/** Le mot ouvre une phrase ou une réplique : sa majuscule ne prouve rien. */
	sentenceStart: boolean;
	/**
	 * Numéro de segment : suite de mots sans ponctuation forte ni zone ignorée
	 * entre eux. Deux mots de segments différents ne forment pas une expression.
	 */
	segment: number;
	/**
	 * Numéro de paragraphe. Un paragraphe s'arrête à une ligne sans mots (ligne blanche,
	 * séparateur, zone ignorée), à un titre, un élément de liste ou une réplique, et au
	 * retour à la ligne qui suit une fin de phrase. Un retour à la ligne au milieu d'une
	 * phrase (texte coupé à la main) le continue : un paragraphe par ligne et un texte
	 * coupé à la main sont compris tous deux.
	 */
	paragraph: number;
}

/**
 * Un mot est une suite de lettres, chiffres et signes combinants. L'apostrophe
 * et le trait d'union coupent : « l'homme » donne « l » et « homme »,
 * « dit-il » donne « dit » et « il ». Pas de \b, qui ne comprend pas les accents.
 */
export const WORD = /[\p{L}\p{N}\p{M}]+/gu;

/** Ponctuation qui ferme une phrase ou une proposition, et fin de ligne (commune aux langues latines et germaniques). */
const HARD_BREAK = /[.!?…;:\n]/;
const UPPERCASE_FIRST = /^\p{Lu}/u;

/** Le début d'une ligne qui ouvre un bloc à part : titre, élément de liste, réplique, ligne de tableau. */
const BLOCK_START = /^[ \t]*(?:>[ \t]*)*(?:#{1,6}(?:[ \t]|$)|[-*+][ \t]|\d+[.)][ \t]|[—–]|--|\|)/;
/** Une ligne qui ne se continue pas sur la suivante : titre, ligne de tableau. */
const WHOLE_LINE = /^[ \t]*(?:>[ \t]*)*(?:#{1,6}(?:[ \t]|$)|\|)/;
/** Une fin de phrase en bout de ligne, guillemets, parenthèses et emphase fermants compris. */
const SENTENCE_END = /[.!?…][\s»"”’')\]*_~=]*$/;

/**
 * Le mot qui suit `gap` ouvre-t-il un paragraphe ? `previousLine` est la ligne du mot
 * précédent, de son début jusqu'à lui.
 */
function startsParagraph(gap: string, previousLine: string): boolean {
	const first = gap.indexOf("\n");
	if (first < 0) return false;
	const last = gap.lastIndexOf("\n");
	// Une ligne entière sans mots entre les deux : ligne blanche, séparateur, bloc ignoré.
	if (first !== last) return true;
	if (BLOCK_START.test(gap.slice(last + 1)) || WHOLE_LINE.test(previousLine)) return true;
	return SENTENCE_END.test(gap.slice(0, first).split(MASK).join(""));
}

/**
 * Découpe le texte en mots, une seule fois pour tous les détecteurs. Les
 * frontmatter, blocs de code, commentaires, adresses (et dialogues en option)
 * sont écartés ; les positions restent celles du texte d'origine.
 */
export function tokenize(text: string, language: Language, options: IgnoreOptions): Token[] {
	const normalized = normalizeText(text);
	const masked = maskSpans(normalized, ignoredSpans(normalized, language, options));

	const tokens: Token[] = [];
	let segment = 0;
	let paragraph = 0;
	let previousEnd = -1;
	let previousLineStart = 0;

	for (const match of masked.matchAll(WORD)) {
		const from = match.index as number;
		const to = from + match[0].length;
		const gap = previousEnd < 0 ? "\n" : masked.slice(previousEnd, from);
		// Ce qui sépare les deux mots une fois les zones ignorées retirées : la ponctuation du lecteur.
		const visible = gap.split(MASK).join("");

		if (HARD_BREAK.test(gap) || gap.includes(MASK)) segment++;
		const newline = gap.lastIndexOf("\n");
		if (previousEnd >= 0 && newline >= 0 && startsParagraph(gap, masked.slice(previousLineStart, previousEnd))) paragraph++;

		tokens.push({
			from,
			to,
			norm: match[0].toLowerCase().normalize("NFC"),
			capitalized: UPPERCASE_FIRST.test(match[0]),
			sentenceStart: HARD_BREAK.test(visible) || language.sentenceOpeners.test(visible),
			segment,
			paragraph,
		});
		// Le début de la ligne de ce mot : après le dernier saut de ligne qui le précède.
		if (previousEnd < 0) previousLineStart = masked.lastIndexOf("\n", from) + 1;
		else if (newline >= 0) previousLineStart = previousEnd + newline + 1;
		previousEnd = to;
	}
	return tokens;
}
