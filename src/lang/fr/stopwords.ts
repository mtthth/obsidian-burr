/**
 * Mots-outils français : ce qui structure la phrase sans porter de sens propre.
 * Leur retour n'est pas une répétition. Les mots de moins de trois lettres
 * (le, la, de, et, il, en, y, ne…) sont déjà écartés par leur longueur.
 *
 * Y figurent les formes d'« être » et d'« avoir », qui reviennent partout ; les
 * autres verbes ternes (faire, aller, pouvoir…) restent surlignables : c'est
 * le rôle d'un futur détecteur de mots faibles de les traiter à part.
 */
const WORDS = `
	les des une aux ces cet cette mes tes ses nos vos mon ton son notre votre
	leur leurs quel quelle quels quelles quelque quelques chaque plusieurs
	aucun aucune tout tous toute toutes même mêmes

	dans par pour sur sous avec sans chez vers entre contre depuis pendant
	devant derrière avant après selon malgré parmi dès jusque jusqu durant
	hors envers

	mais donc car que qui quoi dont où comme quand lorsque lorsqu puisque
	puisqu quoique quoiqu parce

	elle elles ils nous vous lui eux moi toi soi celui celle ceux celles cela
	ceci ça lequel laquelle lesquels lesquelles duquel auquel auxquels
	auxquelles voici voilà

	pas plus

	être suis est sommes êtes sont étais était étions étiez étaient fus fut
	fûmes fûtes furent serai seras sera serons serez seront serais serait
	serions seriez seraient sois soit soyons soyez soient fusse fusses fût
	fussions fussiez fussent été étant

	avoir avons avez ont avais avait avions aviez avaient eus eut eûmes eûtes
	eurent aurai auras aura aurons aurez auront aurais aurait aurions auriez
	auraient aies ait ayons ayez aient eue eues eusse eusses eût eussions
	eussiez eussent ayant
`;

export const FRENCH_STOPWORDS: ReadonlySet<string> = new Set(WORDS.split(/\s+/).filter(Boolean));
