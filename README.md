# Burr

[Version française](README.fr.md)

An [Obsidian](https://obsidian.md) plugin for **proofreading literary prose in French**. While you write, it highlights repetitions: the same word too close to itself, a phrase that comes back, another form of the same verb. Like a burr (the rough edge you file off), it shows what snags; you are the judge. **The text is never changed.**

Burr does three things for now: it detects repetitions, it flags sentence openings that repeat, and it flags weak words when they pile up. A panel ranks what it finds, most serious first. More detectors (rhythm) will follow.

Burr only reads French, so the examples below are in French.

## What the plugin does

### Repetitions

- **By proximity, not frequency.** Two occurrences are flagged when at most *N* words apart (80 by default, 20 to 200). A common word that comes back a hundred pages later bothers no one; rare words have their own rule (below).
- **One colour per family.** All occurrences of a word (related forms included) or of a phrase share a colour, and each family has its own, so you see at a glance which passages answer each other. Twelve colours; within one screen, two neighbouring families only share one when more than twelve families meet there, and the colour chosen is then the one whose other occurrence is furthest away. A family keeps its colour while you type.
- **Intensity by distance.** Three background shades: the closer the two occurrences, the stronger the highlight.
- **On hover, what is wrong.** Hovering a highlighted passage shows a tooltip that says where the other occurrence is: « *regardait* apparaît déjà 12 mots plus haut », « l'expression *tout de même* revient juste après », « *regarda* a la même racine que *regardait* (4 mots plus haut) ». When a word comes back several times, the tooltip speaks of the occurrence that set the highlight, the nearest one. The distance (« 12 mots plus haut ») is a link: a click selects the other occurrence and brings it to the middle of the screen.
- **Single words and phrases.** Burr also finds runs of 2 to 4 words (« tout de même », « il n'y avait pas »). A repeated phrase is highlighted as one block rather than word by word.
- **Forms of the same word.** A French [Snowball](https://snowballstem.org/) stemmer brings *regardait*, *regarda* and *regardant* together. A table of irregular verbs (aller, faire, pouvoir, venir, prendre… and their compounds) also links *fait*, *faisons* and *ferai*, or *irai* and *allons*, which the stemmer cannot relate. These matches are highlighted more lightly and over a shorter distance, since a stemmer is sometimes wrong.
- **Noise is left out.**
  - Function words (*le, de, et, que, dans, il…*) and the forms of *être* and *avoir* do not count.
  - Nor do proper names: a word capitalised mid-sentence is never flagged, so a recurring character is not a repetition.
  - Front matter, code blocks, inline code, comments (`%% %%`, `<!-- -->`), `$$` formulas, URLs and link targets are skipped.
  - Optionally, dialogue.
- **Every occurrence on hover.** When a word comes back more than twice, the tooltip lists them all (the word and its line), each one leading to its passage.
- **Live.** Highlights follow the text as you type and are recomputed after 250 ms of inactivity, in Source mode and Live Preview.

### Rare words echoed from afar

A rare word stands out: *chatoyant* used in chapter 1 still reads as a repetition three pages later, where *fenêtre* goes unnoticed. Burr **underlines it with a wave**, without background, in its family's colour.

- **What is a rare word?** Its frequency in a corpus of books, from the [Lexique](http://www.lexique.org) database. Three levels to choose from: very rare only (under 3 uses per million words: *chatoyant*, *diaphane*), rare (under 10: *ineffable*, *glauque*; the default), uncommon (under 30: *crépuscule*, *cathédrale*). A word Lexique does not know (a coinage, a foreign word) counts as very rare.
- **The whole family.** Rarity and matching apply to the forms of a word: *chatoyaient* echoes *chatoyant*.
- **How far?** 5,000 words by default, roughly a chapter; from 1,000 words to the whole document. On a full manuscript in a single note, "whole document" underlines a lot: rare words all come back eventually.
- **A stronger wave for a rarer word.** Intensity tells rarity, not distance.
- **On hover**, the tooltip says where the other use is: « *chatoyant*, mot très rare, apparaît déjà 2 960 mots plus haut », « *chatoyaient*, mot très rare, reprend *chatoyant* 303 mots plus haut ».
- **Never twice.** A word already highlighted as a close repetition is not underlined as well; the next use, if far away, is.
- The same filters apply: function words, proper names, dialogue optionally. A rare word that is the very subject of the text (*harpon* in a whaling story) is set aside with "Mots à ignorer en plus" (extra words to ignore).

### Repeated sentence openings

« Il ouvrit la porte. Il entra. Elle sourit. Il s'assit. » No word repeats from afar, yet the reader hears a litany. This signal is about a **position** in the text: Burr underlines only the first word with a **solid line**, not the sentence.

- **Sentences: three out of five.** As soon as three sentences out of five in a row open the same way, their openings are underlined. An odd one out (« Elle » among « Il ») does not break the run, which goes on as long as the pattern returns. The line thickens from four, then five openings.
- **Paragraphs: three in a row.** Three consecutive prose paragraphs opening with the same word are underlined, with a line already strong. Dialogue lines do not count and do not break the run; a heading, a list, a quote or a scene break (`***`) does. A paragraph opening flagged as such is not flagged again as a sentence opening.
- **Groups of words count as one:**
  - *Third-person subject*: il, elle, on, ils, elles.
  - *Narrator*: je, j'. *Nous, tu, vous*.
  - *Definite articles*: le, la, les, l'. *Indefinite articles*: un, une, des.
  - *Ce*: ce, cet, cette, ces, c', ça, cela, ceci.
  - *Possessives*: son, sa, ses, leur, mon, ma, ton, notre, votre…
  - *Sequencing*: puis, ensuite, alors.
  - Any other word (« Et », « Soudain », a first name…) only counts against itself, ignoring case and accents.
- **Sentence splitting.** A sentence starts after `.`, `!`, `?` or `…` when the next word is capitalised, and at the start of every line. A colon or a comma does not end a sentence, nor does the full stop of « M. », « Mme » or an initial (« J. Dupont »). Headings, lists and quotes do not open a sentence.
- **On hover**: « 3 phrases sur 4 commencent par « il » ou « elle ». » The tooltip lists the passages of the run, and the run is a single problem in the Priorities panel.
- The same filters apply: front matter, code, comments, dialogue optionally. A deliberate anaphora (« Il pleuvait. Il pleuvait. Il pleuvait. ») is set aside with "Ignorer ici" (ignore here), in the panel or the tooltip.

### Weak words

A weak word is not a mistake: it is a **density signal**. One « très » goes by; three in a paragraph show. So Burr underlines families of weak words with a **dotted line**, but only in paragraphs where a family reaches its threshold (3 occurrences by default, 1 to 6): otherwise the whole text would be coloured and the tool unreadable.

- **Five families, one colour each, each one can be turned off:**
  - *Intensifiers and hedges*: très, assez, plutôt, vraiment, tellement, un peu, presque, quelque peu…
  - *Adverbs in -ment*: found by their ending, with a list of exceptions for nouns (moment, logement, vêtement, gouvernement…); threshold 3.
  - *Dull verbs*: faire, avoir, être, mettre, aller, sembler, paraître, commencer à, se mettre à, être en train de, in all their conjugated forms; threshold 6, since these verbs are everywhere.
  - *Vague words*: chose, quelque chose, truc, sorte de, genre, un certain…; threshold 2.
  - *Narrative crutches*: soudain, tout à coup, puis, alors, comme si, peut-être…
- **The list is a note in your vault.** Burr reads a note (`mots-faibles.md` by default, configurable) with one `##` section per family: you edit it in Obsidian, it is versioned with the rest and synced to mobile, and the highlighting follows every change. The command "Ouvrir la note des mots faibles" creates it with the default words, to adapt; until it exists, those words apply. Deleting a section removes the family.
  - Words or phrases are separated by commas or line breaks.
  - `## Verbes ternes (seuil 6)`: a threshold for this family, which overrides the general setting.
  - `@faire` stands for every form of a verb (*fais, faisait, fera, fit, fait*…); `@commencer à` or `se @mettre à` for a phrase where one word is conjugated. Forms are listed, not guessed by a stemmer: *commencement* is not *commencer*. Irregular verbs come from Burr's table, *être* and *avoir* from a separate list, -er verbs are conjugated (the cedilla of *commençons*, the e of *mangeons*); any other verb is listed form by form.
  - `*ment` stands for words ending that way, except those on the `sauf: moment, logement…` line.
  - A phrase wins over the word it contains (« quelque chose » over « chose »), and a specific word over a pattern (« soudainement » stays a crutch, not an adverb in -ment).
  - The note carries the `burr-ignorer` tag: its own words are not underlined.
- **Intensity by accumulation**: the more the family comes back in the paragraph, the thicker the line.
- **On hover**: « *très* — Intensifs et atténuateurs : 3 dans ce paragraphe. »
- **Never twice.** A word already highlighted as a repetition or underlined as a rare word is not flagged as weak as well; it still counts towards the threshold. A paragraph is what lies between two blank lines.
- The same filters apply: front matter, code, comments, dialogue optionally. In a line of dialogue, « vraiment » or « quelque chose » are often intended: turn on "Ignorer les dialogues".

Reading view is not covered: Burr works in the editor.

### Priorities panel

A few pages can carry dozens of highlights. The **Priorities** panel (list icon in the ribbon, or the command "Ouvrir le panneau des priorités") tells you where to start.

- **Problems, not passages.** Passages that answer each other make a single problem: a word taken up five times at close range, a run of sentence openings, the weak words of a paragraph.
- **Ranked by severity.** Each passage has a weight, on a scale shared by all signals: a strong repetition weighs 4 to 8, a rare word echoed from afar 1 to 3, a weak word 0.5 to 1.5. A problem's severity is the sum of its passages. The panel shows the 25 most serious problems of the open note, and updates after a pause in typing.
- **A click leads to the text.** The first passage is selected, centred on screen and framed in red (the frame blinks); the problem's other passages get the same frame, steady. Each further click moves on to the next passage.
- **The same severity on hover.** A passage's tooltip gives its problem's severity and rank in the note: « Gravité 12,5 · 3e sur 41 ».

### Ignoring a problem

Burr flags, the author decides. What is intended can be set aside, from the tooltip's buttons or by right-clicking a problem in the panel:

- **Ignorer ici** (ignore here): only these passages are set aside. The same word repeated elsewhere in the note is still flagged: a run of « que » accepted in one paragraph does not hold for the whole text, nor does « trame » repeated in the first quarter for the rest. Burr recognises ignored passages by their words and their surroundings in the sentence, not by their position: they stay ignored while you write elsewhere, but **come back if you rewrite their sentence**. A new occurrence typed next to them is flagged.
- **Dans toute la note** (in the whole note): this type of problem (same category, same word or phrase) is no longer flagged anywhere in this note.

Either way, the highlight disappears from the editor and the panel. The panel's "Ignorés" button lists what was set aside, with its scope, and a right-click brings it back ("Ne plus ignorer"). These choices are stored per note in the plugin's settings, and follow a note that is renamed or moved.

### A more visible caret

Burr replaces the editor's text caret with a **wider, coloured bar** that blinks and stays visible while you type (3 px, in the theme's accent colour, by default). Width and colour are set in the options, and the original caret comes back when the setting is turned off. The caret of nested editors (table cells) is left unchanged.

### Choosing what is analysed

- **A single note: right-click in its text**, then "Burr : ignorer cette note". Burr adds the `burr-ignorer` tag to the `tags` of the note's YAML (the text is untouched) and stops highlighting it. The same menu then offers "Burr : réactiver pour cette note", which removes the tag; you can also add or remove it by hand. On mobile, the menu opens with a long press.
- **Folders to analyse**, in the settings: if the list is not empty, only notes in these folders (subfolders included) are analysed; empty, the whole vault is.
- **Folders to ignore**: their notes are never analysed. Ignoring wins over analysing: with `Roman` to analyse and `Roman/Brouillons` to ignore, only the drafts are left out.
- One folder per line, path from the vault root, case-insensitive. A note moved to another folder changes status at once.
- When a folder already excludes a note, the context menu offers nothing: the tag would make no difference.

### Performance

At every pause in typing, Burr analyses the **whole document**. On a 190,000-word novel this takes about a third of a second (measured in Node); for a chapter-sized note it is imperceptible. If you write a whole manuscript in a single file, the editor may pause briefly after each break: turn the highlighting off (command below) or split the manuscript.

The list of common words, used to judge rarity, makes up most of the plugin: `main.js` is about 150 KB, of which 100 KB is the list. It is only read at the first analysis.

## Settings

The interface is in French; setting names are given as they appear.

| Setting | Effect |
| --- | --- |
| Surligner les répétitions | Turns highlighting of close repetitions on or off (rare words echoed from afar have their own setting, just below). |
| Fenêtre de recherche | Maximum distance, in words, between two occurrences (20 to 200). |
| Longueur maximale des expressions | From 1 (single words only) to 4 words. |
| Rapprocher les formes d'un même mot | Turns on the stemmer (*regardait* / *regarda*). |
| Mots rares repris de loin | Underlines with a wave rare words that come back beyond the window. |
| Mots jugés rares | Very rare only, rare (default) or uncommon. |
| Portée des mots rares | 1,000, 2,000, 5,000 (default) or 10,000 words, or the whole document. |
| Débuts de phrase répétés | Underlines the first word when three sentences out of five, or three prose paragraphs in a row, open the same way. |
| Mots faibles | Turns on underlining of weak-word families that pile up. |
| Seuil des mots faibles | Occurrences of a family, in one paragraph, from which it is underlined (1 to 6, 3 by default). |
| *(one line per family)* | Turns each weak-word family on or off. |
| Note des mots faibles | Path of the note listing the words (`mots-faibles.md` by default); a button opens or creates it. |
| Ignorer les noms propres | Leaves out words capitalised mid-sentence. |
| Ignorer les dialogues | Leaves out lines starting with an em dash (— or --) and passages within French guillemets. Note: a whole line of dialogue is left out, dialogue tag included (« dit-il »). |
| Mots à ignorer en plus | Your own exceptions, one word per line or separated by commas. |
| Dossiers à analyser | One folder per line. Empty: every note; otherwise, only those in these folders. |
| Dossiers à ignorer | One folder per line. These notes are never analysed, even inside a folder to analyse. |
| Curseur plus visible | Replaces the text caret with a wider, coloured bar (on by default). |
| Largeur du curseur | 1 to 8 pixels (3 by default). |
| Couleur du curseur | The theme's accent colour by default; a button goes back to it. |

## Commands

- **Ouvrir le panneau des priorités**: shows the panel in the right sidebar (also from the list icon in the ribbon).
- **Afficher ou masquer les répétitions**: toggles highlighting of close repetitions.
- **Afficher ou masquer les débuts de phrase répétés**: toggles underlining of repeated sentence and paragraph openings.
- **Afficher ou masquer les mots faibles**: toggles underlining of weak words.
- **Ouvrir la note des mots faibles (la créer si besoin)**: opens the word note, or creates it with the default words.
- **Burr : ignorer cette note** / **Burr : réactiver pour cette note**: in the right-click menu, adds or removes the `burr-ignorer` tag in the note's YAML.
- **Options de Burr**: in the same menu, a submenu toggles separately the highlighting of repetitions, rare words echoed from afar, repeated sentence openings and weak words, and links straight to the plugin's settings.

## With Marginal Notes

When the Marginal Notes plugin is installed, hovering a highlighted passage points out every occurrence of the problem in its minimap, while the tooltip stays open.

## Language

Burr handles **French** only, and every document is read as French. The code is already built so that a document can have its own language: everything that depends on it (function words, stemmer, dialogue and sentence-opening marks, sentence-opening groups, default weak words and conjugation) lives in a `Language` object, and a document's language is decided in a single place (`resolveLanguage`, in [src/lang/index.ts](src/lang/index.ts)). There is no selector yet.

## Installation

Not yet in the community plugins directory. To try it:

1. Build the plugin (see below), or get `main.js`, `manifest.json` and `styles.css`.
2. Copy these three files to `<your vault>/.obsidian/plugins/burr/`.
3. In Obsidian, *Settings → Community plugins*, enable **Burr**.

## Development

```bash
npm install
npm run build      # type check, then main.js
npm run dev        # rebuild on every change
npm test           # unit tests (Node 22.18 or later)
```

On Windows, [deploy.ps1](deploy.ps1) builds the plugin and copies it to a vault:

```powershell
.\deploy.ps1 -VaultPath "C:\path\to\MyVault"
```

The path is saved in `deploy.local.json` (ignored by git): next time, `.\deploy.ps1` is enough. Reload Obsidian (Ctrl+R) or re-enable the plugin to see the new version.

The list of common words, [src/lang/fr/frequencies.ts](src/lang/fr/frequencies.ts), is generated from Lexique 3.83, a copy of which is in the repository. To regenerate it (changed thresholds, changed stemmer):

```bash
npm run frequencies
```

The [data/](data/) folder holds the third-party sources: Lexique 3.83, and the Snowball stemmer definition with its official test vocabulary, which `npm test` checks in full. [data/README.md](data/README.md) says where each file comes from and how the stemmer was ported. These files are not under the MIT licence: Lexique is under CC BY-SA 4.0, Snowball under BSD (see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)).

### Architecture

```
src/
  main.ts               the plugin: settings, commands, editor extensions
  settingsTab.ts        the settings tab
  scope.ts              which notes are analysed: folders to include or ignore, YAML tag
  analyze.ts            text -> words -> detectors -> ranges to highlight
  priorities.ts         ranges -> problems, ranked by severity
  ignore.ts             what the author sets aside: problem types, passages recognised by their context
  colors.ts             one colour per family of ranges, stable while typing
  text/                 normalisation, skipped zones, word splitting
  detectors/            one module per detector, same interface (types.ts): repetitions.ts, openings.ts, weak.ts
  weak/lexicon.ts       the weak-word note: parsing, entries (word, phrase, @verb, *ending), lookup
  editor/highlight.ts   CodeMirror 6 extension: highlights, tooltips, frames of the chosen passage
  editor/caret.ts       the more visible caret, drawn in a CodeMirror layer
  panel/                the Priorities panel
  lang/                 everything language-dependent (fr/: function words, stemmer, irregular verbs,
                        word frequencies)
scripts/frequencies.ts  generates the list of common words from Lexique
data/                   third-party sources: Lexique 3.83, Snowball definition and test vocabulary
```

- The text is split **only once**; all detectors work on the same words.
- A detector takes the words and returns ranges `{from, to, category, family, intensity, target, explain}`; `explain()` writes the tooltip sentence on demand, one part of which (`link`) leads to `target`, the other occurrence. Each category has its CSS classes (`burr-repetition`, `burr-echo`, `burr-weak`, `burr-opening`). Each range also has a weight (`severity`), which `priorities.ts` turns into the severity of problems. Ranges never overlap: inside `analyze`, a detector gives way to those before it in the list. A range can set its colour (`color`), as weak-word families do; otherwise `colors.ts` picks it. Adding a detector touches neither the editor nor the interface: it only has to be listed in [src/detectors/index.ts](src/detectors/index.ts).
- Typographic normalisation (apostrophe ’, non-breaking spaces) **keeps the text's length**, so that highlight positions stay exact.

## Credits

The French stemmer is a TypeScript port of the [Snowball](https://snowballstem.org/algorithms/french/stemmer.html) algorithm, checked against Snowball's full official test vocabulary (see [data/README.md](data/README.md)). Snowball does not know the -ons ending (*mangeons* stays *mangeon*): `Language.altStem` gives these forms a second stem (*mang*), on top of the usual one, so that *manger* and *mangeons* answer each other without *maison* and *maisons* losing sight of each other. Known limit: *mangions* (imperfect) is not linked to *manger*, since the stemmer only does so for some verbs and the rule cannot tell *mangions* from nouns such as *passions*.

Irregular verbs live in [src/lang/fr/verbs.ts](src/lang/fr/verbs.ts): one entry per verb, with the imperfect and future stems (the endings are shared) and the other forms written by hand. `Language.lemma` returns a form's infinitive; it is also the family (hence the colour) of all its forms. The table adds to the stemmer without replacing it, so that *connaissait* stays linked to *connaissance*. Forms that belong to two verbs (*vit*: voir or vivre) or that are first a common noun (*lit*, *bois*) are left out; their compounds (*relit*) are not.

Word rarity comes from [Lexique 3.83](http://www.lexique.org) (Boris New, Christophe Pallier et al.): the frequency of each lemma in a corpus of books. Burr only keeps the Snowball stems of common words, by degree of use (13,391 stems, about 100 KB); a stem keeps the highest frequency of the words leading to it, so a rare word sharing its stem with a common one passes for common. Lexique does not write ligatures (*coeur*): Burr undoes them before looking a word up. Known limit: rare words echoed from afar do not use the second stem of -ons forms, so *ruisselons* does not answer *ruisseler* 3,000 words apart (at close range, it does).

## Licence

[MIT](LICENSE), except [src/lang/fr/frequencies.ts](src/lang/fr/frequencies.ts), derived from Lexique and, like it, under the [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) licence, and the copies of third-party sources in the [data/](data/) folder, which each keep their licence. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
