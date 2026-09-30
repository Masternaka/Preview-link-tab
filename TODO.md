# Preview link tab — Feuille de route

Objectif : une extension rapide, stable et discrète pour consulter un lien sans perdre sa page de départ.

**Priorités :** P1 = prochain chantier, P2 = ensuite, P3 = plus tard.
Les éléments « À vérifier » sont des scénarios à tester, pas des bugs confirmés.
Les cases cochées dans « Déjà implémenté » indiquent du code présent, pas une validation complète dans les navigateurs.

## Prochaines étapes conseillées

1. **Valider l’ouverture et la fermeture dans les navigateurs utilisés au quotidien.** Confirmer que le scintillement a disparu avant d’ajouter d’autres animations ou modes.
2. **Fiabiliser la navigation.** Corriger l’historique avec URL répétées. La protection de la saisie et les limites de déplacement/redimensionnement sont implémentées ; leurs essais dans les navigateurs restent à faire.
3. **Simplifier les règles par site.** Ajouter une action « Toujours ouvrir ce site en… » pour éviter de modifier une liste à la main.
4. **Préparer une version stable à partager.** Documenter les limites réelles, automatiser les tests et préparer un paquet propre.

## À vérifier

- [ ] **P1 — Ouverture sans scintillement.** Tester plusieurs ouvertures/fermetures rapides, le changement de lien, les différentes positions et les thèmes clair/sombre. Le panneau et ses boutons doivent apparaître directement au bon endroit.
- [ ] **P1 — Chargement des pages.** Tester une page compatible, une page lente, une redirection et un site refusant l’intégration. Après 12 secondes sans confirmation, les alternatives doivent être accessibles ; une confirmation tardive doit afficher la page.
- [ ] **P1 — Domaines exclus.** Vérifier qu’Alt + clic et le clic du milieu gardent leur comportement natif quand le domaine est exclu, y compris avec des sous-domaines.
- [ ] **P1 — Épinglage.** Un aperçu épinglé résiste au clic extérieur ; Échap le ferme seulement si « Fermer avec Échap » est activé. Le bouton Fermer doit toujours fonctionner.
- [ ] **P1 — Vue partagée native.** Tester Chrome, Brave et Helium en notant leurs versions exactes. Si l’API est disponible, le lien doit s’ouvrir à côté de l’onglet source ; sinon, afficher l’aide manuelle sans ouvrir deux fenêtres séparées.
- [ ] **P1 — Cas particuliers du Split View.** Tester un onglet déjà en vue partagée, épinglé, dans un groupe, dans une fenêtre privée et dans une fenêtre compacte. Aucun onglet supplémentaire ne doit apparaître après un échec.
- [ ] **P1 — Fenêtres compactes.** Ouvrir et fermer plusieurs fenêtres rapidement, puis vérifier leur reconnaissance après redémarrage du service worker.
- [ ] **P1 — Réglages.** Modifier le flou et l’assombrissement, changer de mode, enregistrer puis rouvrir la popup. Tester aussi import, export, réinitialisation et erreur de sauvegarde.
- [ ] **P2 — Redimensionnement.** Tester chaque bord et coin, un petit écran, le zoom à 125 % et 150 %, et plusieurs écrans. Le panneau et ses commandes doivent rester accessibles.
- [ ] **P2 — Navigation dans l’aperçu.** Tester les boutons précédent/suivant, les redirections, les liens internes et les sites qui changent d’URL sans recharger la page. Copier l’URL et ouvrir dans un onglet doivent viser la page réellement affichée.
- [ ] **P2 — Accessibilité.** Parcourir toute l’interface avec Tab et Maj + Tab, entrer/sortir de l’iframe et vérifier le retour du focus à la fermeture. Tester les contrastes et la réduction des animations.
- [ ] **P2 — Icônes.** Vérifier la lisibilité à 16/32 px et en thème sombre. Le damier des images sources fait actuellement partie du dessin ; décider si un vrai fond transparent est souhaité.

Pour chaque anomalie, noter : navigateur/version, URL si partageable, mode d’ouverture, réglages utiles, étapes, résultat attendu et résultat observé.

## À corriger

Ces points sont issus de la lecture du code ; ajouter un scénario reproductible et un test ciblé avant chaque correction.

- [x] **P1 — Raccourcis et zones éditables.** Protéger les champs, les zones `contenteditable` (y compris leurs enfants), les champs dans un Shadow DOM ouvert et la composition IME. Trois tests de non-régression ajoutés ; validation dans les navigateurs à poursuivre.
- [ ] **P2 — Raccourcis dans l’iframe.** Seul Échap est actuellement relayé, comme indiqué dans le README ; la composition IME est protégée. Décider s’il est utile de relayer d’autres actions, en préservant les raccourcis et la saisie du site intégré.
- [ ] **P2 — Historique avec URL répétées.** Revoir `recordPreviewNavigation` : retrouver une ancienne URL ne signifie pas forcément que l’utilisateur est revenu en arrière. Vérifier le parcours A → B → A → précédent, qui doit revenir à B.
- [x] **P2 — Débordement pendant le redimensionnement.** Les limites tiennent compte de la position du panneau et conservent le bord opposé. Tests des huit directions, petits viewports et sauvegarde de la position ; validation visuelle à poursuivre.
- [ ] **P2 — Réglages de secours.** Revoir le stockage dans le `localStorage` du site quand le contexte de l’extension est indisponible. Préférer un état temporaire en mémoire et une invitation à recharger la page pour garder les préférences dans l’extension.
- [ ] **P2 — Import plus strict.** Refuser les valeurs JSON qui ne sont pas un objet de réglages, ignorer les clés inconnues et signaler les erreurs de lecture du fichier.
- [ ] **P2 — Liste d’autorisation vide.** Décider explicitement du résultat attendu : actuellement, une liste vide autorise tous les domaines, même en mode liste d’autorisation. Clarifier l’interface et couvrir le choix par un test.

