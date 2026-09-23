# Données tierces

Copies des sources dont le plugin est dérivé, pour que tout se régénère et se vérifie depuis le dépôt, sans rien aller chercher ailleurs. Aucun de ces fichiers n'entre dans `main.js`.

**Ces fichiers ne sont pas sous licence MIT** : chacun garde la sienne, rangée à côté de lui. `lexique/` est sous CC BY-SA 4.0 ; `snowball/` sous BSD à trois clauses ; `snowball-data/` sous BSD à trois clauses, avec des listes de mots tirées de Wikipédia (CC BY-SA 3.0).

Les fins de ligne n'y sont jamais converties (`.gitattributes`) : les fichiers restent identiques, octet pour octet, à ceux de leur source.

## `lexique/` : Lexique 3.83

Base lexicale du français de Boris New, Christophe Pallier et al., <http://www.lexique.org>.

| Fichier | Origine |
| --- | --- |
| `Lexique383.tsv.gz` | <http://www.lexique.org/databases/Lexique383/Lexique383.tsv> (fichier daté du 4 juin 2019, 25 850 780 octets). Contenu inchangé, seulement compressé avec `gzip -9 -n`. |
| `LICENSE.txt` | Texte de la licence CC BY-SA 4.0, tel que le fournit le dépôt [OpenLexicon](https://github.com/chrplr/openlexicon/blob/9009f488f664536940965453c127f43cf18b84a4/LICENSE.txt) des auteurs de Lexique. |

SHA-256 du fichier décompressé, le même que celui de lexique.org : `637ba37a767a66679c48371d673ece50cbf541b49a4e40e598963d4f3fbce52b`.

```bash
gunzip -c data/lexique/Lexique383.tsv.gz | sha256sum
```

**Licence.** Lexique 3.83 est distribué sous licence Creative Commons Attribution - Partage dans les mêmes conditions 4.0 (CC BY-SA 4.0), comme le déclarent le dépôt OpenLexicon et sa [fiche Lexique383](https://github.com/chrplr/openlexicon/blob/9009f488f664536940965453c127f43cf18b84a4/datasets-info/Lexique383/README-Lexique.md). La licence permet de redistribuer la base, à condition de citer les auteurs et de garder la même licence ; c'est aussi pourquoi `src/lang/fr/frequencies.ts`, qui en dérive, est sous CC BY-SA 4.0.

**Usage.** `npm run frequencies` lit cette copie et régénère `src/lang/fr/frequencies.ts` (voir [scripts/frequencies.ts](../scripts/frequencies.ts)). Le résultat doit être identique au fichier du dépôt tant que ni les seuils ni le stemmer ne changent.

**Lexique 4.** lexique.org propose désormais Lexique 4.00 ; Burr reste sur 3.83. Avant d'en changer, vérifier la licence de la version 4 : en septembre 2026, la page d'accueil de lexique.org annonce une licence CC BY-SA 4.0, mais son lien mène à CC BY-NC 4.0, qui interdirait de publier la liste dérivée sous CC BY-SA.

**Citation.** New, B., Pallier, C., Brysbaert, M., & Ferrand, L. (2004). Lexique 2 : A new French lexical database. *Behavior Research Methods, Instruments, & Computers*, 36(3), 516-524.

## `snowball/` et `snowball-data/` : stemmer français Snowball

Projet [Snowball](https://snowballstem.org/) de Martin Porter, Richard Boulton et al. Les deux dossiers reprennent les chemins des deux dépôts du projet, pour que chaque licence reste à la place où ses fichiers la cherchent.

| Fichier | Origine |
| --- | --- |
| `snowball/french.sbl` | Définition de l'algorithme, dans le langage Snowball : [snowball, `algorithms/french.sbl`](https://github.com/snowballstem/snowball/blob/411550ddb8ea049bc3e8d39bf56454e8a9ef0be6/algorithms/french.sbl). |
| `snowball/COPYING` | Licence du dépôt [snowball](https://github.com/snowballstem/snowball/blob/411550ddb8ea049bc3e8d39bf56454e8a9ef0be6/COPYING) : BSD à trois clauses. |
| `snowball-data/french/voc.txt`, `output.txt` | Vocabulaire de test officiel : 21 653 mots, et à la même ligne la racine attendue de chacun : [snowball-data, `french/`](https://github.com/snowballstem/snowball-data/tree/a0ec0d0a2839ec885878868de20fcb63209d92b0/french). |
| `snowball-data/french/COPYING` | D'où vient ce vocabulaire, et sous quelle licence. |
| `snowball-data/COPYING` | Licence du dépôt [snowball-data](https://github.com/snowballstem/snowball-data/blob/a0ec0d0a2839ec885878868de20fcb63209d92b0/COPYING) : BSD à trois clauses, sauf mention contraire dans un sous-dossier. |

**Licence.** `french.sbl` est sous BSD à trois clauses. Le vocabulaire de test aussi, pour sa part d'origine ; mais `french/COPYING` précise qu'il a été complété par des listes de mots tirées de Wikipédia en français, dont le texte est sous CC BY-SA 3.0, et que `output.txt` est produit par le stemmer à partir de `voc.txt`. Ces fichiers ne servent qu'aux tests.

### Comment le stemmer a été porté

[src/lang/fr/stemmer.ts](../src/lang/fr/stemmer.ts) est une traduction de `french.sbl` en TypeScript, sans dépendance :

- **Les routines sont traduites à la main**, une méthode par routine de `french.sbl` (`prelude`, `mark_regions`, `standard_suffix`, `i_verb_suffix`, `verb_suffix`, `residual_suffix`, `un_double`, `un_accent`, `postlude`), dans le même ordre et avec les mêmes tests. Elles s'appuient sur les primitives que le compilateur Snowball fournit à tous ses stemmers générés : un curseur qui recule depuis la fin du mot, les bornes `bra` et `ket` de la partie à remplacer, `find_among_b`, `slice_from`, les tests d'appartenance à un groupe de lettres.
- **Les tables `among`** (les listes de suffixes, chacune avec le numéro de l'action à mener) ont été recopiées par un petit script depuis `french_stemmer.py`, le code que le compilateur Snowball génère à partir de `french.sbl` et que publie le paquet Python [snowballstemmer](https://pypi.org/project/snowballstemmer/) 3.1.1 : cela évitait de renuméroter les actions à la main. Ce script, à usage unique, n'est pas dans le dépôt.
- **Un seul écart** : la routine `elisions` (*l'homme* → *homme*) est omise, parce que le tokenizer de Burr coupe déjà les mots à l'apostrophe.

Deux vérifications :

- **Reproductible, dans `npm test`** : [test/stemmer.test.ts](../test/stemmer.test.ts) passe tout `voc.txt` au stemmer et compare à `output.txt`. Aucun écart sur les 21 653 mots. Le test refait lui-même l'élision, telle que la décrit `french.sbl`. Il échoue bien quand on fausse le port : changer le numéro d'action d'un seul suffixe (`eaux`) donne 46 écarts.
- **Faite une fois, au moment du portage** : comparaison mot à mot avec snowballstemmer 3.1.1 sur 331 778 formes (la liste du paquet npm `an-array-of-french-words`), sans aucun écart. Elle dépendait de ce paquet et de Python, et ne se refait pas depuis le dépôt.

### Suivre une nouvelle version de Snowball

Remplacer les fichiers de `snowball/` et `snowball-data/` par ceux de commits plus récents (et mettre à jour les liens ci-dessus), puis lancer `npm test`. Si le test échoue, reporter dans `stemmer.ts` les changements de `french.sbl` (`git diff data/snowball/french.sbl`) jusqu'à ce qu'il repasse, puis régénérer la liste des mots courants (`npm run frequencies`), qui dépend des racines.
