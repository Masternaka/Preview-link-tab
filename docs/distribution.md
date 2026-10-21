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

## Actualisation locale pendant le développement

`npm run package` prépare en une commande les dossiers chargeables `dist/chrome`
et `dist/firefox`, puis les ZIP et `SHA256SUMS` dans `dist/packages`. Les archives
sont construites dans un dossier temporaire propre; les fichiers périmés déjà
présents dans `dist/` ne sont pas inclus dans les ZIP. Les ZIP d’anciennes versions
restent disponibles pour trois versions au maximum : la version générée et les
deux autres versions aux numéros les plus élevés (tri numérique). Chaque version
comprend les ZIP Chrome et Firefox. Le retrait des ZIP plus anciens intervient
seulement après la réussite des deux archives et de l’écriture de `SHA256SUMS`,
qui décrit la dernière génération. Seuls les fichiers réguliers portant les noms
stricts des ZIP générés sont concernés; les autres fichiers, dossiers et liens
symboliques sont conservés. Les dossiers chargeables ne sont pas nettoyés par
cette rétention.

`npm run dev` réalise cette préparation au démarrage et après chaque modification
d’une ressource applicative copiée, de `manifest.json`, `manifests/firefox.json`,
`package.json` ou des scripts de build, d’archives et de surveillance. La commande
doit rester active dans un terminal; `Ctrl+C` l’arrête. Elle nécessite Node.js 22
ou 24 et `zip`; la vérification des archives nécessite aussi `unzip`.

La surveillance regroupe les sauvegardes rapprochées et attend la fin d’une
génération avant de traiter les changements suivants. Elle détecte les
remplacements de fichiers, y compris une sauvegarde atomique ou un changement
provenant de Git. Les sorties, documents, tests et métadonnées Git ne déclenchent
pas de génération. Un JSON momentanément invalide ou des versions incohérentes
font échouer la génération avec un message; la surveillance attend une correction.

La liste des ressources surveillées et le code du surveillant sont chargés au
lancement : redémarrer `npm run dev` après modification de `scripts/watch.js` ou
de la liste `RUNTIME_FILES` dans `scripts/build.js`. Les modifications des autres
scripts sont prises en compte par le processus de génération suivant.
Pour une sortie isolée, `node scripts/package.js /chemin/dossier` utilise cet
argument comme racine contenant `chrome/`, `firefox/` et `packages/`.

La surveillance reste locale et n’installe aucun service permanent ni hook Git;
les hooks décrits ci-dessous nécessitent leur commande d’installation explicite. Le navigateur ne recharge pas automatiquement
l’extension ni les pages déjà ouvertes. Après une erreur, les sorties existantes
peuvent provenir d’une génération antérieure; attendre le message de réussite.

## Génération après commit et avant push

Activer une fois dans chaque clone, avec Node.js 22 ou 24 :

```sh
npm run hooks:install
```

L’installation locale configure `core.hooksPath` sur `.githooks`. Elle refuse de
remplacer une autre configuration effective ou globale, ou des hooks exécutables
existants dans le dossier Git par défaut (les exemples `.sample` sont ignorés).
La commande est réexécutable. Elle mémorise le chemin absolu de Node dans un fichier
texte local Git; si Node provient d’un dossier temporaire, son seul exécutable est
copié sous `tools/local-runtime/node`, ignoré par Git, puis vérifié. Aucun téléchargement,
service ou changement de configuration globale n’est effectué. Node n’a donc pas
besoin d’être dans le PATH du client Git après installation.

Après chaque commit et avant chaque push, les hooks exécutent directement
`scripts/package.js` avec ce Node : dossiers chargeables et ZIP sont actualisés,
avec la rétention de trois versions décrite ci-dessus. Aucun terminal de
surveillance ne doit rester ouvert. Si la génération échoue après un commit,
le message précise que le commit existe déjà; avant un push, l’échec bloque
le push. Corriger puis relancer `npm run package` ou réessayer le push.

Les sorties correspondent aux fichiers du répertoire de travail au moment du
hook. Un commit partiel, des modifications non commitées ou le push d’une autre
référence peuvent donc produire des fichiers différents du commit envoyé.
Les hooks ne lancent pas les tests; seule la CI valide la version qu’elle reçoit.
Ils ne publient rien et ne rechargent pas le navigateur : recharger l’extension
et les pages reste manuel. `npm run dev` reste disponible pendant le développement.

Pour désactiver ces hooks, vérifier que `git config --local --get core.hooksPath`
affiche bien `.githooks`, puis exécuter `git config --local --unset core.hooksPath`.
Ne pas supprimer une configuration appartenant à un autre outil.
