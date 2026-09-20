// Stemmer Snowball pour le français, porté en TypeScript depuis la définition
// officielle : https://snowballstem.org/algorithms/french/stemmer.html
// (Snowball, licence BSD 3-clauses, Martin Porter et Richard Boulton.)
//
// Écart avec l'original : la routine « elisions » (l'homme -> homme) est omise,
// car le tokenizer coupe déjà les mots à l'apostrophe. Le reste est fidèle, et
// vérifié mot à mot contre l'implémentation de référence.

/** Une table « among » de Snowball : suffixe -> numéro d'action. */
type Among = ReadonlyArray<readonly [string, number]>;

// Le plus long suffixe d'abord : find_among_b renvoie la plus longue correspondance.
function among(entries: Array<[string, number]>): Among {
	return entries.sort((a, b) => b[0].length - a[0].length);
}

const VOWELS = "aeiouyâàëéêèïîôûù";
const OUX_ENDING = "bhjlnp";
const KEEP_WITH_S = "aiouès";

// `c` peut être vide (fin de mot) ; "abc".includes("") vaut true, d'où le test.
const isVowel = (c: string): boolean => c !== "" && VOWELS.includes(c);

// après -ement : iv, eus, abl, iqU, ièr
const A2 = among([
	["iqU", 3], ["abl", 3], ["Ièr", 4], ["ièr", 4],
	["eus", 2], ["iv", 1],
]);

// après -ité : abil, ic, iv
const A3 = among([
	["ic", 2], ["abil", 1], ["iv", 3],
]);

// suffixes de la « standard_suffix »
const A4 = among([
	["iqUe", 1], ["atrice", 2], ["ance", 1], ["ence", 5],
	["logie", 3], ["able", 1], ["isme", 1], ["euse", 12],
	["iste", 1], ["ive", 8], ["if", 8], ["usion", 4],
	["ation", 2], ["ution", 4], ["ateur", 2], ["iqUes", 1],
	["atrices", 2], ["ances", 1], ["ences", 5], ["logies", 3],
	["ables", 1], ["ismes", 1], ["euses", 12], ["istes", 1],
	["ives", 8], ["ifs", 8], ["usions", 4], ["ations", 2],
	["utions", 4], ["ateurs", 2], ["ments", 16], ["ements", 6],
	["issements", 13], ["ités", 7], ["ment", 16], ["ement", 6],
	["issement", 13], ["amment", 14], ["emment", 15], ["aux", 10],
	["eaux", 9], ["eux", 1], ["oux", 11], ["ité", 7],
]);

// suffixes verbaux en -i-
const A5 = among([
	["ira", 1], ["ie", 1], ["isse", 1], ["issante", 1],
	["i", 1], ["irai", 1], ["ir", 1], ["iras", 1],
	["ies", 1], ["îmes", 1], ["isses", 1], ["issantes", 1],
	["îtes", 1], ["is", 1], ["irais", 1], ["issais", 1],
	["irions", 1], ["issions", 1], ["irons", 1], ["issons", 1],
	["issants", 1], ["it", 1], ["irait", 1], ["issait", 1],
	["issant", 1], ["iraIent", 1], ["issaIent", 1], ["irent", 1],
	["issent", 1], ["iront", 1], ["ît", 1], ["iriez", 1],
	["issiez", 1], ["irez", 1], ["issez", 1],
]);

// exceptions de -ais : balais, mauvais, déplais
const A6 = among([
	["al", 1], ["épl", -1], ["auv", -1],
]);

// suffixes verbaux
const A7 = among([
	["a", 3], ["era", 2], ["aise", 4], ["asse", 3],
	["ante", 3], ["ée", 2], ["ai", 3], ["erai", 2],
	["er", 2], ["as", 3], ["eras", 2], ["âmes", 3],
	["aises", 4], ["asses", 3], ["antes", 3], ["âtes", 3],
	["ées", 2], ["ais", 4], ["eais", 2], ["erais", 2],
	["ions", 1], ["erions", 2], ["assions", 3], ["erons", 2],
	["ants", 3], ["és", 2], ["ait", 3], ["erait", 2],
	["ant", 3], ["aIent", 3], ["eraIent", 2], ["èrent", 2],
	["assent", 3], ["eront", 2], ["ât", 3], ["ez", 2],
	["iez", 2], ["eriez", 2], ["assiez", 3], ["erez", 2],
	["é", 2],
]);

// suffixes résiduels
const A8 = among([
	["e", 3], ["Ière", 2], ["ière", 2], ["ion", 1],
	["Ier", 2], ["ier", 2],
]);

// consonnes doublées à réduire
const A9 = among([
	["ell", -1], ["eill", -1], ["enn", -1], ["onn", -1],
	["ett", -1],
]);


