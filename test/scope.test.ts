import assert from "node:assert/strict";
import { test } from "node:test";
import { IGNORE_TAG, addIgnoreTag, exclusionOf, hasIgnoreTag, parseFolderList, removeIgnoreTag } from "../src/scope.ts";
import { DEFAULT_SETTINGS, sanitizeSettings } from "../src/settings.ts";

const scope = (includedFolders = "", excludedFolders = "") => ({ includedFolders, excludedFolders });

test("une liste de dossiers : un par ligne, sans barres, sans casse", () => {
	assert.deepEqual(parseFolderList("Roman\n /Roman/Brouillons/ \r\n\n.\\Notes\\Vrac\n// Éléonore //"), [
		"roman",
		"roman/brouillons",
		"notes/vrac",
		"éléonore",
	]);
	assert.deepEqual(parseFolderList(""), []);
});

test("sans réglage, aucune note n'est écartée", () => {
	assert.equal(exclusionOf("Roman/Chapitre 1.md", {}, scope()), null);
	assert.equal(exclusionOf("Note.md", undefined, scope()), null);
});

test("un dossier à ignorer écarte ses notes et leurs sous-dossiers, pas les dossiers voisins", () => {
	const s = scope("", "Roman/Brouillons");
	assert.equal(exclusionOf("Roman/Brouillons/a.md", null, s), "folder");
	assert.equal(exclusionOf("Roman/Brouillons/vieux/a.md", null, s), "folder");
	assert.equal(exclusionOf("Roman/Brouillons 2/a.md", null, s), null);
	assert.equal(exclusionOf("Roman/a.md", null, s), null);
	assert.equal(exclusionOf("Brouillons/a.md", null, s), null);
});

test("des dossiers à analyser écartent tout le reste, et Note.md à la racine avec", () => {
	const s = scope("Roman\nNouvelles", "");
	assert.equal(exclusionOf("Roman/a.md", null, s), null);
	assert.equal(exclusionOf("Nouvelles/2024/a.md", null, s), null);
	assert.equal(exclusionOf("Journal/a.md", null, s), "folder");
	assert.equal(exclusionOf("Romance/a.md", null, s), "folder");
	assert.equal(exclusionOf("Note.md", null, s), "folder");
});

test("ignorer l'emporte sur analyser", () => {
	const s = scope("Roman", "Roman/Brouillons");
	assert.equal(exclusionOf("Roman/a.md", null, s), null);
	assert.equal(exclusionOf("Roman/Brouillons/a.md", null, s), "folder");
});

test("les dossiers se comparent sans tenir compte des majuscules", () => {
	assert.equal(exclusionOf("Roman/a.md", null, scope("", "roman")), "folder");
	assert.equal(exclusionOf("roman/a.md", null, scope("ROMAN", "")), null);
});

test("la balise du YAML écarte la note, sous toutes les formes de la propriété", () => {
	for (const tags of [
		[IGNORE_TAG],
		["autre", `#${IGNORE_TAG}`],
		IGNORE_TAG,
		`autre, ${IGNORE_TAG}`,
		`#autre #${IGNORE_TAG}`,
		["BURR-Ignorer"],
	]) {
		assert.equal(exclusionOf("a.md", { tags }, scope()), "tag", JSON.stringify(tags));
	}
	assert.equal(exclusionOf("a.md", { tag: IGNORE_TAG }, scope()), "tag");
	for (const tags of [undefined, null, "", [], ["autre"], "burr", ["burr-ignorer-pas"], 2024, [{ a: 1 }]]) {
		assert.equal(hasIgnoreTag({ tags }), false, JSON.stringify(tags));
	}
});

test("la balise passe avant les dossiers : c'est elle qu'on peut retirer", () => {
	assert.equal(exclusionOf("Roman/a.md", { tags: [IGNORE_TAG] }, scope("", "Roman")), "tag");
});

test("ajouter la balise garde les autres, sans doublon", () => {
	const none: Record<string, unknown> = { titre: "x" };
	addIgnoreTag(none);
	assert.deepEqual(none, { titre: "x", tags: [IGNORE_TAG] });

	const list: Record<string, unknown> = { tags: ["roman", "brouillon"] };
	addIgnoreTag(list);
	assert.deepEqual(list.tags, ["roman", "brouillon", IGNORE_TAG]);

	const text: Record<string, unknown> = { tags: "roman, brouillon" };
	addIgnoreTag(text);
	assert.deepEqual(text.tags, ["roman", "brouillon", IGNORE_TAG]);

	const empty: Record<string, unknown> = { tags: null };
	addIgnoreTag(empty);
	assert.deepEqual(empty.tags, [IGNORE_TAG]);

	const twice: Record<string, unknown> = { tags: [`#${IGNORE_TAG}`] };
	addIgnoreTag(twice);
	assert.deepEqual(twice.tags, [`#${IGNORE_TAG}`]);
});

test("retirer la balise garde les autres, et supprime la propriété quand elle est vide", () => {
	const list: Record<string, unknown> = { tags: ["roman", IGNORE_TAG, "brouillon"] };
	removeIgnoreTag(list);
	assert.deepEqual(list.tags, ["roman", "brouillon"]);

	const alone: Record<string, unknown> = { titre: "x", tags: [`#${IGNORE_TAG}`] };
	removeIgnoreTag(alone);
	assert.deepEqual(alone, { titre: "x" });

	const text: Record<string, unknown> = { tags: `roman ${IGNORE_TAG}` };
	removeIgnoreTag(text);
	assert.deepEqual(text.tags, ["roman"]);

	const single: Record<string, unknown> = { tag: IGNORE_TAG, tags: ["roman"] };
	removeIgnoreTag(single);
	assert.deepEqual(single, { tags: ["roman"] });

	const untouched: Record<string, unknown> = { tags: "roman" };
	removeIgnoreTag(untouched);
	assert.deepEqual(untouched, { tags: "roman" });
});

test("ajouter puis retirer rend le YAML tel qu'il était", () => {
	const frontmatter: Record<string, unknown> = { tags: ["roman"] };
	addIgnoreTag(frontmatter);
	assert.equal(hasIgnoreTag(frontmatter), true);
	removeIgnoreTag(frontmatter);
	assert.deepEqual(frontmatter, { tags: ["roman"] });
});

test("les réglages anciens ou abîmés reçoivent des dossiers vides", () => {
	assert.equal(sanitizeSettings({}).includedFolders, "");
	assert.equal(sanitizeSettings({ excludedFolders: null as unknown as string }).excludedFolders, "");
	assert.equal(sanitizeSettings({ excludedFolders: "Roman" }).excludedFolders, "Roman");
	assert.deepEqual({ ...DEFAULT_SETTINGS }, sanitizeSettings(null));
});
