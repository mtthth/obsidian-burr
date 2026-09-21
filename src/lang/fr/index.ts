import type { Language } from "../types.ts";
import { stemFrench } from "./stemmer.ts";
import { FRENCH_STOPWORDS } from "./stopwords.ts";
import { IRREGULAR_VERB_FORMS } from "./verbs.ts";

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

/**
 * Snowball ne connaît pas la désinence -ons de la première personne du pluriel
 * (« mangeons » -> « mangeon », « chantons » -> « chanton »). On la retire nous-mêmes,
 * en seconde racine : l'appartenance à un nom (« maisons ») est indécidable sans lexique.
 * Les -ions (imparfait : « mangions ») restent hors de cette règle : Snowball ne les
 * retire que dans certains mots (« regardions » oui, « mangions » non), mais des noms
 * en -ion au pluriel (« passions », « questions ») seraient rapprochés de « passer »
 * ou de « quête » sans que rien ne les distingue.
 */
function altStem(word: string): string | undefined {
	// « allons », « faisons » : la table des verbes irréguliers les connaît déjà.
	if (!word.endsWith("ons") || word.endsWith("ions") || IRREGULAR_VERB_FORMS.has(word)) return undefined;
	// « plaçons » : le ç n'existe que devant a, o, u ; « placer » a un c.
	const root = stem(word.slice(0, -3).replace(/ç$/, "c"));
	return root !== stem(word) ? root : undefined;
}

export const french: Language = {
	id: "fr",
	label: "Français",
	stopwords: FRENCH_STOPWORDS,
	stem,
	lemma: (word) => IRREGULAR_VERB_FORMS.get(word),
	altStem,
	dialogue: [
		// Réplique introduite par un tiret cadratin, demi-cadratin ou « -- » : toute la ligne.
		/^[ \t]*(?:[—–]|--)[^\n]*/gm,
		// Passage entre guillemets français.
		/«[^»\n]*»/g,
	],
	// Guillemets, tirets de dialogue (« -- » : tiret cadratin tapé au clavier), parenthèse.
	sentenceOpeners: /[«“"—–(]|--/,
};
