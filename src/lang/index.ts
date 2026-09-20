import { french } from "./fr/index.ts";
import type { Language } from "./types.ts";

export type { Language } from "./types.ts";

/** Langues disponibles. Une seule pour l'instant. */
export const LANGUAGES: readonly Language[] = [french];

/** Ce que l'on sait d'un document quand on cherche sa langue. */
export interface DocumentContext {
	text: string;
}

/**
 * Langue d'un document (une langue par document). Pour l'instant, tout est
 * du français et rien n'est sélectionnable ; c'est ici que viendra plus tard
 * la lecture d'une propriété `lang` du frontmatter, ou d'un réglage par dossier.
 */
export function resolveLanguage(_doc: DocumentContext): Language {
	return french;
}