## Améliorations

- [ ] **P1 — Tests automatiques à chaque modification.** Ajouter une action GitHub qui exécute la suite Node.js sur les commits et les pull requests.
- [ ] **P2 — Tests avec un vrai navigateur.** Ajouter des pages de test locales pour l’ouverture, le focus, les redirections et les refus d’intégration. Les tests simulés actuels ne valident pas le rendu ni les API réelles des navigateurs.
- [ ] **P2 — Interface cohérente.** Harmoniser les réglages de la popup, du panneau intégré et du menu compact, ainsi que leurs messages de sauvegarde.
- [ ] **P2 — Réglages simples et avancés.** Mettre le mode d’ouverture, le déclencheur, la taille et la fermeture en premier ; regrouper couleurs, animations et règles détaillées dans une section avancée.
- [ ] **P2 — Code plus facile à maintenir.** Séparer progressivement la navigation, le placement, les réglages et les événements de `content.js`, en conservant des tests sur les comportements existants.
- [ ] **P2 — Isolation visuelle.** Évaluer un Shadow DOM pour limiter les conflits avec les styles des sites. Valider d’abord le focus, les boutons et les thèmes sur un prototype.
- [ ] **P2 — Règles de domaine compréhensibles.** Signaler les lignes invalides et montrer quelle règle sera appliquée à un domaine donné.
- [ ] **P3 — Performance.** Mesurer le coût au repos et lors d’ouvertures répétées ; vérifier le nettoyage des minuteries et observateurs avant d’optimiser.
- [ ] **P3 — Langues.** Centraliser les textes et proposer une interface française et anglaise cohérente.

## Fonctionnalités à ajouter

- [ ] **P2 — « Toujours ouvrir ce site en… ».** Depuis l’aperçu, choisir intégré, compact, vue partagée ou désactivé. Étendre les règles de domaine au mode Split View et permettre d’annuler facilement ce choix.
- [x] **P2 — Déplacer le panneau à la souris.** Glissement par l’en-tête, position bornée et mémorisée, barre d’actions repositionnée pendant le geste. Gestion du relâchement, de la perte de capture et de focus ; désactivé en plein écran. Validation visuelle à poursuivre.
- [ ] **P2 — Prévisualisation des réglages.** Afficher un exemple local du panneau dans les paramètres pour voir immédiatement les changements de thème, taille et animation sans charger un site externe.
- [ ] **P3 — Pause rapide.** Désactiver temporairement les déclencheurs sur le site courant et proposer une réactivation visible.
- [ ] **P3 — Profils de réglages.** Enregistrer quelques configurations personnelles et passer facilement de l’une à l’autre.
- [ ] **P3 — Raccourcis des actions personnalisables.** Permettre de modifier ou désactiver les raccourcis internes en signalant les conflits. Le raccourci global est déjà configurable dans le navigateur.

## Avant de partager une version stable

- [ ] Terminer les validations P1 et documenter les limites restantes dans le README.
- [ ] Vérifier que les permissions du manifeste sont nécessaires aux fonctionnalités conservées.
- [ ] Ajouter une licence et une description claire du stockage des préférences et des connexions réalisées lors d’un aperçu.
- [ ] Préparer un paquet d’extension contenant uniquement les fichiers utiles à l’exécution, sans tests ni images sources haute résolution.
- [ ] Mettre à jour ensemble la version du manifeste et celle de `package.json`, puis rédiger les changements de la version.

## Déjà implémenté — validation terrain à poursuivre

- [x] Proposer Catppuccin, Nordic, Nord, Gruvbox, Tokyo Night, Dracula et Everforest, ainsi que le thème Personnalisé avec réglage manuel des couleurs. Centraliser les palettes, documenter leurs sources et migrer les anciens thèmes génériques vers Catppuccin.
- [x] Retirer l’ouverture automatique au survol et son réglage ; ignorer l’ancienne option lors de l’import. Conserver le raccourci explicite Alt + Shift + P.
- [x] Redessiner l’icône d’épinglage en punaise, pleine et colorée lorsqu’elle est active, et actualiser son libellé accessible.
- [x] Préserver les clics natifs sur les domaines exclus.
- [x] Attendre une confirmation de l’iframe et proposer une alternative si elle n’arrive pas.
- [x] Conserver séparément les valeurs de flou et d’assombrissement et signaler les erreurs de sauvegarde.
- [x] Sérialiser le suivi des fenêtres compactes pour éviter les écrasements concurrents.
- [x] Préparer le placement du panneau avant affichage pour réduire le scintillement.
- [x] Ajouter le mode et le bouton de vue partagée native avec un message d’aide si l’API manque.
- [x] Intégrer les nouvelles icônes aux bonnes dimensions et conserver leurs sources.
- [x] Disposer de 41 tests automatisés réussis lors de la dernière exécution ; compléter par les vérifications dans les navigateurs ci-dessus.

**Conseil de suivi :** traiter un chantier à la fois, noter le résultat de ses vérifications et choisir ensuite la prochaine priorité. Garder les fonctionnalités P3 comme idées, sans les considérer comme des engagements.

**Décisions produit :** conserver uniquement la vue partagée native du navigateur, selon l’API disponible ; ne pas ajouter de remplacement par deux fenêtres ou par des panneaux intégrés. Ne pas réintroduire l’ouverture automatique au survol.
