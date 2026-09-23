/**
 * Régénère src/lang/fr/frequencies.ts à partir de Lexique 3.83 :
 *
 *   npm run frequencies                                   (copie du dépôt, data/lexique/)
 *   node scripts/frequencies.ts chemin/vers/Lexique383.tsv   (autre copie, .tsv ou .tsv.gz)
 *
 * Lexique (Boris New et Christophe Pallier, http://www.lexique.org) est distribué sous
 * licence CC BY-SA 4.0 ; data/README.md dit d'où vient la copie du dépôt.
 *
 * Chaque forme de Lexique donne sa racine Snowball, avec la fréquence de son lemme dans
 * un corpus de livres (colonne freqlemlivres, en emplois par million de mots). Une
 * racine garde la plus haute des fréquences qui y mènent : dans le doute, un mot est
 * courant. Les entrées en plusieurs mots (« aujourd'hui », « peut-être ») sont coupées
 * comme le fait le tokenizer, et chaque morceau reçoit la fréquence de l'entrée.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { stemFrench } from "../src/lang/fr/stemmer.ts";

/** Seuils des degrés d'usage 1, 2 et 3 : en dessous du premier, un mot est très rare. */
const THRESHOLDS = [3, 10, 30] as const;
const OUTPUT = new URL("../src/lang/fr/frequencies.ts", import.meta.url);
const LEXIQUE = new URL("../data/lexique/Lexique383.tsv.gz", import.meta.url);
const LINE_WIDTH = 100;

const source = process.argv[2] ?? LEXIQUE;
const raw = readFileSync(source);
const lines = (String(source).endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8").split(/\r?\n/);
const header = lines[0].split("\t");
const ORTHO = header.indexOf("ortho");
const FREQUENCY = header.indexOf("freqlemlivres");
if (ORTHO < 0 || FREQUENCY < 0) throw new Error("Colonnes ortho ou freqlemlivres introuvables : est-ce bien Lexique 3.83 ?");

const frequencyOfStem = new Map<string, number>();
for (const line of lines.slice(1)) {
	if (!line) continue;
	const fields = line.split("\t");
	const ortho = fields[ORTHO].toLowerCase().normalize("NFC");
	// rarity.ts défait les ligatures du texte parce que Lexique n'en écrit pas (« coeur ») : on le vérifie.
	if (/[œæ]/.test(ortho)) throw new Error(`Lexique écrit désormais les ligatures (« ${ortho} ») : revoir unligate dans rarity.ts.`);
	const frequency = Number(fields[FREQUENCY]);
	for (const part of ortho.split(/[^\p{L}\p{N}\p{M}]+/u)) {
		if (!part) continue;
		const stem = stemFrench(part);
		frequencyOfStem.set(stem, Math.max(frequencyOfStem.get(stem) ?? 0, frequency));
	}
}

/** Une liste de racines, en lignes d'au plus LINE_WIDTH caractères. */
function wrap(stems: string[]): string {
	const out: string[] = [];
	let line = "";
	for (const stem of stems) {
		if (line && line.length + 1 + stem.length > LINE_WIDTH) {
			out.push(line);
			line = stem;
		} else line = line ? `${line} ${stem}` : stem;
	}
	if (line) out.push(line);
	return out.join("\n");
}

const bands = THRESHOLDS.map((low, level) => {
	const high = THRESHOLDS[level + 1] ?? Infinity;
	const stems = [...frequencyOfStem].filter(([, f]) => f >= low && f < high).map(([stem]) => stem);
	return stems.sort();
});

const describe = (level: number) => {
	const low = THRESHOLDS[level];
	const high = THRESHOLDS[level + 1];
	return high === undefined ? `au moins ${low} fois` : `de ${low} à moins de ${high} fois`;
};

const output = `/*
 * Fichier généré par scripts/frequencies.ts : ne pas modifier à la main.
 *
 * Données dérivées de Lexique 3.83 (Boris New, Christophe Pallier et al., http://www.lexique.org),
 * distribuées sous licence CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).
 * Ce fichier est placé sous la même licence ; le reste du plugin est sous licence MIT.
 * Modifications : seules restent les racines Snowball des mots courants, classées par
 * fréquence de leur lemme dans le corpus de livres de Lexique.
 */

/**
 * Racines des mots courants, par degré d'usage : \`COMMON_STEMS[0]\` donne le degré 1,
 * \`COMMON_STEMS[2]\` le degré 3. Une racine absente est celle d'un mot très rare (degré 0).
 */
export const COMMON_STEMS: readonly string[] = [
${bands
	.map(
		(stems, level) =>
			`\t// Degré ${level + 1} : ${stems.length} racines, employées ${describe(level)} par million de mots.\n\t\`\n${wrap(stems)}\n\``,
	)
	.join(",\n")},
];
`;

writeFileSync(OUTPUT, output);
console.log(`${bands.map((b) => b.length).join(" + ")} racines écrites dans ${OUTPUT.pathname}`);
