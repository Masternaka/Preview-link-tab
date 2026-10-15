# Preview link tab

Extension Manifest V3 pour Chrome/Chromium et Firefox sur ordinateur, inspirée du Peek Preview d'Arc.

## Installation

### Chrome / Chromium

1. Ouvrir `chrome://extensions`.
2. Activer le **Mode développeur**.
3. Cliquer sur **Charger l'extension non empaquetée**.
4. Sélectionner ce dossier.
5. Sur une page web, **Alt + clic** sur un lien pour le prévisualiser (le raccourci est configurable).

### Firefox

La version Firefox utilise les mêmes scripts et styles, avec un manifeste adapté.
Firefox **140 ou ultérieur** est ciblé sur ordinateur.

1. Avec Node.js installé, lancer `npm run build:firefox` dans ce dossier.
2. Ouvrir `about:debugging#/runtime/this-firefox` dans Firefox.
3. Cliquer sur **Charger un module complémentaire temporaire**.
4. Sélectionner `dist/firefox/manifest.json`.
5. Sur une page web HTTP ou HTTPS, essayer **Alt + clic** sur un lien.

Le chargement temporaire dure jusqu'au redémarrage de Firefox. Après chaque
modification des sources, relancer la génération puis cliquer sur **Recharger**
dans `about:debugging`. Recharger aussi les pages web déjà ouvertes.
Une installation permanente nécessitera une version signée par Mozilla.

La version Firefox conserve les aperçus intégrés, les fenêtres compactes,
les paramètres, les thèmes et les règles par site. Le script d'arrière-plan utilise
`background.scripts` et les API à promesses de Firefox. Sans API d'affichage,
le placement et la taille des fenêtres compactes se basent sur la fenêtre du
navigateur, y compris sur un écran secondaire. Le mode plein écran compact
remplit cette fenêtre avec des marges ; il ne passe pas le navigateur en plein écran.
La vue partagée conserve le contrôle de disponibilité de l'API native et affiche
le message explicatif si celle-ci est absente.

Les permissions d'accès aux sites peuvent être ajustées dans `about:addons`.
Les pages internes du navigateur et certains sites protégés par Firefox ne
permettent pas l'exécution des scripts de l'extension.

### Générer les deux versions

```bash
npm run build
```

Cette commande copie les fichiers nécessaires dans `dist/chrome` et
`dist/firefox`. `manifest.json` reste la source du manifeste Chrome ;
`manifests/firefox.json` remplace les clés propres à Firefox. Les dossiers
générés ne sont pas versionnés. Les archives et la publication restent à préparer.

## Utilisation

- **Échap** ferme l'aperçu (si **Fermer avec Échap** est activé).
- L'épinglage empêche un clic extérieur de fermer l'aperçu ; Échap le ferme
  toujours lorsque **Fermer avec Échap** est activé.
- Le mode **Vue partagée (Split View)** ouvre le lien à côté de l'onglet courant.
  La barre d'outils de l'aperçu dispose aussi d'un bouton dédié. La compatibilité
  dépend de l'API réellement exposée par l'extension, pas du nom du navigateur :
  les dérivés de Chromium comme Brave ou Helium peuvent l'utiliser s'ils exposent
  l'API Split View. La présence d'un menu **Vue partagée** natif ne garantit pas
  pour autant le support de l'API. Les navigateurs non compatibles ou les onglets
  déjà en vue partagée affichent un message explicatif et conservent l'aperçu en
  cours. Aucun repli vers une fenêtre séparée n'est proposé. Si l'API est
  indisponible, ouvrir le lien dans un nouvel onglet puis utiliser le menu
  contextuel de l'onglet pour créer une vue partagée native, si disponible.
- Boutons de la barre d'outils : paramètres, précédent/suivant, actualiser,
  copier l'URL, épingler, fenêtre compacte, vue partagée, nouvel onglet, fermer.
- Faire glisser l’en-tête pour déplacer l’aperçu ; sa position est mémorisée.
  Les bords et les coins permettent de le redimensionner en restant dans la
  zone visible. Ces gestes passent la position en mode personnalisé ; choisir
  une position prédéfinie dans les réglages pour retrouver un placement automatique.
  Le mode plein écran conserve sa taille et sa position fixes.
- **Alt + Shift + P** prévisualise le dernier lien survolé.
- Clic droit sur un lien → **Preview with Preview link tab**.

