# Guide pour les assistants IA

Ces instructions s’appliquent à tout le dépôt **Preview link tab**. Respecter la demande de l’utilisateur et les consignes plus précises d’un sous-dossier, lorsqu’elles existent.

## Comprendre le projet et reprendre le travail

Preview link tab est une extension Manifest V3 pour Chrome/Chromium et Firefox sur ordinateur. Les deux versions partagent leurs scripts JavaScript, leur HTML et leurs styles CSS. Elle ouvre les liens dans un aperçu intégré, une fenêtre compacte ou une vue partagée native selon les réglages et les API disponibles.

À la reprise, lire dans cet ordre :

1. `AGENTS.md` et [README.md](README.md).
2. [Résumé de session](docs/resume-session.md) et [état du projet](docs/etat-projet.md).
3. [Architecture](docs/architecture.md), [travaux restants](docs/travaux-restants.md) et documents utiles via [l’index](docs/README.md).
4. Le code, les tests concernés et `git status --short`.

Vérifier le code actuel avant de reprendre un ancien constat ou plan. Un document daté ne prouve pas qu’un problème subsiste, qu’un correctif a été validé ou qu’une version est publiée. Les propositions et idées ne sont pas des demandes de tout implémenter.

## Documentation de référence : Markdown dans le dépôt

Depuis la demande du 21 octobre 2026, la gestion documentaire reprend la règle actuelle de Menu de la semaine : **créer et maintenir toute la documentation du projet exclusivement en Markdown dans ce dépôt, sans rédaction ni mise à jour dans Notion**.

`README.md` reste le point d’entrée, `AGENTS.md` contient les consignes opérationnelles et `docs/` rassemble les guides, plans, revues, idées, travaux restants et résumés. Lorsqu’une tâche modifie le fonctionnement, les commandes, la structure, les limites ou les travaux restants, actualiser les documents concernés dans la même tâche. Utiliser des noms français stables en minuscules, avec des tirets; dater les rapports historiques et les plans lorsque cela aide à les distinguer.

Conserver les guides courants directement dans `docs/`. Ranger les plans réalisés et les revues traitées dans `docs/archives/`, avec une notice de statut; leurs cases historiques ne sont pas un backlog actif. Mettre à jour tous les liens lors d’un déplacement. `docs/etat-projet.md` synthétise l’état courant, `docs/verifications.md` détaille les validations et `docs/resume-session.md` conserve le journal. Éviter de recopier tout le journal dans l’état du projet.

