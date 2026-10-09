import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/analyze.ts";
import { WEAK } from "../src/detectors/weak.ts";
import { french } from "../src/lang/fr/index.ts";
import { DEFAULT_SETTINGS, markdownPath } from "../src/settings.ts";
import type { BurrSettings } from "../src/settings.ts";
import { defaultLexicon, followRenames, parseLexicon } from "../src/weak/lexicon.ts";

/** Sans répétitions : un mot répété de près est surligné comme tel, et cède la place (voir le test dédié). */
const ALONE: Partial<BurrSettings> = { enabled: false, echoes: false };

/** Les passages signalés comme mots faibles, avec leur famille (sans le préfixe). */
function weak(text: string, overrides: Partial<BurrSettings> = {}, note?: string): Array<[string, string]> {
	const lexicon = note === undefined ? undefined : parseLexicon(note);
	return analyze(text, { ...DEFAULT_SETTINGS, ...ALONE, ...overrides }, lexicon)
		.filter((h) => h.category === WEAK)
		.map((h) => [text.slice(h.from, h.to), h.family.replace(/^faible:/, "")]);
}

const passages = (text: string, overrides: Partial<BurrSettings> = {}, note?: string) => weak(text, overrides, note).map(([p]) => p);

test("la note se lit par sections, seuils, exceptions et commentaires", () => {
	const lexicon = parseLexicon(`---
tags: [burr-ignorer]
---
# Titre

Une explication qui n'est pas une famille.

## Intensifs (seuil 2)
très, assez
- plutôt
> un commentaire

## Adverbes
*ment
sauf: moment, logement

## Vide
`);
	assert.deepEqual(
		lexicon.families.map((f) => [f.id, f.label, f.threshold, f.entries, f.exceptions]),
		[
			["intensifs", "Intensifs", 2, ["très", "assez", "plutôt"], []],
			["adverbes", "Adverbes", null, ["*ment"], ["moment", "logement"]],
		],
	);
});

test("dans la note, un bloc de code, du code en ligne ou un commentaire ne donnent pas de mots", () => {
	const note = "## Intensifs\n\ntrès, `exemple`\n\n```\nfaux, code\n```\n\n%% brouillon, essai %%\nassez\n";
	assert.deepEqual(parseLexicon(note).families[0].entries, ["très", "assez"]);
});

test("le dictionnaire par défaut a ses cinq familles", () => {
	assert.deepEqual(
		defaultLexicon(french).families.map((f) => f.id),
		["intensifs-et-attenuateurs", "adverbes-en-ment", "verbes-ternes", "mots-vagues", "bequilles-narratives"],
	);
});

test("un intensif isolé passe, trois dans un paragraphe se voient", () => {
	assert.deepEqual(passages("Il était très fatigué."), []);
	assert.deepEqual(passages("Il était très fatigué, assez triste et plutôt seul."), ["très", "assez", "plutôt"]);
});

test("le seuil se compte par paragraphe", () => {
	const text = "Très bien, très beau.\nAssez, plutôt.\nTrès fort.";
	assert.deepEqual(passages(text, { weakThreshold: 2 }), ["Très", "très", "Assez", "plutôt"]);
	assert.equal(passages(text, { weakThreshold: 1 }).length, 5);
});

test("un paragraphe coupé à la main reste un paragraphe ; une ligne blanche, un titre, une réplique ou une liste le ferment", () => {
	// Retours à la ligne au milieu d'une phrase : un seul paragraphe.
	assert.equal(passages("Il était très las,\ntrès fatigué,\ntrès vieux.").length, 3);
	// Un commentaire sur deux lignes ne coupe pas le paragraphe.
	assert.equal(passages("Il était très las %% note\nsur deux lignes %% et très vieux, très seul.").length, 3);
	for (const text of [
		"Il était très las, très vieux\n\ntrès seul.",
		"# Un très bon titre\nTrès las, très vieux",
		"Il était très las\n— Très vieux, très seul",
		"- très las\n- très vieux\n- très seul",
		"Il était très las\n```\ncode\n```\ntrès vieux, très seul",
	]) {
		assert.deepEqual(passages(text), [], text);
	}
});

