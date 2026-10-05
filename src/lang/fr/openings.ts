import type { OpeningSupport } from "../types.ts";

/**
 * Les mots d'un même groupe comptent pour un seul au début d'une phrase : « Il … Elle … On … » se lit comme
 * une série. L'apostrophe coupe les mots (voir le tokenizer) : « J'ai » donne « j », « C'était » donne « c ».
 */
export const FRENCH_OPENINGS: OpeningSupport = {
	groups: [
		{ id: "sujet", words: ["il", "elle", "on", "ils", "elles"] },
		{ id: "je", words: ["je", "j"] },
		{ id: "nous", words: ["nous", "tu", "vous"] },
		{ id: "defini", words: ["le", "la", "les", "l"] },
		{ id: "indefini", words: ["un", "une", "des"] },
		{ id: "ce", words: ["ce", "cet", "cette", "ces", "c", "ça", "cela", "ceci"] },
		{
			id: "possessif",
			words: ["son", "sa", "ses", "leur", "leurs", "mon", "ma", "mes", "ton", "ta", "tes", "notre", "nos", "votre", "vos"],
		},
		{ id: "enchainement", words: ["puis", "ensuite", "alors"] },
	],
	// Après « M. » ou « Dr », le point ne finit pas la phrase.
	abbreviations: new Set(["m", "mme", "mmes", "mlle", "mlles", "mm", "dr", "drs", "pr", "st", "ste", "cf", "vs"]),
};
