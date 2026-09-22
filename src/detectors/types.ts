import type { Language } from "../lang/types.ts";
import type { BurrSettings } from "../settings.ts";
import type { Token } from "../text/tokenize.ts";

/**
 * La phrase d'une infobulle. `link` délimite dans `text` le passage (« 12 mots plus haut »)
 * sur lequel on clique pour aller à l'autre occurrence.
 */
export interface Explanation {
	text: string;
	link?: [from: number, to: number];
}

/** Une plage du document à surligner, telle que la rend un détecteur. */
export interface Highlight {
	/** Positions dans le document. */
	from: number;
	to: number;
	/** Catégorie du signal (« repetition »…). */
	category: string;
	/**
	 * Famille : les occurrences liées entre elles (un même mot répété, une même
	 * expression). Chaque famille reçoit sa couleur, pour que l'on voie d'un coup
	 * d'œil quelles plages se répondent.
	 */
	family: string;
	/** 1 (discret) à 3 (marqué). */
	intensity: 1 | 2 | 3;
	/** L'autre occurrence dont parle l'infobulle, où mène son lien. Positions dans le document analysé. */
	target?: { from: number; to: number };
	/**
	 * Ce qui ne va pas, en une phrase : l'infobulle au survol. Écrit à la demande,
	 * car un seul passage à la fois est survolé.
	 */
	explain(): Explanation;
}

export interface DetectionInput {
	/** Le texte d'origine, dans lequel `tokens` donne des positions. */
	text: string;
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
