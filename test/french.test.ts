import assert from "node:assert/strict";
import { test } from "node:test";
import { french } from "../src/lang/fr/index.ts";
import { stemFrench } from "../src/lang/fr/stemmer.ts";
import { AMBIGUOUS_VERB_FORMS, IRREGULAR_VERB_FORMS, buildVerbTable } from "../src/lang/fr/verbs.ts";

test("la première personne du pluriel a une seconde racine, celle de son infinitif", () => {
	assert.equal(french.altStem?.("mangeons"), french.stem("manger"));
	assert.equal(french.altStem?.("chantons"), french.stem("chanter"));
	assert.equal(french.altStem?.("regardons"), french.stem("regarder"));
	assert.equal(french.altStem?.("plaçons"), french.stem("placer"));
});

test("la seconde racine s'ajoute à la racine ordinaire sans la modifier", () => {
	// Snowball laisse « chantons » en « chanton » : on ne touche pas à cette racine, qui rapproche « maison » de « maisons ».
	assert.equal(french.stem("chantons"), "chanton");
	assert.equal(french.stem("maisons"), french.stem("maison"));
});

test("les mots en -ions et les autres désinences n'ont pas de seconde racine", () => {
	// « passions » ne doit pas être rapproché de « passer » (limite connue : « mangions » ne l'est pas non plus de « manger »).
	assert.equal(french.altStem?.("passions"), undefined);
	assert.equal(french.altStem?.("mangions"), undefined);
	assert.equal(french.altStem?.("manger"), undefined);
	assert.equal(french.altStem?.("mangez"), undefined);
});

// Chaque ligne : l'infinitif, puis des formes de tous les temps qui doivent lui revenir.
const IRREGULAR_GROUPS: Array<[string, string]> = [
	["aller", "vais vas va allons allez vont allais allait irai iras ira irons irez iront irais irait aille allèrent allât allant allé allée"],
	["faire", "fais fait faisons faites font faisais faisait fis fit firent ferai fera feront ferais fasse fassions fît faisant faite"],
	["pouvoir", "peux peut pouvons peuvent pouvais pouvait pus put purent pourrai pourra pourrait puisse puissions pût pouvant"],
	["vouloir", "veux veut voulons veulent voulais voulut voudrai voudrait veuille veuillez voulant voulu"],
	["savoir", "sais sait savons savent savait sut surent saurai saurait sache sachions sût sachant"],
	["voir", "vois voit voyons voient voyait vîmes virent verrai verrait vît voyant vu"],
	["devoir", "dois doit devons doivent devait dut durent devrai devrait doive dût dû"],
	["dire", "dis dit disons dites disent disait dirent dirai dirait dise dît disant dite"],
	["venir", "viens vient venons viennent venait vint vinrent viendrai viendrait vienne vînt venant venu venue"],
	["tenir", "tiens tient tenons tiennent tenait tint tinrent tiendra tienne tenant tenu"],
	["prendre", "prends prend prenons prennent prenait prit prirent prendrai prenne prît prenant pris prise"],
	["mettre", "mets met mettons mettent mettait mit mirent mettrai mette mît mettant mis mise"],
	["croire", "crois croit croyons croient croyait crut crurent croirai croie croyant cru"],
	["boire", "boit buvons boivent buvait burent boirai boive buvant bu"],
	["lire", "lis lisons lisent lisait lut lurent lirai lise lisant lu"],
	["vivre", "vivons vivent vivait vécut vécurent vivrai vivant vécu"],
	["connaître", "connaître connaitre connais connaît connait connaissons connaissait connut connaîtrai connaitrai connaisse connaissant connu"],
	["mourir", "meurs meurt mourons meurent mourait mourut moururent mourrai meure mourant mort"],
	["falloir", "faut fallait fallut faudra faudrait faille fallu"],
	["asseoir", "assieds assied assoit asseyait assit assirent assiérai asseye assoie asseyant assis"],
];

test("toutes les formes d'un verbe irrégulier reviennent à son infinitif", () => {
	for (const [infinitive, forms] of IRREGULAR_GROUPS) {
		for (const form of forms.split(" ")) {
			assert.equal(french.lemma?.(form), infinitive, `${form} devrait être une forme de ${infinitive}`);
		}
	}
});

