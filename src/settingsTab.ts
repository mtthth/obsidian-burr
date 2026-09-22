import { App, PluginSettingTab, Setting } from "obsidian";
import type BurrPlugin from "./main.ts";
import { ECHO_REACHES, NGRAM_RANGE, WINDOW_RANGE } from "./settings.ts";

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
			.setName("Mots rares repris de loin")
			.setDesc("Souligne d'une vague un mot rare (chatoyant, ineffable) qui revient bien au-delà de la fenêtre : un lecteur s'en souvient. Plus le mot est rare, plus la vague est marquée.")
			.addToggle((toggle) =>
				toggle.setValue(settings.echoes).onChange(async (value) => {
					settings.echoes = value;
					await save();
				}),
			);

		new Setting(containerEl)
			.setName("Mots jugés rares")
			.setDesc("D'après leur fréquence dans un corpus de livres (base Lexique).")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("1", "Très rares seulement (chatoyant, diaphane)")
					.addOption("2", "Rares (ineffable, glauque)")
					.addOption("3", "Peu courants (crépuscule, cathédrale)")
					.setValue(String(settings.echoRarity))
					.onChange(async (value) => {
						settings.echoRarity = Number(value);
						await save();
					});
			});

		new Setting(containerEl)
			.setName("Portée des mots rares")
			.setDesc("Distance maximale entre deux emplois d'un mot rare. Sur un manuscrit entier dans une seule note, « Tout le document » souligne beaucoup : les mots rares finissent tous par revenir.")
			.addDropdown((dropdown) => {
				for (const reach of ECHO_REACHES) {
					dropdown.addOption(String(reach), reach > 0 ? `${reach.toLocaleString("fr-FR")} mots` : "Tout le document");
				}
				dropdown.setValue(String(settings.echoReach)).onChange(async (value) => {
					settings.echoReach = Number(value);
					await save();
				});
			});

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

		new Setting(containerEl)
			.setName("Dossiers à analyser")
			.setDesc("Un dossier par ligne (par exemple Roman/Chapitres). Vide : toutes les notes sont analysées. Sinon, seules celles de ces dossiers, sous-dossiers compris, le sont.")
			.addTextArea((area) => {
				area.setPlaceholder("Roman").setValue(settings.includedFolders).onChange(async (value) => {
					settings.includedFolders = value;
					await save();
				});
				area.inputEl.rows = 3;
			});

		new Setting(containerEl)
			.setName("Dossiers à ignorer")
			.setDesc(
				"Un dossier par ligne. Ces dossiers, sous-dossiers compris, ne sont jamais analysés, même au sein d'un dossier à analyser. " +
					"Une note seule s'écarte par un clic droit dans son texte (« Burr : ignorer cette note »), qui ajoute la balise burr-ignorer à son YAML.",
			)
			.addTextArea((area) => {
				area.setPlaceholder("Roman/Brouillons").setValue(settings.excludedFolders).onChange(async (value) => {
					settings.excludedFolders = value;
					await save();
				});
				area.inputEl.rows = 3;
			});
	}
}
