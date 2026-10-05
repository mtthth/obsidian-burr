import { analyze } from "../src/analyze.ts";
import { DEFAULT_SETTINGS } from "../src/settings.ts";
import type { BurrSettings } from "../src/settings.ts";

/** Ces helpers testent les répétitions : les débuts de phrase répétés ont leur propre fichier de tests. */
const NO_OPENINGS: Partial<BurrSettings> = { openings: false };

/** Analyse `text` et rend les passages surlignés, dans l'ordre, avec leur intensité. */
export function highlighted(text: string, overrides: Partial<BurrSettings> = {}): Array<[string, number]> {
	const settings: BurrSettings = { ...DEFAULT_SETTINGS, ...NO_OPENINGS, ...overrides };
	return analyze(text, settings).map((h) => [text.slice(h.from, h.to), h.intensity]);
}

/** Les passages surlignés avec leur famille (mot ou expression dont ils sont une occurrence). */
export function families(text: string, overrides: Partial<BurrSettings> = {}): Array<[string, string]> {
	const settings: BurrSettings = { ...DEFAULT_SETTINGS, ...NO_OPENINGS, ...overrides };
	return analyze(text, settings).map((h) => [text.slice(h.from, h.to), h.family]);
}

/** Les passages surlignés avec ce que dit leur infobulle. */
export function explanations(text: string, overrides: Partial<BurrSettings> = {}): Array<[string, string]> {
	const settings: BurrSettings = { ...DEFAULT_SETTINGS, ...NO_OPENINGS, ...overrides };
	return analyze(text, settings).map((h) => [text.slice(h.from, h.to), h.explain().text]);
}

/** Comme `highlighted`, sans les intensités. */
export function words(text: string, overrides: Partial<BurrSettings> = {}): string[] {
	return highlighted(text, overrides).map(([passage]) => passage);
}
