import type { Highlight } from "./detectors/types.ts";

/** Nombre de couleurs de la palette (voir styles.css, classes `burr-color-N`). */
export const PALETTE_SIZE = 12;

/** Mémoire des couleurs déjà attribuées, d'une analyse à l'autre. */
export type ColorMemory = Map<string, number>;

/** Au-delà, on repart de zéro plutôt que de laisser la mémoire grossir sans fin. */
const MEMORY_LIMIT = 20_000;

interface Span {
	from: number;
	to: number;
}

/** Les plages déjà coloriées d'une couleur, triées par début (elles ne se chevauchent pas). */
class ColorLane {
	private spans: Span[] = [];

	/** Distance minimale entre les plages de cette couleur et l'une de `others` (Infinity si elle est libre). */
	distanceTo(others: readonly Span[]): number {
		let best = Infinity;
		for (const other of others) {
			// Premier indice dont le début dépasse celui de `other`.
			let low = 0;
			let high = this.spans.length;
			while (low < high) {
				const mid = (low + high) >> 1;
				if (this.spans[mid].from <= other.from) low = mid + 1;
				else high = mid;
			}
			if (low > 0) best = Math.min(best, other.from - this.spans[low - 1].to);
			if (low < this.spans.length) best = Math.min(best, this.spans[low].from - other.to);
		}
		return Math.max(best, 0);
	}

	add(spans: readonly Span[]): void {
		this.spans.push(...spans);
		this.spans.sort((a, b) => a.from - b.from);
	}
}

/**
 * Attribue une couleur (0 à PALETTE_SIZE - 1) à chaque plage, une par famille.
 * Chaque famille qui apparaît prend, parmi les couleurs, celle dont l'occurrence
 * la plus proche est la plus éloignée : deux familles voisines ne partagent une
 * couleur que si la palette est épuisée.
 *
 * `memory` rend l'attribution stable pendant la frappe : une famille déjà vue
 * garde sa couleur, quoi qu'il arrive autour d'elle, et seules les familles
 * nouvelles choisissent, autour de celles qui sont déjà placées. Sans cette
 * mémoire, ajouter une répétition au début du texte ferait changer de couleur
 * toutes les suivantes, à chaque frappe.
 */
export function assignColors(highlights: readonly Highlight[], memory: ColorMemory, size = PALETTE_SIZE): number[] {
	if (memory.size > MEMORY_LIMIT) memory.clear();

	// Les plages de chaque famille ; les familles se suivent dans l'ordre du texte.
	const families = new Map<string, Span[]>();
	for (const { family, from, to } of highlights) {
		const spans = families.get(family);
		if (spans) spans.push({ from, to });
		else families.set(family, [{ from, to }]);
	}

	const lanes = Array.from({ length: size }, () => new ColorLane());
	const colorOf = new Map<string, number>();
	const place = (family: string, spans: Span[], color: number) => {
		lanes[color].add(spans);
		colorOf.set(family, color);
		memory.set(family, color);
	};

	// 1. Les familles connues gardent leur couleur.
	const fresh: string[] = [];
	for (const [family, spans] of families) {
		const remembered = memory.get(family);
		if (remembered !== undefined && remembered < size) place(family, spans, remembered);
		else fresh.push(family);
	}

	// 2. Les nouvelles, dans l'ordre du texte : la couleur la plus éloignée, à égalité la première.
	for (const family of fresh) {
		const spans = families.get(family) as Span[];
		let color = 0;
		let farthest = -1;
		for (let c = 0; c < size; c++) {
			const distance = lanes[c].distanceTo(spans);
			if (distance > farthest) {
				farthest = distance;
				color = c;
			}
		}
		place(family, spans, color);
	}

	return highlights.map((highlight) => colorOf.get(highlight.family) as number);
}