class FrenchStemmer {
	private w = "";
	private cursor = 0;
	private limitBackward = 0;
	private bra = 0;
	private ket = 0;
	private pV = 0;
	private p1 = 0;
	private p2 = 0;

	stem(word: string): string {
		this.w = word;
		this.prelude();
		this.markRegions();
		this.limitBackward = 0;

		this.cursor = this.w.length;
		if (this.standardSuffix() || this.attempt(this.iVerbSuffix) || this.attempt(this.verbSuffix)) {
			this.cursor = this.w.length;
			this.ket = this.cursor;
			if (this.cursor > this.limitBackward && this.w[this.cursor - 1] === "Y") {
				this.cursor--;
				this.bra = this.cursor;
				this.sliceFrom("i");
			} else if (this.cursor > this.limitBackward && this.w[this.cursor - 1] === "ç") {
				this.cursor--;
				this.bra = this.cursor;
				this.sliceFrom("c");
			}
		} else {
			this.cursor = this.w.length;
			this.residualSuffix();
		}

		this.cursor = this.w.length;
		this.unDouble();
		this.cursor = this.w.length;
		this.unAccent();

		return this.postlude();
	}

	/** Rejoue une routine depuis la fin du mot, comme `or` en Snowball. */
	private attempt(routine: () => boolean): boolean {
		this.cursor = this.w.length;
		return routine.call(this);
	}

	// --- Primitives -------------------------------------------------------

	private replace(bra: number, ket: number, s: string): void {
		const adjustment = s.length - (ket - bra);
		this.w = this.w.slice(0, bra) + s + this.w.slice(ket);
		if (this.cursor >= ket) this.cursor += adjustment;
		else if (this.cursor > bra) this.cursor = bra;
	}

	private sliceFrom(s: string): void {
		this.replace(this.bra, this.ket, s);
	}

	private sliceDel(): void {
		this.replace(this.bra, this.ket, "");
	}

	/** find_among_b : plus long suffixe de la table qui se termine au curseur. */
	private findAmongB(table: Among): number {
		for (const [suffix, action] of table) {
			const start = this.cursor - suffix.length;
			if (start >= this.limitBackward && this.w.startsWith(suffix, start)) {
				this.cursor = start;
				return action;
			}
		}
		return 0;
	}

	private eqB(s: string): boolean {
		const start = this.cursor - s.length;
		if (start >= this.limitBackward && this.w.startsWith(s, start)) {
			this.cursor = start;
			return true;
		}
		return false;
	}

	/** Consomme, en reculant, une lettre appartenant (ou non) à `group`. */
	private groupingB(group: string, inside: boolean): boolean {
		if (this.cursor <= this.limitBackward) return false;
		if (group.includes(this.w[this.cursor - 1]) !== inside) return false;
		this.cursor--;
		return true;
	}

	private RV(): boolean {
		return this.pV <= this.cursor;
	}

	private R1(): boolean {
		return this.p1 <= this.cursor;
	}

	private R2(): boolean {
		return this.p2 <= this.cursor;
	}

	// --- Prélude, régions, postlude ------------------------------------------

	/** Marque en majuscule les u, i, y qui font office de consonnes. */
	private prelude(): void {
		// À chaque position, on essaie les règles dans l'ordre ; après un
		// remplacement, on réessaie au même endroit (comme `repeat goto` de Snowball).
		let w = this.w;
		const at = (i: number) => w[i] ?? "";
		let p = 0;
		while (p < w.length) {
			const c = w[p];
			if (isVowel(c) && at(p + 1) === "u" && isVowel(at(p + 2))) {
				w = w.slice(0, p + 1) + "U" + w.slice(p + 2);
			} else if (isVowel(c) && at(p + 1) === "i" && isVowel(at(p + 2))) {
				w = w.slice(0, p + 1) + "I" + w.slice(p + 2);
			} else if (isVowel(c) && at(p + 1) === "y") {
				w = w.slice(0, p + 1) + "Y" + w.slice(p + 2);
			} else if (c === "ë") {
				w = w.slice(0, p) + "He" + w.slice(p + 1);
			} else if (c === "ï") {
				w = w.slice(0, p) + "Hi" + w.slice(p + 1);
			} else if (c === "y" && isVowel(at(p + 1))) {
				w = w.slice(0, p) + "Y" + w.slice(p + 1);
			} else if (c === "q" && at(p + 1) === "u") {
				w = w.slice(0, p + 1) + "U" + w.slice(p + 2);
			} else {
				p++;
			}
		}
		this.w = w;
	}