Le raccourci global se modifie dans `chrome://extensions/shortcuts` sur Chromium,
ou dans `about:addons` → menu engrenage → **Gérer les raccourcis des extensions**
sur Firefox. Tant qu'un
aperçu est ouvert, les touches `R`, `O`, `C`, `P` et les flèches gauche/droite
respectivement actualisent, ouvrent dans un onglet, copient, épinglent et
parcourent l'historique de l'aperçu.
Ces raccourcis d'action sont ignorés dans les champs de saisie et les éditeurs
de texte enrichi. Pendant une composition de texte (IME), Échap est également
ignoré pour permettre d'annuler la composition sans fermer l'aperçu.
Lorsque la page intégrée a le focus, seul Échap est relayé vers l'aperçu.

Cliquer sur l’icône de l’extension ouvre une fenêtre de paramètres centrée sur
la fenêtre du navigateur. Sa taille cible est de 1040 × 760 pixels, adaptée à
l’espace disponible. Elle est redimensionnable et reste ouverte quand on revient
à une page web. Un nouveau clic depuis le même onglet ramène la fenêtre existante
au premier plan sans perdre les modifications en cours.

Les paramètres sont regroupés dans quatre rubriques : **Utilisation**, **Apparence**,
**Sites** et **Données**. Le bouton de sauvegarde reste toujours visible ; les
options détaillées se déplient au besoin. Les réglages disponibles comprennent :
mode d'ouverture (intégré, fenêtre compacte, vue partagée), taille, position,
thème, animation, cadre, ombre, déclencheur au clic, clic
molette, fermeture au clic extérieur ou avec Échap, arrière-plan (assombrissement
ou flou, intensité réglable) et fermeture après ouverture externe.

Les thèmes disponibles sont **Catppuccin, Nordic, Nord, Gruvbox, Tokyo Night,
Dracula et Everforest**, avec Catppuccin Mocha par défaut. Le choix
**Personnalisé** permet aussi de définir ses couleurs manuellement. Les variantes et les
sources des palettes sont détaillées dans [THEMES.md](THEMES.md).

## Règles par domaine

Dans les paramètres, ouvrir **Sites → Règles par site**, saisir un domaine ou une URL,
choisir le mode d’ouverture puis cliquer sur **Ajouter la règle**. Chaque entrée
propose **Modifier** et **Supprimer**. Cliquer sur **Sauvegarder** pour appliquer
la liste. Les domaines invalides et les doublons sont signalés. Une règle de
sous-domaine plus spécifique est prioritaire ; la carte du site courant indique
aussi la règle héritée d’un domaine parent. Les domaines acceptent des URL et
la forme `*.domaine`. Le format texte des exports existants reste compatible.

Le bouton **Annuler les modifications**, toujours accessible en bas de la fenêtre,
rétablit les derniers réglages sauvegardés et actualise la miniature. Il annule
aussi les changements non sauvegardés de la liste de règles. Les actions déjà
enregistrées (thèmes personnels, import, réinitialisation et règle rapide
« Mémoriser la règle ») restent conservées.

Une **liste noire** désactive l'aperçu sur les domaines listés, une **liste
blanche** ne l'autorise que sur ceux-ci. L'option **Ouverture compacte
automatique pour les sites bloqués** bascule vers une fenêtre compacte pour les
sites connus comme incompatibles, complétés par une liste de domaines.
La fenêtre donne accès à tous les réglages, avec export et import
au format JSON.

## Règles rapides et pause

Dans l’aperçu, ouvrir **Paramètres → Comportement → Toujours ouvrir ce site en…**
pour mémoriser un mode pour le domaine du lien affiché. Dans les paramètres, la commande
**Ouverture des liens vers ce site** vise le domaine de l’onglet courant. Choisir
**Réglage général / règle héritée** et mémoriser supprime la règle exacte ; une
règle de domaine parent peut encore s’appliquer. La vue partagée reste native et
nécessite l’API du navigateur.

**Mettre en pause sur ce site**, dans la rubrique **Sites** des paramètres, suspend les déclencheurs
sur les pages du même nom d’hôte. Les clics gardent leur comportement normal.
Le bouton devient **Réactiver sur ce site** et l’icône affiche le badge **II**.
La pause ne ferme pas les aperçus déjà ouverts. Elle s’applique aux onglets du
même hôte, séparément en navigation privée, et se termine à la réactivation,
au redémarrage du navigateur ou au rechargement de l’extension.

