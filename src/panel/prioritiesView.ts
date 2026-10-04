import { ItemView, MarkdownView } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { Problem } from "../priorities.ts";

export const PRIORITIES_VIEW = "burr-priorities";

/** Combien de problèmes le panneau liste : les plus graves, pas un inventaire. */
const LIMIT = 25;

const CATEGORY_LABELS: Record<string, string> = {
	repetition: "Répétition",
	echo: "Écho",
	weak: "Mots faibles",
};

/** Ce que le panneau demande au plugin : analyser une note, sans rien savoir de ses réglages. */
export interface PrioritiesSource {
	/** Les problèmes de la note ; `null` si elle est laissée de côté (dossier, balise), `undefined` si tout est désactivé. */
	problemsOf(view: MarkdownView): Problem[] | null | undefined;
}

/** Le panneau « Priorités » : les passages les plus graves de la note ouverte, un clic mène au texte. */
export class PrioritiesView extends ItemView {
	/** La note dont on parle : le dernier éditeur actif (le panneau lui-même ne l'est pas quand on y clique). */
	private source: MarkdownView | null = null;
	private timer: number | null = null;

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
		if (problems.length === 0) return this.message(root, "Rien à signaler dans cette note.");

		const shown = problems.slice(0, LIMIT);
		const summary =
			shown.length < problems.length
				? `${shown.length} problèmes les plus graves, sur ${problems.length}`
				: `${problems.length} problème${problems.length > 1 ? "s" : ""}`;
		root.createDiv({ cls: "burr-priorities-summary", text: summary });
		const list = root.createDiv({ cls: "burr-priorities-list" });
		for (const problem of shown) this.renderProblem(list, view, problem);
	}

	private message(root: HTMLElement, text: string) {
		root.createDiv({ cls: "burr-priorities-empty", text });
	}

	private renderProblem(list: HTMLElement, view: MarkdownView, problem: Problem) {
		const item = list.createDiv({ cls: `burr-priority burr-priority-${problem.category}` });
		const head = item.createDiv({ cls: "burr-priority-head" });
		head.createSpan({ cls: "burr-priority-score", text: formatScore(problem.score) });
		const title = problem.words.map((word) => `« ${word} »`).join(", ") || (CATEGORY_LABELS[problem.category] ?? problem.category);
		const count = problem.spans.length > 2 || problem.words.length > 1 ? ` ×${problem.spans.length}` : "";
		head.createSpan({ cls: "burr-priority-title", text: title + count });
		item.createDiv({ cls: "burr-priority-detail", text: problem.detail });

		// Un clic mène au premier passage ; les suivants parcourent les autres, puis reviennent au premier.
		let next = 0;
		item.addEventListener("click", () => {
			const span = problem.spans[next % problem.spans.length];
			next++;
			const editor = view.editor;
			const length = editor.getValue().length;
			const from = editor.offsetToPos(Math.min(span.from, length));
			const to = editor.offsetToPos(Math.min(span.to, length));
			this.app.workspace.setActiveLeaf(view.leaf, { focus: true });
			editor.setSelection(from, to);
			editor.scrollIntoView({ from, to }, true);
		});
	}
}

/** « 8 », « 1,5 » : une décimale seulement quand il y en a une. */
function formatScore(score: number): string {
	return String(Math.round(score * 10) / 10).replace(".", ",");
}
