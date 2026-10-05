/** Degré d'usage d'un mot dans la langue : 0 très rare (ou inconnu), 1 rare, 2 peu courant, 3 courant. */
export type Commonness = 0 | 1 | 2 | 3;

/** Ce que la langue apporte au détecteur de mots faibles. */
export interface WeakSupport {
	/** Contenu (Markdown) de la note de mots faibles que l'on crée par défaut. */
	readonly template: string;
	/**
	 * Toutes les formes conjuguées d'un verbe (infinitif en minuscules NFC), en minuscules NFC ;
	 * `undefined` si la langue ne sait pas le conjuguer. La liste ne dit que les formes de ce
	 * verbe : un stemmer rapprocherait « commencement » de « commencer ».
	 */
	verbForms(infinitive: string): ReadonlySet<string> | undefined;
}

/** Des mots qui ouvrent une phrase de la même façon (« il », « elle », « on »). */
export interface OpeningGroup {
	/** Identifie le groupe ; ne sert qu'à comparer. */
	readonly id: string;
	/** Les mots du groupe, en minuscules NFC, tels que le tokenizer les coupe (« j' » donne « j »). */
	readonly words: readonly string[];
}

/** Ce que la langue apporte au détecteur de débuts de phrase. */
export interface OpeningSupport {
	/** Groupes de mots comptés pour un seul ; tout autre mot ne compte que contre lui-même. */
	readonly groups: readonly OpeningGroup[];
	/** Abréviations (minuscules NFC, sans point) après lesquelles un point ne finit pas la phrase. */
	readonly abbreviations: ReadonlySet<string>;
}

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
	/**
	 * Mots-outils que l'on signale tout de même quand ils s'enchaînent (« que … que … que ») :
	 * chacun donne la forme qui réunit ses variantes (« qu' » -> « que »).
	 */
	readonly crowded?: ReadonlyMap<string, string>;
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
	/**
	 * Degré d'usage d'un mot (minuscules NFC), celui de sa famille : « chatoyaient »
	 * est aussi rare que « chatoyer ». Un mot rare se remarque : repris de loin, il
	 * se lit encore comme une répétition. Sans cette fonction, rien n'est jugé rare.
	 */
	commonness?(word: string): Commonness;
	/** Mots faibles (intensifs, verbes ternes…) : sans cela, ce détecteur ne signale rien. */
	readonly weak?: WeakSupport;
	/** Débuts de phrase et de paragraphe répétés : sans cela, ce détecteur ne signale rien. */
	readonly openings?: OpeningSupport;
	/** Motifs (drapeau `g`) des répliques de dialogue, ignorées si l'option est activée. */
	readonly dialogue: readonly RegExp[];
	/**
	 * Signes qui ouvrent une phrase ou une réplique sans ponctuation forte
	 * avant eux (« Il dit : « Viens » »). La majuscule qui les suit ne prouve pas
	 * un nom propre. Motif sans drapeau `g`, utilisé avec `test`.
	 */
	readonly sentenceOpeners: RegExp;
}
