# Burr

Plugin [Obsidian](https://obsidian.md) de **relecture de prose littéraire en français**. Pendant que vous écrivez, il surligne les répétitions : le même mot trop près de lui-même, une expression qui revient, une forme du même verbe. Comme un burr (l'aspérité que l'on retire), il montre ce qui accroche ; c'est à vous de juger. **Le texte n'est jamais modifié.**

Pour l'instant, Burr ne fait qu'une chose : la détection automatique des répétitions. D'autres détecteurs (mots faibles, débuts de phrase, rythme) viendront s'y ajouter.

## Ce que fait le plugin

### Répétitions

- **Par proximité, pas par fréquence.** Deux occurrences sont signalées si elles sont séparées par au plus *N* mots (80 par défaut, réglable de 20 à 200). Un mot qui revient à cent pages d'écart ne gêne personne.
- **Une intensité selon la distance.** Trois teintes : plus les deux occurrences sont proches, plus le surlignage est marqué.
- **Mots isolés et expressions.** Burr repère aussi les suites de 2 à 4 mots (« tout de même », « il n'y avait pas »). Quand une expression revient, elle est surlignée d'un bloc plutôt que mot par mot.
- **Formes d'un même mot.** Grâce à un stemmer [Snowball](https://snowballstem.org/) français, *regardait*, *regarda* et *regardant* se rapprochent. Ces rapprochements sont surlignés plus discrètement et sur une distance plus courte, car un stemmer se trompe parfois.
- **Le bruit est écarté.**
  - Les mots-outils (*le, de, et, que, dans, il…*) et les formes d'*être* et d'*avoir* ne comptent pas.
  - Les noms propres non plus : un mot qui prend une majuscule en milieu de phrase n'est jamais signalé, pour qu'un personnage qui revient ne soit pas une répétition.
  - Le frontmatter, les blocs de code, le code en ligne, les commentaires (`%% %%`, `<!-- -->`), les formules `$$`, les adresses et les cibles de liens sont ignorés.
  - En option, les dialogues.
- **En direct.** Les surlignages suivent le texte pendant la frappe et se recalculent après 250 ms d'inactivité, en mode source comme en aperçu en direct.

Le mode Lecture n'est pas couvert : Burr travaille dans l'éditeur.

## Réglages

| Réglage | Effet |
| --- | --- |
| Surligner les répétitions | Active ou désactive le surlignage. |
| Fenêtre de recherche | Distance maximale, en mots, entre deux occurrences (20 à 200). |
| Longueur maximale des expressions | De 1 (mots isolés seulement) à 4 mots. |
| Rapprocher les formes d'un même mot | Active le stemmer (*regardait* / *regarda*). |
| Ignorer les noms propres | Écarte les mots qui prennent une majuscule en milieu de phrase. |
| Ignorer les dialogues | Écarte les lignes qui commencent par un tiret cadratin (— ou --) et les passages entre guillemets français. Attention : une réplique est écartée en entier, incidente comprise (« dit-il »). |
| Mots à ignorer en plus | Vos propres exceptions, un mot par ligne ou séparés par des virgules. |

## Commande

- **Afficher ou masquer les répétitions** : bascule le surlignage.

## Langue

Burr traite le **français** uniquement, et tout document est vu comme du français. Le code est déjà prévu pour qu'un document puisse avoir sa propre langue : tout ce qui en dépend (mots-outils, stemmer, marques de dialogue) vit dans un objet `Language`, et la langue d'un document se décide en un seul endroit (`resolveLanguage`, dans [src/lang/index.ts](src/lang/index.ts)). Il n'y a pas encore de sélecteur.

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

### Architecture

```
src/
  main.ts               le plugin : réglages, commande, extension d'éditeur
  settingsTab.ts        l'onglet de réglages
  analyze.ts            texte -> mots -> détecteurs -> plages à surligner
  text/                 normalisation, zones ignorées, découpage en mots
  detectors/            un module par détecteur, même interface (types.ts)
  editor/highlight.ts   extension CodeMirror 6 (ViewPlugin + Decoration.mark)
  lang/                 tout ce qui dépend de la langue (fr/ : mots-outils, stemmer)
```

- Le texte est découpé **une seule fois** ; tous les détecteurs travaillent sur les mêmes mots.
- Un détecteur reçoit les mots et rend des plages `{from, to, category, intensity}`. En ajouter un ne touche ni l'éditeur ni l'interface : il suffit de l'inscrire dans [src/detectors/index.ts](src/detectors/index.ts).
- La normalisation typographique (apostrophe ’, espaces insécables) **conserve la longueur du texte**, pour que les positions des surlignages restent exactes.

## Crédits

Le stemmer français est un port TypeScript de l'algorithme [Snowball](https://snowballstem.org/algorithms/french/stemmer.html), vérifié mot à mot contre l'implémentation de référence (voir [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)).

## Licence

[MIT](LICENSE)