## Apparence et thèmes personnels

Dans **Apparence**, les réglages défilent à gauche et la miniature reste visible
à droite, avec le bouton Sauvegarder toujours accessible en bas. La miniature
reste au-dessus des réglages si la fenêtre est étroite, sans défiler avec eux. Elle
montre immédiatement les couleurs, dimensions, position, cadre, ombre et
arrière-plan. Changer l’animation ou sa vitesse rejoue
automatiquement la miniature. **Rejouer l’animation** permet aussi d’essayer
la transition choisie ; aucune page externe n’est chargée par cet exemple.
Les glissements déplacent le panneau horizontalement ou verticalement, le zoom
agrandit le panneau, le rebond dépasse brièvement sa taille finale, le fondu agit
sur l’opacité et le flou fait progressivement apparaître une image nette.
La préférence système de réduction des animations désactive ces effets.

Les cadres proposent **Arrondi, Carré, Verre dépoli, Contour accent, Arrondi
généreux, Sans bordure et Double contour**. Le verre et l’arrondi généreux ajoutent
une marge visible autour du contenu ; les contours suivent la couleur d’accent.

Les ombres proposent **Selon le thème, Aucune, Légère, Moyenne, Forte, Flottante,
Halo diffus, Décalage net et Lueur accent**. Le halo entoure le panneau, le
décalage net dessine une ombre sans flou et la lueur reprend la couleur d’accent.
Le choix d’ombre reste prioritaire lors d’un changement de thème. La miniature
et l’aperçu partagent les mêmes styles de cadre et d’ombre.

**Copier vers Personnalisé** reprend les couleurs du thème sélectionné. Modifier
les champs, saisir un nom puis cliquer **Enregistrer ce thème** ajoute une entrée
à **Mes thèmes**, disponible dans tous les sélecteurs. Un nom déjà présent
remplace sa palette. La bibliothèque accepte jusqu’à 50 thèmes. **Supprimer ce
thème** retire l’entrée tout en gardant ses couleurs dans Personnalisé.
L’enregistrement d’un thème sauvegarde sa palette immédiatement ; les autres
réglages modifiés restent à sauvegarder avec le bouton principal.

Les exports JSON incluent la bibliothèque. L’import accepte uniquement un objet
contenant des réglages reconnus, ignore les clés inconnues et limite le fichier
à 1 Mo. Un fichier invalide ou illisible ne remplace pas les préférences.

## Icônes

Chaque icône de l'extension conserve son propre visuel. Les originaux sont
préservés dans [`icons/sources`](icons/sources) ; la génération recadre chaque
image au centre en carré puis la redimensionne en 16, 32, 48 ou 128 pixels sans
modifier son fond. La popup utilise `icons/icon48.png`. Régénérer les tailles sur
macOS avec :

```bash
./scripts/generate-icons.sh
```

Il est aussi possible de lancer `python3 scripts/generate-icons.py` avec Pillow
installé. Remplacer les fichiers correspondants dans `icons/sources` lors d'une
mise à jour du visuel.

## Limites

Certains sites bloquent l'intégration dans un aperçu (`X-Frame-Options` / CSP).
Utiliser alors la fenêtre compacte ou un nouvel onglet.
L'aperçu attend la confirmation du script de l'extension présent dans la page
intégrée. Sans confirmation sous 12 secondes, il propose ces alternatives ; cela
peut aussi arriver avec une page lente ou lorsque le script ne peut pas s'exécuter.

## Tests

Avec une installation actuelle de Node.js, lancer :

```bash
npm test
```

Le workflow [Tests](.github/workflows/tests.yml) lance cette commande sur Node.js
22 et 24 à chaque push et pull request. Aucune dépendance npm n’est nécessaire pour la suite ; les tests des archives
utilisent aussi les commandes système `zip` et `unzip`.

Les tests couvrent aussi la génération des deux versions et les API Firefox
simulées. Le paquet Firefox a été validé avec `web-ext lint` : aucune erreur,
trois avertissements (deux insertions de HTML construit par le code et une
compatibilité minimale Android ; seule la version ordinateur est ciblée).
Les essais visuels dans Firefox restent à faire : aperçu et Échap, paramètres,
fenêtre compacte, copie d'URL, pause par site et raccourci global.

