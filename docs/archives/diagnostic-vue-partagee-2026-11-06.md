# Diagnostic de la vue partagée — 6 novembre 2026

**Statut : historique.** La fonctionnalité a ensuite été retirée de toute
l’extension à la demande de l’utilisateur, le 6 novembre 2026. Le code et les
tests spécifiques décrits ci-dessous ne sont plus présents. Les observations
et les limites de validation sont conservées pour leur provenance.

## Bouton de vue partagée — 6 novembre 2026

Signalement : le bouton ouvre seulement un onglet. Le worker contrôlait la
présence de `tabs.createSplit` sans l’invoquer et acceptait comme réussite le
résultat de `tabs.create` avec `splitWithTabId`. Le test de régression constate
l’absence d’appel à `createSplit` avant correction.

Le worker appelle maintenant l’[API native documentée](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-createSplit),
prépare l’adjacence, l’état épinglé et le groupe du nouvel onglet, puis confirme
les `splitViewId` des deux onglets et leur fenêtre. La source reste active
pendant la préparation. Si l’association n’est pas confirmée, seul l’onglet
créé est supprimé. Si le nettoyage est refusé, le message le précise.

Tests Node.js : appel natif et identifiant de split nul valide (`0`), API
absente, onglet déjà partagé, appel refusé ou ignoré, association partielle,
identifiant absent, fermeture de la source, préparation d’onglets privés,
épinglés et groupés, API Chrome/Firefox simulées et échec de nettoyage.
Un échec de sélection de l’onglet après confirmation ne détruit pas la vue.
Le contrôle navigateur clique sur le bouton, simule un refus et vérifie
l’affichage du message, la conservation de l’aperçu et l’absence d’onglet de
secours.

Ces contrôles ne valident pas une vue native réellement affichée dans Vivaldi,
Chrome ou Firefox. Le navigateur intégré reste inaccessible; Playwright utilise
Chrome installé avec les API d’extension simulées. Le support dépend des API
réellement exposées; aucune compatibilité n’est déduite du nom du navigateur.

Résultats : 177 tests Node.js réussis sous Node.js 24.10.0, contrôle navigateur
complet réussi, builds et ZIP Chrome/Firefox `1.0.1` régénérés,
`git diff --check` réussi. Aucun commit, push, changement de version ni
publication. Le test réel du split natif dans Vivaldi reste nécessaire.

### Complément : faux succès réel dans Vivaldi

Le retour utilisateur confirme un onglet seul et la fermeture de l’aperçu.
Un diagnostic avec Vivaldi 8.3.4191.30 / Chromium 156.0.8078.91, une extension
réellement chargée, un profil temporaire et des pages HTTP locales reproduit
le faux succès. `createSplit` renvoie un identifiant positif et les deux onglets
exposent cet identifiant, mais chacun reste à 1 153 × 682 px dans une fenêtre
de 1 200 × 800 px. Les identifiants Chromium ne suffisent donc pas à confirmer
la juxtaposition dans cette version de Vivaldi.

Le worker sélectionne maintenant la vue et attend jusqu’à environ 900 ms pour
obtenir des dimensions positives compatibles avec deux volets, dont la taille
se réduit par rapport à la source. Il accepte une disposition horizontale ou
verticale. Ce contrôle est une condition de cohérence du rendu, pas une
inspection visuelle générale. Il ne dépend ni du nom ni de la version du
navigateur. Une absence de confirmation referme l’onglet créé et renvoie une
explication; aucune ouverture de secours ni paire de fenêtres.

Nouvel essai réel dans Vivaldi : l’appel est refusé avec le message prévu;
l’onglet créé est supprimé et il reste exactement l’onglet source, actif, avec
`splitViewId = -1`. La juxtaposition automatique Vivaldi via cette API n’est pas
validée et reste indisponible dans la version testée. La commande manuelle de
juxtaposition est décrite dans l’[aide Vivaldi](https://help.vivaldi.com/desktop/tabs/tab-tiling/).

Les contrôles réels ci-dessus appellent le worker chargé dans Vivaldi. Le
clic du bouton et la conservation de l’aperçu restent contrôlés dans Chrome
avec API simulée : les vues web de Vivaldi n’ont pas été exposées comme pages
pilotables lors de la tentative d’automatisation de l’interface. Le premier
essai Vivaldi sans interface était bloqué; le diagnostic a ensuite utilisé des
fenêtres natives dans des profils temporaires. Les navigateurs de diagnostic
ont été fermés sans utiliser ni modifier le profil personnel.

Validation du complément : 179 tests Node.js réussis, dont le cas réel de
dimensions inchangées, l’attente de mise en page et une disposition verticale.
Builds et ZIP Chrome/Firefox `1.0.1` actualisés par `npm run package` et
`git diff --check` réussi. Le contrôle Chrome de bouton avec API simulée reste
celui de la correction précédente; la validation nouvelle porte sur le worker
réel dans Vivaldi. Aucun commit, push, changement de version ni publication.

