import type { Language } from "../lang/types.ts";
import type { Token } from "../text/tokenize.ts";
import { normalizeText } from "../text/normalize.ts";

/** Une famille de mots faibles : une section de la note, avec sa couleur et son seuil. */
export interface WeakFamily {
	/** Identifiant stable tiré du titre (« adverbes-en-ment »). */
	id: string;
	/** Le titre de la section. */
	label: string;
	/** Occurrences par paragraphe à partir desquelles la famille est surlignée ; null : le réglage général. */
	threshold: number | null;
	/** Mots et expressions, minuscules NFC, tels qu'écrits dans la note. */
	entries: string[];
	/** Mots que `*suffixe` ne doit pas attraper. */
	exceptions: string[];
}

export interface Lexicon {
	families: WeakFamily[];
}

/** Les mots d'une entrée : lettres, chiffres, et les marques `@` (verbe) et `*` (terminaison). */
const ENTRY_WORD = /[@*]?[\p{L}\p{N}\p{M}]+/gu;
const FRONTMATTER = /^---[ \t]*\n[\s\S]*?\n(?:---|\.\.\.)[ \t]*(?:\n|$)/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const THRESHOLD = /\(\s*seuil\s*:?\s*(\d+)\s*\)/i;
const EXCEPTIONS = /^sauf\s*:/i;
const BULLET = /^[-*+]\s+/;

const clean = (item: string): string => item.trim().toLowerCase().normalize("NFC");

function slug(label: string): string {
	return label
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * Lit la note de mots faibles. Une section `##` par famille ; un titre `#` n'ouvre
 * pas de famille (c'est le titre de la note, et ce qui le suit est de l'explication).
 * Les lignes `>` sont des commentaires.
 */
export function parseLexicon(markdown: string): Lexicon {
	const text = normalizeText(markdown.replace(/\r\n?/g, "\n").replace(FRONTMATTER, ""));
	const families: WeakFamily[] = [];
	const used = new Set<string>();
	let current: WeakFamily | null = null;

	for (const raw of text.split("\n")) {
		const line = raw.trim();
		if (!line || line.startsWith(">")) continue;

		const heading = HEADING.exec(line);
		if (heading) {
			if (heading[1].length === 1) {
				current = null;
				continue;
			}
			const threshold = THRESHOLD.exec(heading[2]);
			const label = heading[2].replace(THRESHOLD, "").trim();
			let id = slug(label) || "famille";
			for (let n = 2; used.has(id); n++) id = `${slug(label) || "famille"}-${n}`;
			used.add(id);
			current = { id, label, threshold: threshold ? Math.max(1, Number(threshold[1])) : null, entries: [], exceptions: [] };
			families.push(current);
			continue;
		}
		if (!current) continue;

		const body = line.replace(BULLET, "");
		const isException = EXCEPTIONS.test(body);
		const items = (isException ? body.replace(EXCEPTIONS, "") : body)
			.split(/[,;]/)
			.map(clean)
			.filter(Boolean);
		(isException ? current.exceptions : current.entries).push(...items);
	}
	return { families: families.filter((family) => family.entries.length > 0) };
}

/** Le dictionnaire livré avec la langue : celui que l'on utilise tant que la note n'existe pas. */
export function defaultLexicon(language: Language): Lexicon {
	let lexicon = defaults.get(language);
	if (!lexicon) {
		lexicon = parseLexicon(language.weak?.template ?? "");
		defaults.set(language, lexicon);
	}
	return lexicon;
}
const defaults = new WeakMap<Language, Lexicon>();

/** Un mot d'une entrée : sa forme, et les mots du texte qu'elle attrape. */
interface Element {
	test(norm: string): boolean;
	/** Les formes exactes qu'elle attrape, pour l'index ; absent pour un motif (`*ment`). */
	keys?: readonly string[];
}

interface Entry {
	elements: readonly Element[];
	family: number;
	/** Une entrée de mots précis l'emporte, à longueur égale, sur un motif : « soudainement » sur `*ment`. */
	pattern: boolean;
}

export interface WeakMatch {
	/** Le nombre de mots couverts. */
	length: number;
	/** Rang de la famille dans le lexique. */
	family: number;
}

export interface WeakMatcher {
	/** La plus longue entrée qui commence au mot `index`, ou null. */
	match(tokens: readonly Token[], index: number): WeakMatch | null;
}

function compileEntry(source: string, family: number, exceptions: ReadonlySet<string>, language: Language): Entry | null {
	const elements: Element[] = [];
	let pattern = false;
	for (const word of source.match(ENTRY_WORD) ?? []) {
		if (word.startsWith("@")) {
			const infinitive = word.slice(1);
			const forms = language.weak?.verbForms(infinitive) ?? new Set([infinitive]);
			elements.push({ test: (norm) => forms.has(norm), keys: [...forms] });
		} else if (word.startsWith("*")) {
			const suffix = word.slice(1);
			pattern = true;
			// Au moins trois lettres avant la terminaison : « ment » seul, « dément »… ne sont pas des adverbes.
			elements.push({ test: (norm) => norm.length >= suffix.length + 3 && norm.endsWith(suffix) && !exceptions.has(norm) });
		} else {
			elements.push({ test: (norm) => norm === word, keys: [word] });
		}
	}
	return elements.length > 0 ? { elements, family, pattern } : null;
}

/** Prépare les entrées du lexique pour la recherche : un index par premier mot, les motifs à part. */
export function compileLexicon(lexicon: Lexicon, language: Language): WeakMatcher {
	const byFirst = new Map<string, Entry[]>();
	const wildcards: Entry[] = [];

	lexicon.families.forEach((family, rank) => {
		const exceptions = new Set(family.exceptions);
		for (const source of family.entries) {
			const entry = compileEntry(source, rank, exceptions, language);
			if (!entry) continue;
			const keys = entry.elements[0].keys;
			if (!keys) wildcards.push(entry);
			else {
				for (const key of keys) {
					const list = byFirst.get(key);
					if (list) list.push(entry);
					else byFirst.set(key, [entry]);
				}
			}
		}
	});

	return {
		match(tokens, index) {
			const first = tokens[index].norm;
			let best: WeakMatch | null = null;
			let bestScore = -1;
			let bestFamily = Infinity;
			const consider = (entry: Entry) => {
				const size = entry.elements.length;
				if (index + size > tokens.length) return;
				const segment = tokens[index].segment;
				for (let k = 0; k < size; k++) {
					if (tokens[index + k].segment !== segment || !entry.elements[k].test(tokens[index + k].norm)) return;
				}
				const score = size * 2 + (entry.pattern ? 0 : 1);
				if (score > bestScore || (score === bestScore && entry.family < bestFamily)) {
					best = { length: size, family: entry.family };
					bestScore = score;
					bestFamily = entry.family;
				}
			};
			byFirst.get(first)?.forEach(consider);
			wildcards.forEach(consider);
			return best;
		},
	};
}

const compiled = new WeakMap<Lexicon, { language: Language; matcher: WeakMatcher }>();

/** `compileLexicon`, mémorisé : le lexique ne change que lorsque la note est relue. */
export function matcherFor(lexicon: Lexicon, language: Language): WeakMatcher {
	let cached = compiled.get(lexicon);
	if (!cached || cached.language !== language) {
		cached = { language, matcher: compileLexicon(lexicon, language) };
		compiled.set(lexicon, cached);
	}
	return cached.matcher;
}
