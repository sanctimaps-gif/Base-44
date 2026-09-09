# Base 44

Plateforme de creation d'applications pilotee par une **IA autonome**.

Vous decrivez ce que vous voulez en francais courant, le moteur concoit le modele
de donnees, genere les pages, remplit l'application de donnees coherentes et
produit le code source correspondant.

```
« cree une application de gestion de clients avec un suivi des factures »
  -> 5 tables, 6 pages, un tableau de bord, 40 enregistrements, 19 fichiers de code
```

---

## L'IA est totalement independante

C'etait l'exigence centrale de ce projet, et elle est tenue au sens suivant :

| Garantie | Etat |
| --- | --- |
| Modeles d'IA tiers utilises | **aucun** |
| Cles d'API requises | **aucune** |
| Requetes reseau sortantes | **aucune** |
| Dependances npm du moteur | **aucune** |
| Fonctionne hors ligne | **oui** |

Le moteur (`packages/engine`) est un raisonneur symbolique ecrit entierement
pour ce projet : analyse linguistique, classification d'intention, extraction,
base de connaissance metier, planification et generation de code. Vos
descriptions et vos donnees ne quittent jamais votre serveur.

**Ce que cela implique aussi** : il s'agit d'un moteur specialise dans la
generation d'applications, pas d'un grand modele de langage generaliste. C'est
precisement ce qui le rend autonome, previsible et verifiable — mais il ne tient
pas une conversation de culture generale. Entrainer un modele de fondation depuis
zero est hors de portee d'un depot applicatif ; l'independance est donc obtenue
en construisant un raisonneur propre, et non en enveloppant l'IA de quelqu'un d'autre.

Une couche d'adaptateurs (`engine/src/providers`) permet de brancher plus tard un
modele externe sans toucher au reste de l'application. Tant qu'aucun adaptateur
n'est enregistre, l'IA reste 100 % autonome — c'est le comportement par defaut.

---

## Version en ligne

**https://sanctimaps-gif.github.io/Base-44/**

Le studio y tourne en **mode autonome** : aucun serveur n'est necessaire, le
moteur d'IA s'execute dans le navigateur et vos applications sont conservees
dans le stockage local du navigateur. Rien n'est envoye nulle part.

---

## Demarrage

```bash
npm install
npm run dev
```

- Studio : http://localhost:5173
- API : http://localhost:844

```bash
npm test          # 31 tests du moteur
npm run build     # build de production du studio
```

Aucune configuration n'est necessaire. `.env.example` documente les reglages
optionnels (port, repertoire de donnees).

---

## Architecture

```
packages/
├── engine/     Le moteur d'IA — zero dependance
│   ├── nlu/          normalisation, lexique FR/EN, intentions, extraction
│   ├── knowledge/    15 domaines metier, types de champs, synonymes, donnees
│   ├── planner/      AppSpec : construction, mutation, validation, reparation
│   ├── synth/        generation SQL / Express / React / TypeScript
│   ├── memory/       memoire conversationnelle
│   └── providers/    adaptateurs externes (aucun actif par defaut)
│
├── server/     API Express + stockage JSON
│   └── routes/       applications, conversation, donnees, export
│
└── web/        Studio React + Vite
    ├── runtime/      rendu des applications generees
    ├── pages/        accueil, builder, apercu, modeles, moteur, parametres
    ├── lib/          client d'API + backend autonome (navigateur)
    └── styles/       systeme de design (theme clair/sombre)
```

### Deux modes d'execution

Le studio parle toujours aux memes routes ; seule leur implementation change.

| Mode | Quand | Donnees |
| --- | --- | --- |
| Serveur | `npm run dev`, ou build avec `VITE_API_URL` | API Express, fichiers JSON |
| Autonome | build statique sans `VITE_API_URL` (GitHub Pages) | moteur dans le navigateur, `localStorage` |

Le moteur n'ayant aucune dependance ni appel reseau, il s'execute a l'identique
des deux cotes ; les regles de validation sont partagees
(`engine/src/planner/records.js`), si bien qu'un enregistrement refuse par
l'API l'est aussi en mode autonome.

### Deploiement

Un push sur la branche declenche `.github/workflows/deploy.yml` : tests, build
statique, publication sur GitHub Pages. Cote depot, il suffit d'activer
**Settings → Pages → Source : GitHub Actions**.

### Le pivot : l'AppSpec

Tout passe par un unique document JSON decrivant l'application — tables, champs
types, relations, pages, vues, theme. Le moteur le produit et le modifie, le
runtime l'affiche, les synthetiseurs le traduisent en code. Ajouter une
capacite au produit revient a etendre ce format.

### Comment le moteur raisonne

1. **Analyse linguistique** — accents, tokenisation, pluriels FR/EN, tolerance aux fautes.
2. **Intention** — creation, ajout de table/champ/vue, suppression, renommage, theme, question.
3. **Extraction** — domaine, entites, champs, couleurs, type de vue.
4. **Planification** — construction ou mutation de l'AppSpec, puis validation et auto-reparation.
5. **Synthese** — rendu a l'ecran et generation du code source.

---

## Fonctionnalites

**Studio**
- Creation d'application depuis une simple description
- Conversation continue pour faire evoluer l'application
- Apercu vivant, structure du modele, code source genere
- Application generee consultable en plein ecran
- Themes clair / sombre, couleur d'accent suivant l'application
- 15 modeles de domaines prets a l'emploi

**Applications generees**
- Vues liste, kanban, calendrier, galerie, tableau de bord
- Formulaires generes selon les types de champs (19 types)
- Validation serveur derivee du spec (obligatoire, unicite, enumerations, e-mail, dates)
- Relations entre tables resolues a l'affichage
- Recherche, tri, filtres
- Donnees d'exemple coherentes (les relations pointent vers de vrais enregistrements)

**Export**
- `schema.sql`, `types.ts`, `server.js` (API Express), client d'API,
  composants React de liste et de formulaire, `README.md`, `app.spec.json`

---

## Tests

Le moteur est couvert par 31 tests (`node --test`) portant sur la classification
d'intention, la detection de domaine, l'inference de types, la coherence du spec
apres mutation, le determinisme des donnees d'exemple et la validite du code
genere. Le parcours complet du studio est verifie par un scenario navigateur.

```bash
npm test
```
