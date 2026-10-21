# Guide d’utilisation

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
sources des palettes sont détaillées dans [Thèmes](themes.md).

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

## Limites

Certains sites bloquent l'intégration dans un aperçu (`X-Frame-Options` / CSP).
Utiliser alors la fenêtre compacte ou un nouvel onglet.
L'aperçu attend la confirmation du script de l'extension présent dans la page
intégrée. Sans confirmation sous 12 secondes, il propose ces alternatives ; cela
peut aussi arriver avec une page lente ou lorsque le script ne peut pas s'exécuter.

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
