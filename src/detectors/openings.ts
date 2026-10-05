import type { Token } from "../text/tokenize.ts";
import type { DetectionInput, Detector, Explanation, Highlight } from "./types.ts";

export const OPENING = "opening";

/** Phrases : au moins `MIN_SENTENCES` du même début parmi `WINDOW` phrases consécutives. */
const WINDOW = 5;
const MIN_SENTENCES = 3;
/** Paragraphes : au moins ce nombre de paragraphes de prose qui se suivent, du même début. */
const MIN_PARAGRAPHS = 3;

/** Une couleur fixe (celle d'index 11 de la palette) : ce signal porte sur une position, pas sur une famille de mots. */
const COLOR = 11;

type Intensity = 1 | 2 | 3;

/** Le poids d'un passage selon son intensité (voir `Highlight.severity`) : une série de trois pèse 3 à 4,5. */
const SENTENCE_SEVERITY = [0, 1, 1.5, 2];
const PARAGRAPH_SEVERITY = [0, 1.5, 2, 2.5];

const SENTENCE_END = /[!?…]/;
/** Une ligne de titre, de liste, de citation ou de tableau n'est pas de la prose à relire. */
const NOT_PROSE = /^\s*(?:#{1,6}[ \t]|[-+*][ \t]|\d+[.)][ \t]|>|\|)/;
/** Ce que l'on passe pour lire le début d'une ligne : espaces, emphase (`*`, `_`, `~`, `=`) et crochets de lien. */
const TRANSPARENT = /^[\s*_~=[]+/;
/** Une ligne de dialogue (tiret cadratin, demi-cadratin ou « -- », guillemet), masquée ou non. */
const DIALOGUE_LINE = /^\s*(?:[—–«]|--)/;

/** Ce que la ligne d'un mot dit de lui : de la prose, une réplique ou une citation (le début est un signe), ou autre chose (titre, liste). */
type LineKind = "prose" | "quoted" | "other";

function lineKind(text: string, position: number): LineKind {
	const prefix = text.slice(text.lastIndexOf("\n", position - 1) + 1, position);
	if (NOT_PROSE.test(prefix)) return "other";
	return prefix.replace(TRANSPARENT, "") === "" ? "prose" : "quoted";
}

/** Un début de phrase : un mot, et la place de sa phrase dans le texte. */
interface Start {
	token: number;
	/** Ce que le mot compte pour : son groupe, ou lui-même. */
	key: string;
	/** La phrase ouvre un paragraphe. */
	paragraph: boolean;
	kind: LineKind;
	/** Numéro de coupure : un titre, une séparation de scène ou un bloc ignoré ferme la série en cours. */
	segment: number;
}

/** Les débuts de phrase d'un texte, dans l'ordre. Les titres et les listes n'en ont pas. */
function findStarts({ text, tokens, language }: DetectionInput): Start[] {
	const support = language.openings;
	if (!support) return [];
	const groupOf = new Map<string, string>();
	for (const group of support.groups) for (const word of group.words) groupOf.set(word, `#${group.id}`);

	const starts: Start[] = [];
	let segment = 0;
	let kind: LineKind = "prose";
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		const previous = i > 0 ? tokens[i - 1] : undefined;
		const gap = previous ? text.slice(previous.to, token.from) : "\n";
		const newLine = gap.includes("\n");
		let start = newLine;
		if (newLine) {
			// Entre deux paragraphes : une ligne qui n'est pas du dialogue (séparation `***`, bloc de code ignoré…) coupe la série.
			const between = gap.split("\n").slice(1, -1);
			if (between.some((line) => line.trim() !== "" && !DIALOGUE_LINE.test(line))) segment++;
			kind = lineKind(text, token.from);
			if (kind === "other") segment++;
		} else if (previous && token.capitalized && endsSentence(gap, previous, support.abbreviations)) {
			start = true;
		}
		if (!start || kind === "other") continue;
		starts.push({ token: i, key: groupOf.get(token.norm) ?? token.norm, paragraph: newLine, kind, segment });
	}
	return starts;
}

/** Le point ne finit pas la phrase après « M. » ou une initiale (« J. Dupont »). */
function endsSentence(gap: string, previous: Token, abbreviations: ReadonlySet<string>): boolean {
	if (SENTENCE_END.test(gap)) return true;
	if (!gap.includes(".")) return false;
	const abbreviated = abbreviations.has(previous.norm) || (previous.to - previous.from === 1 && previous.capitalized);
	return !(abbreviated && /^\.\s*$/.test(gap));
}

/** Une série de débuts identiques : `members` sont des indices dans la liste des débuts de phrase. */
interface Run {
	key: string;
	members: number[];
}

/**
 * Les séries de phrases : au moins `MIN_SENTENCES` du même début dans `WINDOW` phrases consécutives, sans
 * titre ni coupure entre elles. Une série prolonge les triplets qui se chevauchent ; elle compte tous leurs débuts.
 */
function sentenceRuns(starts: readonly Start[]): Run[] {
	const byKey = new Map<string, number[]>();
	starts.forEach((start, i) => {
		const list = byKey.get(start.key);
		if (list) list.push(i);
		else byKey.set(start.key, [i]);
	});

	const runs: Run[] = [];
	for (const [key, positions] of byKey) {
		const inTriple = new Array<boolean>(positions.length).fill(false);
		const reach = MIN_SENTENCES - 1;
		for (let j = 0; j + reach < positions.length; j++) {
			const first = positions[j];
			const last = positions[j + reach];
			if (last - first < WINDOW && starts[first].segment === starts[last].segment) {
				for (let k = j; k <= j + reach; k++) inTriple[k] = true;
			}
		}
		let run: Run | null = null;
		let previous = -1;
		for (let j = 0; j < positions.length; j++) {
			if (!inTriple[j]) continue;
			const position = positions[j];
			if (run && position - previous < WINDOW && starts[position].segment === starts[previous].segment) run.members.push(position);
			else {
				run = { key, members: [position] };
				runs.push(run);
			}
			previous = position;
		}
	}
	return runs;
}

/** Les séries de paragraphes : `MIN_PARAGRAPHS` paragraphes de prose de suite, du même début. Le dialogue ne compte pas et ne coupe pas. */
function paragraphRuns(starts: readonly Start[]): Run[] {
	const runs: Run[] = [];
	let current: Run | null = null;
	let segment = -1;
	starts.forEach((start, i) => {
		if (!start.paragraph || start.kind !== "prose") return;
		if (current && current.key === start.key && segment === start.segment) current.members.push(i);
		else {
			current = { key: start.key, members: [i] };
			runs.push(current);
		}
		segment = start.segment;
	});
	return runs.filter((run) => run.members.length >= MIN_PARAGRAPHS);
}

/** « il », « elle » ou « on » : les mots d'une série, tels qu'ils sont écrits (« j' » garde son apostrophe). */
function wordsOf(text: string, tokens: readonly Token[], starts: readonly Start[], run: Run): string {
	const words: string[] = [];
	for (const member of run.members) {
		const token = tokens[starts[member].token];
		const word = text.slice(token.from, token.to).toLowerCase() + (text[token.to] === "'" || text[token.to] === "’" ? "'" : "");
		if (!words.includes(word)) words.push(word);
	}
	const quoted = words.map((word) => `« ${word} »`);
	return quoted.length > 1 ? `${quoted.slice(0, -1).join(", ")} ou ${quoted[quoted.length - 1]}` : quoted[0];
}

/**
 * Débuts répétés : une position précise du texte, pas des mots qui reviennent. Cinq phrases d'affilée qui commencent
 * par « Il », « Elle », « Il », « Il » se lisent comme une litanie, même si aucun mot n'est répété de près ailleurs.
 * Le signal est donc posé sur le seul premier mot, et deux niveaux se complètent :
 *
 * - Phrases : au moins trois du même début parmi cinq consécutives. Les mots d'un groupe (« il », « elle »,
 *   « on », voir `Language.openings`) comptent pour un seul ; tout autre mot ne compte que contre lui-même.
 * - Paragraphes : trois paragraphes de prose de suite, du même début. Les répliques de dialogue sont laissées de côté
 *   (elles ne comptent pas et ne coupent pas la série) ; un titre, une liste, une séparation de scène la coupent.
 *
 * Un début de paragraphe signalé comme tel n'est pas signalé en plus comme début de phrase.
 */
function detect(input: DetectionInput): Highlight[] {
	if (!input.settings.openings) return [];
	const { text, tokens } = input;
	const starts = findStarts(input);

	const highlights: Highlight[] = [];
	const taken = new Set<number>();
	const emit = (run: Run, label: (count: number, words: string) => string, kind: "paragraphe" | "phrase") => {
		const count = run.members.length;
		const intensity: Intensity =
			kind === "phrase" ? (count >= 5 ? 3 : count === 4 ? 2 : 1) : count >= 4 ? 3 : 2;
		const severity = (kind === "phrase" ? SENTENCE_SEVERITY : PARAGRAPH_SEVERITY)[intensity];
		const words = wordsOf(text, tokens, starts, run);
		const first = starts[run.members[0]].token;
		const reach = kind === "phrase" ? run.members[count - 1] - run.members[0] + 1 : count;
		for (const member of run.members) {
			const index = starts[member].token;
			if (taken.has(index)) continue;
			taken.add(index);
			highlights.push({
				from: tokens[index].from,
				to: tokens[index].to,
				category: OPENING,
				family: `${kind}:${run.key}`,
				color: COLOR,
				intensity,
				severity,
				group: `${kind}:${run.key}:${first}`,
				explain: (): Explanation => ({ text: label(reach, words) }),
			});
		}
	};

	for (const run of paragraphRuns(starts)) {
		emit(run, (count, words) => `${count} paragraphes de suite commencent par ${words}.`, "paragraphe");
	}
	for (const run of sentenceRuns(starts)) {
		const count = run.members.length;
		emit(run, (reach, words) => `${count} phrases sur ${reach} commencent par ${words}.`, "phrase");
	}
	return highlights.sort((a, b) => a.from - b.from);
}

export const openings: Detector = { id: "openings", detect };
