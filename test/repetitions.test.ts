import assert from "node:assert/strict";
import { test } from "node:test";
import { analyze } from "../src/analyze.ts";
import { DEFAULT_SETTINGS } from "../src/settings.ts";
import { explanations, families, highlighted, words } from "./helpers.ts";

/** N mots de remplissage sans aucune répétition (vocabulaire de 400 mots distincts). */
function filler(count: number): string {
	return Array.from({ length: count }, (_, i) => `mot${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + (Math.floor(i / 26) % 26))}x`).join(" ");
}

test("un mot répété de près est surligné aux deux endroits, au maximum", () => {
	assert.deepEqual(highlighted("Il ouvrit la porte. La porte grinça."), [
		["porte", 3],
		["porte", 3],
	]);
});

test("l'intensité baisse avec la distance et la répétition disparaît hors fenêtre", () => {
	const near = highlighted(`Un chien. ${filler(10)} Un chien.`);
	const middle = highlighted(`Un chien. ${filler(30)} Un chien.`);
	const far = highlighted(`Un chien. ${filler(70)} Un chien.`);
	assert.deepEqual(near.map((h) => h[1]), [3, 3]);
	assert.deepEqual(middle.map((h) => h[1]), [2, 2]);
	assert.deepEqual(far.map((h) => h[1]), [1, 1]);
	assert.deepEqual(highlighted(`Un chien. ${filler(100)} Un chien.`), []);
});

test("la fenêtre est réglable", () => {
	const text = `Un chien. ${filler(100)} Un chien.`;
	assert.deepEqual(words(text, { window: 150 }), ["chien", "chien"]);
	assert.deepEqual(words(text, { window: 50 }), []);
});

test("les mots-outils et les mots très courts ne sont jamais signalés", () => {
	assert.deepEqual(words("Le chat et le chien dans le jardin, avec le vent et la pluie de l'été."), []);
	assert.deepEqual(words("Il a vu la mer. Elle est là. Il a pris un roi."), []);
});

test("les formes d'« être » et d'« avoir » sont des mots-outils", () => {
	assert.deepEqual(words("Il était fatigué. Elle était partie. Ils avaient faim, elles avaient soif."), []);
});

test("les noms propres ne sont pas des répétitions", () => {
	const text = "Alors Marie sourit. Marie regarda Marie.";
	assert.deepEqual(words(text), []);
	assert.deepEqual(words(text, { ignoreProperNames: false }), ["Marie", "Marie", "Marie"]);
});

test("une majuscule de début de phrase ne fait pas un nom propre", () => {
	assert.deepEqual(words("Maison vide. Maison sombre."), ["Maison", "Maison"]);
});

test("les mots à ignorer de l'utilisateur sont respectés, sur plusieurs lignes ou séparés par des virgules", () => {
	const text = "Un fauteuil, un fauteuil, une table, une table.";
	assert.deepEqual(words(text), ["fauteuil", "fauteuil", "table", "table"]);
	assert.deepEqual(words(text, { extraIgnoredWords: "fauteuil\nTable" }), []);
	assert.deepEqual(words(text, { extraIgnoredWords: "fauteuil, table" }), []);
});

test("les formes d'un même mot sont rapprochées, plus discrètement", () => {
	const text = "Il regardait la mer. Elle regarda le ciel.";
	assert.deepEqual(highlighted(text), [
		["regardait", 2],
		["regarda", 2],
	]);
	assert.deepEqual(words(text, { useStemming: false }), []);
});

test("une même forme l'emporte sur le simple rapprochement", () => {
	const [first] = highlighted("Il regardait la mer. Elle regardait le ciel.");
	assert.equal(first[1], 3);
});

test("une expression répétée est surlignée d'un bloc", () => {
	const text = "Il mangea tout de même la soupe. Elle but tout de même le vin.";
	assert.deepEqual(words(text), ["tout de même", "tout de même"]);
	assert.deepEqual(words(text, { maxNgram: 1 }), []);
});

test("la plus longue expression l'emporte sur les mots qu'elle contient", () => {
	const text = "Il n’y avait pas un souffle ce soir. Il n’y avait pas la moindre brise.";
	assert.deepEqual(words(text), ["Il n’y avait pas", "Il n’y avait pas"]);
	assert.deepEqual(words(text, { maxNgram: 3 }), ["Il n’y avait pas", "Il n’y avait pas"]);
	// Des paires de mots-outils ne font pas une expression.
	assert.deepEqual(words(text, { maxNgram: 2 }), []);
});

test("une expression ne traverse pas la ponctuation forte", () => {
	// « vieux pont » n'apparaît qu'une fois d'un seul tenant : « vieux. Pont » est coupé.
	assert.deepEqual(words("Un vieux. Pont sombre, un vieux pont."), ["vieux", "Pont", "vieux", "pont"]);
});

