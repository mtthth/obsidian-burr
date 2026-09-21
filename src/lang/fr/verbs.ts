/**
 * Verbes irréguliers : forme conjuguée -> infinitif.
 *
 * Snowball ne peut pas rapprocher « faisons » de « fait », ni « irai » de
 * « allons » : leurs radicaux n'ont rien en commun. Ici, chaque forme de ces
 * verbes est rangée sous son infinitif, à la main.
 *
 * Les imparfaits, futurs et conditionnels suivent partout les mêmes désinences :
 * on ne donne que leur radical. Le reste est listé forme à forme.
 *
 * Ne figurent pas :
 * - les formes qui appartiennent à deux verbes (« vit » : voir ou vivre ; « suis » :
 *   être ou suivre) : mieux vaut ne rien dire que se tromper ;
 * - les formes qui sont d'abord un autre mot, sans lien de sens avec le verbe
 *   (« lit », « bois », « bus », « but », « vive », « sue », « crue »), sauf dans les
 *   composés (« relit »).
 * Un nom qui vient du verbe (« la surprise », « la venue », « la tenue ») reste
 * rapproché de lui : c'est un vrai écho.
 */
export interface Verb {
	/** L'infinitif (plusieurs si l'orthographe varie : « connaître », « connaitre ») ; le premier sert de clé. */
	infinitive: string;
	present?: string;
	/** Radical de l'imparfait : + ais, ait, ions, iez, aient. */
	imperfect?: string;
	/** Radical du futur et du conditionnel : + ai, as, a, ons, ez, ont, et ais, ait, ions, iez, aient. */
	future?: string;
	/** Passé simple. */
	past?: string;
	/** Subjonctif, quand il diffère de l'imparfait, et impératif quand il diffère du présent. */
	subjunctive?: string;
	participles?: string;
	/** Autres formes, pour les verbes qui n'ont pas de conjugaison complète. */
	others?: string;
	/** Préfixes qui font d'autres verbes conjugués de même (« re » -> revenir, reviens…). */
	compounds?: string;
	/** Le radical ne se dit pas seul (« crire » n'existe qu'avec é-, dé-). */
	bound?: boolean;
	/** Formes du verbe simple que ses composés gardent, mais qui sont d'abord des noms courants. */
	nounLike?: string;
}