Après avoir commité et poussé les changements sur GitHub, ouvrir l’onglet
**Actions → Tests** pour consulter le résultat. Une coche verte indique que les
tests ont réussi ; une croix rouge permet d’ouvrir les journaux du test en échec.
Le workflow peut aussi être lancé manuellement depuis **Run workflow**, une fois
présent sur la branche par défaut. Ces tests ne remplacent pas les essais visuels
de l’extension dans les navigateurs.

## Reprise de lecture et actions annulables

Dans un aperçu intégré, la position de défilement est mémorisée pour retrouver
sa lecture en rouvrant exactement la même URL. Les positions restent dans le
stockage de session de l’extension : au maximum 100 pages par contexte
(normal ou privé), pendant 24 heures au plus et jusqu’à la fermeture du
navigateur. Elles ne sont pas exportées avec les réglages. Si le stockage de
session n’est pas disponible, la mémoire temporaire du script d’arrière-plan
est utilisée. Aucun stockage du site n’est utilisé.

La reprise nécessite que le script de l’extension puisse s’exécuter dans la page.
Elle vise le défilement principal, pas les zones défilantes internes d’un site.
La restauration attend brièvement le contenu dynamique et s’arrête dès une
interaction pour laisser la main à l’utilisateur. Les changements d’URL des
applications web sont également suivis pendant l’aperçu.

Après une suppression de règle ou de thème personnel, **Annuler la suppression**
reste disponible pendant 10 secondes. Pour une règle, la restauration reste un
brouillon à sauvegarder ; pour un thème, elle est enregistrée immédiatement.
Une nouvelle règle ou un nouveau thème de même identité n’est jamais écrasé.

**Nouvel onglet** ferme immédiatement l’aperçu au clic, même s’il est épinglé,
avant de demander l’ouverture de l’onglet. La fermeture ne dépend ni d’une
animation ni d’une réponse du navigateur ; cela évite de laisser l’aperçu
ouvert dans l’onglet source lors d’un changement de focus, notamment sur Helium.
En cas d’échec d’ouverture signalé, un message invite à réouvrir le lien. L’ancien
réglage de fermeture après ouverture externe ne concerne désormais que le
passage en fenêtre compacte.

En l’absence de confirmation de chargement sous 12 secondes, l’aperçu propose
**Réessayer**, **Fenêtre compacte** et **Nouvel onglet**. Une confirmation tardive
rétablit automatiquement la page. Le message ne prétend pas distinguer un site
qui refuse l’intégration d’une page simplement lente.

### Vérifications dans Chromium

Un contrôle complémentaire avec de vraies pages locales et les scripts de
l’extension est disponible :

```bash
PLAYWRIGHT_MODULE=/chemin/vers/playwright node scripts/check-browser.cjs
```

Playwright est installé séparément avec `npm ci --prefix tools/ci`.
Sans `PLAYWRIGHT_MODULE`, le script utilise cette installation verrouillée.
`CHROMIUM_PATH` permet de choisir un exécutable existant ; sinon, le Chromium
installé par Playwright est utilisé. `QA_SCREENSHOT_DIR` permet d’enregistrer des captures hors du
dépôt. Aucun paquet supplémentaire n’est requis pour `npm test` ou la génération.

Ce contrôle vérifie la reprise de lecture dans une iframe d’une autre origine,
les redirections, les changements d’URL sans rechargement, les pages lentes,
les refus `X-Frame-Options`, le bouton Réessayer, la fermeture à l’ouverture d’un
onglet et l’annulation des suppressions. Les API d’extension sont simulées ; ce
contrôle complète les essais avec l’extension réellement chargée dans Chrome
et Firefox, sans les remplacer.


### Mise à jour 0.2.1

La version 0.2.1 retire l’aperçu dès le clic sur **Nouvel onglet**, avant toute
communication avec le script d’arrière-plan. Après une mise à jour locale,
vérifier **0.2.1** dans la page des extensions de Chrome, Helium ou Firefox,
recharger l’extension et actualiser les pages déjà ouvertes pour remplacer
leurs anciens scripts. Les fichiers générés doivent être reconstruits avec
`npm run build` avant de recharger une installation pointant sur `dist/`.

## GitHub Actions : tests, téléchargements et releases

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
