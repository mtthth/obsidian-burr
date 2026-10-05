import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/analyze.ts";
import { OPENING } from "../src/detectors/openings.ts";
import { DEFAULT_SETTINGS } from "../src/settings.ts";
import type { BurrSettings } from "../src/settings.ts";

/** Seuls les débuts répétés : les autres détecteurs ne se mêlent pas des mots. */
const ALONE: Partial<BurrSettings> = { enabled: false, echoes: false, weakWords: false };

/** Les passages signalés comme débuts répétés, avec leur famille. */
function openings(text: string, overrides: Partial<BurrSettings> = {}): Array<[string, string]> {
	return analyze(text, { ...DEFAULT_SETTINGS, ...ALONE, ...overrides })
		.filter((h) => h.category === OPENING)
		.map((h) => [text.slice(h.from, h.to), h.family]);
}

const passages = (text: string, overrides: Partial<BurrSettings> = {}) => openings(text, overrides).map(([p]) => p);

test("trois phrases sur cinq du même début : seul le premier mot est signalé", () => {
	const text = "Il ouvrit la porte. Il entra. Marie sourit. Il s'assit. La pluie tombait.";
	assert.deepEqual(passages(text), ["Il", "Il", "Il"]);
});

test("il, elle et on comptent pour un seul mot", () => {
	const text = "Il ouvrit la porte. Elle entra. La nuit tombait. On s'assit. Marie sourit.";
	assert.deepEqual(passages(text), ["Il", "Elle", "On"]);
});

test("deux phrases ne suffisent pas, ni trois trop éloignées", () => {
	assert.deepEqual(passages("Il ouvrit. Elle entra. La nuit tombait. Marie sourit."), []);
	// Troisième emploi à la sixième phrase : hors de la fenêtre de cinq.
	assert.deepEqual(passages("Il ouvrit. Marie sourit. La nuit tombait. Le vent soufflait. Pierre partit. Il entra. Elle rit."), []);
});

test("la série se prolonge d'un triplet à l'autre", () => {
	const text = "Il ouvrit. Marie sourit. Il entra. La nuit tombait. Il s'assit. Pierre partit. Il rit.";
	assert.deepEqual(passages(text), ["Il", "Il", "Il", "Il"]);
});

test("un autre mot n'est pas du groupe", () => {
	const text = "Soudain, la porte claqua. Soudain, Marie cria. Soudain, tout changea.";
	assert.deepEqual(openings(text), [
		["Soudain", "phrase:soudain"],
		["Soudain", "phrase:soudain"],
		["Soudain", "phrase:soudain"],
	]);
});

test("les mots d'un groupe partagent une famille", () => {
	const text = "Il ouvrit. Elle entra. On s'assit.";
	assert.deepEqual(openings(text).map(([, family]) => family), ["phrase:#sujet", "phrase:#sujet", "phrase:#sujet"]);
});

test("J'ai et Je sont le même début, comme L'homme et La femme", () => {
	assert.deepEqual(passages("J'ouvris. Je criai. Marie sourit. J'entrai."), ["J", "Je", "J"]);
	assert.deepEqual(passages("L'homme partit. La femme resta. Les enfants jouaient."), ["L", "La", "Les"]);
});

test("une minuscule après un point n'ouvre pas une phrase, ni l'abréviation « M. »", () => {
	// Coupé après « M. » ou « Mme », « Dupont » ouvrirait trois phrases ; ce sont des noms dans la phrase.
	assert.deepEqual(passages("Il vit Mme Dupont. Il vit M. Dupont. Marie sourit. Dupont rit."), []);
	assert.deepEqual(passages("Il vit M. Dupont. Il entra. Il rit."), ["Il", "Il", "Il"]);
});

test("les phrases se séparent sur . ! ? et …", () => {
	assert.deepEqual(passages("Il partit! Il revint? Il hésita… Marie rit."), ["Il", "Il", "Il"]);
});

test("un deux-points ou une virgule ne finit pas la phrase", () => {
	assert.deepEqual(passages("Il dit : Il faut partir, Il le savait. Marie sourit."), []);
});

