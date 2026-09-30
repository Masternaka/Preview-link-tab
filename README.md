# Preview link tab

Extension Chrome Manifest V3 inspirée du Peek Preview d'Arc.

## Installation

1. Ouvrir `chrome://extensions`.
2. Activer le **Mode développeur**.
3. Cliquer sur **Charger l'extension non empaquetée**.
4. Sélectionner ce dossier.
5. Sur une page web, **Alt + clic** sur un lien pour le prévisualiser (le raccourci est configurable).

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

Le raccourci global se modifie dans `chrome://extensions/shortcuts`. Tant qu'un
aperçu est ouvert, les touches `R`, `O`, `C`, `P` et les flèches gauche/droite
respectivement actualisent, ouvrent dans un onglet, copient, épinglent et
parcourent l'historique de l'aperçu.
Ces raccourcis d'action sont ignorés dans les champs de saisie et les éditeurs
de texte enrichi. Pendant une composition de texte (IME), Échap est également
ignoré pour permettre d'annuler la composition sans fermer l'aperçu.
Lorsque la page intégrée a le focus, seul Échap est relayé vers l'aperçu.

Chaque réglage d'ouverture est disponible dans **Comportement** et **Apparence** :
mode d'ouverture (intégré, fenêtre compacte, vue partagée), taille, position,
thème, animation, cadre, ombre, déclencheur au clic, clic
molette, fermeture au clic extérieur ou avec Échap, arrière-plan (assombrissement
ou flou, intensité réglable) et fermeture après ouverture externe.

Les thèmes disponibles sont **Catppuccin, Nordic, Nord, Gruvbox, Tokyo Night,
Dracula et Everforest**, avec Catppuccin Mocha par défaut. Le choix
**Personnalisé** permet aussi de définir ses couleurs manuellement. Les variantes et les
sources des palettes sont détaillées dans [THEMES.md](THEMES.md).

## Règles par domaine

Dans **Comportement**, ajouter une règle par ligne sous la forme
`domaine = overlay`, `domaine = compact` ou `domaine = blocked`. Une règle de
sous-domaine plus spécifique est prioritaire. Les listes de domaines acceptent
aussi des URL et la forme `*.domaine`.

Une **liste noire** désactive l'aperçu sur les domaines listés, une **liste
blanche** ne l'autorise que sur ceux-ci. L'option **Ouverture compacte
automatique pour les sites bloqués** bascule vers une fenêtre compacte pour les
sites connus comme incompatibles, complétés par une liste de domaines.
Cliquer sur l'icône de l'extension ouvre tous les réglages, avec export et import
au format JSON.

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