	private markRegions(): void {
		const w = this.w;
		const n = w.length;
		this.pV = n;
		this.p1 = n;
		this.p2 = n;

		if (n >= 3 && isVowel(w[0]) && isVowel(w[1])) {
			this.pV = 3;
		} else if (/^(?:par|col|tap)/.test(w)) {
			this.pV = 3;
		} else if (w.startsWith("ni") && n >= 3 && isVowel(w[2])) {
			this.pV = 3;
		} else {
			for (let i = 1; i < n; i++) {
				if (isVowel(w[i])) {
					this.pV = i + 1;
					break;
				}
			}
		}

		// p1 : après la première consonne qui suit une voyelle ; p2 : idem, ensuite.
		let i = 0;
		const gopast = (vowel: boolean): boolean => {
			while (i < n && isVowel(w[i]) !== vowel) i++;
			if (i >= n) return false;
			i++;
			return true;
		};
		if (gopast(true) && gopast(false)) {
			this.p1 = i;
			if (gopast(true) && gopast(false)) this.p2 = i;
		}
	}

	private postlude(): string {
		return this.w
			.replace(/He/g, "ë")
			.replace(/Hi/g, "ï")
			.replace(/H/g, "")
			.replace(/I/g, "i")
			.replace(/U/g, "u")
			.replace(/Y/g, "y");
	}

	// --- Suffixes ----------------------------------------------------------

	private standardSuffix(): boolean {
		this.ket = this.cursor;
		const action = this.findAmongB(A4);
		if (action === 0) return false;
		this.bra = this.cursor;

		switch (action) {
			case 1:
				if (!this.R2()) return false;
				this.sliceDel();
				break;
			case 2:
				if (!this.R2()) return false;
				this.sliceDel();
				this.tryIc();
				break;
			case 3:
				if (!this.R2()) return false;
				this.sliceFrom("log");
				break;
			case 4:
				if (!this.R2()) return false;
				this.sliceFrom("u");
				break;
			case 5:
				if (!this.R2()) return false;
				this.sliceFrom("ent");
				break;
			case 6:
				if (!this.RV()) return false;
				this.sliceDel();
				this.afterEment();
				break;
			case 7:
				if (!this.R2()) return false;
				this.sliceDel();
				this.afterIte();
				break;
			case 8:
				if (!this.R2()) return false;
				this.sliceDel();
				this.afterIf();
				break;
			case 9:
				this.sliceFrom("eau");
				break;
			case 10:
				if (!this.R1()) return false;
				this.sliceFrom("al");
				break;
			case 11:
				if (!this.groupingB(OUX_ENDING, true)) return false;
				this.sliceFrom("ou");
				break;
			case 12:
				if (this.R2()) {
					this.sliceDel();
				} else {
					if (!this.R1()) return false;
					this.sliceFrom("eux");
				}
				break;
			case 13:
				if (!this.R1()) return false;
				if (!this.groupingB(VOWELS, false)) return false;
				this.sliceDel();
				break;
			case 14:
				if (!this.RV()) return false;
				this.sliceFrom("ant");
				return false; // force l'essai des suffixes verbaux
			case 15:
				if (!this.RV()) return false;
				this.sliceFrom("ent");
				return false;
			default: {
				// -ment, -ments : suffixe verbal, jamais nominal.
				const saved = this.cursor;
				if (!this.groupingB(VOWELS, true)) return false;
				if (!this.RV()) return false;
				this.cursor = saved;
				this.sliceDel();
				return false;
			}
		}
		return true;
	}

	/** try( ['ic'] (R2 delete or <- 'iqU') ) */
	private tryIc(): void {
		this.ket = this.cursor;
		if (!this.eqB("ic")) return;
		this.bra = this.cursor;
		if (this.R2()) this.sliceDel();
		else this.sliceFrom("iqU");
	}

	private afterEment(): void {
		this.ket = this.cursor;
		const action = this.findAmongB(A2);
		if (action === 0) return;
		this.bra = this.cursor;
		switch (action) {
			case 1:
				if (!this.R2()) return;
				this.sliceDel();
				this.ket = this.cursor;
				if (!this.eqB("at")) return;
				this.bra = this.cursor;
				if (!this.R2()) return;
				this.sliceDel();
				break;
			case 2:
				if (this.R2()) this.sliceDel();
				else if (this.R1()) this.sliceFrom("eux");
				break;
			case 3:
				if (this.R2()) this.sliceDel();
				break;
			default:
				if (this.RV()) this.sliceFrom("i");
		}
	}

	private afterIte(): void {
		this.ket = this.cursor;
		const action = this.findAmongB(A3);
		if (action === 0) return;
		this.bra = this.cursor;
		switch (action) {
			case 1:
				if (this.R2()) this.sliceDel();
				else this.sliceFrom("abl");
				break;
			case 2:
				if (this.R2()) this.sliceDel();
				else this.sliceFrom("iqU");
				break;
			default:
				if (this.R2()) this.sliceDel();
		}
	}

