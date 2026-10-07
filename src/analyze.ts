import { detectors } from "./detectors/index.ts";
import type { Highlight } from "./detectors/index.ts";
import { coversProblem, ignoredTest } from "./ignore.ts";
import type { Ignored } from "./ignore.ts";
import { resolveLanguage } from "./lang/index.ts";
import { prioritize } from "./priorities.ts";
import type { Problem } from "./priorities.ts";
import type { BurrSettings } from "./settings.ts";
import { tokenize } from "./text/tokenize.ts";
import { defaultLexicon } from "./weak/lexicon.ts";
import type { Lexicon } from "./weak/lexicon.ts";

/** Garde les plages de `found` qui ne recouvrent aucune de `taken` (triées, sans chevauchement). */
function withoutOverlap(found: Highlight[], taken: readonly Highlight[]): Highlight[] {
	if (taken.length === 0) return found;
	return found.filter((h) => {
		// Dernière plage prise qui commence avant la fin de h : elle finit au plus tard, puisqu'elles sont disjointes.
		let low = 0;
		let high = taken.length;
		while (low < high) {
			const mid = (low + high) >> 1;
			if (taken[mid].from < h.to) low = mid + 1;
			else high = mid;
		}
		return low === 0 || taken[low - 1].to <= h.from;
	});
}

/**
 * Analyse un document : une tokenisation, puis tous les détecteurs sur les mêmes mots.
 * Les plages ne se chevauchent jamais : un détecteur cède la place à ceux qui le précèdent
 * dans `detectors` (un mot déjà surligné comme répétition n'est pas signalé en plus comme faible).
 * `lexicon` : les mots faibles de l'auteur ; à défaut, ceux de la langue.
 * `ignored` : ce que l'auteur ne veut plus voir dans cette note, types de problèmes ou passages ;
 * ils sont écartés avant le partage des plages, comme s'ils n'avaient pas été détectés.
 */
export function analyze(text: string, settings: BurrSettings, lexicon?: Lexicon, ignored?: Ignored): Highlight[] {
	const language = resolveLanguage({ text });
	const tokens = tokenize(text, language, { ignoreDialogue: settings.ignoreDialogue });
	const words = lexicon ?? defaultLexicon(language);
	const isIgnored = ignored ? ignoredTest(text, ignored) : null;

	let taken: Highlight[] = [];
	for (const detector of detectors) {
		let detected = detector.detect({ text, tokens, language, settings, lexicon: words });
		if (isIgnored) detected = detected.filter((h) => !isIgnored(h));
		const found = withoutOverlap(detected, taken);
		taken = taken.concat(found).sort((a, b) => a.from - b.from || a.to - b.to);
	}
	return taken;
}

/** A problem the author set aside: for the whole note, or in this place only. */
export interface IgnoredProblem extends Problem {
	scope: "note" | "passage";
}

/**
 * A note's problems as the editor shows them (`active`, ranked), and those the author set aside (`ignored`),
 * found in an analysis that ignores nothing.
 */
export function noteProblems(
	text: string,
	settings: BurrSettings,
	lexicon: Lexicon | undefined,
	ignored: Ignored,
): { active: Problem[]; ignored: IgnoredProblem[] } {
	const active = prioritize(text, analyze(text, settings, lexicon, ignored));
	if (ignored.keys.size === 0 && ignored.passages.length === 0) return { active, ignored: [] };
	const hidden: IgnoredProblem[] = [];
	for (const problem of prioritize(text, analyze(text, settings, lexicon))) {
		if (ignored.keys.has(problem.key)) hidden.push({ ...problem, scope: "note" });
		else if (ignored.passages.some((passage) => coversProblem(passage, problem))) hidden.push({ ...problem, scope: "passage" });
	}
	return { active, ignored: hidden };
}
