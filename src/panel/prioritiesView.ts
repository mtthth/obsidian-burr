import type { EditorView } from "@codemirror/view";
import { ItemView, MarkdownView, Menu } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { IgnoredProblem } from "../analyze.ts";
import { showPassage } from "../editor/highlight.ts";
import type { IgnoredPassage } from "../ignore.ts";
import { formatScore } from "../priorities.ts";
import type { Problem } from "../priorities.ts";

export const PRIORITIES_VIEW = "burr-priorities";

/** Combien de problèmes le panneau liste : les plus graves, pas un inventaire. */
const LIMIT = 25;

const CATEGORY_LABELS: Record<string, string> = {
	repetition: "Répétition",
	echo: "Écho",
	weak: "Mots faibles",
	opening: "Débuts répétés",
};

/** Ce que le panneau demande au plugin : analyser une note, sans rien savoir de ses réglages. */
export interface PrioritiesSource {
	/**
	 * Les problèmes de la note, ceux que montre l'éditeur et ceux que l'auteur a écartés ;
	 * `null` si elle est laissée de côté (dossier, balise), `undefined` si tout est désactivé.
	 */
	problemsOf(view: MarkdownView): { active: Problem[]; ignored: IgnoredProblem[] } | null | undefined;
	setProblemIgnored(path: string, key: string, ignored: boolean): Promise<void>;
	setPassageIgnored(path: string, passage: IgnoredPassage, ignored: boolean): Promise<void>;
}

