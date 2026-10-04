import type { Language } from "../lang/types.ts";
import type { BurrSettings } from "../settings.ts";
import type { Token } from "../text/tokenize.ts";
import type { Lexicon } from "../weak/lexicon.ts";

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
	/**
	 * Le poids de ce passage dans la gravité du problème auquel il appartient (voir `priorities.ts`) :
	 * plus il est élevé, plus le lecteur le remarquera. Échelle commune à tous les détecteurs :
	 * une répétition marquée pèse 4 à 8, un écho 1 à 3, un mot faible 0,5 à 1,5.
	 */
	severity: number;
	/**
	 * Le problème auquel appartient le passage, quand aucune cible ne le relie aux autres
	 * (des mots faibles d'un même paragraphe). Les passages qui ont une cible se regroupent par elle.
	 */
	group?: string;
	/** Couleur imposée (0 à PALETTE_SIZE - 1), quand la famille a toujours la même ; sinon elle est attribuée. */
	color?: number;
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
	/** Les mots faibles de l'auteur (sa note), ou ceux de la langue. */
	lexicon: Lexicon;
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
