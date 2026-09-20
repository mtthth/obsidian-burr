import type { Language } from "../lang/types.ts";
import { ignoredSpans, maskSpans } from "./ignored.ts";
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
}

/**
 * Un mot est une suite de lettres, chiffres et signes combinants. L'apostrophe
 * et le trait d'union coupent : « l'homme » donne « l » et « homme »,
 * « dit-il » donne « dit » et « il ». Pas de \b, qui ne comprend pas les accents.
 */
const WORD = /[\p{L}\p{N}\p{M}]+/gu;

/** Ponctuation qui ferme une phrase ou une proposition, et fin de ligne (commune aux langues latines et germaniques). */
const HARD_BREAK = /[.!?…;:\n]/;
const UPPERCASE_FIRST = /^\p{Lu}/u;

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
	let previousEnd = -1;

	for (const match of masked.matchAll(WORD)) {
		const from = match.index as number;
		const to = from + match[0].length;
		const gap = previousEnd < 0 ? "\n" : masked.slice(previousEnd, from);

		const newSegment = HARD_BREAK.test(gap);
		if (newSegment) segment++;

		tokens.push({
			from,
			to,
			norm: match[0].toLowerCase().normalize("NFC"),
			capitalized: UPPERCASE_FIRST.test(match[0]),
			sentenceStart: newSegment || language.sentenceOpeners.test(gap),
			segment,
		});
		previousEnd = to;
	}
	return tokens;
}