	private afterIf(): void {
		this.ket = this.cursor;
		if (!this.eqB("at")) return;
		this.bra = this.cursor;
		if (!this.R2()) return;
		this.sliceDel();
		this.tryIc();
	}

	private iVerbSuffix(): boolean {
		if (this.cursor < this.pV) return false;
		const saved = this.limitBackward;
		this.limitBackward = this.pV;
		this.ket = this.cursor;
		if (this.findAmongB(A5) === 0) {
			this.limitBackward = saved;
			return false;
		}
		this.bra = this.cursor;
		if (this.cursor > this.limitBackward && this.w[this.cursor - 1] === "H") {
			this.limitBackward = saved;
			return false;
		}
		if (!this.groupingB(VOWELS, false)) {
			this.limitBackward = saved;
			return false;
		}
		this.sliceDel();
		this.limitBackward = saved;
		return true;
	}

	private verbSuffix(): boolean {
		if (this.cursor < this.pV) return false;
		const saved = this.limitBackward;
		this.limitBackward = this.pV;
		this.ket = this.cursor;
		const action = this.findAmongB(A7);
		if (action === 0) {
			this.limitBackward = saved;
			return false;
		}
		this.bra = this.cursor;
		this.limitBackward = saved;

		switch (action) {
			case 1:
				if (!this.R2()) return false;
				this.sliceDel();
				break;
			case 2:
				this.sliceDel();
				break;
			case 3:
				// try('e' RV ]) : le « e » qui précède fait partie du suffixe.
				if (this.cursor > this.limitBackward && this.w[this.cursor - 1] === "e") {
					this.cursor--;
					if (this.RV()) this.bra = this.cursor;
				}
				this.sliceDel();
				break;
			default: {
				// -ais, -aise, -aises : sauf balais, mauvais, déplais…
				const before = this.findAmongB(A6);
				if (before === 1) {
					const stops = this.cursor > this.limitBackward && this.cursor - 1 <= this.limitBackward;
					if (stops) return false; // 'al' précédé d'une seule lettre : balais, calais…
				} else if (before !== 0) {
					return false; // mauvais, déplais
				}
				this.sliceDel();
			}
		}
		return true;
	}

	private residualSuffix(): boolean {
		// try(['s'] test('Hi' or non-keep_with_s) delete)
		if (this.cursor > this.limitBackward && this.w[this.cursor - 1] === "s") {
			const end = this.cursor;
			this.ket = this.cursor;
			this.cursor--;
			this.bra = this.cursor;
			const afterS = this.cursor;
			const ok = this.eqB("Hi") || this.groupingB(KEEP_WITH_S, false);
			this.cursor = afterS;
			if (ok) this.sliceDel();
			else this.cursor = end;
		}

		if (this.cursor < this.pV) return false;
		const saved = this.limitBackward;
		this.limitBackward = this.pV;
		this.ket = this.cursor;
		const action = this.findAmongB(A8);
		if (action === 0) {
			this.limitBackward = saved;
			return false;
		}
		this.bra = this.cursor;
		switch (action) {
			case 1:
				if (!this.R2()) {
					this.limitBackward = saved;
					return false;
				}
				if (this.cursor > this.limitBackward && (this.w[this.cursor - 1] === "s" || this.w[this.cursor - 1] === "t")) {
					this.cursor--;
				} else {
					this.limitBackward = saved;
					return false;
				}
				this.sliceDel();
				break;
			case 2:
				this.sliceFrom("i");
				break;
			default:
				this.sliceDel();
		}
		this.limitBackward = saved;
		return true;
	}

	private unDouble(): boolean {
		const saved = this.cursor;
		if (this.findAmongB(A9) === 0) return false;
		this.cursor = saved;
		this.ket = this.cursor;
		if (this.cursor <= this.limitBackward) return false;
		this.cursor--;
		this.bra = this.cursor;
		this.sliceDel();
		return true;
	}

	private unAccent(): boolean {
		let consonants = 0;
		while (this.groupingB(VOWELS, false)) consonants++;
		if (consonants === 0) return false;
		this.ket = this.cursor;
		const c = this.cursor > this.limitBackward ? this.w[this.cursor - 1] : "";
		if (c !== "é" && c !== "è") return false;
		this.cursor--;
		this.bra = this.cursor;
		this.sliceFrom("e");
		return true;
	}
}

const stemmer = new FrenchStemmer();

/** Racine Snowball d'un mot français (minuscules, sans apostrophe). */
export function stemFrench(word: string): string {
	return stemmer.stem(word);
}
