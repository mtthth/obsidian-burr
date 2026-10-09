import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_SETTINGS, sanitizeSettings } from "../src/settings.ts";
import type { BurrSettings } from "../src/settings.ts";

/** Des réglages tels qu'un fichier édité à la main peut les donner. */
const raw = (values: Record<string, unknown>) => values as Partial<BurrSettings>;

test("un interrupteur mal écrit sur le disque reprend sa valeur par défaut", () => {
	assert.equal(sanitizeSettings(raw({ enabled: "false" })).enabled, false);
	assert.equal(sanitizeSettings(raw({ ignoreDialogue: "true" })).ignoreDialogue, true);
	assert.equal(sanitizeSettings(raw({ enabled: false })).enabled, false);
	const toggles = ["enabled", "useStemming", "echoes", "weakWords", "ignoreProperNames", "ignoreDialogue"] as const;
	for (const value of ["non", 0, 1, null, [], {}]) {
		const settings = sanitizeSettings(raw(Object.fromEntries(toggles.map((key) => [key, value]))));
		for (const key of toggles) assert.equal(settings[key], DEFAULT_SETTINGS[key], `${key} : ${JSON.stringify(value)}`);
	}
});
