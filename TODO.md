# Preview link tab — Travail restant

Objectif : une extension rapide, stable et discrète pour consulter un lien sans perdre sa page de départ.

**Priorités :** P1 = prochain chantier, P2 = ensuite, P3 = plus tard.
Les tâches terminées ont été retirées. Le fonctionnement courant des améliorations récentes a été confirmé par l’utilisateur le 1er octobre 2026. Les vérifications ci-dessous concernent des cas complémentaires ; elles ne signalent pas des bugs confirmés.

## Prochaines étapes conseillées

1. Ajouter les profils de réglages et la possibilité d’annuler les modifications.
2. Simplifier la gestion des règles par site.
3. Valider la version Firefox dans le navigateur, puis préparer les archives de distribution.

## Fonctionnalités à ajouter

- [ ] **P1 — Profils de réglages.** Enregistrer, nommer, modifier et supprimer des configurations complètes : thème, taille, position, animations, cadres, ombres et comportements. Permettre de passer d’un profil à l’autre en un clic et de les inclure dans l’export/import. Exemples : Lecture, Travail, Minimaliste.
- [ ] **P1 — Annuler les modifications.** Ajouter un bouton pour revenir aux derniers réglages sauvegardés et remettre la miniature à jour. Définir aussi le comportement des modifications non sauvegardées quand on change de profil.
- [ ] **P2 — Réinitialiser une rubrique.** Rétablir uniquement les réglages d’Utilisation, d’Apparence ou de Sites, sans effacer les autres préférences ni la bibliothèque de thèmes personnels.
- [ ] **P2 — Règles par site avec une interface visuelle.** Remplacer la saisie textuelle par une liste avec domaine, mode d’ouverture et boutons Ajouter/Modifier/Supprimer. Signaler les domaines invalides et afficher la règle réellement appliquée au site courant, y compris les règles héritées d’un domaine parent.
- [ ] **P2 — Raccourcis des actions personnalisables.** Permettre de modifier ou désactiver les touches pour actualiser, épingler, copier l’URL et ouvrir dans un onglet, en signalant les conflits. Étudier le relais des actions dans l’iframe en préservant la saisie et les raccourcis du site intégré. Le raccourci global est déjà configurable dans le navigateur.
- [ ] **P2 — Validation Firefox.** La base commune, le manifeste Firefox, les API d'arrière-plan et la génération des deux versions sont en place (`npm run build`). Les tests avec API simulées couvrent Firefox. Confirmer dans Firefox les aperçus, les fenêtres, le stockage, la pause par site, le presse-papiers et les raccourcis, puis tester les fonctions natives selon les API disponibles.

## Comportements à clarifier ou corriger

Ces points ont été reproduits le 1er octobre 2026 en exécutant le code avec des API simulées. Les corrections restent à faire ; cette vérification n’a pas utilisé de navigateur réel.

- [ ] **P2 — Réglages de secours.** Vérification confirmée : si l’API de stockage est absente ou lève une exception, le script lit et écrit les réglages dans le `localStorage` du site. Une erreur de lecture signalée par callback lit aussi ce stockage ; une erreur d’écriture signalée par callback est seulement journalisée. Avec le stockage de l’extension disponible, le stockage du site n’est pas utilisé. Remplacer ce secours par un état temporaire en mémoire et une invitation à recharger la page ; garder les préférences persistantes dans l’extension.
- [ ] **P2 — Liste d’autorisation vide.** Vérification confirmée : une liste vide, ou composée seulement d’espaces et de virgules, autorise tous les domaines en mode liste d’autorisation. Les règles de domaine explicites restent prioritaires, notamment les règles de blocage. Une liste renseignée filtre correctement les domaines et leurs sous-domaines. Choix recommandé : une liste d’autorisation vide n’autorise aucun domaine via cette liste. Clarifier l’interface et couvrir ce comportement par un test de non-régression.

## Améliorations techniques et de l’interface

