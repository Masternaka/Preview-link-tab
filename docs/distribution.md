# Distribution et GitHub Actions

Les workflows décrits ici sont présents dans le dépôt. Leur présence ne prouve pas leur exécution ni une publication distante récente. Toute écriture GitHub, tout commit et tout push exigent une demande ou une confirmation explicite selon [AGENTS.md](../AGENTS.md).

Le workflow **Tests et extensions** s’exécute sur chaque push de branche, sur
chaque pull request et manuellement depuis **Actions → Tests et extensions →
Run workflow**. Il effectue :

1. Les tests sur Node.js 22 et 24, y compris la vérification des ZIP.
2. La génération Chrome/Firefox et `web-ext lint` pour Firefox.
3. Les tests d’intégration dans Chromium avec les API d’extension simulées.
4. Si toutes les vérifications réussissent, la préparation des deux ZIP et du
   fichier d’empreintes `SHA256SUMS`.

### Télécharger une version à essayer

Sur GitHub, ouvrir **Actions → Tests et extensions**, choisir une exécution
réussie correspondant au commit voulu, puis télécharger l’artefact
**preview-link-tab-packages** en bas de sa page. Une connexion à GitHub peut être
nécessaire. Extraire cette première archive pour obtenir :

- `preview-link-tab-<version>-chrome.zip` ;
- `preview-link-tab-<version>-firefox.zip` ;
- `SHA256SUMS`.

Les artefacts sont conservés 30 jours. Les rapports Firefox et les captures
Chromium, sous **rapports-validation**, restent disponibles 14 jours.

Pour Chrome et Helium, extraire aussi le ZIP Chrome, puis charger le dossier
contenant `manifest.json` comme extension non empaquetée. Pour Firefox,
extraire le ZIP Firefox et charger temporairement son `manifest.json` depuis
`about:debugging`. Recharger l’extension et les pages existantes après chaque
mise à jour. Ces archives ne sont pas signées pour une installation permanente
dans Firefox et ne sont pas publiées sur les boutiques.

### Publication automatique après un push

Quand une version est prête, augmenter ensemble les versions de `package.json`
et `manifest.json`, puis faire un commit et un push vers `main`. Par exemple,
passer les deux fichiers de 0.2.2 à 0.2.3 avant de pousser.

Le workflow **Publication automatique** détecte le nouveau numéro, relance les
validations, récupère les archives et vérifie leurs empreintes. Si tout réussit,
il crée le tag correspondant (par exemple `v0.2.3`) sur le commit testé et publie
la release avec les ZIP Chrome/Firefox et des notes générées automatiquement.
Il n’y a plus de bouton de publication à cliquer.

Un push sans changement de version conserve les contrôles et les ZIP dans
**Actions**, sans créer de release. Une release déjà publiée n’est jamais
remplacée. Un tag existant pointant vers un autre commit n’est pas déplacé.
Un brouillon existant pour la même version et le même commit peut être terminé.

En cas d’échec, corriger le problème puis ouvrir **Actions → Publication
automatique → Run workflow**, sur `main`, pour reprendre la publication de la
version non publiée. Les tags `v*` restent aussi acceptés, à condition de
correspondre à la version des manifestes. Les publications depuis une autre
branche sont refusées.

Aucun secret personnel n’est requis : le workflow utilise le jeton temporaire
fourni par GitHub. Si la politique du dépôt interdit l’écriture avec
`GITHUB_TOKEN`, son propriétaire doit autoriser cette opération dans les
paramètres GitHub Actions. Une publication GitHub ne signe pas l’extension
Firefox et ne publie pas l’extension sur les boutiques.

### Exécuter les mêmes contrôles localement

Les tests d’archives et `npm run package` nécessitent les commandes `zip` et
`unzip`, présentes sur les runners Ubuntu de GitHub. Les commandes de génération
`npm run build` restent sans dépendances npm. Les outils optionnels ont leur
propre manifeste et lockfile sous `tools/ci` :

```bash
npm ci --prefix tools/ci
npm test
npm run build
tools/ci/node_modules/.bin/web-ext lint --source-dir dist/firefox
tools/ci/node_modules/.bin/playwright install chromium
npm run test:browser
npm run package
```

Sur Linux, `playwright install --with-deps chromium` peut être nécessaire pour
installer aussi les bibliothèques système. Pour réutiliser un Chromium déjà
installé, utiliser `CHROMIUM_PATH=/chemin/vers/chromium npm run test:browser`.
Les paquets sont écrits dans `dist/packages/`. Ne pas versionner `dist/` ni les
outils installés. Les vérifications avec les API simulées complètent les essais
réels dans Chrome, Firefox et Helium.

## Note historique 0.2.1

La version 0.2.1 retire l’aperçu dès le clic sur **Nouvel onglet**, avant toute
communication avec le script d’arrière-plan. Après une mise à jour locale,
vérifier **0.2.1** dans la page des extensions de Chrome, Helium ou Firefox,
recharger l’extension et actualiser les pages déjà ouvertes pour remplacer
leurs anciens scripts. Les fichiers générés doivent être reconstruits avec
`npm run build` avant de recharger une installation pointant sur `dist/`.

Cette note conserve le contexte de la modification 0.2.1. Pour une installation actuelle, vérifier la version effectivement indiquée par les manifestes plutôt que rechercher ce numéro historique.
