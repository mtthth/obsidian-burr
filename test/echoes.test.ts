import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/analyze.ts";
import { ECHO, REPETITION } from "../src/detectors/repetitions.ts";
import { french } from "../src/lang/fr/index.ts";
import { DEFAULT_SETTINGS, sanitizeSettings } from "../src/settings.ts";
import type { BurrSettings } from "../src/settings.ts";

/** N mots de remplissage tous différents (jusqu'à 17 576) : inconnus de la langue, donc rares, mais jamais répétés. */
function filler(count: number): string {
	const letter = (n: number) => String.fromCharCode(97 + (n % 26));
	return Array.from({ length: count }, (_, i) => `mot${letter(i)}${letter(Math.floor(i / 26))}${letter(Math.floor(i / 676))}x`).join(" ");
}

const run = (text: string, overrides: Partial<BurrSettings> = {}) => analyze(text, { ...DEFAULT_SETTINGS, ...overrides });

/** Les passages soulignés comme mots rares repris de loin, avec leur intensité. */
function echoes(text: string, overrides: Partial<BurrSettings> = {}): Array<[string, number]> {
	return run(text, overrides)
		.filter((h) => h.category === ECHO)
		.map((h) => [text.slice(h.from, h.to), h.intensity]);
}

test("le degré d'usage d'un mot vient de sa fréquence dans les livres", () => {
	const commonness = french.commonness as (word: string) => number;
	for (const [word, level] of [
		["fenêtre", 3],
		["maison", 3],
		["crépuscule", 2],
		["cathédrale", 2],
		["ineffable", 1],
		["glauque", 1],
		["chatoyant", 0],
		["palimpseste", 0],
		["motaaax", 0],
	] as const) {
		assert.equal(commonness(word), level, word);
	}
});

test("le degré d'usage vaut pour toute la famille, et les ligatures ne gênent pas", () => {
	const commonness = french.commonness as (word: string) => number;
	assert.equal(commonness("chatoyaient"), commonness("chatoyant"));
	assert.equal(commonness("cœur"), 3);
	assert.equal(commonness("œil"), 3);
	// « aujourd'hui », « quelqu'un » : le découpage en mots en fait deux morceaux, courants tous deux.
	for (const part of ["aujourd", "hui", "quelqu", "presqu"]) assert.equal(commonness(part), 3, part);
});

test("un mot rare repris de loin est souligné aux deux endroits, et rien d'autre", () => {
	const text = `Un reflet chatoyant. ${filler(500)} Un tissu chatoyant.`;
	assert.deepEqual(echoes(text), [
		["chatoyant", 3],
		["chatoyant", 3],
	]);
	assert.equal(run(text).length, 2);
});

test("un mot courant repris de loin n'est pas signalé", () => {
	assert.deepEqual(run(`La fenêtre. ${filler(500)} La fenêtre.`), []);
});

test("de près, c'est une répétition ordinaire, pas un écho", () => {
	const highlights = run("Un reflet chatoyant, un tissu chatoyant.");
	assert.deepEqual(
		highlights.map((h) => h.category),
		[REPETITION, REPETITION],
	);
});

test("un mot déjà surligné de près n'est pas souligné en plus ; le suivant, lointain, l'est", () => {
	const text = `Un reflet chatoyant, un tissu chatoyant. ${filler(500)} Un ciel chatoyant.`;
	const highlights = run(text);
	assert.deepEqual(
		highlights.map((h) => h.category),
		[REPETITION, REPETITION, ECHO],
	);
	assert.equal(highlights[2].explain().text, "« chatoyant », mot très rare, apparaît déjà 503 mots plus haut.");
	// Même mot, même famille, donc même couleur, qu'il soit surligné ou souligné.
	assert.equal(new Set(highlights.map((h) => h.family)).size, 1);
});