- [ ] **P2 — Tests avec un vrai navigateur.** Ajouter des pages locales et des tests d’intégration pour l’ouverture, la fermeture, le focus, les redirections et les refus d’intégration. Compléter les tests actuels utilisant des API simulées.
- [ ] **P2 — Interface cohérente.** Harmoniser le panneau de réglages intégré à l’aperçu et le menu compact avec la fenêtre principale de paramètres.
- [ ] **P2 — Code plus facile à maintenir.** Séparer progressivement la navigation, le placement, les réglages et les événements de `content.js`, en conservant les tests existants.
- [ ] **P2 — Isolation visuelle.** Évaluer un Shadow DOM pour limiter les conflits avec les styles des sites. Valider le focus, les boutons et les thèmes sur un prototype.
- [ ] **P3 — Performance.** Mesurer le coût au repos et lors d’ouvertures répétées ; vérifier le nettoyage des minuteries et observateurs avant d’optimiser.
- [ ] **P3 — Langues.** Centraliser les textes et proposer une interface française et anglaise cohérente.

## Vérifications complémentaires

- [ ] **P1 — Chargement et navigation.** Tester une page lente, une redirection, un site refusant l’intégration et une confirmation de chargement tardive. Vérifier précédent/suivant, les liens internes et les changements d’URL sans rechargement ; Copier et Ouvrir dans un onglet doivent viser la page réellement affichée.
- [ ] **P1 — Vue partagée native.** Tester les navigateurs ciblés, les onglets déjà en vue partagée, épinglés ou groupés, ainsi que les fenêtres privées et compactes. Vérifier qu’un échec ne crée pas d’onglet supplémentaire et que l’aide s’affiche lorsque l’API est indisponible.
- [ ] **P1 — Fenêtres et contexte de site.** Tester les ouvertures/fermetures rapides des fenêtres compactes et le redémarrage du service worker. Vérifier aussi les paramètres depuis un onglet fermé ou une fenêtre privée, et leur placement sur plusieurs écrans.
- [ ] **P2 — Clavier et accessibilité.** Parcourir les interfaces avec Tab et Maj + Tab, entrer/sortir de l’iframe et vérifier le retour du focus à la fermeture. Tester les champs éditables, la composition IME, les contrastes et la réduction des animations.
- [ ] **P2 — Petits écrans et zoom.** Vérifier les huit directions de redimensionnement, les fenêtres étroites et le zoom à 125 % et 150 %. Le panneau, la miniature des paramètres et les commandes doivent rester accessibles.
- [ ] **P2 — Réglages et cas d’erreur.** Vérifier import, export, réinitialisation, erreur de sauvegarde et fermeture/réouverture des paramètres. Confirmer la persistance des thèmes personnels, des règles et des intensités de flou et d’assombrissement.
- [ ] **P2 — Icônes.** Vérifier la lisibilité à 16/32 px en thème clair et sombre. Le damier des images sources fait partie du dessin ; décider si un vrai fond transparent est souhaité.

Pour chaque anomalie, noter : navigateur/version, URL si partageable, réglages utiles, étapes, résultat attendu et résultat observé.

## Préparer les versions à distribuer

- [ ] **P2 — Archives et versions GitHub automatisées.** Générer une archive contenant les fichiers utiles à l’exécution pour chaque navigateur, puis préparer une release GitHub avec ces archives et la liste des changements.
- [ ] **P2 — Version et notes de publication.** Mettre à jour ensemble la version du manifeste et celle de `package.json`, puis rédiger les changements de chaque version.
- [ ] **P2 — Licence et stockage.** Ajouter une licence et une description claire du stockage des préférences et des connexions réalisées lors d’un aperçu.
- [ ] **P2 — Préparation finale.** Terminer les vérifications prioritaires, documenter les limites restantes dans le README et vérifier que les permissions du manifeste correspondent aux fonctions conservées.

**Décisions produit à conserver :** utiliser uniquement la vue partagée native selon l’API disponible ; ne pas ajouter de remplacement par deux fenêtres ou par des panneaux intégrés. Ne pas réintroduire l’ouverture automatique au survol.
