import type { EditorView } from "@codemirror/view";
import { MarkdownView, Menu, Notice, Plugin, TFile, editorInfoField, normalizePath } from "obsidian";
import type { MenuItem } from "obsidian";
import { analyze } from "./analyze.ts";
import { burrHighlighter, refreshHighlights } from "./editor/highlight.ts";
import { PRIORITIES_VIEW, PrioritiesView } from "./panel/prioritiesView.ts";
import { prioritize } from "./priorities.ts";
import type { Problem } from "./priorities.ts";
import { addIgnoreTag, exclusionOf, removeIgnoreTag } from "./scope.ts";
import type { Exclusion } from "./scope.ts";
import { DEFAULT_SETTINGS, sanitizeSettings } from "./settings.ts";
import type { BurrSettings } from "./settings.ts";
import { BurrSettingTab } from "./settingsTab.ts";
import { resolveLanguage } from "./lang/index.ts";
import { defaultLexicon, parseLexicon } from "./weak/lexicon.ts";
import type { Lexicon } from "./weak/lexicon.ts";

export default class BurrPlugin extends Plugin {
	settings: BurrSettings = { ...DEFAULT_SETTINGS };

	/** Ce que les éditeurs ont vu de chaque note, pour ne relancer l'analyse que si cela change. */
	private seen = new Map<string, Exclusion | null>();

	/** Les mots faibles lus dans la note de l'auteur ; `undefined` tant qu'elle n'existe pas (ceux de la langue s'appliquent). */
	private lexicon: Lexicon | undefined;