/** Le panneau « Priorités » : les passages les plus graves de la note ouverte, un clic mène au texte. */
export class PrioritiesView extends ItemView {
	/** La note dont on parle : le dernier éditeur actif (le panneau lui-même ne l'est pas quand on y clique). */
	private source: MarkdownView | null = null;
	private timer: number | null = null;
	/** Montre les problèmes ignorés (pour les réintégrer) au lieu des autres. */
	private showIgnored = false;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: PrioritiesSource,
	) {
		super(leaf);
	}

	getViewType(): string {
		return PRIORITIES_VIEW;
	}

	getDisplayText(): string {
		return "Priorités de Burr";
	}

	getIcon(): string {
		return "list-ordered";
	}

	async onOpen() {
		this.contentEl.addClass("burr-priorities");
		this.source = this.app.workspace.getActiveViewOfType(MarkdownView);
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf?.view instanceof MarkdownView && leaf.view !== this.source) {
					this.source = leaf.view;
					this.showIgnored = false;
					this.refresh(0);
				}
			}),
		);
		// Pendant la frappe, on attend une pause : l'analyse porte sur toute la note.
		this.registerEvent(
			this.app.workspace.on("editor-change", (_editor, info) => {
				if (info === this.source) this.refresh(600);
			}),
		);
		this.refresh(0);
	}

	async onClose() {
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = null;
	}

	/** Relance l'analyse, après `delay` ms ; un appel plus récent annule le précédent. */
	refresh(delay = 0) {
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = window.setTimeout(() => {
			this.timer = null;
			this.render();
		}, delay);
	}

	private render() {
		const root = this.contentEl;
		root.empty();
		// Une note fermée n'est plus un éditeur : on ne s'y fie pas.
		const view = this.source?.leaf.view === this.source ? this.source : null;
		if (!view) return this.message(root, "Ouvrez une note pour voir ses priorités.");

		const problems = this.plugin.problemsOf(view);
		if (problems === undefined) return this.message(root, "Tous les signaux de Burr sont désactivés.");
		if (problems === null) return this.message(root, "Cette note est laissée de côté par Burr.");
		const { active, ignored } = problems;
		if (active.length === 0 && ignored.length === 0) return this.message(root, "Rien à signaler dans cette note.");
		// Plus rien d'ignoré à revoir : on revient à la liste.
		if (ignored.length === 0) this.showIgnored = false;

		const shown = this.showIgnored ? ignored : active.slice(0, LIMIT);
		const header = root.createDiv({ cls: "burr-priorities-header" });
		const summary = this.showIgnored
			? `${ignored.length} problème${ignored.length > 1 ? "s" : ""} ignoré${ignored.length > 1 ? "s" : ""}`
			: shown.length < active.length
				? `${shown.length} problèmes les plus graves, sur ${active.length}`
				: `${active.length} problème${active.length > 1 ? "s" : ""}`;
		header.createSpan({ cls: "burr-priorities-summary", text: summary });
		if (ignored.length > 0) {
			const toggle = header.createEl("button", {
				cls: "burr-priorities-toggle",
				text: this.showIgnored ? "Retour" : `Ignorés (${ignored.length})`,
			});
			toggle.addEventListener("click", () => {
				this.showIgnored = !this.showIgnored;
				this.refresh(0);
			});
		}
		if (shown.length === 0) return this.message(root, "Rien à signaler dans cette note.");

		const list = root.createDiv({ cls: "burr-priorities-list" });
		for (const problem of shown) this.renderProblem(list, view, problem);
	}

	private message(root: HTMLElement, text: string) {
		root.createDiv({ cls: "burr-priorities-empty", text });
	}

	private renderProblem(list: HTMLElement, view: MarkdownView, problem: Problem | IgnoredProblem) {
		const scope = "scope" in problem ? problem.scope : null;
		const item = list.createDiv({ cls: `burr-priority burr-priority-${problem.category}` });
		const head = item.createDiv({ cls: "burr-priority-head" });
		head.createSpan({ cls: "burr-priority-score", text: formatScore(problem.score) });
		const title = problem.words.map((word) => `« ${word} »`).join(", ") || (CATEGORY_LABELS[problem.category] ?? problem.category);
		const count = problem.spans.length > 2 || problem.words.length > 1 ? ` ×${problem.spans.length}` : "";
		head.createSpan({ cls: "burr-priority-title", text: title + count });
		item.createDiv({ cls: "burr-priority-detail", text: problem.detail });
		if (scope) item.createDiv({ cls: "burr-priority-scope", text: scope === "note" ? "Ignoré dans toute la note" : "Ignoré à cet endroit" });

		// Un clic mène au premier passage ; les suivants parcourent les autres, puis reviennent au premier.
		let next = 0;
		item.addEventListener("click", () => {
			const span = problem.spans[next % problem.spans.length];
			next++;
			this.app.workspace.setActiveLeaf(view.leaf, { focus: true });
			// `editor.cm` n'est pas dans l'API publique, mais c'est l'usage établi.
			const cm = (view.editor as unknown as { cm?: EditorView }).cm;
			if (cm) {
				showPassage(cm, span, problem.spans.filter((other) => other !== span));
				cm.focus();
			} else {
				view.editor.setSelection(view.editor.offsetToPos(span.from), view.editor.offsetToPos(span.to));
			}
		});

		// Clic droit : écarter le problème du panneau (ou le réintégrer, dans la liste des ignorés).
		item.addEventListener("contextmenu", (event) => {
			event.preventDefault();
			const path = view.file?.path;
			if (!path) return;
			const menu = new Menu();
			if (scope)
				menu.addItem((entry) =>
					entry
						.setTitle("Ne plus ignorer")
						.setIcon("eye")
						.onClick(() =>
							void (scope === "note"
								? this.plugin.setProblemIgnored(path, problem.key, false)
								: this.plugin.setPassageIgnored(path, problem, false)),
						),
				);
			else
				menu
					.addItem((entry) =>
						entry
							.setTitle("Ignorer à cet endroit")
							.setIcon("eye-off")
							.onClick(() => void this.plugin.setPassageIgnored(path, problem, true)),
					)
					.addItem((entry) =>
						entry
							.setTitle("Ignorer dans toute la note")
							.setIcon("eye-off")
							.onClick(() => void this.plugin.setProblemIgnored(path, problem.key, true)),
					);
			menu.showAtMouseEvent(event);
		});
	}
}
