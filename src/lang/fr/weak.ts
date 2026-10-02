import type { WeakSupport } from "../types.ts";
import { IRREGULAR_VERB_FORMS } from "./verbs.ts";

/**
 * Les mots du dictionnaire par défaut : un exemple que l'on peut éditer, pas une vérité.
 * Les noms en -ment sont les faux positifs de `*ment`, qui n'y distingue pas un adverbe
 * (« lentement ») d'un nom (« logement »).
 */
const TEMPLATE = `---
tags: [burr-ignorer]
---
# Mots faibles

Cette note est lue par le plugin Burr. Modifiez-la : le surlignage suit.

- Une section (\`##\`) par famille, avec sa couleur. Supprimez une section pour ne plus la signaler.
- Les mots ou expressions se séparent par des virgules ou des retours à la ligne.
- \`(seuil N)\` après un titre : la famille n'est surlignée qu'à partir de N occurrences dans un même paragraphe. Sans seuil, c'est celui des réglages.
- \`@faire\` désigne toutes les formes d'un verbe (fais, faisait, fera…) ; \`@commencer à\` une expression dont un mot se conjugue.
- \`*ment\` désigne tous les mots qui se terminent ainsi, sauf ceux de la ligne \`sauf:\`.

## Intensifs et atténuateurs

très, assez, plutôt, vraiment, tellement, un peu, presque, quelque peu, trop, tout à fait

## Adverbes en -ment (seuil 3)

*ment

sauf: moment, vêtement, mouvement, sentiment, document, logement, gouvernement, comment, bâtiment, instrument, appartement, ornement, élément, sacrement, testament, monument, argument, médicament, fragment, segment, commencement, changement, enseignement, événement, évènement, jugement, tempérament, tourment, tremblement, aliment, serment, ciment, firmament, parlement, règlement, emplacement, remplacement, déplacement, rassemblement, soulagement, avertissement, attachement, étonnement, bruissement, grondement, battement, claquement, craquement, effondrement, abattement, ameublement, engagement, divertissement, établissement, détachement, éloignement, ravissement, frémissement, gémissement, hennissement, vieillissement, apaisement, assoupissement, fonctionnement, environnement, traitement, rendement, paiement, déroulement, ressentiment, tiraillement, bourdonnement, chuchotement, ronflement, froment

## Verbes ternes (seuil 6)

@faire, @avoir, @être, @mettre, @aller, @sembler, @paraître, @commencer à, se @mettre à, @être en train de

## Mots vagues (seuil 2)

chose, choses, quelque chose, truc, trucs, machin, sorte de, genre, un certain, une certaine, espèce de

## Béquilles narratives

soudain, soudainement, tout à coup, tout d'un coup, puis, alors, comme si, peut-être
`;

const words = (list: string): string[] => list.split(/\s+/).filter(Boolean);

/** « être » et « avoir » : trop irréguliers, et absents de la table des verbes irréguliers (ce sont des mots-outils). */
const AUXILIARIES = new Map<string, ReadonlySet<string>>([
	[
		"être",
		new Set(
			words(`être suis es est sommes êtes sont étais était étions étiez étaient fus fut fûmes fûtes furent
				serai seras sera serons serez seront serais serait serions seriez seraient sois soyons soyez soient
				fût étant`),
		),
	],
	[
		"avoir",
		new Set(
			words(`avoir ai as a avons avez ont avais avait avions aviez avaient eus eut eûmes eûtes eurent
				aurai auras aura aurons aurez auront aurais aurait aurions auriez auraient aie aies ait ayons ayez
				aient eût ayant eu`),
		),
	],
]);

let irregularByInfinitive: Map<string, Set<string>> | undefined;

/** La table forme -> infinitif retournée : infinitif -> toutes ses formes. */
function irregularForms(): Map<string, Set<string>> {
	if (!irregularByInfinitive) {
		irregularByInfinitive = new Map();
		for (const [form, infinitive] of IRREGULAR_VERB_FORMS) {
			const forms = irregularByInfinitive.get(infinitive);
			if (forms) forms.add(form);
			else irregularByInfinitive.set(infinitive, new Set([form]));
		}
	}
	return irregularByInfinitive;
}

const ER_ENDINGS = [
	// présent, imparfait, passé simple, subjonctif présent
	..."e es ons ez ent ais ait ions iez aient ai as a âmes âtes èrent".split(" "),
	// futur, conditionnel
	..."erai eras era erons erez eront erais erait erions eriez eraient".split(" "),
	// participes, infinitif
	..."ant é ée és ées er".split(" "),
];

/**
 * Les formes d'un verbe régulier en -er : commencer -> commence, commençons, commençait…
 * Le c prend une cédille et le g un e devant a, o et â. Les verbes à radical changeant
 * (appeler, jeter, acheter) y perdent quelques formes ; ils peuvent se lister à la main.
 */
function regularErForms(infinitive: string): Set<string> | undefined {
	if (infinitive.length < 4 || !infinitive.endsWith("er")) return undefined;
	const radical = infinitive.slice(0, -2);
	const forms = new Set<string>();
	for (const ending of ER_ENDINGS) {
		let stem = radical;
		if (/^[aoâ]/.test(ending)) {
			if (radical.endsWith("c")) stem = radical.slice(0, -1) + "ç";
			else if (radical.endsWith("g")) stem = radical + "e";
		}
		forms.add(stem + ending);
	}
	return forms;
}

export const frenchWeak: WeakSupport = {
	template: TEMPLATE,
	verbForms(infinitive) {
		const auxiliary = AUXILIARIES.get(infinitive);
		if (auxiliary) return auxiliary;
		const lemma = IRREGULAR_VERB_FORMS.get(infinitive);
		if (lemma !== undefined) return irregularForms().get(lemma);
		return regularErForms(infinitive);
	},
};
