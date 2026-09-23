import { parseWordList } from "../settings.ts";
import type { Token } from "../text/tokenize.ts";
import type { DetectionInput, Detector, Explanation, Highlight } from "./types.ts";

export const REPETITION = "repetition";
/** Un mot rare repris de loin : souligné d'une vague plutôt que surligné. */
export const ECHO = "echo";

/**
 * Ce que l'infobulle dit d'un mot selon son degré d'usage. Un écho a un degré de 0 à 2 :
 * `echoRarity` ne dépasse pas 3 (ECHO_RARITY_RANGE), et les mots courants n'en sont jamais.
 */
const RARITY_LABELS = ["très rare", "rare", "peu courant"];

/** En dessous, un mot n'est jamais signalé (eau, mer, or, air passent déjà à trois lettres). */
const MIN_WORD_LENGTH = 3;
/** Les racines très courtes (« tel ») rapprochent des mots qui n'ont rien à voir. */
const MIN_STEM_LENGTH = 4;
const LETTER = /\p{L}/u;

type Intensity = 1 | 2 | 3;

/** Plus les deux occurrences sont proches, plus le surlignage est marqué. */
function intensityFor(distance: number, window: number): Intensity {
	const ratio = distance / window;
	return ratio <= 0.2 ? 3 : ratio <= 0.5 ? 2 : 1;
}

/** Où se trouve l'autre occurrence, en mots : « 5 mots plus haut », « 2 960 mots plus loin », « juste après »… */
function where(distance: number, before: boolean): string {
	if (distance === 1) return before ? "juste avant" : "juste après";
	// Espace fine insécable entre les milliers, sans dépendre de la langue du système.
	const count = String(distance).replace(/\B(?=(\d{3})+$)/g, "\u202f");
	return `${count} mots plus ${before ? "haut" : "loin"}`;
}

/** Une phrase d'infobulle dont le passage `place` (« 5 mots plus haut ») mène à l'autre occurrence. */
function sentence(before: string, place: string, after: string): Explanation {
	return { text: before + place + after, link: [before.length, before.length + place.length] };
}

/**
 * Mots qui s'écrivent avec une majuscule ailleurs qu'en début de phrase :
 * des noms propres. Un personnage qui revient sans cesse n'est pas une répétition.
 * Les mots-outils et les mots très courts sont écartés : « Il » ou « Qu' » après
 * un tiret de dialogue mal reconnu ne font pas de « il » ou de « qu » des noms propres.
 */
function properNames(tokens: readonly Token[], stopwords: ReadonlySet<string>): Set<string> {
	const names = new Set<string>();
	for (const token of tokens) {
		if (token.capitalized && !token.sentenceStart && token.norm.length >= MIN_WORD_LENGTH && !stopwords.has(token.norm)) {
			names.add(token.norm);
		}
	}
	return names;
}

/**
 * Répétitions par proximité : deux occurrences d'un mot ou d'une expression
 * séparées par au plus `window` mots. Un seul passage sur les mots par famille
 * de comparaison, avec la dernière position vue de chaque clé : complexité linéaire.
 *
 * - Même forme (« regardait » … « regardait ») : signal plein.
 * - Même racine, formes différentes (« regardait » … « regarda ») : signal
 *   atténué et limité à la moitié de la fenêtre, car le stemming se trompe.
 * - Expressions de 2 à `maxNgram` mots (« tout de même ») : la plus longue
 *   l'emporte sur les mots qu'elle contient.
 * - Mots rares (« chatoyant ») repris de loin, jusqu'à `echoReach` mots : un
 *   lecteur s'en souvient bien au-delà de la fenêtre. Catégorie à part (ECHO), sur
 *   les seuls mots que rien d'autre ne surligne : les plages ne se chevauchent jamais.
 */
