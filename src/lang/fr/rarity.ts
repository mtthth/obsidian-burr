import type { Commonness } from "../types.ts";
import { COMMON_STEMS } from "./frequencies.ts";

/** Le degré d'usage de chaque racine courante, construit au premier besoin : le chargement du plugin n'attend pas. */
let levels: Map<string, Commonness> | null = null;

function commonStems(): Map<string, Commonness> {
	if (!levels) {
		levels = new Map();
		COMMON_STEMS.forEach((band, index) => {
			const level = (index + 1) as Commonness;
			for (const stem of band.split(/\s+/)) if (stem) levels?.set(stem, level);
		});
	}
	return levels;
}

/** Lexique écrit « coeur », « oeil » : on défait les ligatures avant de chercher un mot. */
export function unligate(word: string): string {
	return word.replace(/œ/g, "oe").replace(/æ/g, "ae");
}

/** Degré d'usage d'une racine Snowball (d'un mot sans ligature) : 0 si elle n'est pas dans la liste. */
export function commonnessOfStem(stem: string): Commonness {
	return commonStems().get(stem) ?? 0;
}