test("la famille compte, pas le mot : trois intensifs différents suffisent", () => {
	assert.equal(passages("très, assez, presque.").length, 3);
});

test("une expression l'emporte sur le mot qu'elle contient", () => {
	assert.deepEqual(passages("Quelque chose, une chose, un truc.", { weakThreshold: 1 }), ["Quelque chose", "chose", "truc"]);
	assert.deepEqual(passages("Il regarda un peu, puis un peu encore, un peu plus.", { weakThreshold: 1 }), ["un peu", "puis", "un peu", "un peu"]);
});

test("les adverbes en -ment : le motif attrape, les exceptions et les noms échappent", () => {
	assert.deepEqual(passages("Il marcha lentement, parla doucement, sourit calmement."), ["lentement", "doucement", "calmement"]);
	// Des noms en -ment : la liste « sauf » de la note.
	assert.deepEqual(passages("Ce moment, ce logement, ce vêtement, ce document.", { weakThreshold: 1 }), []);
	// Un mot précis de la note l'emporte sur le motif : « vraiment » est un intensif, « soudainement » une béquille.
	assert.deepEqual(
		weak("Vraiment, lentement, doucement, calmement, soudainement.", { weakThreshold: 1 }).map(([, family]) => family),
		["intensifs-et-attenuateurs", "adverbes-en-ment", "adverbes-en-ment", "adverbes-en-ment", "bequilles-narratives"],
	);
});

test("les verbes ternes : toutes les formes, et les expressions dont un mot se conjugue", () => {
	const text = "Il faisait, elle fit, ils feront, nous faisons, vous faites, il a fait.";
	assert.deepEqual(passages(text, { weakThreshold: 1 }, "## V\n@faire"), ["faisait", "fit", "feront", "faisons", "faites", "fait"]);
	assert.deepEqual(
		passages("Il commençait à rire, elle commença à pleurer, je commence à comprendre.", { weakThreshold: 1 }, "## V\n@commencer à"),
		["commençait à", "commença à", "commence à"],
	);
	assert.deepEqual(passages("Il se mit à courir, il se met à rire.", { weakThreshold: 1 }, "## V\nse @mettre à"), ["se mit à", "se met à"]);
	// Pas de stemmer ici : un nom qui ressemble au verbe n'est pas signalé.
	assert.deepEqual(passages("Le commencement de la fin.", { weakThreshold: 1 }, "## V\n@commencer"), []);
});

test("être et avoir se conjuguent", () => {
	const text = "Il est parti, elle avait fui, nous serons là, ils ont su.";
	assert.deepEqual(passages(text, { weakThreshold: 1 }, "## A\n@être, @avoir"), ["est", "avait", "serons", "ont"]);
});

test("un verbe en -er garde ses cédilles et ses e : commençons, mangeais", () => {
	assert.deepEqual(
		passages("Nous commençons, il commençait, ils mangeaient, nous mangeons.", { weakThreshold: 1 }, "## V\n@commencer, @manger"),
		["commençons", "commençait", "mangeaient", "mangeons"],
	);
});

test("une expression ne traverse pas la ponctuation forte", () => {
	assert.deepEqual(passages("Tout. À coup, il tomba.", { weakThreshold: 1 }), []);
	assert.deepEqual(passages("Tout à coup, il tomba.", { weakThreshold: 1 }), ["Tout à coup"]);
	assert.deepEqual(passages("Il l'a fait peut-être trop tôt.", { weakThreshold: 1 }), ["peut-être", "trop"]);
});

test("l'apostrophe typographique et l'espace insécable ne changent rien", () => {
	assert.deepEqual(passages("Tout d’un coup, un peu.", { weakThreshold: 1 }), ["Tout d’un coup", "un peu"]);
});

test("un seuil propre à la famille l'emporte sur le réglage", () => {
	assert.deepEqual(passages("très, assez.", { weakThreshold: 3 }, "## A (seuil 1)\ntrès\n## B\nassez"), ["très"]);
});

