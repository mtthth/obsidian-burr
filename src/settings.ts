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
	/** Ne jamais signaler un mot qui prend une majuscule en milieu de phrase. */
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
	ignoreProperNames: true,
	ignoreDialogue: false,
	extraIgnoredWords: "",
	includedFolders: "",
	excludedFolders: "",
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Complète et borne des réglages lus sur le disque (fichier édité à la main, ancienne version…). */
export function sanitizeSettings(raw: Partial<BurrSettings> | null | undefined): BurrSettings {
	const merged = { ...DEFAULT_SETTINGS, ...raw };
	return {
		...merged,
		window: clamp(Math.round(Number(merged.window)) || DEFAULT_SETTINGS.window, WINDOW_RANGE.min, WINDOW_RANGE.max),
		maxNgram: clamp(Math.round(Number(merged.maxNgram)) || DEFAULT_SETTINGS.maxNgram, NGRAM_RANGE.min, NGRAM_RANGE.max),
		echoRarity: clamp(
			Math.round(Number(merged.echoRarity)) || DEFAULT_SETTINGS.echoRarity,
			ECHO_RARITY_RANGE.min,
			ECHO_RARITY_RANGE.max,
		),
		echoReach: ECHO_REACHES.includes(Number(merged.echoReach)) ? Number(merged.echoReach) : DEFAULT_SETTINGS.echoReach,
		extraIgnoredWords: String(merged.extraIgnoredWords ?? ""),
		includedFolders: String(merged.includedFolders ?? ""),
		excludedFolders: String(merged.excludedFolders ?? ""),
	};
}

/** « mot, autre mot » ou un mot par ligne -> ensemble de mots en minuscules NFC. */
export function parseWordList(text: string): Set<string> {
	const words = text
		.split(/[\s,;]+/)
		.map((word) => word.trim().toLowerCase().normalize("NFC"))
		.filter(Boolean);
	return new Set(words);
}
