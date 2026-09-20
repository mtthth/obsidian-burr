import type { Language } from "../types.ts";
import { stemFrench } from "./stemmer.ts";
import { FRENCH_STOPWORDS } from "./stopwords.ts";

/** Le stemmer est le point chaud de l'analyse : on mémorise, avec un plafond. */
const STEM_CACHE_LIMIT = 50_000;
const stemCache = new Map<string, string>();

function stem(word: string): string {
	let root = stemCache.get(word);
	if (root === undefined) {
		if (stemCache.size >= STEM_CACHE_LIMIT) stemCache.clear();
		root = stemFrench(word);
		stemCache.set(word, root);
	}
	return root;
}

export const french: Language = {
	id: "fr",
	label: "Français",
	stopwords: FRENCH_STOPWORDS,
	stem,
	dialogue: [
		// Réplique introduite par un tiret cadratin, demi-cadratin ou « -- » : toute la ligne.
		/^[ \t]*(?:[—–]|--)[^\n]*/gm,
		// Passage entre guillemets français.
		/«[^»\n]*»/g,
	],
};