const VERBS: readonly Verb[] = [
	{
		infinitive: "aller",
		present: "vais vas va allons allez vont",
		imperfect: "all",
		future: "ir",
		past: "allai allas alla allâmes allâtes allèrent",
		subjunctive: "aille ailles aillent allât",
		participles: "allant allé allée allés allées",
	},
	{
		infinitive: "faire",
		present: "fais fait faisons faites font",
		imperfect: "fais",
		future: "fer",
		past: "fis fit fîmes fîtes firent",
		subjunctive: "fasse fasses fassent fassions fassiez fît",
		participles: "faisant fait faits faite faites",
		compounds: "dé re satis",
	},
	{
		infinitive: "pouvoir",
		present: "peux peut pouvons pouvez peuvent",
		imperfect: "pouv",
		future: "pourr",
		past: "pus put pûmes pûtes purent",
		subjunctive: "puisse puisses puissent puissions puissiez pût",
		participles: "pouvant pu",
	},
	{
		infinitive: "vouloir",
		present: "veux veut voulons voulez veulent",
		imperfect: "voul",
		future: "voudr",
		past: "voulus voulut voulûmes voulûtes voulurent",
		subjunctive: "veuille veuilles veuillent veuillons veuillez voulût",
		participles: "voulant voulu voulue voulus voulues",
	},
	{
		infinitive: "savoir",
		present: "sais sait savons savez savent",
		imperfect: "sav",
		future: "saur",
		past: "sus sut sûmes sûtes surent",
		subjunctive: "sache saches sachent sachions sachiez sachons sachez sût",
		participles: "sachant su sus",
	},
	{
		infinitive: "voir",
		present: "vois voit voyons voyez voient",
		imperfect: "voy",
		future: "verr",
		past: "vîmes vîtes virent",
		subjunctive: "vît",
		participles: "voyant vu vue vus vues",
	},
	{
		infinitive: "devoir",
		present: "dois doit devons devez doivent",
		imperfect: "dev",
		future: "devr",
		past: "dus dut dûmes dûtes durent",
		subjunctive: "doive doives doivent dût",
		participles: "dû due dus dues",
	},
	{
		infinitive: "dire",
		present: "dis dit disons dites disent",
		imperfect: "dis",
		future: "dir",
		past: "dis dit dîmes dîtes dirent",
		subjunctive: "dise dises disent disions disiez dît",
		participles: "disant dit dite dits dites",
		compounds: "contre inter pré re",
	},
	{
		infinitive: "venir",
		present: "viens vient venons venez viennent",
		imperfect: "ven",
		future: "viendr",
		past: "vins vint vînmes vîntes vinrent",
		subjunctive: "vienne viennes viennent vînt",
		participles: "venant venu venue venus venues",
		compounds: "de re par con sur pré inter pro sou",
	},
	{
		infinitive: "tenir",
		present: "tiens tient tenons tenez tiennent",
		imperfect: "ten",
		future: "tiendr",
		past: "tins tint tînmes tîntes tinrent",
		subjunctive: "tienne tiennes tiennent tînt",
		participles: "tenant tenu tenue tenus tenues",
		compounds: "con dé main ob re sou entre appar abs",
	},
	{
		infinitive: "prendre",
		present: "prends prend prenons prenez prennent",
		imperfect: "pren",
		future: "prendr",
		past: "pris prit prîmes prîtes prirent",
		subjunctive: "prenne prennes prennent prît",
		participles: "prenant pris prise prises",
		compounds: "ap com re sur entre",
	},
	{
		infinitive: "mettre",
		present: "mets met mettons mettez mettent",
		imperfect: "mett",
		future: "mettr",
		past: "mis mit mîmes mîtes mirent",
		subjunctive: "mette mettes mettent mît",
		participles: "mettant mis mise mises",
		compounds: "ad com dé é o per pro re sou trans",
	},
	{
		infinitive: "croire",
		present: "crois croit croyons croyez croient",
		imperfect: "croy",
		future: "croir",
		past: "crut crûmes crûtes crurent",
		subjunctive: "croie croies croient croyions croyiez crût",
		participles: "croyant cru",
	},
	{
		infinitive: "boire",
		present: "bois boit buvons buvez boivent",
		imperfect: "buv",
		future: "boir",
		past: "bûmes bûtes burent",
		subjunctive: "boive boives boivent bût",
		participles: "buvant bu bue bues",
		nounLike: "bois",
	},
	{
		infinitive: "lire",
		present: "lis lit lisons lisez lisent",
		imperfect: "lis",
		future: "lir",
		past: "lus lut lûmes lûtes lurent",
		subjunctive: "lise lises lisent lût",
		participles: "lisant lu lue lus lues",
		compounds: "re é",
		nounLike: "lit",
	},
	{
		infinitive: "crire",
		present: "cris crit crivons crivez crivent",
		imperfect: "criv",
		future: "crir",
		past: "crivis crivit crivîmes crivîtes crivirent",
		subjunctive: "crive crives crivent crivît",
		participles: "crivant crit crite crits crites",
		compounds: "é dé",
		bound: true,
	},
	{
		infinitive: "suivre",
		present: "suit suivons suivez suivent",
		imperfect: "suiv",
		future: "suivr",
		past: "suivis suivit suivîmes suivîtes suivirent",
		subjunctive: "suive suives suivent suivît",
		participles: "suivant suivi suivie suivis suivies",
		compounds: "pour",
	},
	{
		infinitive: "vivre",
		present: "vivons vivez vivent",
		imperfect: "viv",
		future: "vivr",
		past: "vécus vécut vécûmes vécûtes vécurent",
		subjunctive: "vivent vécût",
		participles: "vivant vécu vécue vécus vécues",
		compounds: "sur re",
	},
	{
		infinitive: "connaître connaitre",
		present: "connais connaît connait connaissons connaissez connaissent",
		imperfect: "connaiss",
		future: "connaîtr connaitr",
		past: "connus connut connûmes connûtes connurent",
		subjunctive: "connaisse connaisses connût",
		participles: "connaissant connu connue connus connues",
		compounds: "re mé",
	},
	{
		infinitive: "paraître paraitre",
		present: "parais paraît parait paraissons paraissez paraissent",
		imperfect: "paraiss",
		future: "paraîtr paraitr",
		past: "parus parut parûmes parûtes parurent",
		subjunctive: "paraisse paraisses parût",
		participles: "paraissant paru parue parus parues",
		compounds: "ap dis com trans",
	},
	{
		infinitive: "mourir",
		present: "meurs meurt mourons mourez meurent",
		imperfect: "mour",
		future: "mourr",
		past: "mourus mourut mourûmes mourûtes moururent",
		subjunctive: "meure meures meurent mourût",
		participles: "mourant mort morte morts mortes",
	},
	{
		infinitive: "cevoir",
		present: "çois çoit cevons cevez çoivent",
		imperfect: "cev",
		future: "cevr",
		past: "çus çut çûmes çûtes çurent",
		subjunctive: "çoive çoives çoivent çût",
		participles: "cevant çu çue çus çues",
		compounds: "re aper con dé per",
		bound: true,
	},
	{
		infinitive: "valoir",
		present: "vaux vaut valons valez valent",
		imperfect: "val",
		future: "vaudr",
		past: "valus valut valûmes valûtes valurent",
		subjunctive: "vaille vailles vaillent valût",
		participles: "valant valu",
	},
	{
		infinitive: "falloir",
		others: "faut fallait fallut faudra faudrait faille fallût fallu",
	},
	{
		infinitive: "rire",
		present: "ris rit rions riez rient",
		imperfect: "ri",
		future: "rir",
		past: "ris rit rîmes rîtes rirent",
		subjunctive: "rie ries rient rît",
		participles: "riant ri",
		compounds: "sou",
	},
	{
		infinitive: "asseoir assoir",
		present: "assieds assied asseyons asseyez asseyent assois assoit assoyons assoyez assoient",
		imperfect: "assey assoy",
		future: "assiér assoir asseyer",
		past: "assis assit assîmes assîtes assirent",
		subjunctive: "asseye asseyes asseyent assoie assoies assoient assît",
		participles: "asseyant assoyant assis assise assises",
	},
];

