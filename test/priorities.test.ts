import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze, noteProblems } from "../src/analyze.ts";
import { NOTHING_IGNORED } from "../src/ignore.ts";
import { formatRank, prioritize } from "../src/priorities.ts";
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
	const left = analyze(text, DEFAULT_SETTINGS, undefined, { keys: new Set([chat.key]), passages: [] });
	assert.ok(left.length > 0 && left.length < all.length);
	assert.ok(left.every((h) => !text.slice(h.from, h.to).toLowerCase().includes("chat")));
});

// Two clusters of « trame », far enough apart (filler words) to be two problems.
const filler = Array.from({ length: 120 }, (_, i) => `mot${i}`).join(" ");
const twoClusters = `La trame avance. La trame recule. ${filler}. Une trame revient. Cette trame encore.`;
const tramesIn = (text: string, ignored = NOTHING_IGNORED) =>
	analyze(text, DEFAULT_SETTINGS, undefined, ignored).filter((h) => text.slice(h.from, h.to).toLowerCase() === "trame");

test("ignorer un problème à cet endroit laisse le même mot répété ailleurs signalé", () => {
	const clusters = problems(twoClusters).filter((p) => p.words.includes("trame"));
	assert.equal(clusters.length, 2);
	const first = clusters.find((p) => p.spans[0].from < 20);
	assert.ok(first);
	const left = tramesIn(twoClusters, { keys: new Set(), passages: [{ key: first.key, anchors: first.anchors }] });
	assert.equal(left.length, 2);
	assert.ok(left.every((h) => h.from > first.spans[1].to));
});

test("un passage ignoré le reste quand le texte change ailleurs", () => {
	const first = problems(twoClusters).find((p) => p.words.includes("trame") && p.spans[0].from < 20);
	assert.ok(first);
	const ignored = { keys: new Set<string>(), passages: [{ key: first.key, anchors: first.anchors }] };
	const edited = `Un paragraphe ajouté en tête.

${twoClusters.replace("Une trame revient", "Une trame revient enfin")}`;
	assert.equal(tramesIn(edited, ignored).length, 2);
});

test("une occurrence tapée près de passages ignorés reste signalée", () => {
	const text = "La trame avance. La trame recule.";
	const [problem] = problems(text);
	const ignored = { keys: new Set<string>(), passages: [{ key: problem.key, anchors: problem.anchors }] };
	assert.equal(tramesIn(text, ignored).length, 0);
	assert.equal(tramesIn(`${text} Puis la trame tourne.`, ignored).length, 1);
});

test("les problèmes écartés sont rendus à part, avec leur portée", () => {
	const text = "Le chat dort. Le chat mange. La porte claque. La porte claque encore.";
	const [chat, porte] = ["chat", "porte"].map((w) => problems(text).find((p) => p.words.some((x) => x.includes(w))));
	assert.ok(chat && porte);
	const { active, ignored } = noteProblems(text, DEFAULT_SETTINGS, undefined, {
		keys: new Set([chat.key]),
		passages: [{ key: porte.key, anchors: porte.anchors }],
	});
	assert.deepEqual(ignored.map((p) => [p.key, p.scope]).sort(), [[chat.key, "note"], [porte.key, "passage"]].sort());
	assert.ok(active.every((p) => p.key !== chat.key && p.key !== porte.key));
});

test("le rang s'écrit à la française", () => {
	assert.deepEqual([1, 2, 41].map(formatRank), ["1er", "2e", "41e"]);
});
