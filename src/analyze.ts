import { detectors } from "./detectors/index.ts";
import type { Highlight } from "./detectors/index.ts";
import { resolveLanguage } from "./lang/index.ts";
import type { BurrSettings } from "./settings.ts";
import { tokenize } from "./text/tokenize.ts";

/** Analyse un document : une tokenisation, puis tous les détecteurs sur les mêmes mots. */
export function analyze(text: string, settings: BurrSettings): Highlight[] {
	const language = resolveLanguage({ text });
	const tokens = tokenize(text, language, { ignoreDialogue: settings.ignoreDialogue });
	const highlights = detectors.flatMap((detector) => detector.detect({ tokens, language, settings }));
	return highlights.sort((a, b) => a.from - b.from || a.to - b.to);
}
