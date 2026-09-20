import type { EditorView } from "@codemirror/view";
import { MarkdownView, Notice, Plugin } from "obsidian";
import { burrHighlighter, refreshHighlights } from "./editor/highlight.ts";
import { DEFAULT_SETTINGS, sanitizeSettings } from "./settings.ts";
import type { BurrSettings } from "./settings.ts";
import { BurrSettingTab } from "./settingsTab.ts";

export default class BurrPlugin extends Plugin {
	settings: BurrSettings = { ...DEFAULT_SETTINGS };

	async onload() {
		this.settings = sanitizeSettings(await this.loadData());

		this.registerEditorExtension(burrHighlighter(() => this.settings));

		this.addCommand({
			id: "toggle-repetitions",
			name: "Afficher ou masquer les répétitions",
			callback: async () => {
				this.settings.enabled = !this.settings.enabled;
				await this.saveSettings();
				new Notice(this.settings.enabled ? "Répétitions surlignées" : "Répétitions masquées");
			},
		});

		this.addSettingTab(new BurrSettingTab(this.app, this));
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.refreshEditors();
	}

	/** Relance l'analyse dans tous les éditeurs ouverts. */
	private refreshEditors() {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (!(leaf.view instanceof MarkdownView)) return;
			// `editor.cm` n'est pas dans l'API publique, mais c'est l'usage établi.
			const cm = (leaf.view.editor as unknown as { cm?: EditorView }).cm;
			cm?.dispatch({ effects: refreshHighlights.of(null) });
		});
	}
}
