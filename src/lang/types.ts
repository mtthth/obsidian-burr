/**
 * Ce qui dépend de la langue du document. Le reste du plugin (tokenizer,
 * détecteurs, éditeur) n'en sait rien : ajouter une langue, c'est écrire un
 * `Language` et l'inscrire dans `resolveLanguage`.
 */
export interface Language {
	/** Code court de la langue (ISO 639-1). */
	readonly id: string;
	/** Nom affiché à l'utilisateur. */
	readonly label: string;
	/** Mots-outils, en minuscules NFC : jamais signalés comme répétitions. */
	readonly stopwords: ReadonlySet<string>;
	/** Racine d'un mot (minuscules NFC, sans apostrophe) : rapproche regardait / regarda. */
	stem(word: string): string;
	/**
	 * L'infinitif d'une forme de verbe irrégulier (« faisons » -> « faire »), que le
	 * stemmer ne peut pas rapprocher de « fait ». Il sert de racine et de famille,
	 * et s'ajoute à `stem` : les liens que le stemmer sait faire (« connaissait » et
	 * « connaissance ») restent. `undefined` pour tout autre mot.
	 */
	lemma?(word: string): string | undefined;
	/**
	 * Seconde racine possible d'une forme que `stem` laisse telle quelle faute de
	 * connaître sa désinence (« mangeons » reste « mangeon », pas « mang »).
	 * Elle s'ajoute à la racine ordinaire, ne la remplace pas : « maisons » doit
	 * rester rapproché de « maison ». Rend `undefined` s'il n'y en a pas.
	 */
	altStem?(word: string): string | undefined;
	/** Motifs (drapeau `g`) des répliques de dialogue, ignorées si l'option est activée. */
	readonly dialogue: readonly RegExp[];
	/**
	 * Signes qui ouvrent une phrase ou une réplique sans ponctuation forte
	 * avant eux (« Il dit : « Viens » »). La majuscule qui les suit ne prouve pas
	 * un nom propre. Motif sans drapeau `g`, utilisé avec `test`.
	 */
	readonly sentenceOpeners: RegExp;
}