	async onload() {
		this.settings = sanitizeSettings(await this.loadData());

		this.registerEditorExtension(burrHighlighter(() => this.settings, (view) => this.isExcluded(view), () => this.lexicon));

		this.registerView(PRIORITIES_VIEW, (leaf) => new PrioritiesView(leaf, this));
		this.addRibbonIcon("list-ordered", "Priorités de Burr", () => void this.openPriorities());
		this.addCommand({
			id: "open-priorities",
			name: "Ouvrir le panneau des priorités",
			callback: () => this.openPriorities(),
		});

		this.addCommand({
			id: "toggle-repetitions",
			name: "Afficher ou masquer les répétitions",
			callback: async () => {
				this.settings.enabled = !this.settings.enabled;
				await this.saveSettings();
				new Notice(this.settings.enabled ? "Répétitions surlignées" : "Répétitions masquées");
			},
		});

		this.addCommand({
			id: "toggle-weak-words",
			name: "Afficher ou masquer les mots faibles",
			callback: async () => {
				this.settings.weakWords = !this.settings.weakWords;
				await this.saveSettings();
				new Notice(this.settings.weakWords ? "Mots faibles surlignés" : "Mots faibles masqués");
			},
		});

		this.addCommand({
			id: "open-weak-words-note",
			name: "Ouvrir la note des mots faibles (la créer si besoin)",
			callback: () => this.openWeakWordsNote(),
		});

		// La note des mots faibles est relue à chaque modification, et à son apparition ou disparition.
		const onNoteChange = (file: { path: string }, oldPath?: string) => {
			const path = normalizePath(this.settings.weakNote);
			if (file.path === path || oldPath === path) void this.loadLexicon();
		};
		this.registerEvent(this.app.vault.on("modify", (file) => onNoteChange(file)));
		this.registerEvent(this.app.vault.on("create", (file) => onNoteChange(file)));
		this.registerEvent(this.app.vault.on("delete", (file) => onNoteChange(file)));
		this.registerEvent(this.app.vault.on("rename", (file, oldPath) => onNoteChange(file, oldPath)));
		this.app.workspace.onLayoutReady(() => void this.loadLexicon());

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, _editor, info) => {
				const file = info.file;
				if (file) {
					const exclusion = this.exclusion(file);
					// Écartée par un dossier, une balise n'y changerait rien.
					if (exclusion !== "folder") {
						const ignored = exclusion === "tag";
						menu.addItem((item) =>
							item
								.setTitle(ignored ? "Burr : réactiver pour cette note" : "Burr : ignorer cette note")
								.setIcon(ignored ? "eye" : "eye-off")
								.onClick(() => this.setNoteIgnored(file, !ignored)),
						);
					}
				}
				this.addOptionsItem(menu);
			}),
		);

		// Au démarrage, un éditeur peut analyser avant que les métadonnées de sa note soient lues :
		// la balise du YAML lui échappe. Une fois tout indexé, on relance une fois.
		const resolved = this.app.metadataCache.on("resolved", () => {
			this.app.metadataCache.offref(resolved);
			this.refreshEditors();
		});
		this.registerEvent(resolved);

		// Le YAML modifié à la main, ou par le menu ci-dessus, se voit ici, une fois la note réindexée.
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (this.seen.has(file.path) && this.seen.get(file.path) !== this.exclusion(file)) this.refreshEditors(file);
			}),
		);

		// Une note déplacée peut changer de dossier, donc de statut.
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				this.seen.delete(oldPath);
				if (file instanceof TFile) this.refreshEditors(file);
			}),
		);

		this.addSettingTab(new BurrSettingTab(this.app, this));
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.refreshEditors();
	}

	/** Les mots faibles en vigueur : ceux de la note, à défaut ceux de la langue. */
	currentLexicon(): Lexicon {
		return this.lexicon ?? defaultLexicon(resolveLanguage({ text: "" }));
	}

	/** Les problèmes d'une note, du plus grave au moins grave (voir `priorities.ts`). Même règle que l'éditeur pour ce qui est laissé de côté. */
	problemsOf(view: MarkdownView): Problem[] | null | undefined {
		const { settings } = this;
		if (!(settings.enabled || settings.echoes || settings.weakWords)) return undefined;
		if (view.file && this.exclusion(view.file) !== null) return null;
		const text = view.editor.getValue();
		return prioritize(text, analyze(text, settings, this.lexicon));
	}

	/** Montre le panneau des priorités dans la barre latérale droite (le crée au besoin). */
	async openPriorities() {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(PRIORITIES_VIEW)[0];
		if (!leaf) {
			const right = workspace.getRightLeaf(false);
			if (!right) return;
			await right.setViewState({ type: PRIORITIES_VIEW, active: true });
			leaf = right;
		}
		workspace.revealLeaf(leaf);
	}

	/** Relit la note des mots faibles (absente : on revient aux mots de la langue) et relance l'analyse. */
	async loadLexicon() {
		const file = this.app.vault.getAbstractFileByPath(normalizePath(this.settings.weakNote));
		try {
			this.lexicon = file instanceof TFile ? parseLexicon(await this.app.vault.cachedRead(file)) : undefined;
		} catch (error) {
			console.error("Burr : note des mots faibles illisible", error);
			this.lexicon = undefined;
		}
		this.refreshEditors();
	}

	/** Ouvre la note des mots faibles ; si elle n'existe pas, la crée avec les mots de la langue, à éditer. */
	async openWeakWordsNote() {
		const path = normalizePath(this.settings.weakNote);
		let file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			const template = resolveLanguage({ text: "" }).weak?.template;
			if (template === undefined) return;
			const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
			try {
				if (folder && !this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder);
				file = await this.app.vault.create(path, template);
			} catch (error) {
				console.error("Burr : création de la note des mots faibles impossible", error);
				new Notice(`Burr : impossible de créer « ${path} ».`);
				return;
			}
		}
		if (file instanceof TFile) await this.app.workspace.getLeaf(false).openFile(file);
	}

	/** Pourquoi cette note n'est pas analysée, ou null si elle l'est. */
	private exclusion(file: TFile): Exclusion | null {
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
		return exclusionOf(file.path, frontmatter, this.settings);
	}

	/** Appelé par chaque éditeur avant d'analyser sa note. */
	private isExcluded(view: EditorView): boolean {
		const file = view.state.field(editorInfoField, false)?.file;
		// Un éditeur sans note (fenêtre flottante, éditeur embarqué) n'a ni dossier ni YAML : on l'analyse.
		if (!file) return false;
		const exclusion = this.exclusion(file);
		this.seen.set(file.path, exclusion);
		return exclusion !== null;
	}

	/** Pose ou retire la balise dans le YAML ; le surlignage suit quand la note est réindexée. */
	private async setNoteIgnored(file: TFile, ignored: boolean) {
		try {
			await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
				if (ignored) addIgnoreTag(frontmatter);
				else removeIgnoreTag(frontmatter);
			});
		} catch (error) {
			console.error("Burr : YAML illisible", error);
			new Notice("Burr : le YAML de cette note est illisible, la balise n'a pas été modifiée.");
		}
	}

	/** Remplit le sous-menu « Options de Burr » : afficher ou non chaque signal, lien vers les réglages. */
	private fillOptionsMenu(menu: Menu): Menu {
		return menu
			.addItem((item) =>
				item
					.setTitle("Répétitions")
					.setChecked(this.settings.enabled)
					.onClick(async () => {
						this.settings.enabled = !this.settings.enabled;
						await this.saveSettings();
					}),
			)
			.addItem((item) =>
				item
					.setTitle("Mots rares repris de loin")
					.setChecked(this.settings.echoes)
					.onClick(async () => {
						this.settings.echoes = !this.settings.echoes;
						await this.saveSettings();
					}),
			)
			.addItem((item) =>
				item
					.setTitle("Mots faibles")
					.setChecked(this.settings.weakWords)
					.onClick(async () => {
						this.settings.weakWords = !this.settings.weakWords;
						await this.saveSettings();
					}),
			)
			.addSeparator()
			.addItem((item) =>
				item
					.setTitle("Options du plugin…")
					.setIcon("settings")
					.onClick(() => this.openPluginSettings()),
			);
	}

	/** Ajoute « Options de Burr » au menu : un sous-menu si l'API (non publique) le permet, sinon un second menu au clic. */
	private addOptionsItem(menu: Menu) {
		menu.addItem((item) => {
			item.setTitle("Options de Burr").setIcon("sliders-horizontal");
			// `MenuItem.setSubmenu()` n'est pas dans l'API publique, mais c'est l'usage établi pour les sous-menus.
			const submenu = (item as MenuItem & { setSubmenu?(): Menu }).setSubmenu?.();
			if (submenu) this.fillOptionsMenu(submenu);
			else item.onClick((evt) => this.fillOptionsMenu(new Menu()).showAtMouseEvent(evt as MouseEvent));
		});
	}

	/** Ouvre l'onglet de réglages de Burr. `app.setting` n'est pas non plus dans l'API publique. */
	private openPluginSettings() {
		const setting = (this.app as unknown as { setting?: { open(): void; openTabById(id: string): void } }).setting;
		setting?.open();
		setting?.openTabById(this.manifest.id);
	}

	/** Relance l'analyse dans les éditeurs ouverts : tous, ou ceux d'une seule note. */
	private refreshEditors(only?: TFile) {
		for (const leaf of this.app.workspace.getLeavesOfType(PRIORITIES_VIEW)) {
			if (leaf.view instanceof PrioritiesView) leaf.view.refresh();
		}
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (!(leaf.view instanceof MarkdownView)) return;
			if (only && leaf.view.file !== only) return;
			// `editor.cm` n'est pas dans l'API publique, mais c'est l'usage établi.
			const cm = (leaf.view.editor as unknown as { cm?: EditorView }).cm;
			cm?.dispatch({ effects: refreshHighlights.of(null) });
		});
	}
}
