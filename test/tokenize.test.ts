import assert from "node:assert/strict";
import { test } from "node:test";
import { french } from "../src/lang/fr/index.ts";
import { resolveLanguage } from "../src/lang/index.ts";
import { normalizeText } from "../src/text/normalize.ts";
import { tokenize } from "../src/text/tokenize.ts";

const tokens = (text: string, ignoreDialogue = false) => tokenize(text, french, { ignoreDialogue });

test("la normalisation garde la longueur du texte", () => {
	const text = "L’homme : « tout de même ! » l’œil ʼ";
	const normalized = normalizeText(text);
	assert.equal(normalized.length, text.length);
	assert.equal(normalized, "L'homme : « tout de même ! » l'œil '");
});

test("les positions des mots renvoient au texte d'origine", () => {
	const text = "L’été : Éléonore n’osa pas — même à l’aube.";
	for (const token of tokens(text)) {
		assert.equal(text.slice(token.from, token.to).toLowerCase(), token.norm);
	}
	assert.deepEqual(
		tokens(text).map((t) => t.norm),
		["l", "été", "éléonore", "n", "osa", "pas", "même", "à", "l", "aube"],
	);
});

test("une lettre accentuée ne coupe pas un mot", () => {
	assert.deepEqual(tokens("déjà crûmes œuvre").map((t) => t.norm), ["déjà", "crûmes", "œuvre"]);
});

test("frontmatter, code et liens ne sont pas de la prose", () => {
	const text = [
		"---",
		"titre: secret",
		"---",
		"Un mot `code` puis [le lien](http://exemple.fr/chemin) et %%note%% fin.",
		"```js",
		"const caché = 1;",
		"```",
		"Après.",
	].join("\n");
	const norms = tokens(text).map((t) => t.norm);
	assert.deepEqual(norms, ["un", "mot", "puis", "le", "lien", "et", "fin", "après"]);
});

test("un frontmatter jamais refermé n'efface pas le document", () => {
	const norms = tokens("---\nUn texte\n```\ncode\n```\nSuite").map((t) => t.norm);
	assert.deepEqual(norms, ["un", "texte", "suite"]);
});

test("les dialogues ne sont écartés que sur demande", () => {
	const text = "— Bonjour, dit-il.\nIl sortit « vite » ici.";
	assert.deepEqual(tokens(text).map((t) => t.norm), ["bonjour", "dit", "il", "il", "sortit", "vite", "ici"]);
	assert.deepEqual(tokens(text, true).map((t) => t.norm), ["il", "sortit", "ici"]);
});

test("la ponctuation forte et les zones ignorées coupent les segments", () => {
	const [a, b, c, d, e] = tokens("Un deux, trois. Quatre `x` cinq");
	assert.equal(a.segment, b.segment);
	assert.equal(b.segment, c.segment); // la virgule ne coupe pas
	assert.notEqual(c.segment, d.segment); // le point coupe
	assert.notEqual(d.segment, e.segment); // le code coupe
});

test("un mot ouvre une phrase après une ponctuation forte ou une ouverture de réplique", () => {
	const t = tokens("Il dit : Marie viendra. Et « Paul » aussi, avec Léa.");
	const byNorm = Object.fromEntries(t.map((x) => [x.norm, x]));
	assert.equal(byNorm.il.sentenceStart, true);
	assert.equal(byNorm.marie.sentenceStart, true);
	assert.equal(byNorm.paul.sentenceStart, true);
	assert.equal(byNorm.léa.sentenceStart, false);
	assert.equal(byNorm.léa.capitalized, true);
});

test("la langue d'un document est le français, pour l'instant", () => {
	assert.equal(resolveLanguage({ text: "" }).id, "fr");
	assert.equal(resolveLanguage({ text: "The cat sat on the mat." }).id, "fr");
});
