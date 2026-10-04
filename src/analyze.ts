import { detectors } from "./detectors/index.ts";
import type { Highlight } from "./detectors/index.ts";
import { resolveLanguage } from "./lang/index.ts";
import { problemKey } from "./priorities.ts";
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
 * `ignored` : les types de problèmes (`problemKey`) que l'auteur ne veut plus voir dans cette note ;
 * ils sont écartés avant le partage des plages, comme s'ils n'avaient pas été détectés.
 */
export function analyze(text: string, settings: BurrSettings, lexicon?: Lexicon, ignored?: ReadonlySet<string>): Highlight[] {
	const language = resolveLanguage({ text });
	const tokens = tokenize(text, language, { ignoreDialogue: settings.ignoreDialogue });
	const words = lexicon ?? defaultLexicon(language);

	let taken: Highlight[] = [];
	for (const detector of detectors) {
		let detected = detector.detect({ text, tokens, language, settings, lexicon: words });
		if (ignored && ignored.size > 0) detected = detected.filter((h) => !ignored.has(problemKey(h)));
		const found = withoutOverlap(detected, taken);
		taken = taken.concat(found).sort((a, b) => a.from - b.from || a.to - b.to);
	}
	return taken;
}