test("les composés sont des verbes à part, conjugués de même", () => {
	for (const form of ["reviens", "revenait", "revint", "reviendra", "revenu", "revenue"]) assert.equal(french.lemma?.(form), "revenir");
	for (const form of ["devient", "devenait", "devint", "devenu"]) assert.equal(french.lemma?.(form), "devenir");
	for (const form of ["comprends", "comprenait", "comprit", "compris"]) assert.equal(french.lemma?.(form), "comprendre");
	for (const form of ["permet", "permettait", "permit", "permis"]) assert.equal(french.lemma?.(form), "permettre");
	for (const form of ["décrit", "décrivait", "décrivit", "décrirai"]) assert.equal(french.lemma?.(form), "décrire");
	for (const form of ["reçoit", "recevait", "reçut", "reçu"]) assert.equal(french.lemma?.(form), "recevoir");
	for (const form of ["aperçoit", "apercevait", "aperçut", "aperçu"]) assert.equal(french.lemma?.(form), "apercevoir");
	for (const form of ["disparaît", "disparaissait", "disparut", "disparu"]) assert.equal(french.lemma?.(form), "disparaître");
	for (const form of ["souriait", "sourit", "sourira"]) assert.equal(french.lemma?.(form), "sourire");
	for (const form of ["relit", "reprend", "refait", "reconnaissait"]) assert.notEqual(french.lemma?.(form), undefined);
	assert.notEqual(french.lemma?.("revenait"), french.lemma?.("venait"));
});

test("les formes qui s'écrivent aussi comme un autre mot ou comme un autre verbe restent au stemmer", () => {
	// Deux verbes qui se disputent une forme (« vit », « suis ») : aucun ne l'emporte.
	for (const form of ["vit", "vis", "suis"]) assert.equal(french.lemma?.(form), undefined, form);
	// Des mots sans lien de sens avec le verbe : « le lit », « le bois », « un bus », « le but », « une lueur vive »…
	for (const form of ["lit", "bois", "bus", "but", "vive", "sue", "crue"]) assert.equal(french.lemma?.(form), undefined, form);
	// Les mots-outils sont à part.
	for (const form of ["est", "fut", "sois", "sommes"]) assert.equal(french.lemma?.(form), undefined, form);
	// Mais les composés gardent ce que le verbe simple écarte : « relit » ne peut pas être un nom.
	assert.equal(french.lemma?.("relit"), "relire");
	// À l'inverse, un nom qui vient du verbe reste son écho.
	for (const [noun, verb] of [["surprise", "surprendre"], ["venue", "venir"], ["tenue", "tenir"], ["reprise", "reprendre"]]) {
		assert.equal(french.lemma?.(noun), verb, noun);
	}
});

test("la table ne contient aucune forme commune à deux verbes", () => {
	// Ce n'est pas une garantie du code (voir le test suivant) mais de la donnée : si cela échoue, on vient d'écrire une forme deux fois.
	assert.deepEqual([...AMBIGUOUS_VERB_FORMS], []);
});

test("une forme commune à deux verbes est écartée plutôt que donnée à l'un des deux", () => {
	const { table, clashes } = buildVerbTable([
		{ infinitive: "aaaa", present: "commune propre-a" },
		{ infinitive: "bbbb", present: "commune propre-b" },
		{ infinitive: "cccc", present: "commune" },
	]);
	assert.equal(table.has("commune"), false);
	assert.deepEqual([...clashes], ["commune"]);
	assert.equal(table.get("propre-a"), "aaaa");
	assert.equal(table.get("propre-b"), "bbbb");
	// La même forme redite dans un même verbe n'est pas un conflit.
	const same = buildVerbTable([{ infinitive: "dddd", present: "forme", past: "forme" }]);
	assert.equal(same.table.get("forme"), "dddd");
	assert.equal(same.clashes.size, 0);
});

test("les noms et les verbes réguliers ne sont pas pris pour des verbes irréguliers", () => {
	for (const word of ["maison", "maisons", "porte", "regardait", "mangeons", "chanson", "poisson", "vaisselle", "pouvoirs"]) {
		assert.equal(french.lemma?.(word), undefined, word);
	}
});

test("la table s'ajoute au stemmer sans le changer", () => {
	for (const word of ["faisons", "irai", "connaissait", "connaissance"]) assert.equal(french.stem(word), stemFrench(word));
	// Les mots de la table n'ont pas de seconde racine en -ons : la table les connaît.
	assert.equal(french.altStem?.("allons"), undefined);
	assert.equal(french.altStem?.("faisons"), undefined);
});

test("chaque infinitif est assez long pour servir de famille", () => {
	for (const lemma of new Set(IRREGULAR_VERB_FORMS.values())) assert.ok(lemma.length >= 4, lemma);
});