test("trois paragraphes de prose de suite du même début", () => {
	const text = "Il ouvrit la porte.\n\nIl entra.\n\nElle sourit.\n";
	assert.deepEqual(openings(text), [
		["Il", "paragraphe:#sujet"],
		["Il", "paragraphe:#sujet"],
		["Elle", "paragraphe:#sujet"],
	]);
});

test("deux paragraphes ne suffisent pas", () => {
	assert.deepEqual(openings("Il ouvrit.\n\nIl entra.\n\nLa nuit tombait.\n"), []);
});

test("un début de paragraphe n'est pas signalé deux fois", () => {
	const text = "Il ouvrit la porte. Marie sourit.\n\nIl entra. La nuit tombait.\n\nIl s'assit. Pierre partit.\n";
	const found = openings(text);
	assert.equal(found.length, 3);
	assert.ok(found.every(([, family]) => family.startsWith("paragraphe:")));
});

test("les répliques ne comptent pas dans les paragraphes et ne coupent pas la série", () => {
	const text = "Il ouvrit la porte.\n\n— Entrez, dit-elle.\n\nIl entra.\n\n— Merci.\n\nIl sourit.\n";
	assert.deepEqual(
		openings(text).map(([, family]) => family),
		["paragraphe:#sujet", "paragraphe:#sujet", "paragraphe:#sujet"],
	);
});

test("un titre ou une séparation de scène coupe la série de paragraphes", () => {
	assert.deepEqual(openings("Il ouvrit.\n\nIl entra.\n\n## Chapitre\n\nIl sourit.\n"), []);
	assert.deepEqual(openings("Il ouvrit.\n\nIl entra.\n\n***\n\nIl sourit.\n"), []);
});

test("un titre n'est pas un début de phrase, une liste non plus", () => {
	assert.deepEqual(openings("# Il pleut\n\n- Il vient\n- Il part\n- Il revient\n"), []);
});

test("une série de phrases ne passe pas au-dessus d'un titre", () => {
	assert.deepEqual(openings("Il ouvrit. Il entra.\n\n## Suite\n\nIl sourit. Marie rit."), []);
});

test("le frontmatter et le code sont ignorés", () => {
	assert.deepEqual(openings("---\ntitre: Il\n---\nIl ouvrit. Marie sourit.\n```\nIl a. Il b. Il c.\n```\n"), []);
});

test("l'option « Ignorer les dialogues » retire les répliques des phrases", () => {
	const text = "— Il vient. Il part. Il revient.\n\nMarie sourit.\n";
	assert.equal(passages(text).length, 3);
	assert.deepEqual(passages(text, { ignoreDialogue: true }), []);
});

test("le réglage désactive le détecteur", () => {
	assert.deepEqual(passages("Il ouvrit. Il entra. Il sourit.", { openings: false }), []);
});

test("l'infobulle dit combien de phrases, sur combien, et par quels mots", () => {
	const text = "Il ouvrit la porte. Elle entra. Marie sourit. Il s'assit. La pluie tombait.";
	const [first] = analyze(text, { ...DEFAULT_SETTINGS, ...ALONE }).filter((h) => h.category === OPENING);
	assert.equal(first.explain().text, "3 phrases sur 4 commencent par « il » ou « elle ».");
});

test("l'infobulle d'un paragraphe", () => {
	const [first] = analyze("Il ouvrit.\n\nIl entra.\n\nIl sourit.\n", { ...DEFAULT_SETTINGS, ...ALONE });
	assert.equal(first.explain().text, "3 paragraphes de suite commencent par « il ».");
});

test("une série est un seul problème, sans cible", () => {
	const highlights = analyze("Il ouvrit. Elle entra. On s'assit.", { ...DEFAULT_SETTINGS, ...ALONE });
	assert.equal(new Set(highlights.map((h) => h.group)).size, 1);
	assert.ok(highlights.every((h) => h.target === undefined));
});

test("deux séries éloignées du même début sont deux problèmes", () => {
	const filler = " Marie sourit. Pierre rit. La nuit tombait. Le vent soufflait. Un oiseau chanta. Tout changea.";
	const text = `Il ouvrit. Il entra. Il sourit.${filler} Il partit. Il revint. Il rit.`;
	const highlights = analyze(text, { ...DEFAULT_SETTINGS, ...ALONE });
	assert.equal(highlights.length, 6);
	assert.equal(new Set(highlights.map((h) => h.group)).size, 2);
});
