import assert from "node:assert/strict";
import { test } from "node:test";
import { PALETTE_SIZE, assignColors } from "../src/colors.ts";
import type { ColorMemory } from "../src/colors.ts";
import type { Highlight } from "../src/detectors/types.ts";

/** Une plage à `from`, de la famille `family`. */
const at = (from: number, family: string): Highlight => ({ from, to: from + 5, category: "repetition", family, intensity: 3, explain: () => ({ text: "" }) });

test("les occurrences d'une même famille ont la même couleur", () => {
	const colors = assignColors([at(0, "porte"), at(20, "fenêtre"), at(40, "porte"), at(60, "fenêtre")], new Map());
	assert.equal(colors[0], colors[2]);
	assert.equal(colors[1], colors[3]);
	assert.notEqual(colors[0], colors[1]);
});

test("les familles visibles en même temps ont des couleurs différentes", () => {
	const highlights = Array.from({ length: PALETTE_SIZE }, (_, i) => at(i * 100, `mot${i}`));
	const colors = assignColors(highlights, new Map());
	assert.equal(new Set(colors).size, PALETTE_SIZE);
});

test("les couleurs se réutilisent une fois les familles éloignées", () => {
	// Plus de familles que de couleurs, mais espacées de 10 000 caractères : aucun conflit possible.
	const highlights = Array.from({ length: PALETTE_SIZE * 2 }, (_, i) => at(i * 10_000, `mot${i}`));
	const colors = assignColors(highlights, new Map());
	assert.ok(colors.every((c) => c >= 0 && c < PALETTE_SIZE));
	assert.ok(new Set(colors).size < highlights.length);
});

test("avec plus de familles proches que de couleurs, la palette reste respectée", () => {
	const highlights = Array.from({ length: PALETTE_SIZE * 2 }, (_, i) => at(i * 50, `mot${i}`));
	const colors = assignColors(highlights, new Map());
	assert.ok(colors.every((c) => c >= 0 && c < PALETTE_SIZE));
	// Les huit premières sont toutes distinctes ; les suivantes reprennent la moins récente.
	assert.equal(new Set(colors.slice(0, PALETTE_SIZE)).size, PALETTE_SIZE);
	assert.deepEqual(colors.slice(PALETTE_SIZE), colors.slice(0, PALETTE_SIZE));
});

test("ajouter une famille en tête ne change pas la couleur des autres", () => {
	const memory: ColorMemory = new Map();
	const before = [at(1000, "porte"), at(1100, "fenêtre"), at(1200, "porte"), at(1300, "lampe"), at(1400, "fenêtre")];
	const colorsBefore = assignColors(before, memory);

	const after = [at(0, "nouveau"), at(50, "nouveau"), ...before];
	const colorsAfter = assignColors(after, memory);

	assert.deepEqual(colorsAfter.slice(2), colorsBefore);
	// « nouveau » prend une couleur qui n'est utilisée par aucune de ses voisines.
	assert.ok(!colorsBefore.includes(colorsAfter[0]));
	assert.equal(colorsAfter[0], colorsAfter[1]);
});

test("une famille déjà vue garde sa couleur, une nouvelle en prend une libre", () => {
	// « a » a déjà la couleur 2 ; « b », nouvelle et placée avant elle dans le texte, ne la lui prend pas.
	const memory: ColorMemory = new Map([["a", 2]]);
	const [colorOfB, colorOfA] = assignColors([at(0, "b"), at(100, "a")], memory);
	assert.equal(colorOfA, 2);
	assert.notEqual(colorOfB, 2);
});

test("l'attribution est stable d'une analyse à l'autre, même quand la palette est épuisée", () => {
	const highlights = Array.from({ length: PALETTE_SIZE * 3 }, (_, i) => at(i * 40, `mot${i}`));
	const memory: ColorMemory = new Map();
	const first = assignColors(highlights, memory);
	assert.deepEqual(assignColors(highlights, memory), first);
	assert.deepEqual(assignColors(highlights, memory), first);
});

test("une plage sans famille connue reçoit quand même une couleur valide", () => {
	assert.deepEqual(assignColors([], new Map()), []);
	assert.deepEqual(assignColors([at(0, "")], new Map()), [0]);
});
