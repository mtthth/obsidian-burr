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
	/** Motifs (drapeau `g`) des répliques de dialogue, ignorées si l'option est activée. */
	readonly dialogue: readonly RegExp[];
	/**
	 * Signes qui ouvrent une phrase ou une réplique sans ponctuation forte
	 * avant eux (« Il dit : « Viens » »). La majuscule qui les suit ne prouve pas
	 * un nom propre. Motif sans drapeau `g`, utilisé avec `test`.
	 */
	readonly sentenceOpeners: RegExp;
}
