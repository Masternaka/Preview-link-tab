# Plan de correction — Preview link tab

> Archive du 21 octobre 2026 : les quatre lots et les corrections de revue sont implémentés localement. Ce plan décrit la préparation initiale et conserve ses cases d’origine; il ne constitue plus la liste des travaux actifs. Les essais avec les extensions réellement chargées restent dans [Vérifications](../verifications.md). Consulter [l’état actuel](../etat-projet.md) et [la revue archivée](revue-locale-2026-10-21.md).

Date : 21 octobre 2026  
Référence de départ : `61dd7b3` — version `0.2.2`  
Statut : plan initial de correction; son texte ne prouve pas la réalisation des lots.

## 1. Objectif et ordre de travail

Corriger les quatre problèmes relevés pendant la revue générale, en conservant les modes d’aperçu intégré, de fenêtre compacte et de vue partagée native.

| Ordre | Priorité | Problème | Fichiers principaux |
| --- | --- | --- | --- |
| 1 | P1 | Une fenêtre compacte perd le contexte privé de l’onglet source | `background.js`, `tests/javascript/background.test.js` |
| 2 | P2 | Les paramètres ne chargent pas depuis une fenêtre privée Chrome | `background.js`, `popup.js`, `tests/javascript/background.test.js` |
| 3 | P2 | L’aperçu déborde après réduction de la fenêtre | `content.js`, `tests/javascript/interactions.test.js`, `tests/browser/check-browser.cjs` |
| 4 | P2 | Une ancienne fenêtre de paramètres écrase des réglages récents | `popup.js`, `background.js`, `tests/javascript/interactions.test.js`, `tests/javascript/background.test.js` |

Traiter les lots 1 et 2 ensemble pour valider tout le parcours privé. Les lots 3 et 4 peuvent ensuite être réalisés séparément. Prévoir un commit par lot, avec un message en français, lorsque les vérifications du lot passent.

## 2. Préparation

- [ ] Relever la branche, le commit et les modifications locales avant intervention. Si le code a changé depuis `61dd7b3`, revérifier les quatre chemins concernés.
- [ ] Vérifier la disponibilité de Node.js et npm. Respecter les versions indiquées par le projet et sa CI, si elles sont précisées.
- [ ] Exécuter `npm test` pour établir un résultat de référence avant modification.
- [ ] Préparer des profils de test Chrome et Firefox, avec des adresses de test non sensibles.
- [ ] Autoriser explicitement l’extension en navigation privée dans ces profils.
- [ ] Reproduire chaque scénario décrit ci-dessous et consigner son résultat avant correction.

Pendant la revue, le dépôt était propre et `git diff --check` passait. La suite Node n’a pas pu démarrer : Node.js/npm étaient introuvables. Trois vérifications ciblées ont été réalisées avec JavaScriptCore et des API simulées; aucun parcours n’a été validé dans une extension réellement chargée.

## 3. Lot 1 — Conserver le contexte privé des fenêtres compactes

### Problème

`openCompactWindow()` crée une fenêtre avec l’URL et la géométrie demandées, mais sans renseigner `incognito`. Depuis un onglet privé Chrome, cela peut ouvrir le lien dans le contexte normal, avec un risque d’exposition à son historique ou à sa session.

### Modification prévue

1. Dans `background.js`, ajouter `incognito: Boolean(sender.tab?.incognito)` aux options de `extensionApi.windows.create()`.
2. Utiliser le contexte de l’onglet transmis par le navigateur. Ne pas accepter un indicateur privé provenant du contenu du message comme source d’autorité.
3. Vérifier tous les chemins qui aboutissent à `openCompactWindow()` : déclenchement direct et repli automatique après échec d’un aperçu intégré.
4. Conserver le comportement normal pour un onglet non privé et pour les appels sans onglet actuellement autorisés.
5. En cas de refus de création privée, conserver le traitement d’erreur existant ou le compléter. Aucun nouvel essai automatique ne doit ouvrir l’URL dans une fenêtre normale.
6. Vérifier que le suivi des identifiants de fenêtres et d’onglets compacts continue à fonctionner après création, fermeture et redémarrage du worker.

### Tests automatisés

Étendre le harnais de `tests/javascript/background.test.js` pour enregistrer les options de `windows.create()`.

