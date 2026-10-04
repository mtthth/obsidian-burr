import type { Highlight } from "./detectors/index.ts";

/** Identifie un type de problème (catégorie et famille), d'une analyse à l'autre : ce que l'auteur ignore. */
export function problemKey(highlight: Highlight): string {
	return `${highlight.category}:${highlight.family}`;
}

/** Un problème : les passages qui se répondent (un mot répété, un paragraphe chargé en mots faibles), et sa gravité. */
export interface Problem {
	/** Identifie le problème d'une analyse à l'autre (catégorie et famille), pour pouvoir l'ignorer. */
	key: string;
	/** Somme du poids des passages (`Highlight.severity`) : de quoi classer les problèmes entre eux. */
	score: number;
	category: string;
	/** Les passages, dans l'ordre du texte. */
	spans: Array<{ from: number; to: number }>;
	/** Les mots concernés, sans doublon (« très », « assez »), dans l'ordre où ils apparaissent. */
	words: string[];
	/** Ce que dit l'infobulle du premier passage. */
	detail: string;
}

/** Plus de trois mots distincts : la liste ne dit plus rien, le détail suffit. */
const MAX_WORDS = 3;

/**
 * Regroupe les plages d'une analyse en problèmes et les classe du plus grave au moins grave.
 * Deux plages d'une même famille font partie du même problème quand l'une désigne l'autre
 * (`target`) : « regard » … « regard » … « regard » en est un seul. Sans cible, c'est `group` qui relie
 * (les mots faibles d'un même paragraphe), à défaut la plage est seule.
 * `highlights` est trié et sans chevauchement, comme le rend `analyze`.
 */
export function prioritize(text: string, highlights: readonly Highlight[]): Problem[] {
	const parent = highlights.map((_, i) => i);
	const find = (i: number): number => {
		while (parent[i] !== i) i = parent[i] = parent[parent[i]];
		return i;
	};
	const join = (a: number, b: number) => {
		parent[find(a)] = find(b);
	};

	// L'indice de la plage qui contient `position`, ou -1.
	const indexAt = (position: number): number => {
		let low = 0;
		let high = highlights.length;
		while (low < high) {
			const mid = (low + high) >> 1;
			if (highlights[mid].from <= position) low = mid + 1;
			else high = mid;
		}
		return low > 0 && highlights[low - 1].to > position ? low - 1 : -1;
	};

	const byGroup = new Map<string, number>();
	highlights.forEach((h, i) => {
		if (h.target) {
			const other = indexAt(h.target.from);
			if (other >= 0 && highlights[other].family === h.family) join(i, other);
		} else if (h.group !== undefined) {
			const first = byGroup.get(h.group);
			if (first === undefined) byGroup.set(h.group, i);
			else join(i, first);
		}
	});

	const problems = new Map<number, Problem & { first: number }>();
	highlights.forEach((h, i) => {
		const root = find(i);
		let problem = problems.get(root);
		if (!problem) {
			problem = { key: problemKey(h), score: 0, category: h.category, spans: [], words: [], detail: h.explain().text, first: h.from };
			problems.set(root, problem);
		}
		problem.score += h.severity;
		problem.spans.push({ from: h.from, to: h.to });
		const word = text.slice(h.from, h.to).toLowerCase();
		if (!problem.words.includes(word)) problem.words.push(word);
	});

	return [...problems.values()]
		.map(({ first: _first, ...problem }) => ({ ...problem, words: problem.words.length > MAX_WORDS ? [] : problem.words }))
		.sort((a, b) => b.score - a.score || a.spans[0].from - b.spans[0].from);
}
