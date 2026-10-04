import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/analyze.ts";
import { prioritize } from "../src/priorities.ts";
import { DEFAULT_SETTINGS } from "../src/settings.ts";

const problems = (text: string) => prioritize(text, analyze(text, DEFAULT_SETTINGS));

test("un mot répété trois fois de près est un seul problème, avec ses trois passages", () => {
	const text = "Le chat regarde la fenêtre. Le chat dort. Puis le chat part.";
	const found = problems(text).filter((p) => p.words.includes("chat"));
	assert.equal(found.length, 1);
	assert.equal(found[0].spans.length, 3);
});

test("les problèmes sont classés du plus grave au moins grave", () => {
	const text = "Il s'assit sur la chaise. Il s'assit sur la chaise. Il était très fatigué, très las et très triste.";
	const scores = problems(text).map((p) => p.score);
	assert.ok(scores.length >= 2);
	assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
});

test("une expression répétée pèse plus qu'un mot isolé répété à la même distance", () => {
	const phrase = problems("Elle ouvrit la porte du jardin. Puis elle ferma la porte du jardin.").find((p) => p.words.some((w) => w.includes("porte du")));
	const word = problems("Elle ouvrit la porte. Puis elle ferma la porte.").find((p) => p.words.includes("porte"));
	assert.ok(phrase && word);
	assert.ok(phrase.score > word.score);
});

test("les mots faibles d'un même paragraphe forment un problème, un autre paragraphe un autre", () => {
	const text = "Il était très las, très las, très las.\n\nElle était très gaie, très gaie, très gaie.";
	const weak = prioritize(text, analyze(text, { ...DEFAULT_SETTINGS, enabled: false, echoes: false })).filter((p) => p.category === "weak");
	assert.equal(weak.length, 2);
});

test("un texte sans signal ne donne aucun problème", () => {
	assert.deepEqual(problems("Le soleil se lève sur la mer."), []);
});

test("la clé d'un problème tient d'une analyse à l'autre, même si le texte autour change", () => {
	const keys = (text: string) => problems(text).map((p) => p.key);
	const before = keys("Le chat dort. Le chat mange.");
	const after = keys("Un mot de plus pour décaler. Le chat dort. Le chat mange.");
	assert.deepEqual(before, after);
	assert.ok(before.length > 0);
});

test("ignorer un type de problème le retire de l'analyse, et lui seul", () => {
	const text = "Le chat dort. Le chat mange. La porte claque. La porte claque encore.";
	const all = analyze(text, DEFAULT_SETTINGS);
	const chat = problems(text).find((p) => p.words.includes("chat"));
	assert.ok(chat);
	const left = analyze(text, DEFAULT_SETTINGS, undefined, new Set([chat.key]));
	assert.ok(left.length > 0 && left.length < all.length);
	assert.ok(left.every((h) => !text.slice(h.from, h.to).toLowerCase().includes("chat")));
});