- [ ] Expéditeur privé : l’appel reçoit `incognito: true` et l’URL attendue.
- [ ] Expéditeur normal : l’appel reçoit `incognito: false`.
- [ ] Appel autorisé sans onglet : le comportement normal reste défini.
- [ ] Rejet de création : aucun second appel ne tente une fenêtre normale.
- [ ] Les tests existants de suivi concurrent des fenêtres compactes passent toujours.

### Validation réelle et acceptation

- [ ] Depuis un onglet privé, ouvrir un lien en mode compact et vérifier que la nouvelle fenêtre est privée.
- [ ] Répéter via le repli automatique, si activé.
- [ ] Vérifier le même parcours depuis un onglet normal.
- [ ] Fermer les fenêtres privées et vérifier que l’URL de test n’a pas été ajoutée à l’historique normal par ces ouvertures.
- [ ] Effectuer les vérifications dans Chrome et Firefox.

Le lot est accepté lorsque toutes les ouvertures compactes testées conservent le contexte de leur onglet source, y compris en cas d’échec.

## 4. Lot 2 — Rendre les paramètres accessibles depuis un onglet privé

### Choix proposé

Conserver le fonctionnement partagé actuel de Chrome et ouvrir la page de paramètres dans une fenêtre normale, tout en gardant le lien avec l’onglet privé source. Cela évite d’introduire deux contextes de worker avec le mode `split`, qui demanderait une révision plus large des stockages et des messages.

