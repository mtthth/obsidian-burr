import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/analyze.ts";
import { DEFAULT_SETTINGS } from "../src/settings.ts";

/** Chaque passage surligné, avec le passage lié de son infobulle et le texte de sa cible. */
function links(text: string): Array<[passage: string, link: string, target: string]> {
	return analyze(text, DEFAULT_SETTINGS).map((h) => {
		const { text: sentence, link } = h.explain();
		assert.ok(link && h.target, "chaque infobulle a un lien et une cible");
		return [text.slice(h.from, h.to), sentence.slice(link[0], link[1]), text.slice(h.target.from, h.target.to)];
	});
}

test("le lien d'une répétition mène à l'autre occurrence du mot", () => {
	const text = "Il ouvrit la porte. La porte grinça.";
	assert.deepEqual(links(text), [
		["porte", "2 mots plus loin", "porte"],
		["porte", "2 mots plus haut", "porte"],
	]);
	const [first, second] = analyze(text, DEFAULT_SETTINGS);
	assert.deepEqual(first.target, { from: second.from, to: second.to });
	assert.deepEqual(second.target, { from: first.from, to: first.to });
});

test("le lien d'une expression mène à toute l'autre expression", () => {
	assert.deepEqual(links("Il mangea tout de même la soupe. Elle but tout de même le vin."), [
		["tout de même", "7 mots plus loin", "tout de même"],
		["tout de même", "7 mots plus haut", "tout de même"],
	]);
});

test("le lien d'une forme voisine mène à l'autre forme", () => {
	assert.deepEqual(links("Il regardait la mer. Elle regarda le ciel."), [
		["regardait", "4 mots plus loin", "regarda"],
		["regarda", "4 mots plus haut", "regardait"],
	]);
});

test("le lien d'un mot rare repris de loin mène à l'autre emploi", () => {
	const filler = Array.from({ length: 300 }, (_, i) => `mot${i.toString(36)}x`).join(" ");
	assert.deepEqual(links(`Un reflet chatoyant. ${filler} Les eaux chatoyaient.`), [
		["chatoyant", "303 mots plus loin", "chatoyaient"],
		["chatoyaient", "303 mots plus haut", "chatoyant"],
	]);
});

test("le passage lié est toujours la distance, et la cible toujours un passage surligné", () => {
	const text =
		"Il regardait la mer, tout de même. Elle regarda le ciel, tout de même, et la mer encore. " +
		"Nous irons demain ; vous allez au marché. Une porte porte close.";
	const highlights = analyze(text, DEFAULT_SETTINGS);
	assert.ok(highlights.length > 4);
	for (const h of highlights) {
		const { text: sentence, link } = h.explain();
		assert.ok(link && h.target);
		assert.match(sentence.slice(link[0], link[1]), /^(juste (avant|après)|\d+ mots plus (haut|loin))$/);
		const target = h.target;
		assert.ok(
			highlights.some((other) => other !== h && other.from <= target.from && target.to <= other.to),
			`la cible de « ${text.slice(h.from, h.to)} » est surlignée`,
		);
	}
});
