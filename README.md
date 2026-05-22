# Peek Preview

Extension Chrome Manifest V3 inspirée du Peek Preview d'Arc.

## Utilisation

1. Ouvre `chrome://extensions`.
2. Active `Mode développeur`.
3. Clique `Charger l'extension non empaquetée`.
4. Sélectionne ce dossier.
5. Sur une page web, fais `Alt` + clic sur un lien pour l'ouvrir en aperçu.

`Esc` ferme l'aperçu. Le bouton `↗` ouvre le lien dans un nouvel onglet. Le bouton `▣` ouvre le lien dans une fenetre compacte Chrome. Clique l'icone de l'extension dans Chrome pour ouvrir le menu des parametres.

## Options

Le menu de l'icone Chrome permet de modifier les options puis de les appliquer avec `Sauvegarder`. Le bouton `⚙` dans la fenêtre d'aperçu permet aussi de régler rapidement les options principales:

- le mode d'ouverture: aperçu intégré ou fenêtre compacte directement;
- la grandeur de la fenêtre: petite, moyenne, grande ou plein écran;
- les grandeurs prédéfinies utilisent un ratio 16:9;
- la grandeur personnalisée avec largeur et hauteur en pixels;
- la position: droite, gauche, centre ou bas de l'écran;
- le centrage par rapport à la fenêtre du navigateur;
- la position personnalisée avec X et Y en pixels;
- le raccourci d'ouverture: `Alt`/`Option`, `Command`/`Ctrl` ou `Shift` + clic;
- le thème: système, clair, sombre, graphite, menthe, Catppuccin, Gruvbox ou Dracula;
- l'affichage des codes couleur du thème prédéfini choisi dans la section du thème personnalisé;
- le thème personnalisé avec couleurs hex pour accent, fond, entête, page, texte, bordure et arrière-plan;
- l'animation d'ouverture: glissement, zoom, fondu ou aucune;
- la vitesse d'animation: rapide, normale ou lente;
- le style du cadre: doux, net, flottant ou minimal;
- la fermeture au clic extérieur;
- la fermeture avec `Esc`;
- l'assombrissement de la page arrière;
- la fermeture automatique de l'aperçu après ouverture dans un nouvel onglet.

Les options sont sauvegardées localement par Chrome.

## Limites

Chrome ne permet pas de contourner les protections `X-Frame-Options` et `Content-Security-Policy` des sites. Certains liens refuseront donc l'affichage intégré; dans ce cas, utilise le bouton `Fenetre compacte` ou `Nouvel onglet`.

Les positions des fenêtres compactes sont calculées par rapport à l'écran, sauf `Centre du navigateur`, qui est centré sur la fenêtre Chrome active. L'aperçu intégré reste contraint à l'espace de l'onglet Chrome.