function detect({ text, tokens, language, settings }: DetectionInput): Highlight[] {
	const count = tokens.length;
	const reach = settings.window;

	const ignored = parseWordList(settings.extraIgnoredWords);
	const names = settings.ignoreProperNames ? properNames(tokens, language.stopwords) : new Set<string>();

	// Trois sortes de mots : pleins (signalables), mots-outils (jamais signalés
	// seuls, mais qui comptent dans une expression), et écartés (noms propres,
	// mots de l'utilisateur : ils ne comptent nulle part, expressions comprises).
	const FUNCTION = 0;
	const FULL = 1;
	const EXCLUDED = 2;
	const kind = new Uint8Array(count);
	for (let i = 0; i < count; i++) {
		const word = tokens[i].norm;
		if (ignored.has(word) || names.has(word)) kind[i] = EXCLUDED;
		else if (word.length >= MIN_WORD_LENGTH && LETTER.test(word) && !language.stopwords.has(word)) kind[i] = FULL;
		else kind[i] = FUNCTION;
	}

	const wordLevel = new Uint8Array(count); // mots isolés
	const wordOther = new Int32Array(count); // le mot auquel il a été rapproché, à son niveau le plus marqué
	const wordSame = new Uint8Array(count); // 1 si c'est la même forme, 0 si la racine seulement
	// La racine par laquelle une forme a été rapprochée d'une autre : c'est la famille de toutes
	// ses occurrences, même celles que seule la même forme relie (mangeons … mangeons … manger).
	const familyOfForm = new Map<string, string>();
	const phraseLevel = new Uint8Array(count); // mots couverts par une expression répétée
	const phraseKey = new Array<string>(count); // l'expression qui couvre chaque mot
	const phraseStart = new Int32Array(count); // le premier mot de cette occurrence de l'expression
	const phraseOther = new Int32Array(count); // le premier mot de l'autre occurrence
	const phraseSize = new Uint8Array(count); // le nombre de mots de l'expression

	// Un mot garde le rapprochement le plus marqué (le premier à égalité) : c'est celui que l'infobulle explique.
	const raiseWord = (index: number, level: number, other: number, same: boolean) => {
		if (level <= wordLevel[index]) return;
		wordLevel[index] = level;
		wordOther[index] = other;
		wordSame[index] = same ? 1 : 0;
	};
	const raisePhrase = (index: number, level: number, key: string, start: number, other: number, size: number) => {
		if (level <= phraseLevel[index]) return;
		phraseLevel[index] = level;
		phraseKey[index] = key;
		phraseStart[index] = start;
		phraseOther[index] = other;
		phraseSize[index] = size;
	};

	// Les infobulles. Chaque plage rend une fonction qui écrit sa phrase à la demande ;
	// la distance (« 5 mots plus haut ») y est le lien vers l'autre occurrence.
	const textOf = (first: number, last: number) => text.slice(tokens[first].from, tokens[last].to);
	const spanOf = (first: number, last: number) => ({ from: tokens[first].from, to: tokens[last].to });
	const explainWord = (index: number, other: number, same: boolean) => (): Explanation => {
		const before = other < index;
		const place = where(Math.abs(index - other), before);
		if (same) return sentence(`« ${textOf(index, index)} » ${before ? "apparaît déjà" : "revient"} `, place, ".");
		// Deux formes d'un verbe irrégulier n'ont pas de racine commune : on nomme l'infinitif.
		const lemma = language.lemma?.(tokens[index].norm);
		if (lemma !== undefined && lemma === language.lemma?.(tokens[other].norm)) {
			return sentence(`« ${textOf(index, index)} » et « ${textOf(other, other)} » sont deux formes de « ${lemma} » (`, place, ").");
		}
		return sentence(`« ${textOf(index, index)} » a la même racine que « ${textOf(other, other)} » (`, place, ").");
	};
	const explainPhrase = (start: number, other: number, size: number) => (): Explanation => {
		const before = other < start;
		const place = where(Math.abs(start - other), before);
		return sentence(`L'expression « ${textOf(start, start + size - 1)} » ${before ? "apparaît déjà" : "revient"} `, place, ".");
	};
	const explainEcho = (index: number, other: number, commonness: number) => (): Explanation => {
		const before = other < index;
		const place = where(Math.abs(index - other), before);
		const word = `« ${textOf(index, index)} », mot ${RARITY_LABELS[commonness]},`;
		if (tokens[index].norm === tokens[other].norm) return sentence(`${word} ${before ? "apparaît déjà" : "revient"} `, place, ".");
		const form = `« ${textOf(other, other)} »`;
		return sentence(before ? `${word} reprend ${form} ` : `${word} revient sous la forme ${form} `, place, ".");
	};

	// Famille d'un mot isolé : quand le stemming est actif, l'infinitif d'un verbe
	// irrégulier (fait, faisons, ferai), la racine par laquelle il a été rapproché
	// d'une autre forme, ou à défaut sa racine (regardait, regarda et regardant se
	// répondent) ; sans stemming, sa forme.
	const wordFamily = (index: number): string => {
		const word = tokens[index].norm;
		if (settings.useStemming) {
			const lemma = language.lemma?.(word);
			if (lemma !== undefined) return lemma;
			const linked = familyOfForm.get(word);
			if (linked !== undefined) return linked;
			const stem = language.stem(word);
			if (stem.length >= MIN_STEM_LENGTH) return stem;
		}
		return word;
	};

	// Les racines d'un mot, assez longues pour ne pas rapprocher n'importe quoi. L'infinitif
	// d'un verbe irrégulier vient en premier : à distance égale, c'est lui qui relie.
	const stemsOf = (word: string): string[] => {
		const stems = [language.lemma?.(word), language.stem(word), language.altStem?.(word)];
		return stems.filter((stem): stem is string => stem !== undefined && stem.length >= MIN_STEM_LENGTH);
	};

	// 1. Même forme.
	const lastSeen = new Map<string, number>();
	for (let i = 0; i < count; i++) {
		if (kind[i] !== FULL) continue;
		const word = tokens[i].norm;
		const previous = lastSeen.get(word);
		if (settings.enabled && previous !== undefined && i - previous <= reach) {
			const level = intensityFor(i - previous, reach);
			raiseWord(i, level, previous, true);
			raiseWord(previous, level, i, true);
		}
		lastSeen.set(word, i);
	}

	// 2. Même racine, forme différente. Un mot peut avoir deux racines (« mangeons » :
	// « mangeon » et « mang ») : il est rangé sous les deux, et rapproché du plus proche.
	if (settings.useStemming) {
		const formsByStem = new Map<string, Map<string, number>>();
		for (let i = 0; i < count; i++) {
			if (kind[i] !== FULL) continue;
			const word = tokens[i].norm;

			let nearest = -1;
			let nearestStem = "";
			for (const stem of stemsOf(word)) {
				let forms = formsByStem.get(stem);
				if (!forms) formsByStem.set(stem, (forms = new Map()));
				for (const [form, index] of forms) {
					if (form !== word && index > nearest) {
						nearest = index;
						nearestStem = stem;
					}
				}
				forms.set(word, i);
			}
			if (settings.enabled && nearest >= 0 && i - nearest <= reach / 2) {
				const level = intensityFor(i - nearest, reach) === 3 ? 2 : 1;
				raiseWord(i, level, nearest, false);
				raiseWord(nearest, level, i, false);
				// Ces deux formes ont désormais la même famille. Un verbe irrégulier donne
				// la sienne (« connaissance » rapproché de « connaissait » suit « connaître ») ;
				// il n'a pas besoin d'être noté, sa famille est déjà celle de son infinitif.
				const other = tokens[nearest].norm;
				const family = language.lemma?.(word) ?? language.lemma?.(other) ?? nearestStem;
				for (const form of [word, other]) {
					if (language.lemma?.(form) === undefined) familyOfForm.set(form, family);
				}
			}
		}
	}

	// 3. Expressions de 2 à maxNgram mots dans une même phrase ou proposition.
	for (let size = 2; size <= settings.maxNgram; size++) {
		const firstSeen = new Map<string, number>();
		for (let i = 0; i + size <= count; i++) {
			if (tokens[i].segment !== tokens[i + size - 1].segment) continue;

			// Une paire n'est une expression que si elle compte deux mots pleins :
			// « la porte » n'est que « porte » avec un article. Dès trois mots,
			// même des mots-outils seuls comptent (« il n'y avait pas »).
			let full = 0;
			let excluded = false;
			for (let k = 0; k < size; k++) {
				if (kind[i + k] === FULL) full++;
				else if (kind[i + k] === EXCLUDED) excluded = true;
			}
			if (excluded || (size < 3 && full < 2)) continue;

			let key = tokens[i].norm;
			for (let k = 1; k < size; k++) key += " " + tokens[i + k].norm;

			const previous = firstSeen.get(key);
			if (previous !== undefined) {
				const distance = i - previous;
				if (distance < size) continue; // les deux occurrences se chevauchent
				if (settings.enabled && distance <= reach) {
					const boost = size >= 3 ? 1 : 0;
					const level = Math.min(3, intensityFor(distance, reach) + boost);
					for (let k = 0; k < size; k++) {
						raisePhrase(i + k, level, key, i, previous, size);
						raisePhrase(previous + k, level, key, previous, i, size);
					}
				}
			}
			firstSeen.set(key, i);
		}
	}

	// 4. Mots rares repris de loin. Chaque famille rare est suivie dans tout le document ;
	// deux emplois qui se suivent forment un écho s'ils sont à moins de `echoReach` mots.
	// Un mot déjà surligné de près le reste : on ne souligne que les autres, et chacun
	// explique l'emploi le plus proche (le premier à égalité).
	const echoOther = new Int32Array(count).fill(-1);
	const echoCommonness = new Uint8Array(count);
	if (settings.echoes && language.commonness) {
		const echoReach = settings.echoReach > 0 ? settings.echoReach : Infinity;
		const lastOfFamily = new Map<string, number>();
		const link = (index: number, other: number) => {
			if (wordLevel[index] || phraseLevel[index]) return;
			const current = echoOther[index];
			if (current < 0 || Math.abs(other - index) < Math.abs(current - index)) echoOther[index] = other;
		};
		for (let i = 0; i < count; i++) {
			if (kind[i] !== FULL) continue;
			const commonness = language.commonness(tokens[i].norm);
			if (commonness >= settings.echoRarity) continue;
			echoCommonness[i] = commonness;
			const family = wordFamily(i);
			const previous = lastOfFamily.get(family);
			if (previous !== undefined && i - previous <= echoReach) {
				link(i, previous);
				link(previous, i);
			}
			lastOfFamily.set(family, i);
		}
	}

	// 5. Plages : une suite de mots couverts par des expressions devient une seule plage.
	const highlights: Highlight[] = [];
	for (let i = 0; i < count; ) {
		if (phraseLevel[i]) {
			const segment = tokens[i].segment;
			let end = i;
			let level = 0;
			let strongest = i; // le mot couvert par l'expression la plus marquée donne sa famille à la plage
			while (end < count && phraseLevel[end] && tokens[end].segment === segment) {
				if (phraseLevel[end] > phraseLevel[strongest]) strongest = end;
				level = Math.max(level, phraseLevel[end], wordLevel[end]);
				end++;
			}
			highlights.push({
				from: tokens[i].from,
				to: tokens[end - 1].to,
				category: REPETITION,
				family: phraseKey[strongest],
				intensity: level as Intensity,
				target: spanOf(phraseOther[strongest], phraseOther[strongest] + phraseSize[strongest] - 1),
				explain: explainPhrase(phraseStart[strongest], phraseOther[strongest], phraseSize[strongest]),
			});
			i = end;
		} else {
			if (wordLevel[i]) {
				highlights.push({
					from: tokens[i].from,
					to: tokens[i].to,
					category: REPETITION,
					family: wordFamily(i),
					intensity: wordLevel[i] as Intensity,
					target: spanOf(wordOther[i], wordOther[i]),
					explain: explainWord(i, wordOther[i], wordSame[i] === 1),
				});
			} else if (echoOther[i] >= 0) {
				highlights.push({
					from: tokens[i].from,
					to: tokens[i].to,
					category: ECHO,
					// Même famille, donc même couleur, que les répétitions proches du même mot.
					family: wordFamily(i),
					// Plus le mot est rare, plus la vague est marquée.
					intensity: (3 - echoCommonness[i]) as Intensity,
					target: spanOf(echoOther[i], echoOther[i]),
					explain: explainEcho(i, echoOther[i], echoCommonness[i]),
				});
			}
			i++;
		}
	}
	return highlights;
}

export const repetitions: Detector = { id: "repetitions", detect };