test("la paire « article + mot » n'est pas une expression, mais le mot reste signalé", () => {
	assert.deepEqual(words("Il ferma la porte. Elle rouvrit la porte."), ["porte", "porte"]);
});

test("les positions résistent aux apostrophes et espaces typographiques", () => {
	const text = "L’homme entra : le lion ! Le lion rugit, l’homme recula.";
	assert.deepEqual(words(text), ["homme", "lion", "lion", "homme"]);
});

test("le code, le frontmatter et les liens sont laissés de côté", () => {
	const text = ["---", "titre: porte porte", "---", "```", "porte porte", "```", "Une `porte` dans [la porte](porte.md).", "Une porte."].join("\n");
	assert.deepEqual(words(text), ["porte", "porte"]); // « la porte » du lien et « Une porte. » restent
});

test("les dialogues sont écartés sur demande", () => {
	const text = "— Maison, dit-il.\n— Maison, dit-elle.\nLe vent.";
	assert.deepEqual(words(text), ["Maison, dit", "Maison, dit"]);
	assert.deepEqual(words(text, { ignoreDialogue: true }), []);
});

test("les plages rendues sont triées et ne se chevauchent pas", () => {
	const text = "Il regardait la porte, la porte close, et regarda encore la porte close de la maison, la maison vide.";
	const ranges = analyze(text, DEFAULT_SETTINGS);
	assert.ok(ranges.length > 0);
	for (let i = 1; i < ranges.length; i++) {
		assert.ok(ranges[i].from >= ranges[i - 1].to, `chevauchement entre ${i - 1} et ${i}`);
	}
});

test("chaque mot répété forme sa propre famille", () => {
	const text = "La porte grinça ; la fenêtre claqua ; la porte céda ; la fenêtre vola.";
	const byFamily = new Map<string, string[]>();
	for (const [passage, family] of families(text)) byFamily.set(family, [...(byFamily.get(family) ?? []), passage]);
	assert.equal(byFamily.size, 2);
	assert.deepEqual([...byFamily.values()].map((passages) => passages.length), [2, 2]);
});

test("les formes d'un même mot appartiennent à la même famille, sauf sans stemming", () => {
	const text = "Il regardait la mer. Elle regarda le ciel. Il regardait encore.";
	assert.equal(new Set(families(text).map(([, family]) => family)).size, 1);
	// Sans stemming, « regarda » n'est plus rapproché : « regardait » reste seul dans sa famille.
	assert.deepEqual(families(text, { useStemming: false }).map(([passage]) => passage), ["regardait", "regardait"]);
});

test("une expression répétée a sa famille, distincte de celle des mots qu'elle contient", () => {
	const text = "Tout de même, le vin. Le vin est bon. Tout de même, la soupe.";
	const found = families(text);
	const phrase = found.filter(([passage]) => passage === "Tout de même");
	assert.equal(phrase.length, 2);
	assert.equal(phrase[0][1], phrase[1][1]);
	assert.notEqual(phrase[0][1], found.find(([passage]) => passage === "vin")?.[1]);
});

test("l'infobulle d'un mot répété dit où est l'autre occurrence", () => {
	assert.deepEqual(explanations(`Un chien. ${filler(10)} Un chien.`), [
		["chien", "« chien » revient 12 mots plus loin."],
		["chien", "« chien » apparaît déjà 12 mots plus haut."],
	]);
	assert.deepEqual(explanations("Une porte porte close."), [["porte", "« porte » revient juste après."], ["porte", "« porte » apparaît déjà juste avant."]]);
});

test("l'infobulle d'un mot au milieu d'une série parle de l'occurrence la plus proche", () => {
	const text = `Un chien. ${filler(30)} Un chien. ombre lueur brume sable Un chien.`;
	const [first, middle, last] = explanations(text).map(([, message]) => message);
	assert.equal(first, "« chien » revient 32 mots plus loin.");
	assert.equal(middle, "« chien » revient 6 mots plus loin.");
	assert.equal(last, "« chien » apparaît déjà 6 mots plus haut.");
});

test("l'infobulle d'une autre forme du même mot nomme l'autre forme", () => {
	assert.deepEqual(explanations("Il regardait la mer. Elle regarda le ciel."), [
		["regardait", "« regardait » a la même racine que « regarda » (4 mots plus loin)."],
		["regarda", "« regarda » a la même racine que « regardait » (4 mots plus haut)."],
	]);
});

test("l'infobulle d'une expression la cite en entier", () => {
	assert.deepEqual(explanations("Il mangea tout de même la soupe. Elle but tout de même le vin."), [
		["tout de même", "L'expression « tout de même » revient 7 mots plus loin."],
		["tout de même", "L'expression « tout de même » apparaît déjà 7 mots plus haut."],
	]);
});

test("un texte vide ou sans mots ne plante pas", () => {
	assert.deepEqual(highlighted(""), []);
	assert.deepEqual(highlighted("...  ---  \n\n"), []);
});
