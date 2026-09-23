import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { stemFrench } from "../src/lang/fr/stemmer.ts";

// Racines produites par l'implémentation de référence de Snowball (paquet Python
// snowballstemmer 3.1.1), pour des mots choisis dans la prose littéraire. La plupart
// sont aussi dans le vocabulaire officiel, plus bas ; pas tous (« cœur », « balais »).
const REFERENCE: Array<[string, string]> = [
	["regardait", "regard"],
	["regarda", "regard"],
	["regardant", "regard"],
	["regardèrent", "regard"],
	["regarder", "regard"],
	["sourire", "sourir"],
	["sourit", "sour"],
	["souriait", "souri"],
	["tellement", "tel"],
	["continuellement", "continuel"],
	["heureusement", "heureux"],
	["main", "main"],
	["mains", "main"],
	["yeux", "yeux"],
	["œil", "œil"],
	["cœur", "cœur"],
	["nationalité", "national"],
	["nationalisme", "national"],
	["anciennement", "ancien"],
	["chevaux", "cheval"],
	["bijoux", "bijou"],
	["choux", "chou"],
	["balais", "balais"],
	["mauvais", "mauvais"],
	["déplais", "déplais"],
	["palais", "palais"],
	["voyage", "voyag"],
	["voyageur", "voyageur"],
	["envoyer", "envoi"],
	["payer", "pai"],
	["quoique", "quoiqu"],
	["équipe", "équip"],
	["aiguille", "aiguill"],
	["vieille", "vieil"],
	["vieillesse", "vieilless"],
	["tapis", "tapis"],
	["colis", "colis"],
	["paris", "paris"],
	["parie", "pari"],
	["niais", "niais"],
	["nierais", "nier"],
	["joyeux", "joyeux"],
	["joyeuse", "joyeux"],
	["joie", "joi"],
	["naïve", "naïv"],
	["naïvement", "naïv"],
	["aiguë", "aigu"],
	["ambiguë", "ambigu"],
	["maison", "maison"],
	["maisons", "maison"],
	["maisonnette", "maisonnet"],
	["conquérant", "conquer"],
	["conquête", "conquêt"],
	["abaissement", "abaissement"],
	["abaissai", "abaiss"],
	["abaisserai", "abaiss"],
	["fabrication", "fabriqu"],
	["fabricateur", "fabriqu"],
	["logique", "logiqu"],
	["logiquement", "logiqu"],
	["fatalité", "fatal"],
	["fatal", "fatal"],
	["actif", "actif"],
	["active", "activ"],
	["activement", "activ"],
	["finissaient", "fin"],
	["finirent", "fin"],
	["finissons", "fin"],
	["chantaient", "chant"],
	["chantons", "chanton"],
	["chante", "chant"],
	["chanteuse", "chanteux"],
	["chanteur", "chanteur"],
	["amoureusement", "amour"],
	["amoureux", "amour"],
	["amour", "amour"],
	["pommes", "pomm"],
	["pomme", "pomm"],
	["pommier", "pommi"],
	["fermeté", "fermet"],
	["fermement", "ferm"],
	["question", "question"],
	["questionner", "question"],
	["qui", "qui"],
	["quel", "quel"],
	["quelle", "quel"],
	["quoi", "quoi"],
	["aujourd", "aujourd"],
];

test("le stemmer français donne les mêmes racines que Snowball", () => {
	for (const [word, stem] of REFERENCE) {
		assert.equal(stemFrench(word), stem, word);
	}
});

/** Les lignes d'un fichier de data/snowball-data/french/, copie du vocabulaire de test officiel de Snowball. */
function snowballData(name: string): string[] {
	const text = readFileSync(new URL(`../data/snowball-data/french/${name}`, import.meta.url), "utf8");
	return text.split(/\r?\n/).filter(Boolean);
}

test("le stemmer donne les racines du vocabulaire de test officiel de Snowball", () => {
	const words = snowballData("voc.txt");
	const stems = snowballData("output.txt");
	assert.equal(words.length, stems.length);
	assert.ok(words.length > 20000, `vocabulaire tronqué : ${words.length} mots`);
	const mismatches: string[] = [];
	words.forEach((word, i) => {
		// Le port laisse la routine « elisions » au tokenizer (« l'homme » -> « homme ») :
		// on la refait ici, telle que la décrit french.sbl.
		const stem = stemFrench(word.replace(/^(?:[cdjlmnstz]|qu)'(?=.)/, ""));
		if (stem !== stems[i]) mismatches.push(`${word} : ${stem} au lieu de ${stems[i]}`);
	});
	assert.deepEqual(mismatches.slice(0, 20), [], `${mismatches.length} écarts`);
});

test("les formes d'un même verbe se rapprochent", () => {
	const stems = new Set(["regardait", "regarda", "regardant", "regarder"].map(stemFrench));
	assert.equal(stems.size, 1);
});

test("un mot vide ou très court ne fait pas planter", () => {
	assert.equal(stemFrench(""), "");
	assert.equal(stemFrench("a"), "a");
	assert.equal(stemFrench("ai"), "ai");
});