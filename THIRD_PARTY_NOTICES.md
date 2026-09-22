# Notices de tiers

## Snowball : stemmer français

`src/lang/fr/stemmer.ts` est un port en TypeScript de l'algorithme de racinisation
français du projet [Snowball](https://snowballstem.org/algorithms/french/stemmer.html)
(définition `french.sbl`). Le port a été vérifié mot à mot contre l'implémentation de
référence, sur un dictionnaire de 331 778 formes, sans aucun écart.

Le projet Snowball est distribué sous licence BSD à trois clauses :

```
Copyright (c) 2001, Dr Martin Porter
Copyright (c) 2004,2005, Richard Boulton
Copyright (c) 2013, Yoshiki Shibukawa
Copyright (c) 2006-2025, Olly Betts
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:

  1. Redistributions of source code must retain the above copyright notice,
     this list of conditions and the following disclaimer.
  2. Redistributions in binary form must reproduce the above copyright notice,
     this list of conditions and the following disclaimer in the documentation
     and/or other materials provided with the distribution.
  3. Neither the name of the Snowball project nor the names of its contributors
     may be used to endorse or promote products derived from this software
     without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## Lexique 3.83 : fréquence des mots français

`src/lang/fr/frequencies.ts` est dérivé de [Lexique 3.83](http://www.lexique.org),
base lexicale du français de Boris New, Christophe Pallier et al. Le fichier est généré par
`scripts/frequencies.ts` à partir de `Lexique383.tsv` : n'y restent que les racines Snowball
des mots dont le lemme revient au moins 3 fois par million de mots dans le corpus de livres
de Lexique (colonne `freqlemlivres`), classées en trois degrés d'usage.

Lexique est distribué sous licence Creative Commons Attribution - Partage dans les mêmes
conditions 4.0 International (CC BY-SA 4.0) :
https://creativecommons.org/licenses/by-sa/4.0/

`src/lang/fr/frequencies.ts` est placé sous la même licence. Le reste du plugin demeure
sous licence MIT.

Référence : New, B., Pallier, C., Brysbaert, M., & Ferrand, L. (2004). Lexique 2 : A new
French lexical database. *Behavior Research Methods, Instruments, & Computers*, 36(3),
516-524.
