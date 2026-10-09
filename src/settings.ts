export interface BurrSettings {
	/** Surligner les répétitions dans l'éditeur. */
	enabled: boolean;
	/** Distance maximale, en mots, entre deux occurrences pour les signaler. */
	window: number;
	/** Longueur maximale, en mots, des expressions répétées (1 = mots isolés). */
	maxNgram: number;
	/** Rapprocher les formes d'un même mot (regardait / regarda / regardant). */
	useStemming: boolean;
	/** Souligner les mots rares repris de loin, au-delà de la fenêtre. */
	echoes: boolean;
	/** Mots jugés rares : 1 très rares seulement, 2 rares aussi, 3 peu courants aussi. */
	echoRarity: number;
	/** Distance maximale, en mots, entre deux emplois d'un mot rare ; 0 : tout le document. */
	echoReach: number;
	/** Surligner les mots faibles (intensifs, verbes ternes, béquilles…) quand ils s'accumulent. */
	weakWords: boolean;
	/** Occurrences d'une famille de mots faibles, dans un même paragraphe, à partir desquelles elle est surlignée. */
	weakThreshold: number;
	/** Les familles de mots faibles (leur identifiant) que l'on ne veut pas voir. */
	weakDisabled: string[];
	/** Chemin de la note qui liste les mots faibles ; absente, les mots de la langue s'appliquent. */
	weakNote: string;
	/** Ne jamais signaler un mot écrit avec la majuscule qu'il prend en milieu de phrase (un nom propre). */
	ignoreProperNames: boolean;
	/** Laisser de côté les répliques de dialogue. */
	ignoreDialogue: boolean;
	/** Mots à ne jamais signaler, en plus des mots-outils. */
	extraIgnoredWords: string;
	/** Dossiers à analyser, un par ligne ; vide : tout le coffre. */
	includedFolders: string;
	/** Dossiers à ne jamais analyser, un par ligne. */
	excludedFolders: string;
}

export const WINDOW_RANGE = { min: 20, max: 200, step: 10 } as const;
export const NGRAM_RANGE = { min: 1, max: 4 } as const;
export const WEAK_THRESHOLD_RANGE = { min: 1, max: 6 } as const;
export const DEFAULT_WEAK_NOTE = "mots-faibles.md";
export const ECHO_RARITY_RANGE = { min: 1, max: 3 } as const;
/** Les portées proposées pour les mots rares ; 0 : tout le document. */
export const ECHO_REACHES: readonly number[] = [1000, 2000, 5000, 10000, 0];

export const DEFAULT_SETTINGS: BurrSettings = {
	enabled: true,
	window: 80,
	maxNgram: 4,
	useStemming: true,
	echoes: true,
	echoRarity: 2,
	// À peu près un chapitre. Sur tout un roman, les mots rares finissent tous par revenir.
	echoReach: 5000,
	weakWords: true,
	weakThreshold: 3,
	weakDisabled: [],
	weakNote: DEFAULT_WEAK_NOTE,
	ignoreProperNames: true,
	ignoreDialogue: false,
	extraIgnoredWords: "",
	includedFolders: "",
	excludedFolders: "",
};

/** Le chemin d'une note : l'extension .md s'ajoute si elle manque (« mots-faibles » -> « mots-faibles.md »). */
export function markdownPath(path: string): string {
	return /\.md$/i.test(path) ? path : `${path}.md`;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Un interrupteur lu sur le disque : un booléen, ou son écriture en texte ; sinon la valeur par défaut. */
const toggle = (value: unknown, fallback: boolean): boolean =>
	typeof value === "boolean" ? value : value === "true" ? true : value === "false" ? false : fallback;

/** Complète et borne des réglages lus sur le disque (fichier édité à la main, ancienne version…). */
export function sanitizeSettings(raw: Partial<BurrSettings> | null | undefined): BurrSettings {
	const merged = { ...DEFAULT_SETTINGS, ...raw };
	return {
		...merged,
		enabled: toggle(merged.enabled, DEFAULT_SETTINGS.enabled),
		useStemming: toggle(merged.useStemming, DEFAULT_SETTINGS.useStemming),
		echoes: toggle(merged.echoes, DEFAULT_SETTINGS.echoes),
		weakWords: toggle(merged.weakWords, DEFAULT_SETTINGS.weakWords),
		ignoreProperNames: toggle(merged.ignoreProperNames, DEFAULT_SETTINGS.ignoreProperNames),
		ignoreDialogue: toggle(merged.ignoreDialogue, DEFAULT_SETTINGS.ignoreDialogue),
		window: clamp(Math.round(Number(merged.window)) || DEFAULT_SETTINGS.window, WINDOW_RANGE.min, WINDOW_RANGE.max),
		maxNgram: clamp(Math.round(Number(merged.maxNgram)) || DEFAULT_SETTINGS.maxNgram, NGRAM_RANGE.min, NGRAM_RANGE.max),
		echoRarity: clamp(
			Math.round(Number(merged.echoRarity)) || DEFAULT_SETTINGS.echoRarity,
			ECHO_RARITY_RANGE.min,
			ECHO_RARITY_RANGE.max,
		),
		echoReach: ECHO_REACHES.includes(Number(merged.echoReach)) ? Number(merged.echoReach) : DEFAULT_SETTINGS.echoReach,
		weakThreshold: clamp(
			Math.round(Number(merged.weakThreshold)) || DEFAULT_SETTINGS.weakThreshold,
			WEAK_THRESHOLD_RANGE.min,
			WEAK_THRESHOLD_RANGE.max,
		),
		weakDisabled: Array.isArray(merged.weakDisabled) ? merged.weakDisabled.filter((id) => typeof id === "string") : [],
		weakNote: String(merged.weakNote ?? "").trim() || DEFAULT_WEAK_NOTE,
		extraIgnoredWords: String(merged.extraIgnoredWords ?? ""),
		includedFolders: String(merged.includedFolders ?? ""),
		excludedFolders: String(merged.excludedFolders ?? ""),
	};
}