La restriction ayant motivé le constat est décrite dans la [documentation Chrome sur la navigation privée](https://developer.chrome.com/docs/extensions/reference/manifest/incognito). Valider le comportement réel des deux navigateurs avant de décider si Firefox doit suivre exactement la même politique.

### Modification prévue

1. Dans `createOrFocusSettingsWindow()`, distinguer le contexte de la fenêtre de paramètres de celui de l’onglet source.
2. Pour Chrome en mode partagé, demander une fenêtre normale pour `popup.html`, même si l’onglet source est privé.
3. Adapter la recherche de fenêtre existante : comparer son contexte au contexte cible des paramètres, plutôt qu’à celui de l’onglet source.
4. Conserver `sourceTabId` dans l’URL pour que `initSiteControls()` retrouve le bon site.
5. Garder uniquement l’identifiant d’onglet dans l’URL des paramètres; ne pas y ajouter l’URL privée du site.
6. Vérifier `GET_SITE_PAUSE` et `SET_SITE_PAUSE` : le worker doit continuer à résoudre l’onglet source et sa partition privée. Une pause privée ne doit pas devenir une pause normale.
7. Si l’onglet source est fermé entre-temps, désactiver les commandes propres au site et afficher un message explicite, tout en laissant les réglages généraux disponibles.
8. Préserver la réutilisation d’une fenêtre existante et ses modifications non sauvegardées, y compris après redémarrage du worker.

Les préférences générales et règles de domaine conservent leur portée actuelle dans `storage.local`. L’isolation privée concerne ici la pause de session et les autres données déjà partitionnées; ce lot ne crée pas de préférences privées distinctes.

### Tests automatisés

- [ ] Source privée : la fenêtre de paramètres Chrome est créée avec le contexte normal attendu et le bon `sourceTabId`.
- [ ] Deux clics pour le même onglet réutilisent la fenêtre, sans rechargement du formulaire.
- [ ] La réutilisation fonctionne après redémarrage du worker.
- [ ] Deux onglets sources distincts conservent leurs propres contextes de site.
- [ ] La pause d’un site privé ne modifie pas sa pause normale, et inversement.
- [ ] Un onglet source disparu ne provoque ni erreur non traitée ni action sur un autre onglet.

### Validation réelle et acceptation

- [ ] Cliquer sur l’action depuis Chrome privé : les paramètres chargent et indiquent le bon site.
- [ ] Activer puis désactiver la pause; vérifier l’onglet privé et un onglet normal du même domaine.
- [ ] Modifier un champ, cliquer de nouveau sur l’action et vérifier que le brouillon est conservé.
- [ ] Fermer l’onglet source puis utiliser les paramètres : les réglages généraux restent accessibles.
- [ ] Tester Firefox avec l’autorisation privée activée, puis vérifier le comportement sans cette autorisation.

Le lot est accepté lorsque les paramètres sont accessibles depuis les deux contextes, sans perte du site source ni mélange des pauses.

## 5. Lot 3 — Recalculer les dimensions après redimensionnement

### Problème

Le rappel temporisé de `scheduleOverlayLayout()` impose `updateDimensions: false`. Il perd donc la demande de recalcul envoyée par l’événement `resize`, alors que les dimensions du panneau sont fixées en pixels.

### Modification prévue

1. Faire transmettre au rappel temporisé la valeur demandée de `updateDimensions`.
2. Conserver `updateDimensions: true` pour les changements de taille du viewport.
3. Conserver `updateDimensions: false` pour les notifications internes du `ResizeObserver`, afin de limiter les boucles de recalcul.
4. Traiter le cas où une notification de l’observateur arrive après le `resize` et remplace son minuteur : une demande de recalcul complet en attente doit rester prioritaire.
5. Réinitialiser les indicateurs et annuler les rappels nécessaires à la fermeture de l’aperçu.
6. Vérifier les interactions avec les gestes manuels : un recalcul ne doit pas interrompre un déplacement ou un redimensionnement en cours. Si le viewport change pendant un geste, effectuer le recalage nécessaire à sa fin.

### Tests automatisés

Étendre le harnais de `tests/javascript/interactions.test.js` pour déclencher les événements, les minuteurs et les trames de rendu.

- [ ] `resize` suivi du délai produit un recalcul des dimensions.
- [ ] Une notification interne seule conserve un simple repositionnement.
- [ ] `resize` puis notification interne avant expiration conserve le recalcul complet.
- [ ] Plusieurs événements rapides aboutissent à un état final cohérent et borné.
- [ ] Fermer l’aperçu avant le rappel ne provoque aucune erreur.

Ajouter dans `tests/browser/check-browser.cjs` une vérification géométrique du panneau après réduction et agrandissement du viewport. Vérifier ses bornes réelles avec une petite tolérance d’arrondi, ainsi que l’accès à la barre d’actions.

### Validation réelle et acceptation

- [ ] Ouvrir un grand aperçu dans une fenêtre de 1600 px de large, puis réduire à environ 900 px et à une largeur étroite exploitable.
- [ ] Répéter pour les positions centrée, en coin et personnalisée, ainsi que les tailles personnalisée et plein écran.
- [ ] Vérifier que le contenu reste consultable et que la fermeture et les actions restent accessibles.
- [ ] Agrandir de nouveau la fenêtre, puis déplacer et redimensionner manuellement le panneau.
- [ ] Vérifier l’absence d’oscillation du panneau et d’erreur liée au `ResizeObserver` dans Chrome et Firefox.

Le lot est accepté lorsque le panneau reste utilisable dans le viewport après les changements de taille, sans boucle de mise en page.

## 6. Lot 4 — Préserver les modifications entre plusieurs fenêtres de paramètres

### Problème

Chaque formulaire conserve un ancien état des préférences puis sauvegarde toutes ses clés. Une fenêtre ancienne peut ainsi écraser une règle ou un thème enregistré depuis une autre fenêtre. Ajouter seulement un écouteur `storage.onChanged` ne suffit pas : les brouillons locaux doivent être préservés et les écritures concurrentes traitées.

### Architecture proposée

Centraliser les mutations des préférences dans le worker partagé. Utiliser une file dédiée qui sérialise la lecture de l’état actuel, l’application d’une modification et son écriture. Une simple lecture suivie d’une écriture dans chaque popup laisserait subsister une course entre deux fenêtres.

### Modification prévue

1. Dans `popup.js`, séparer l’état de référence connu, le brouillon courant et les champs réellement modifiés.
2. Écouter `chrome.storage.onChanged` pour la zone `local`. Rafraîchir les champs non modifiés et conserver les brouillons locaux.
3. Envoyer au worker les seules préférences scalaires modifiées, plutôt que tout le formulaire.
4. Pour `domainRules`, envoyer des opérations par domaine : ajout, changement de mode ou suppression. Ne pas réécrire toute la collection depuis une copie ancienne.
5. Pour `savedThemes`, envoyer des opérations par identifiant stable : création, modification ou suppression. Préserver les autres thèmes.
6. Dans `background.js`, faire passer les mutations concernées par une file commune, avec validation et normalisation de leurs données. Ne pas réutiliser la file des fenêtres compactes.
7. Faire entrer le chemin existant `SET_DOMAIN_RULE` dans cette même file. Recenser tous les appels à `storage.local.set` concernés pour éviter un chemin qui contourne la protection.
8. Inclure l’état de référence attendu pour les éléments modifiés. Si le même champ, domaine ou thème a changé ailleurs, refuser son écrasement silencieux et signaler le conflit.
9. En cas de conflit, conserver le brouillon et proposer de charger la version enregistrée ou de réappliquer explicitement la modification locale après consultation du nouvel état.
10. Après succès, utiliser l’état confirmé pour rafraîchir la référence et ne retirer que les modifications effectivement enregistrées.
11. Après échec, conserver le brouillon et afficher un message d’échec; ne pas afficher « Sauvegardé ».
12. Traiter explicitement les actions transversales : import, réinitialisation, annulation des modifications, suppression et restauration d’une règle ou d’un thème. Une restauration ne doit pas écraser un élément recréé ailleurs.

Une file dans le worker protège les écritures qui passent par ce worker; elle ne constitue pas une transaction persistante. En cas d’interruption, relire le stockage avant un nouvel essai et ne pas confirmer une opération sans réponse de succès. Si le mode privé `split` est finalement retenu, revoir cette architecture : une file par worker ne sérialiserait pas leurs écritures communes.

### Tests automatisés

Dans `tests/javascript/background.test.js`, simuler des lectures et écritures différées pour exercer les vraies courses. Dans `tests/javascript/interactions.test.js`, simuler deux formulaires et les événements de stockage.

- [ ] B ajoute une règle; A modifie uniquement une option : les deux changements restent enregistrés.
- [ ] B ajoute un thème; A sauvegarde une autre option : le thème reste disponible.
- [ ] Deux opérations simultanées sur des domaines différents sont conservées.
- [ ] Deux créations de thèmes distincts sont conservées.
- [ ] Deux modifications du même élément produisent le comportement de conflit prévu.
- [ ] Un événement externe actualise les champs intacts sans effacer une saisie locale.
- [ ] Une erreur de stockage conserve le brouillon et ne bloque pas les opérations suivantes de la file.
- [ ] Import, réinitialisation, suppression et restauration respectent la politique de concurrence.
- [ ] Après redémarrage du worker, les opérations repartent de l’état réellement enregistré.

### Validation réelle et acceptation

Ouvrir A et B depuis deux onglets différents. Ajouter une règle et un thème dans B, puis enregistrer une autre option depuis A. Fermer et rouvrir les paramètres pour vérifier les trois changements. Répéter avec des sauvegardes rapprochées et avec un conflit sur le même élément, dans Chrome et Firefox.

Le lot est accepté lorsque les modifications indépendantes sont conservées, les conflits sont visibles et les brouillons survivent aux erreurs.

## 7. Vérifications finales

Exécuter les commandes suivantes dans un environnement Node.js disponible :

```sh
npm test
npm run build:chrome
npm run build:firefox
git diff --check
```

Si Playwright et son navigateur sont déjà disponibles dans l’environnement prévu par le projet :

```sh
npm run test:browser
```

Le script navigateur charge le contenu et les paramètres avec des API d’extension simulées. Il peut confirmer la géométrie et les interactions; il ne valide pas la création réelle des fenêtres privées ni le fonctionnement du worker installé.

Charger ensuite les versions produites dans `dist/chrome` et `dist/firefox` pour vérifier les permissions, le contexte privé, le routage des messages et les sauvegardes entre fenêtres. Confirmer les instructions de chargement dans `README.md` et `docs/installation.md` au moment de l’exécution.

## 8. Critères de clôture

- [ ] Les quatre scénarios initiaux échouent avant leur correctif et passent après.
- [ ] La suite automatisée complète et les deux builds réussissent.
- [ ] Les quatre parcours sont validés dans Chrome et Firefox, avec leurs versions consignées.
- [ ] Les modes intégré, compact et partagé natif restent utilisables lorsque le navigateur les prend en charge.
- [ ] Les exclusions de domaine, les raccourcis, les thèmes, l’import/export et les annulations restent fonctionnels.
- [ ] Le bilan distingue les tests automatisés, les validations réelles et les vérifications non exécutées.
- [ ] Le diff final contient uniquement les corrections, leurs tests et les ajustements documentaires nécessaires.

La création de ce plan n’autorise ni publication, ni push, ni changement de version. Ces actions restent distinctes de la réalisation et de la validation des correctifs.
