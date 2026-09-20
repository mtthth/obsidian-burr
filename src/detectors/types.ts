import type { Language } from "../lang/types.ts";
import type { BurrSettings } from "../settings.ts";
import type { Token } from "../text/tokenize.ts";

/** Une plage du document à surligner, telle que la rend un détecteur. */
export interface Highlight {
	/** Positions dans le document. */
	from: number;
	to: number;
	/** Famille du signal (« repetition »…) : détermine la couleur. */
	category: string;
	/** 1 (discret) à 3 (marqué). */
	intensity: 1 | 2 | 3;
}

export interface DetectionInput {
	tokens: readonly Token[];
	language: Language;
	settings: BurrSettings;
}

/**
 * Tous les détecteurs partagent cette forme : ils reçoivent le texte déjà
 * découpé et rendent des plages. En ajouter un ne touche ni l'éditeur ni
 * l'interface : il suffit de l'inscrire dans `detectors`.
 */
export interface Detector {
	readonly id: string;
	detect(input: DetectionInput): Highlight[];
}