Les anciennes pages Notion sont des sources historiques. Leur correspondance est conservée dans [la provenance documentaire](docs/README.md#provenance-du-regroupement). Ne pas entretenir de copie parallèle. Préserver les notes et idées de l’utilisateur; si une source manque, signaler le manque sans inventer son contenu. Ne pas remplacer un document existant par un résumé qui perd ses informations utiles.

## Structure et fichiers à modifier

| Emplacement | Responsabilité |
| --- | --- |
| `manifest.json` | Manifeste Chrome et version de référence, identique à `package.json`. |
| `manifests/firefox.json` | Remplacement des clés propres à Firefox pendant la génération. |
| `background.js` | Fenêtres, onglets, commandes, messages, pause, positions de lecture et mutations de préférences. |
| `content.js` | Déclencheurs explicites, panneau, navigation, iframe, placement, gestes et réglages intégrés. |
| `settings.js` | Valeurs par défaut, validation, domaines, palettes et fonctions partagées. |
| `peek-icons.js` | Icônes utilisées par les interfaces de l’extension. |
| `popup.html`, `popup.js`, `popup.css` | Fenêtre principale des paramètres, brouillons et conflits. |
| `appearance.css`, `styles.css` | Apparence partagée et présentation de l’aperçu. |
| `icons/`, `icons/sources/` | PNG utilisés et originaux à préserver. |
| `scripts/` | Génération, archives, décision de publication et génération des icônes. |
| `tests/javascript/` | Tests Node.js de réglages, interactions, worker, build et archives. |
| `tests/browser/` | Contrôle Chromium avec pages locales et API d’extension simulées. |
| `tools/ci/` | Dépendances optionnelles verrouillées : Playwright et `web-ext`. |
| `.github/workflows/` | Validations, artefacts et publication automatique. |
| `docs/` | Documentation de référence et rapports datés. |
| `dist/` | Extensions et ZIP générés, non versionnés. |

Conserver les fichiers chargés par l’extension à leurs emplacements actuels. Ne pas créer un dossier `src/` simplement pour ranger la racine : les manifestes, les URL d’extension, les injections, le build et les tests dépendent de ces chemins. Tout déplacement de ressource doit traiter et vérifier tous ces usages. Le build copie une liste explicite de fichiers applicatifs; ne pas y inclure documentation, tests ou dépendances de développement.

Conserver un seul code applicatif commun avec des manifestes adaptés. Ne pas déplacer ni supprimer les originaux des icônes. Ne pas nettoyer les profils de navigateur, préférences, exports personnels ou dossiers extérieurs au projet pour réorganiser ce dépôt.

Avant un ménage, inventorier les usages dans les manifestes, scripts, tests et workflows. Supprimer seulement les fichiers devenus inutiles dont l’absence d’usage est confirmée. Préserver les configurations locales des outils, les dépendances de développement installées et les builds pouvant être chargés dans un navigateur. Un fichier généré ou ignoré par Git n’est pas automatiquement à supprimer. Les fichiers Finder `.DS_Store` et les marqueurs `.gitkeep` de dossiers déjà remplis peuvent être retirés.

## Exécuter et vérifier

Utiliser Node.js 22 ou 24, comme la matrice de CI actuelle. Aucune dépendance npm applicative n’est nécessaire pour les tests JavaScript ni pour le build. Les tests d’archives et la préparation des ZIP nécessitent `zip` et `unzip`.

```sh
npm test
npm run build
npm run package
git diff --check
```

Pour un changement de logique, adapter ou ajouter un test de régression ciblé. Pour une modification purement documentaire, vérifier les liens, les commandes et le diff suffit. Après une réorganisation des tests ou des ressources, exécuter les tests, les deux builds et la vérification des archives.

Pour les contrôles complémentaires, lorsque les outils requis sont disponibles :

```sh
npm ci --prefix tools/ci
tools/ci/node_modules/.bin/playwright install chromium
npm run test:browser
tools/ci/node_modules/.bin/web-ext lint --source-dir dist/firefox
```

`PLAYWRIGHT_MODULE` sélectionne un module Playwright externe; `CHROMIUM_PATH` sélectionne un navigateur installé; `QA_SCREENSHOT_DIR` choisit le dossier des captures. Consulter [Vérifications](docs/verifications.md) pour les limites et essais manuels. Ne pas installer ces outils uniquement pour modifier une documentation.

Après un changement applicatif, recharger l’extension et les pages déjà ouvertes. Pour une installation sous `dist/`, reconstruire d’abord les fichiers. Firefox se charge temporairement par `about:debugging#/runtime/this-firefox` avec `dist/firefox/manifest.json`; cette installation ne constitue pas une distribution signée.

## Comportements à préserver

- Préserver les déclencheurs explicites et le raccourci global. Ne pas réintroduire l’aperçu automatique au survol.
- Vérifier les exclusions avant d’intercepter le clic. Sur un site exclu ou en pause, conserver le comportement normal du lien.
- Utiliser uniquement la vue partagée native lorsque son API est exposée. Ne pas la remplacer par deux fenêtres ou des panneaux intégrés, ni déduire sa disponibilité du nom du navigateur.
- Ne pas contourner les protections iframe des sites. La confirmation de navigation de l’extension fait foi; un événement `load` seul ne prouve pas la réussite. Conserver les alternatives et les messages de délai prévus.
- Préserver le contexte privé des fenêtres et onglets externes. Un échec d’ouverture privée ne doit pas ouvrir silencieusement une fenêtre normale. L’ouverture des paramètres doit rester compatible avec le mode partagé Chrome et conserver l’onglet source.
- Garder les pauses et positions de lecture privées séparées des normales. Ne pas ajouter d’URL privée aux journaux ou documents. Vérifier l’accès au site source et son éventuelle fermeture avant une action.
- Préserver les brouillons, thèmes et règles enregistrés dans d’autres fenêtres. Faire passer les écritures concurrentes concernées par le protocole du worker; ne pas contourner sa file avec un nouvel appel direct à `storage.local.set` dans une interface.
- Ne pas supprimer silencieusement des préférences après une erreur ou un conflit. Conserver les brouillons et annoncer le résultat réel de la sauvegarde.
- Préserver les raccourcis des champs éditables, les éditeurs riches, la composition IME, le focus et la préférence de réduction des animations.
- Conserver les sept thèmes connus, les palettes personnelles, les originaux des icônes et la priorité du choix d’ombre sur le thème.
- Conserver la fermeture immédiate de l’aperçu au clic sur Nouvel onglet, même épinglé, avant la réponse du worker.

Les revues signalent aussi des points restant à confirmer ou corriger. Ces règles décrivent le comportement à préserver ou atteindre; elles ne certifient pas que tout le code le respecte déjà. Ne pas corriger d’autres chantiers sans lien avec la demande en cours.

## Git, versions et publication

Examiner `git status` avant toute modification et préserver le travail existant. Une demande de développement, de revue, de documentation ou de résumé n’autorise aucun commit, push ou publication. Attendre une demande ou une confirmation explicite pour ces opérations et distinguer leur portée : un commit seul n’autorise pas le push.

Utiliser la compétence **github-commit-push** lorsqu’une telle opération est demandée, en respectant les protections du projet. Si elle est indisponible, le signaler. Les messages de commit doivent être en français, avec un titre court et une description concise, comme indiqué dans `.github/copilot-instructions.md`.

Ne pas augmenter la version pour une simple réorganisation. Pour une future version, garder `manifest.json` et `package.json` cohérents. Les workflows actuels préparent des ZIP après validation; un push autorisé augmentant la version sur `main` peut déclencher une publication automatique. Expliquer cet effet avant un push concerné. Une relance manuelle ou un tag peut aussi reprendre une publication selon les contrôles du workflow.

Ne jamais annoncer un paquet local, un artefact CI, une release GitHub, une signature Firefox et une publication sur boutique comme équivalents. Ne pas déplacer de tag ou remplacer une release publiée. Lire [Distribution](docs/distribution.md) et vérifier l’état distant si une publication est effectivement demandée.

## Résumé et reprise des sessions

Lorsqu’un résumé ou une clôture de session est demandé, actualiser directement `docs/resume-session.md` sans redemander l’autorisation d’écrire ce document. Une clôture est annoncée par l’utilisateur; chaque réponse ne constitue pas une fin de session.

Actualiser la synthèse en tête et conserver un journal daté. Indiquer : décisions, prochaine étape, fichiers concernés, état Git, vérifications réellement exécutées et limites. Distinguer code présent, propositions, défauts signalés et validations manuelles restantes. Préserver les priorités et notes de l’utilisateur; ne pas copier toute la conversation ni inclure de secrets ou de données de navigation privées.

En fin de tâche, présenter brièvement les changements, les vérifications et les limites. Séparer les tests automatisés des essais réellement effectués dans Chrome, Firefox ou Helium. Ne pas annoncer un test ou une publication qui n’a pas été exécuté.