test("les plages ne se chevauchent jamais", () => {
	const text = `Un reflet chatoyant, un tissu chatoyant. Tout de même, un ciel glauque. ${filler(300)} Tout de même, un ciel glauque et chatoyant. ${filler(300)} Un palimpseste, un palimpseste.`;
	const highlights = run(text);
	assert.ok(highlights.some((h) => h.category === ECHO));
	for (let i = 1; i < highlights.length; i++) assert.ok(highlights[i - 1].to <= highlights[i].from);
});

test("l'infobulle dit où est l'autre emploi, milliers compris", () => {
	const text = `Un reflet chatoyant. ${filler(2000)} Un tissu chatoyant.`;
	assert.deepEqual(
		run(text).map((h) => h.explain().text),
		[
			"« chatoyant », mot très rare, revient 2\u202f003 mots plus loin.",
			"« chatoyant », mot très rare, apparaît déjà 2\u202f003 mots plus haut.",
		],
	);
});

test("deux formes d'un même mot rare se répondent, et l'infobulle les nomme", () => {
	const text = `Un reflet chatoyant. ${filler(300)} Les eaux chatoyaient.`;
	assert.deepEqual(
		run(text).map((h) => h.explain().text),
		[
			"« chatoyant », mot très rare, revient sous la forme « chatoyaient » 303 mots plus loin.",
			"« chatoyaient », mot très rare, reprend « chatoyant » 303 mots plus haut.",
		],
	);
	assert.deepEqual(echoes(text, { useStemming: false }), []);
});

test("le seuil de rareté est réglable, et plus le mot est rare, plus la vague est marquée", () => {
	const text = `Un glauque. Un crépuscule. Un palimpseste. ${filler(300)} Un glauque. Un crépuscule. Un palimpseste.`;
	assert.deepEqual(echoes(text, { echoRarity: 1 }), [
		["palimpseste", 3],
		["palimpseste", 3],
	]);
	assert.deepEqual(echoes(text, { echoRarity: 2 }), [
		["glauque", 2],
		["palimpseste", 3],
		["glauque", 2],
		["palimpseste", 3],
	]);
	assert.deepEqual(echoes(text, { echoRarity: 3 }), [
		["glauque", 2],
		["crépuscule", 1],
		["palimpseste", 3],
		["glauque", 2],
		["crépuscule", 1],
		["palimpseste", 3],
	]);
	assert.match(run(text, { echoRarity: 3 })[1].explain().text, /^« crépuscule », mot peu courant,/);
});

test("la portée est réglable ; 0, c'est tout le document", () => {
	const text = `Un reflet chatoyant. ${filler(1500)} Un tissu chatoyant.`;
	assert.deepEqual(echoes(text, { echoReach: 1000 }), []);
	assert.equal(echoes(text, { echoReach: 2000 }).length, 2);
	assert.equal(echoes(text, { echoReach: 0 }).length, 2);
});

test("noms propres, mots de l'utilisateur et réglage désactivé : rien n'est souligné", () => {
	const names = `Il salua le Cormoran. ${filler(300)} Il quitta le Cormoran.`;
	assert.deepEqual(echoes(names), []);
	assert.equal(echoes(names, { ignoreProperNames: false }).length, 2);

	const text = `Un reflet chatoyant. ${filler(300)} Un tissu chatoyant.`;
	assert.deepEqual(echoes(text, { extraIgnoredWords: "chatoyant" }), []);
	assert.deepEqual(echoes(text, { echoes: false }), []);
});

test("les réglages des mots rares sont bornés", () => {
	assert.equal(sanitizeSettings({ echoRarity: 7 }).echoRarity, 3);
	assert.equal(sanitizeSettings({ echoRarity: "x" as unknown as number }).echoRarity, DEFAULT_SETTINGS.echoRarity);
	assert.equal(sanitizeSettings({ echoReach: 1234 }).echoReach, DEFAULT_SETTINGS.echoReach);
	assert.equal(sanitizeSettings({ echoReach: "5000" as unknown as number }).echoReach, 5000);
	assert.equal(sanitizeSettings({}).echoes, true);
});
