import { matcherFor } from "../weak/lexicon.ts";
import type { DetectionInput, Detector, Highlight } from "./types.ts";

export const WEAK = "weak";

/**
 * Les couleurs des familles (`burr-color-N`), dans l'ordre de la note : une famille garde la
 * sienne, quoi qu'il arrive dans le texte. Ces teintes évitent le orange des répétitions.
 */
const FAMILY_COLORS = [1, 3, 5, 7, 9, 10, 11, 6] as const;

type Intensity = 1 | 2 | 3;

/** Plus une famille s'accumule dans le paragraphe, plus le soulignement est marqué. */
function intensityFor(count: number, threshold: number): Intensity {
	return count >= 2 * threshold ? 3 : count > threshold ? 2 : 1;
}

/**
 * Mots faibles : un intensif (« très »), un adverbe en -ment, un verbe terne, un mot vague
 * ne sont pas des fautes, mais un signal de densité. Une famille n'est surlignée que dans les
 * paragraphes où elle atteint son seuil : un « très » passe, trois à la suite se voient.
 *
 * Un seul passage glouton sur les mots : à chaque position, l'entrée la plus longue gagne
 * (« quelque chose » plutôt que « chose »), et ses mots ne comptent pas deux fois.
 * Les paragraphes sont ceux du découpage en mots (voir `Token.paragraph`).
 */
function detect({ text, tokens, language, settings, lexicon }: DetectionInput): Highlight[] {
	if (!settings.weakWords || lexicon.families.length === 0) return [];
	const matcher = matcherFor(lexicon, language);
	const disabled = new Set(settings.weakDisabled);

	interface Hit {
		first: number;
		last: number;
		family: number;
		paragraph: number;
	}
	const hits: Hit[] = [];
	const counts = new Map<number, number>(); // paragraphe * (nombre de familles) + famille -> occurrences
	const stride = lexicon.families.length;

	for (let i = 0; i < tokens.length; ) {
		const match = matcher.match(tokens, i);
		if (!match) {
			i++;
			continue;
		}
		const last = i + match.length - 1;
		if (!disabled.has(lexicon.families[match.family].id)) {
			const paragraph = tokens[i].paragraph;
			hits.push({ first: i, last, family: match.family, paragraph });
			const key = paragraph * stride + match.family;
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
		// Les mots d'une entrée sont d'un seul segment, donc d'un seul paragraphe.
		i = last + 1;
	}

	const highlights: Highlight[] = [];
	for (const { first, last, family: rank, paragraph: where } of hits) {
		const family = lexicon.families[rank];
		const threshold = family.threshold ?? settings.weakThreshold;
		const count = counts.get(where * stride + rank) as number;
		if (count < threshold) continue;
		const from = tokens[first].from;
		const to = tokens[last].to;
		highlights.push({
			from,
			to,
			category: WEAK,
			family: `faible:${family.id}`,
			color: FAMILY_COLORS[rank % FAMILY_COLORS.length],
			intensity: intensityFor(count, threshold),
			explain: () => ({ text: `« ${text.slice(from, to)} » — ${family.label} : ${count} dans ce paragraphe.` }),
		});
	}
	return highlights;
}

export const weak: Detector = { id: "weak", detect };