const IMPERFECT_ENDINGS = ["ais", "ait", "ions", "iez", "aient"];
const FUTURE_ENDINGS = ["ai", "as", "a", "ons", "ez", "ont"];

const words = (list = ""): string[] => list.split(/\s+/).filter(Boolean);

/** Toutes les formes d'un verbe simple, sans préfixe. */
function formsOf(verb: Verb): string[] {
	const forms = [
		...words(verb.infinitive),
		...words(verb.present),
		...words(verb.past),
		...words(verb.subjunctive),
		...words(verb.participles),
		...words(verb.others),
	];
	for (const stem of words(verb.imperfect)) {
		for (const ending of IMPERFECT_ENDINGS) forms.push(stem + ending);
	}
	for (const stem of words(verb.future)) {
		for (const ending of [...FUTURE_ENDINGS, ...IMPERFECT_ENDINGS]) forms.push(stem + ending);
	}
	return forms;
}

/**
 * La table forme -> infinitif. Une forme qui se trouverait chez deux verbes est
 * retirée de la table et rendue à part : elle retombe sur le stemmer.
 */
export function buildVerbTable(verbs: readonly Verb[] = VERBS): { table: Map<string, string>; clashes: Set<string> } {
	const table = new Map<string, string>();
	const clashes = new Set<string>();
	const add = (form: string, lemma: string) => {
		if (clashes.has(form)) return;
		const known = table.get(form);
		if (known !== undefined && known !== lemma) {
			table.delete(form);
			clashes.add(form);
		} else {
			table.set(form, lemma);
		}
	};

	for (const verb of verbs) {
		const forms = formsOf(verb);
		const nounLike = new Set(words(verb.nounLike));
		const [infinitive] = words(verb.infinitive);
		for (const prefix of [...(verb.bound ? [] : [""]), ...words(verb.compounds)]) {
			for (const form of forms) {
				if (prefix === "" && nounLike.has(form)) continue;
				add(prefix + form, prefix + infinitive);
			}
		}
	}
	return { table, clashes };
}

const built = buildVerbTable();

/** Forme conjuguée (minuscules NFC) -> infinitif, pour les verbes irréguliers les plus courants. */
export const IRREGULAR_VERB_FORMS: ReadonlyMap<string, string> = built.table;

/** Les formes écartées parce qu'elles appartiennent à deux verbes. */
export const AMBIGUOUS_VERB_FORMS: ReadonlySet<string> = built.clashes;
