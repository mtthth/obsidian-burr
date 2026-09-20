/**
 * Apostrophes typographiques (’ ‘ ʼ), espace insécable (U+00A0), insécable
 * fine (U+202F), espace figure (U+2007) et espace fine (U+2009).
 */
const TYPOGRAPHIC = /[‘’ʼ    ]/g;

function replacement(char: string): string {
	return char === "‘" || char === "’" || char === "ʼ" ? "'" : " ";
}

/**
 * Ramène la typographie soignée à des caractères simples pour que « tout de
 * même » ou « n'y » se reconnaissent quelle que soit la façon dont ils sont
 * composés.
 *
 * Contrat : le résultat a exactement la longueur du texte d'origine, chaque
 * caractère étant remplacé par un seul autre. Un décalage d'un caractère ferait
 * dériver tous les surlignages : ne jamais supprimer ni ajouter de caractère ici
 * (pas de « œ » -> « oe », pas de NFC sur le texte entier).
 */
export function normalizeText(text: string): string {
	return text.replace(TYPOGRAPHIC, replacement);
}
