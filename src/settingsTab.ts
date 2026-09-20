import { App, PluginSettingTab, Setting } from "obsidian";
import type BurrPlugin from "./main.ts";
import { NGRAM_RANGE, WINDOW_RANGE } from "./settings.ts";

export class BurrSettingTab extends PluginSettingTab {
	private plugin: BurrPlugin;

	constructor(app: App, plugin: BurrPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		const settings = this.plugin.settings;
		containerEl.empty();

		const save = () => this.plugin.saveSettings();

		new Setting(containerEl)
			.setName("Surligner les répétitions")
			.setDesc("Le plugin montre, l'auteur juge : le texte n'est jamais modifié.")
			.addToggle((toggle) =>
				toggle.setValue(settings.enabled).onChange(async (value) => {
					settings.enabled = value;
					await save();
				}),
			);

		new Setting(containerEl)
			.setName("Fenêtre de recherche")
			.setDesc("Deux occurrences sont signalées si elles sont séparées par au plus ce nombre de mots. Plus elles sont proches, plus le surlignage est marqué.")
			.addSlider((slider) =>
				slider
					.setLimits(WINDOW_RANGE.min, WINDOW_RANGE.max, WINDOW_RANGE.step)
					.setValue(settings.window)
					.setDynamicTooltip()
					.onChange(async (value) => {
						settings.window = value;
						await save();
					}),
			);

		new Setting(containerEl)
			.setName("Longueur maximale des expressions")
			.setDesc("Repère aussi les suites de mots répétées (« tout de même », « il n'y avait pas »). 1 : mots isolés seulement.")
			.addDropdown((dropdown) => {
				for (let n = NGRAM_RANGE.min; n <= NGRAM_RANGE.max; n++) dropdown.addOption(String(n), String(n));
				dropdown.setValue(String(settings.maxNgram)).onChange(async (value) => {
					settings.maxNgram = Number(value);
					await save();
				});
			});

		new Setting(containerEl)
			.setName("Rapprocher les formes d'un même mot")
			.setDesc("Regardait, regarda, regardant… Ces rapprochements sont surlignés plus discrètement, car ils se trompent parfois.")
			.addToggle((toggle) =>
				toggle.setValue(settings.useStemming).onChange(async (value) => {
					settings.useStemming = value;
					await save();
				}),
			);

		new Setting(containerEl)
			.setName("Ignorer les noms propres")
			.setDesc("Un mot qui prend une majuscule en milieu de phrase n'est jamais signalé : un personnage qui revient n'est pas une répétition.")
			.addToggle((toggle) =>
				toggle.setValue(settings.ignoreProperNames).onChange(async (value) => {
					settings.ignoreProperNames = value;
					await save();
				}),
			);

		new Setting(containerEl)
			.setName("Ignorer les dialogues")
			.setDesc("Laisse de côté les lignes qui commencent par un tiret cadratin et les passages entre guillemets français.")
			.addToggle((toggle) =>
				toggle.setValue(settings.ignoreDialogue).onChange(async (value) => {
					settings.ignoreDialogue = value;
					await save();
				}),
			);

		new Setting(containerEl)
			.setName("Mots à ignorer en plus")
			.setDesc("Ajoutés aux mots-outils (le, de, il, être, avoir…). Un mot par ligne, ou séparés par des virgules.")
			.addTextArea((area) => {
				area.setValue(settings.extraIgnoredWords).onChange(async (value) => {
					settings.extraIgnoredWords = value;
					await save();
				});
				area.inputEl.rows = 4;
			});
	}
}
