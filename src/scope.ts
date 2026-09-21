import type { BurrSettings } from "./settings.ts";

/** Balise à mettre dans le YAML d'une note pour que Burr la laisse de côté. */
export const IGNORE_TAG = "burr-ignorer";

/** Pourquoi une note n'est pas analysée : sa balise (retirable d'un clic) ou les réglages de dossiers. */
export type Exclusion = "tag" | "folder";

type Frontmatter = Record<string, unknown>;

/** Les propriétés où Obsidian lit les balises d'une note. */
const TAG_KEYS = ["tags", "tag"] as const;

/** Un dossier par ligne -> chemins sans barre initiale ni finale, en minuscules NFC. */
export function parseFolderList(text: string): string[] {
	return text
		.split(/\r?\n/)
		.map((line) =>
			line
				.trim()
				.replace(/\\/g, "/")
				.replace(/\/{2,}/g, "/")
				.replace(/^(\.\/)+/, "")
				.replace(/^\/+|\/+$/g, "")
				.trim()
				.normalize("NFC")
				.toLowerCase(),
		)
		.filter(Boolean);
}

const inFolder = (path: string, folder: string): boolean => path.startsWith(`${folder}/`);

/** Les balises d'une propriété : une liste, ou un texte (« a, b » ; « #a #b »), sans « # », en minuscules. */
function tagsOf(value: unknown): string[] {
	const items = Array.isArray(value) ? value : [value];
	return items
		.flatMap((item) => (typeof item === "string" ? item.split(/[\s,]+/) : []))
		.map((tag) => tag.replace(/^#/, "").toLowerCase())
		.filter(Boolean);
}

/** La note porte-t-elle la balise d'exclusion dans son YAML ? */
export function hasIgnoreTag(frontmatter: Frontmatter | null | undefined): boolean {
	return TAG_KEYS.some((key) => tagsOf(frontmatter?.[key]).includes(IGNORE_TAG));
}

/**
 * Ajoute la balise au YAML, sans toucher aux balises déjà présentes. On écrit toujours
 * dans `tags` : `tag` est l'ancienne clé, qu'Obsidian migre vers `tags` depuis la 1.4.
 */
export function addIgnoreTag(frontmatter: Frontmatter): void {
	if (hasIgnoreTag(frontmatter)) return;
	const existing = frontmatter.tags;
	const kept = Array.isArray(existing) ? existing : typeof existing === "string" ? existing.split(/[\s,]+/).filter(Boolean) : [];
	frontmatter.tags = [...kept, IGNORE_TAG];
}

/** Retire la balise du YAML, et la propriété si elle n'a plus rien d'autre. */
export function removeIgnoreTag(frontmatter: Frontmatter): void {
	for (const key of TAG_KEYS) {
		const value = frontmatter[key];
		if (!tagsOf(value).includes(IGNORE_TAG)) continue;
		const items: unknown[] = Array.isArray(value) ? value : String(value).split(/[\s,]+/).filter(Boolean);
		const rest = items.filter((item) => typeof item !== "string" || item.replace(/^#/, "").toLowerCase() !== IGNORE_TAG);
		if (rest.length > 0) frontmatter[key] = rest;
		else delete frontmatter[key];
	}
}

/**
 * Une note est laissée de côté si son YAML porte la balise, si elle est dans un dossier
 * à ignorer, ou si des dossiers à analyser sont donnés et qu'elle n'est dans aucun.
 * Ignorer l'emporte sur analyser : `Roman` analysé, `Roman/Brouillons` ignoré.
 */
export function exclusionOf(
	path: string,
	frontmatter: Frontmatter | null | undefined,
	scope: Pick<BurrSettings, "includedFolders" | "excludedFolders">,
): Exclusion | null {
	if (hasIgnoreTag(frontmatter)) return "tag";
	const key = path.normalize("NFC").toLowerCase();
	if (parseFolderList(scope.excludedFolders).some((folder) => inFolder(key, folder))) return "folder";
	const included = parseFolderList(scope.includedFolders);
	if (included.length > 0 && !included.some((folder) => inFolder(key, folder))) return "folder";
	return null;
}
