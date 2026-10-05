# Burr

Plugin [Obsidian](https://obsidian.md) de **relecture de prose littéraire en français**. Pendant que vous écrivez, il surligne les répétitions : le même mot trop près de lui-même, une expression qui revient, une forme du même verbe. Comme un burr (l'aspérité que l'on retire), il montre ce qui accroche ; c'est à vous de juger. **Le texte n'est jamais modifié.**

Burr fait pour l'instant trois choses : la détection automatique des répétitions, le repérage des débuts de phrase qui se répètent, et celui des mots faibles quand ils s'accumulent. D'autres détecteurs (rythme) viendront s'y ajouter.

## Ce que fait le plugin

### Répétitions

- **Par proximité, pas par fréquence.** Deux occurrences sont signalées si elles sont séparées par au plus *N* mots (80 par défaut, réglable de 20 à 200). Un mot courant qui revient à cent pages d'écart ne gêne personne ; les mots rares ont leur propre règle (ci-dessous).
- **Une couleur par famille.** Toutes les occurrences d'un même mot (formes voisines comprises) ou d'une même expression partagent une couleur, et chaque famille a la sienne : on voit d'un coup d'œil quelles plages se répondent. Douze couleurs ; à l'intérieur d'un écran, deux familles voisines n'en partagent une que si plus de douze familles s'y croisent, et la couleur choisie est alors celle dont l'autre occurrence est la plus éloignée. Une famille garde sa couleur pendant que vous tapez.
- **Une intensité selon la distance.** Trois nuances de fond : plus les deux occurrences sont proches, plus le surlignage est marqué.
- **Au survol, ce qui ne va pas.** Passer la souris sur un passage surligné affiche une infobulle qui dit où se trouve l'autre occurrence : « *regardait* apparaît déjà 12 mots plus haut », « l'expression *tout de même* revient juste après », « *regarda* a la même racine que *regardait* (4 mots plus haut) ». Quand un mot revient plusieurs fois, l'infobulle parle de l'occurrence qui a fait pencher le surlignage, la plus proche. La distance (« 12 mots plus haut ») est un lien : un clic sélectionne l'autre occurrence et l'amène au milieu de l'écran.
- **Mots isolés et expressions.** Burr repère aussi les suites de 2 à 4 mots (« tout de même », « il n'y avait pas »). Quand une expression revient, elle est surlignée d'un bloc plutôt que mot par mot.
- **Formes d'un même mot.** Grâce à un stemmer [Snowball](https://snowballstem.org/) français, *regardait*, *regarda* et *regardant* se rapprochent. Une table des verbes irréguliers (aller, faire, pouvoir, venir, prendre… et leurs composés) rapproche aussi *fait*, *faisons* et *ferai*, ou *irai* et *allons*, que le stemmer ne peut pas relier. Ces rapprochements sont surlignés plus discrètement et sur une distance plus courte, car un stemmer se trompe parfois.
- **Le bruit est écarté.**
  - Les mots-outils (*le, de, et, que, dans, il…*) et les formes d'*être* et d'*avoir* ne comptent pas.
  - Les noms propres non plus : un mot qui prend une majuscule en milieu de phrase n'est jamais signalé, pour qu'un personnage qui revient ne soit pas une répétition.
  - Le frontmatter, les blocs de code, le code en ligne, les commentaires (`%% %%`, `<!-- -->`), les formules `$$`, les adresses et les cibles de liens sont ignorés.
  - En option, les dialogues.
- **En direct.** Les surlignages suivent le texte pendant la frappe et se recalculent après 250 ms d'inactivité, en mode source comme en aperçu en direct.

### Mots rares repris de loin

Un mot rare se remarque : *chatoyant* employé au chapitre 1 se lit encore comme une répétition trois pages plus loin, là où *fenêtre* passe inaperçu. Burr le **souligne d'une vague**, sans fond, dans la couleur de sa famille.

- **Qu'est-ce qu'un mot rare ?** Sa fréquence dans un corpus de livres, tirée de la base [Lexique](http://www.lexique.org). Trois niveaux, au choix : très rares seulement (moins de 3 emplois par million de mots : *chatoyant*, *diaphane*), rares (moins de 10 : *ineffable*, *glauque* ; c'est le réglage par défaut), peu courants (moins de 30 : *crépuscule*, *cathédrale*). Un mot inconnu de Lexique (néologisme, mot étranger) compte comme très rare.
- **Toute la famille.** La rareté et le rapprochement valent pour les formes d'un même mot : *chatoyaient* reprend *chatoyant*.
- **Jusqu'à quelle distance ?** 5 000 mots par défaut, soit à peu près un chapitre ; réglable de 1 000 mots à tout le document. Sur un manuscrit entier dans une seule note, « tout le document » souligne beaucoup : les mots rares finissent tous par revenir.
- **Une vague plus marquée pour un mot plus rare.** L'intensité dit la rareté, pas la distance.
- **Au survol**, l'infobulle dit où est l'autre emploi : « *chatoyant*, mot très rare, apparaît déjà 2 960 mots plus haut », « *chatoyaient*, mot très rare, reprend *chatoyant* 303 mots plus haut ».
- **Jamais en double.** Un mot déjà surligné comme répétition proche n'est pas souligné en plus ; l'emploi suivant, s'il est lointain, l'est.
- Les mêmes filtres s'appliquent : mots-outils, noms propres, dialogues en option. Un mot rare qui est le sujet même du texte (*harpon* dans une histoire de baleinier) s'écarte avec « Mots à ignorer en plus ».

### Débuts de phrase répétés

« Il ouvrit la porte. Il entra. Elle sourit. Il s'assit. » Aucun mot n'est répété de loin, mais le lecteur entend une litanie. Ce signal porte sur une **position** précise du texte : Burr souligne d'un **trait plein** le seul premier mot, pas la phrase.

- **Phrases : trois sur cinq.** Dès que trois phrases parmi cinq consécutives commencent de la même façon, leurs débuts sont soulignés. Un intrus (« Elle » parmi des « Il ») ne casse pas la série, et elle se prolonge tant que le motif revient. Le trait s'épaissit à partir de quatre, puis de cinq débuts.
- **Paragraphes : trois de suite.** Trois paragraphes de prose consécutifs qui commencent par le même mot sont soulignés, avec un trait déjà marqué. Les répliques de dialogue ne comptent pas et ne coupent pas la série ; un titre, une liste, une citation ou une séparation de scène (`***`) la coupent. Un début de paragraphe signalé comme tel n'est pas signalé en plus comme début de phrase.
- **Des groupes de mots comptent pour un seul :**
  - *Sujet de 3ᵉ personne* : il, elle, on, ils, elles.
  - *Narrateur* : je, j'. *Nous, tu, vous*.
  - *Articles définis* : le, la, les, l'. *Articles indéfinis* : un, une, des.
  - *Ce* : ce, cet, cette, ces, c', ça, cela, ceci.
  - *Possessifs* : son, sa, ses, leur, mon, ma, ton, notre, votre…
  - *Enchaînement* : puis, ensuite, alors.
  - Tout autre mot (« Et », « Soudain », un prénom…) ne compte que contre lui-même, sans tenir compte de la casse ni des accents.
- **Découpage des phrases.** Une phrase commence après `.`, `!`, `?` ou `…` si le mot suivant prend une majuscule, et à chaque début de ligne. Un deux-points ou une virgule ne finissent pas la phrase, pas plus que le point de « M. », « Mme » ou d'une initiale (« J. Dupont »). Les titres, listes et citations n'ouvrent pas de phrase.
- **Au survol** : « 3 phrases sur 4 commencent par « il » ou « elle ». » La liste des passages de la série est dans l'infobulle, et la série forme un seul problème dans le panneau Priorités.
- Les mêmes filtres s'appliquent : frontmatter, code, commentaires, dialogues en option. Une anaphore voulue (« Il pleuvait. Il pleuvait. Il pleuvait. ») se met de côté avec « Ignorer ce type de problème dans cette note », dans le panneau.

### Mots faibles

Un mot faible n'est pas une faute : c'est un **signal de densité**. Un « très » passe ; trois dans un paragraphe se voient. Burr souligne donc d'un **pointillé** les familles de mots faibles, mais seulement dans les paragraphes où une famille atteint son seuil (3 occurrences par défaut, réglable de 1 à 6) : sinon tout le texte serait coloré et l'outil, illisible.

- **Cinq familles, une couleur chacune, activables séparément :**
  - *Intensifs et atténuateurs* : très, assez, plutôt, vraiment, tellement, un peu, presque, quelque peu…
  - *Adverbes en -ment* : détectés par leur terminaison, avec une liste d'exceptions pour les noms (moment, logement, vêtement, gouvernement…) ; seuil de 3.
  - *Verbes ternes* : faire, avoir, être, mettre, aller, sembler, paraître, commencer à, se mettre à, être en train de, sous toutes leurs formes conjuguées ; seuil de 6, car ces verbes sont partout.
  - *Mots vagues* : chose, quelque chose, truc, sorte de, genre, un certain… ; seuil de 2.
  - *Béquilles narratives* : soudain, tout à coup, puis, alors, comme si, peut-être…
- **La liste est une note de votre coffre.** Burr lit une note (`mots-faibles.md` par défaut, réglable) avec une section `##` par famille : vous l'éditez dans Obsidian, elle est versionnée avec le reste et synchronisée sur mobile, et le surlignage suit chaque modification. La commande « Ouvrir la note des mots faibles » la crée avec les mots par défaut, à adapter ; tant qu'elle n'existe pas, ces mots s'appliquent. Supprimer une section retire la famille.
  - Les mots ou expressions se séparent par des virgules ou des retours à la ligne.
  - `## Verbes ternes (seuil 6)` : un seuil propre à la famille, qui l'emporte sur le réglage général.
  - `@faire` désigne toutes les formes d'un verbe (*fais, faisait, fera, fit, fait*…) ; `@commencer à` ou `se @mettre à` une expression dont un mot se conjugue. Les formes sont listées, pas déduites d'un stemmer : *commencement* n'est pas *commencer*. Les verbes irréguliers viennent de la table de Burr, *être* et *avoir* d'une liste à part, les verbes en -er sont conjugués (cédille de *commençons*, e de *mangeons*) ; un autre verbe se liste forme à forme.
  - `*ment` désigne les mots qui se terminent ainsi, sauf ceux de la ligne `sauf: moment, logement…`.
  - Une expression l'emporte sur le mot qu'elle contient (« quelque chose » sur « chose »), et un mot précis sur un motif (« soudainement » reste une béquille, pas un adverbe en -ment).
  - La note porte la balise `burr-ignorer` : ses propres mots ne sont pas soulignés.
- **Une intensité selon l'accumulation** : plus la famille revient dans le paragraphe, plus le trait est épais.
- **Au survol** : « *très* — Intensifs et atténuateurs : 3 dans ce paragraphe. »
- **Jamais en double.** Un mot déjà surligné comme répétition ou souligné comme mot rare n'est pas signalé en plus comme faible ; il compte pourtant dans le seuil. Un paragraphe est ce qui tient entre deux sauts de ligne.
- Les mêmes filtres s'appliquent : frontmatter, code, commentaires, dialogues en option. Dans une réplique, « vraiment » ou « quelque chose » sont souvent voulus : activez « Ignorer les dialogues ».

Le mode Lecture n'est pas couvert : Burr travaille dans l'éditeur.

### Choisir ce qui est analysé

- **Une note à part : clic droit dans son texte**, puis « Burr : ignorer cette note ». Burr ajoute la balise `burr-ignorer` aux `tags` du YAML de la note (le texte n'est pas touché) et cesse de la surligner. Le même menu propose ensuite « Burr : réactiver pour cette note », qui retire la balise ; on peut aussi la poser ou l'ôter à la main. Sur mobile, le menu s'ouvre par un appui long.
- **Des dossiers à analyser**, dans les réglages : si la liste n'est pas vide, seules les notes de ces dossiers (sous-dossiers compris) sont analysées ; vide, tout le coffre l'est.
- **Des dossiers à ignorer** : leurs notes ne sont jamais analysées. Ignorer l'emporte sur analyser : avec `Roman` à analyser et `Roman/Brouillons` à ignorer, seuls les brouillons sont laissés de côté.
- Un dossier par ligne, chemin depuis la racine du coffre, sans tenir compte des majuscules. Une note déplacée dans un autre dossier change de statut tout de suite.
- Quand un dossier écarte déjà une note, le menu contextuel ne propose rien : la balise n'y changerait rien.

### Performances

À chaque pause dans la frappe, Burr analyse le **document entier**. Sur un roman de 190 000 mots, cela prend environ un tiers de seconde (mesuré sous Node) ; pour une note de la taille d'un chapitre, c'est imperceptible. Si vous écrivez tout un manuscrit dans un seul fichier, l'éditeur peut marquer un temps d'arrêt après chaque pause : désactivez alors le surlignage (commande ci-dessous) ou découpez le manuscrit.

La liste des mots courants, qui sert à juger de la rareté, pèse l'essentiel du plugin : `main.js` fait environ 150 Ko, dont 100 Ko de liste. Elle n'est lue qu'à la première analyse.

## Réglages

| Réglage | Effet |
| --- | --- |
| Surligner les répétitions | Active ou désactive le surlignage des répétitions par proximité (les mots rares repris de loin ont leur propre réglage, juste en dessous). |
| Fenêtre de recherche | Distance maximale, en mots, entre deux occurrences (20 à 200). |
| Longueur maximale des expressions | De 1 (mots isolés seulement) à 4 mots. |
| Rapprocher les formes d'un même mot | Active le stemmer (*regardait* / *regarda*). |
| Mots rares repris de loin | Souligne d'une vague les mots rares qui reviennent au-delà de la fenêtre. |
| Mots jugés rares | Très rares seulement, rares (par défaut) ou peu courants. |
| Portée des mots rares | 1 000, 2 000, 5 000 (par défaut) ou 10 000 mots, ou tout le document. |
| Débuts de phrase répétés | Souligne le premier mot quand trois phrases sur cinq, ou trois paragraphes de prose de suite, commencent de la même façon. |
| Mots faibles | Active le soulignement des familles de mots faibles qui s'accumulent. |
| Seuil des mots faibles | Occurrences d'une famille, dans un même paragraphe, à partir desquelles elle est soulignée (1 à 6, 3 par défaut). |
| *(une ligne par famille)* | Active ou désactive chaque famille de mots faibles. |
| Note des mots faibles | Chemin de la note qui liste les mots (`mots-faibles.md` par défaut) ; bouton pour l'ouvrir ou la créer. |
| Ignorer les noms propres | Écarte les mots qui prennent une majuscule en milieu de phrase. |
| Ignorer les dialogues | Écarte les lignes qui commencent par un tiret cadratin (— ou --) et les passages entre guillemets français. Attention : une réplique est écartée en entier, incidente comprise (« dit-il »). |
| Mots à ignorer en plus | Vos propres exceptions, un mot par ligne ou séparés par des virgules. |
| Dossiers à analyser | Un dossier par ligne. Vide : toutes les notes ; sinon, seulement celles de ces dossiers. |
| Dossiers à ignorer | Un dossier par ligne. Ces notes ne sont jamais analysées, même dans un dossier à analyser. |

## Commande

- **Afficher ou masquer les répétitions** : bascule le surlignage des répétitions par proximité.
- **Afficher ou masquer les débuts de phrase répétés** : bascule le soulignement des débuts de phrase et de paragraphe répétés.
- **Afficher ou masquer les mots faibles** : bascule le soulignement des mots faibles.
- **Ouvrir la note des mots faibles (la créer si besoin)** : ouvre la note de mots, ou la crée avec les mots par défaut.
- **Burr : ignorer cette note** / **Burr : réactiver pour cette note** : dans le menu du clic droit, pose ou retire la balise `burr-ignorer` dans le YAML de la note.
- **Options de Burr** : dans le même menu, un sous-menu bascule indépendamment le surlignage des répétitions, celui des mots rares repris de loin, celui des débuts de phrase répétés et celui des mots faibles, et propose un lien direct vers les réglages du plugin.

## Langue

Burr traite le **français** uniquement, et tout document est vu comme du français. Le code est déjà prévu pour qu'un document puisse avoir sa propre langue : tout ce qui en dépend (mots-outils, stemmer, marques de dialogue et d'ouverture de phrase, groupes de débuts de phrase, mots faibles par défaut et conjugaison) vit dans un objet `Language`, et la langue d'un document se décide en un seul endroit (`resolveLanguage`, dans [src/lang/index.ts](src/lang/index.ts)). Il n'y a pas encore de sélecteur.

## Installation

Pas encore dans le répertoire des plugins communautaires. Pour l'essayer :

1. Compilez le plugin (voir plus bas), ou récupérez `main.js`, `manifest.json` et `styles.css`.
2. Copiez ces trois fichiers dans `<votre vault>/.obsidian/plugins/burr/`.
3. Dans Obsidian, *Réglages → Modules complémentaires*, activez **Burr**.

## Développement

```bash
npm install
npm run build      # vérification des types, puis main.js
npm run dev        # recompile à chaque modification
npm test           # tests unitaires (Node 22.18 ou plus récent)
```

Sous Windows, [deploy.ps1](deploy.ps1) compile le plugin et le copie dans un vault :

```powershell
.\deploy.ps1 -VaultPath "C:\chemin\vers\MonVault"
```

Le chemin est mémorisé dans `deploy.local.json` (ignoré par git) : les fois suivantes, `.\deploy.ps1` suffit. Recharger Obsidian (Ctrl+R) ou réactiver le plugin pour voir la nouvelle version.

La liste des mots courants, [src/lang/fr/frequencies.ts](src/lang/fr/frequencies.ts), est générée à partir de Lexique 3.83, dont une copie est dans le dépôt. Pour la refaire (seuils modifiés, stemmer changé) :

```bash
npm run frequencies
```

Le dossier [data/](data/) contient les sources tierces : Lexique 3.83, et la définition du stemmer Snowball avec son vocabulaire de test officiel, que `npm test` vérifie en entier. [data/README.md](data/README.md) dit d'où vient chaque fichier et comment le stemmer a été porté. Ces fichiers ne sont pas sous licence MIT : Lexique est sous CC BY-SA 4.0, Snowball sous BSD (voir [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)).

### Architecture

```
src/
  main.ts               le plugin : réglages, commande, extension d'éditeur
  settingsTab.ts        l'onglet de réglages
  scope.ts              quelles notes sont analysées : dossiers à inclure ou ignorer, balise du YAML
  analyze.ts            texte -> mots -> détecteurs -> plages à surligner
  colors.ts             une couleur par famille de plages, stable pendant la frappe
  text/                 normalisation, zones ignorées, découpage en mots
  detectors/            un module par détecteur, même interface (types.ts) : repetitions.ts, weak.ts
  weak/lexicon.ts       la note de mots faibles : lecture, entrées (mot, expression, @verbe, *terminaison), recherche
  editor/highlight.ts   extension CodeMirror 6 (ViewPlugin + Decoration.mark)
  lang/                 tout ce qui dépend de la langue (fr/ : mots-outils, stemmer, verbes irréguliers,
                        fréquence des mots)
scripts/frequencies.ts  génère la liste des mots courants à partir de Lexique
data/                   sources tierces : Lexique 3.83, définition et vocabulaire de test de Snowball
```

- Le texte est découpé **une seule fois** ; tous les détecteurs travaillent sur les mêmes mots.
- Un détecteur reçoit les mots et rend des plages `{from, to, category, family, intensity, target, explain}` ; `explain()` écrit à la demande la phrase de l'infobulle, dont un passage (`link`) mène à `target`, l'autre occurrence. Chaque catégorie a ses classes CSS (`burr-repetition`, `burr-echo`, `burr-weak`). Les plages ne se chevauchent jamais : à l'intérieur de `analyze`, un détecteur cède la place à ceux qui le précèdent dans la liste. Une plage peut imposer sa couleur (`color`), comme les familles de mots faibles ; sinon `colors.ts` la choisit. En ajouter un ne touche ni l'éditeur ni l'interface : il suffit de l'inscrire dans [src/detectors/index.ts](src/detectors/index.ts).
- La normalisation typographique (apostrophe ’, espaces insécables) **conserve la longueur du texte**, pour que les positions des surlignages restent exactes.

## Crédits

Le stemmer français est un port TypeScript de l'algorithme [Snowball](https://snowballstem.org/algorithms/french/stemmer.html), vérifié sur tout le vocabulaire de test officiel de Snowball (voir [data/README.md](data/README.md)). Snowball ne connaît pas la désinence -ons (*mangeons* reste *mangeon*) : `Language.altStem` donne à ces formes une seconde racine (*mang*), en plus de l'ordinaire, pour que *manger* et *mangeons* se répondent sans que *maison* et *maisons* se perdent de vue. Limite connue : *mangions* (imparfait) n'est pas rapproché de *manger*, le stemmer ne le faisant que pour certains verbes et la règle ne pouvant pas distinguer *mangions* de noms comme *passions*.

Les verbes irréguliers vivent dans [src/lang/fr/verbs.ts](src/lang/fr/verbs.ts) : une entrée par verbe, avec le radical de l'imparfait et du futur (les désinences sont communes) et les autres formes écrites à la main. `Language.lemma` rend l'infinitif d'une forme ; c'est aussi la famille (donc la couleur) de toutes ses formes. La table s'ajoute au stemmer sans le remplacer, pour que *connaissait* reste rapproché de *connaissance*. Les formes qui appartiennent à deux verbes (*vit* : voir ou vivre) ou qui sont d'abord un nom courant (*lit*, *bois*) n'y figurent pas ; leurs composés (*relit*) si.

La rareté des mots vient de [Lexique 3.83](http://www.lexique.org) (Boris New, Christophe Pallier et al.) : la fréquence de chaque lemme dans un corpus de livres. Burr n'en garde que les racines Snowball des mots courants, par degré d'usage (13 391 racines, environ 100 Ko) ; une racine garde la plus haute fréquence des mots qui y mènent, si bien qu'un mot rare qui partage sa racine avec un mot courant passe pour courant. Lexique n'écrit pas les ligatures (*coeur*) : Burr les défait avant de chercher un mot. Limite connue : les mots rares repris de loin n'utilisent pas la seconde racine des formes en -ons, si bien que *ruisselons* ne répond pas à *ruisseler* à 3 000 mots d'écart (de près, si).

## Licence

[MIT](LICENSE), sauf [src/lang/fr/frequencies.ts](src/lang/fr/frequencies.ts), dérivé de Lexique et placé comme lui sous licence [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), et les copies de sources tierces du dossier [data/](data/), qui gardent chacune leur licence. Voir [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
