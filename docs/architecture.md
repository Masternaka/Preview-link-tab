# Architecture et structure du dépôt

État vérifié dans les sources le 21 octobre 2026. Le dépôt contient une extension JavaScript/HTML/CSS sans framework applicatif, ainsi que des outils Node.js de développement.

## Arborescence

```text
Preview link tab/
├── AGENTS.md                  # Consignes opérationnelles
├── README.md                  # Point d’entrée
├── manifest.json              # Chrome, Manifest V3
├── background.js              # Opérations et état d’arrière-plan
├── content.js                 # Aperçu et interactions dans les pages
├── settings.js                # Réglages, validation, domaines et palettes
├── peek-icons.js              # Icônes d’interface
├── popup.html / .js / .css     # Paramètres
├── appearance.css             # Apparence partagée
├── styles.css                 # Panneau intégré
├── package.json               # Commandes et version
├── manifests/firefox.json     # Clés de manifeste Firefox
├── icons/                     # Icônes utilisées et sources originales
├── scripts/                   # Build, archives, release et icônes
├── tests/
│   ├── javascript/            # Tests exécutés par npm test
│   └── browser/               # Contrôle Playwright explicite
├── tools/ci/                  # Outils optionnels et lockfile
├── docs/                      # Guides et suivi actuels
│   └── archives/              # Plans réalisés et revues traitées
├── .github/                   # Instructions de commit et workflows
└── dist/                      # Sorties ignorées par Git
```

Les fichiers applicatifs restent à la racine afin de préserver les chemins des manifestes, les URL d’extension et le chargement direct dans Chrome. La réorganisation du 21 octobre ne transforme pas l’architecture applicative et ne modifie pas le format des préférences.

## Responsabilités

| Fichier | Responsabilité |
| --- | --- |
| `content.js` | Détection des liens, interception autorisée, panneau, iframe, navigation, gestes, raccourcis, menu intégré et affichage des erreurs. |
| `background.js` | Ouverture des fenêtres/onglets, commandes navigateur, suivi des fenêtres compactes, messages, pause, positions de lecture et mutations de préférences. |
| `settings.js` | Défauts, options autorisées, nettoyage des imports, règles de domaine, thèmes et calculs partagés. |
| `popup.js` | Formulaire, site source, aperçu d’apparence, bibliothèques, brouillons, import/export et interface de conflit. |
| `appearance.css` | Thèmes, cadres et ombres partagés. |
| `styles.css`, `popup.css` | Présentation propre à l’aperçu et à la fenêtre de paramètres. |

## Deux manifestes, un code commun

`scripts/build.js` lit le manifeste racine et copie une liste explicite de ressources dans `dist/chrome` ou `dist/firefox`. Pour Firefox, il remplace les clés concernées avec `manifests/firefox.json`.

Chrome utilise `background.service_worker`. Firefox charge `settings.js` puis `background.js` avec `background.scripts`; sa variante adapte les permissions et définit l’identifiant Gecko ainsi que Firefox 140 minimum sur ordinateur. Les opérations d’arrière-plan choisissent `browser` ou `chrome` selon l’environnement.

Un fichier ajouté au runtime doit être intégré aux manifestes ou au build selon son rôle. Les documents et tests ne doivent jamais être ajoutés aux archives applicatives.

## Stockage et concurrence

Les préférences persistantes et les thèmes utilisent le stockage local de l’extension. Les pauses et positions de lecture utilisent le stockage de session ou le repli mémoire prévu, avec séparation normal/privé pour les données concernées.

La copie de travail présente à la réorganisation contient déjà une file de mutations des préférences dans le worker. Les fenêtres de paramètres transmettent des modifications et gèrent un état de référence, des brouillons et des conflits. Les corrections de la [revue locale](archives/revue-locale-2026-10-21.md) séparent la dernière version stockée des références des entrées modifiées localement. Une seule mutation de préférences ou de règle rapide est envoyée à la fois par fenêtre; les notifications reçues pendant la requête sont rejouées après sa réponse pour respecter les écritures plus récentes; les réponses réconcilient les entrées soumises en préservant les brouillons ultérieurs. Le réducteur pur `applySettingsMutation`, placé dans `settings.js`, fournit la même validation au worker et aux deux harnais. Les tests simulés ne remplacent pas la validation avec les extensions chargées.

Les documents historiques signalent aussi un secours des préférences dans le `localStorage` du site et une liste d’autorisation vide permissive. Leur suivi reste dans [Travaux restants](travaux-restants.md); cette réorganisation ne change pas ces comportements.

## Outils, tests et livraison

- `tests/javascript/` contient les tests Node.js, y compris les harnais de worker et d’interface avec API simulées.
- `tests/browser/check-browser.cjs` sert des pages locales et exécute les scripts avec Playwright; il simule les API d’extension.
- Le CLI `scripts/package.js` actualise les deux dossiers chargeables, puis génère les ZIP depuis un staging temporaire propre et calcule `SHA256SUMS`. Son API `packageExtensions(output)` produit uniquement les archives dans le dossier demandé.
- Après réussite des deux ZIP et de `SHA256SUMS`, la rétention conserve la version générée et les deux autres versions numériquement les plus élevées. Elle ne retire que les fichiers réguliers aux noms stricts des archives générées, sans toucher aux autres ressources ni aux dossiers chargeables.
- `scripts/watch.js` (`npm run dev`) compare périodiquement les empreintes des seules entrées de génération. Il regroupe les changements et lance un nouveau processus Node.js pour chaque préparation, sans cache des versions. Une seule génération tourne à la fois; les changements reçus pendant son exécution sont traités ensuite. Aucun hook Git ni service système n’est installé.
- `scripts/release-plan.js` vérifie la cohérence de version, de référence Git et de release avant une éventuelle publication par la CI.
- `.github/workflows/tests.yml` exécute les contrôles et prépare les artefacts; `release.yml` orchestre la publication autorisée par ses déclencheurs.

Voir [Vérifications](verifications.md) et [Distribution](distribution.md) pour les commandes et leurs limites.

## Icônes

Chaque icône conserve son visuel original sous `icons/sources/`. La génération recadre chaque source au centre en carré puis la redimensionne en 16, 32, 48 ou 128 pixels, sans modifier son fond.

Sur macOS :

```sh
./scripts/generate-icons.sh
```

L’alternative `python3 scripts/generate-icons.py` nécessite Pillow. Ne pas régénérer les icônes pour une simple réorganisation. La popup utilise `icons/icon48.png`.

L’ancienne image `iconhighres.png`, qui n’est utilisée ni par les manifestes ni par les générateurs actuels, est conservée dans `icons/sources/`. Les quatre fichiers `icons/icon16.png`, `icon32.png`, `icon48.png` et `icon128.png` restent les ressources utilisées et empaquetées.

## Hooks Git locaux

`scripts/install-hooks.js` configure explicitement `.githooks` dans chaque clone,
avec protection des hooks existants et chemin Node local stable. `post-commit`
et `pre-push` partagent le lanceur `prepare-distribution`, qui appelle directement
`scripts/package.js` sans transmettre les arguments Git. Le premier avertit après
un échec; le second bloque le push. Aucun service permanent. Le runtime Node
éventuellement copié sous `tools/local-runtime/` est ignoré par Git.
