import { normalizeText } from "./normalize.ts";
import { WORD } from "./tokenize.ts";
import type { Token } from "./tokenize.ts";

/** Une entrée de plusieurs mots (« aujourd'hui », « peut-être ») : ses mots, et sa forme écrite. */
interface Compound {
	parts: string[];
	written: string;
}

/** Une liste de mots de l'auteur, prête à être cherchée dans le texte. */
export interface WordList {
	/** Les entrées d'un seul mot. */
	words: Set<string>;
	/** Les entrées de plusieurs mots, par premier mot. */
	compounds: Map<string, Compound[]>;
}

/** Minuscules NFC, typographie ramenée à des caractères simples : la forme de comparaison des mots du texte. */
const clean = (text: string): string => normalizeText(text).toLowerCase().normalize("NFC");

/**
 * « mot, autre mot » ou un mot par ligne. Une entrée est découpée comme le texte :
 * « aujourd'hui » donne « aujourd » et « hui », qui devront s'y suivre, séparés
 * par le même signe (« peut-être » n'attrape pas « il peut être là »).
 */
export function parseWordList(text: string): WordList {
	const list: WordList = { words: new Set(), compounds: new Map() };
	for (const item of text.split(/[\s,;]+/)) {
		const entry = clean(item);
		const matches = [...entry.matchAll(WORD)];
		if (matches.length === 0) continue;
		if (matches.length === 1) {
			list.words.add(matches[0][0]);
			continue;
		}
		const last = matches[matches.length - 1];
		const compound = {
			parts: matches.map((match) => match[0]),
			written: entry.slice(matches[0].index as number, (last.index as number) + last[0].length),
		};
		const known = list.compounds.get(compound.parts[0]);
		if (known) known.push(compound);
		else list.compounds.set(compound.parts[0], [compound]);
	}
	return list;
}

/** Les mots du texte que la liste désigne : 1 pour chacun, 0 pour les autres. */
export function listedTokens(text: string, tokens: readonly Token[], list: WordList): Uint8Array {
	const listed = new Uint8Array(tokens.length);
	for (let i = 0; i < tokens.length; i++) {
		if (list.words.has(tokens[i].norm)) listed[i] = 1;
		for (const { parts, written } of list.compounds.get(tokens[i].norm) ?? []) {
			const last = i + parts.length - 1;
			if (last >= tokens.length) continue;
			if (!parts.every((part, k) => tokens[i + k].norm === part)) continue;
			if (clean(text.slice(tokens[i].from, tokens[last].to)) !== written) continue;
			listed.fill(1, i, last + 1);
		}
	}
	return listed;
}