test("une famille se désactive sans toucher aux autres", () => {
	const text = "très, assez, presque, lentement, doucement, calmement.";
	assert.equal(passages(text).length, 6);
	assert.deepEqual(passages(text, { weakDisabled: ["adverbes-en-ment"] }), ["très", "assez", "presque"]);
	assert.deepEqual(passages(text, { weakWords: false }), []);
});

test("un mot déjà surligné comme répétition n'est pas signalé en plus", () => {
	const text = "Il fut vraiment content, vraiment ému, très, assez, presque.";
	const found = analyze(text, DEFAULT_SETTINGS);
	for (const a of found) {
		for (const b of found) assert.ok(a === b || a.to <= b.from || b.to <= a.from, "pas de chevauchement");
	}
	const categories = found.map((h) => [text.slice(h.from, h.to), h.category]);
	assert.deepEqual(categories.filter(([word]) => word === "vraiment").map(([, category]) => category), ["repetition", "repetition"]);
	assert.deepEqual(categories.filter(([, category]) => category === WEAK).map(([word]) => word), ["très", "assez", "presque"]);
});

test("les dialogues s'écartent en option, comme pour les répétitions", () => {
	const text = "— Très bien, assez, presque.\nIl dit très, assez, presque.";
	assert.equal(passages(text).length, 6);
	assert.equal(passages(text, { ignoreDialogue: true }).length, 3);
});

test("une couleur fixe par famille, dans l'ordre de la note, et une infobulle", () => {
	const found = analyze("très, assez, presque, lentement, doucement, calmement.", { ...DEFAULT_SETTINGS, ...ALONE }).filter((h) => h.category === WEAK);
	assert.equal(new Set(found.slice(0, 3).map((h) => h.color)).size, 1);
	assert.notEqual(found[0].color, found[3].color);
	assert.equal(found[0].explain().text, "« très » — Intensifs et atténuateurs : 3 dans ce paragraphe.");
});

test("l'intensité suit l'accumulation", () => {
	const level = (count: number) =>
		analyze(Array(count).fill("très").join(" mais "), { ...DEFAULT_SETTINGS, ...ALONE }).find((h) => h.category === WEAK)?.intensity;
	assert.deepEqual([3, 4, 6].map(level), [1, 2, 3]);
});

test("une note sans famille ne signale rien", () => {
	assert.deepEqual(passages("très, assez, presque.", {}, ""), []);
});

test("le chemin de la note prend l'extension .md quand elle manque", () => {
	assert.equal(markdownPath("mots-faibles"), "mots-faibles.md");
	assert.equal(markdownPath("Notes/v1.2/mots"), "Notes/v1.2/mots.md");
	assert.equal(markdownPath("Notes/mots-faibles.md"), "Notes/mots-faibles.md");
	assert.equal(markdownPath("Notes/Mots-faibles.MD"), "Notes/Mots-faibles.MD");
});

test("une section renommée reste désactivée ; une section ajoutée, retirée ou déplacée ne vole rien", () => {
	const before = parseLexicon("## Intensifs\n\ntrès\n\n## Mots vagues\n\nchose\n\n## Béquilles\n\npuis\n");
	const renamed = parseLexicon("## Intensifs\n\ntrès\n\n## Mots flous\n\nchose\n\n## Béquilles\n\npuis\n");
	assert.deepEqual(followRenames(["mots-vagues", "bequilles"], before, renamed), ["mots-flous", "bequilles"]);

	// Une section ajoutée en tête décale les autres, qui existent toujours : rien ne change.
	const added = parseLexicon("## Nouvelle\n\nmachin\n\n## Intensifs\n\ntrès\n\n## Mots vagues\n\nchose\n");
	assert.deepEqual(followRenames(["intensifs", "mots-vagues"], before, added), ["intensifs", "mots-vagues"]);

	// Une section retirée : celle qui prend son rang existait déjà, elle n'hérite pas de l'interrupteur.
	const removed = parseLexicon("## Intensifs\n\ntrès\n\n## Béquilles\n\npuis\n");
	assert.deepEqual(followRenames(["mots-vagues"], before, removed), ["mots-vagues"]);
});
