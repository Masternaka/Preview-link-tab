# Revue locale — modifications non commitées

> Rapport préexistant, conservé lors de la réorganisation du 21 octobre 2026. Les constats, numéros de ligne et affirmations de validation décrivent la revue d’origine. La section suivante donne le résultat de leur reprise et de leur correction ultérieures; le détail historique reste conservé.

## État après correction — 21 octobre 2026

Les six problèmes et les deux suggestions ci-dessous ont été traités dans la copie de travail, sans version ni publication. Les constats et anciens numéros de ligne sont conservés pour leur valeur historique.

Les références des entrées modifiées sont préservées malgré les notifications externes; les mutations sont uniques par fenêtre; les réponses et notifications conservent les brouillons, y compris les modifications du même champ pendant la requête. « Réappliquer » lit le formulaire courant et la sauvegarde de thème reconstruit son action courante. Les noms propres suivent les renommages externes, tandis que les noms saisis sont conservés. Les événements de fermeture/navigation de la source effacent son contexte et invalident les réponses tardives. Une règle rapide n’acquitte que son domaine. Le réducteur validant les mutations est désormais partagé dans `settings.js`; la branche inatteignable du worker a été supprimée.

Validation : 155 tests Node.js réussis, builds et ZIP Chrome/Firefox produits, lint Firefox sans erreur ni notice et avec les trois avertissements préexistants. Une revue ciblée par Sol 6.1 Moyen a contrôlé les changements significatifs. Les contrôles Chrome avec API simulées confirment les conflits, les brouillons en vol, la réapplication, le nom de thème, le statut de sauvegarde partielle et l’effacement du site source. Voir [l’état du projet](../etat-projet.md) pour les scénarios et limites. Aucun essai d’extension réellement chargée dans Firefox/Chrome n’est déduit de ces tests.

## Résumé

Cette modification applique les quatre lots de correction : contexte privé des fenêtres compactes, accès aux paramètres depuis un onglet privé, recalcul après redimensionnement, et protocole de préférences sérialisé dans le worker avec gestion des conflits. La structure générale est correcte et les vérifications automatisées passent, mais la nouvelle couche de concurrence peut encore écraser silencieusement des changements externes, perdre des brouillons lors d’une sauvegarde ou d’une réapplication, et laisser un nom d’hôte privé visible après la fermeture de l’onglet source.

## Problèmes relevés

| Sévérité | Fichier:Ligne | Problème |
|---|---|---|
| WARNING | `popup.js:486` | Les changements externes sur un champ modifié localement mettent à jour la référence, donc la sauvegarde suivante les écrase silencieusement au lieu de signaler un conflit. |
| WARNING | `popup.js:260` | Aucune protection contre une sauvegarde en cours : un second clic avant la réponse produit un faux conflit même lorsque les deux mutations sont identiques. |
| WARNING | `popup.js:262` | La sauvegarde réussie recharge tout le formulaire avec `setFormSettings`, ce qui supprime les brouillons qui ne faisaient pas partie de la mutation. |
| WARNING | `popup.js:56` | « Réappliquer » réutilise l’instantané du conflit et ignore les modifications faites après l’apparition du conflit. |
| WARNING | `popup.js:489` | Des événements de stockage sans rapport appellent `updateThemeLibraryControls`, ce qui efface un nom de thème en cours de saisie. |
| WARNING | `popup.js:106` | La fermeture d’un onglet source privé laisse son nom d’hôte et sa règle effective visibles dans la fenêtre normale des paramètres. |
| SUGGESTION | `background.js:553` | La branche `SET_DOMAIN_RULE` de `handleSiteSettings` est inatteignable depuis la route de premier niveau. |
| SUGGESTION | `tests/browser/check-browser.cjs:44` | Le harnais navigateur duplique le réducteur de mutations du worker avec une validation plus faible, ce qui crée un risque de divergence. |

## Détail des constats

### 1. [WARNING] `popup.js:486` — Les changements externes sur un même champ sont écrasés silencieusement

**Confiance :** 95 %

**Problème :** À la fin du gestionnaire `storage.onChanged`, `persistedSettings = next` remplace la référence même lorsque le brouillon contient une modification locale pour une clé présente dans `changes`. La sauvegarde suivante utilise donc la valeur externe comme `expected`, le worker accepte la valeur locale, et aucun conflit n’est affiché. Cela contredit l’exigence du plan de refuser un écrasement silencieux lorsque le même champ, domaine ou thème a changé ailleurs.

**Correction suggérée :** Conserver la référence utilisée au moment de la création du brouillon pour les clés modifiées localement, ou enregistrer la valeur entrante et afficher un conflit en attente. Ne rafraîchir `persistedSettings` que pour les clés non modifiées localement.

### 2. [WARNING] `popup.js:260` — Un double clic sur Sauvegarder crée un faux conflit

**Confiance :** 95 %

**Problème :** La sauvegarde ne désactive pas le formulaire et ne suit pas la mutation en cours. Un second clic avant la réponse construit la même mutation à partir de l’ancien `persistedSettings`. Le worker applique la première mutation, puis rejette la seconde, identique, parce que son `expected` ne correspond plus. Un conflit est affiché alors que les valeurs sont les mêmes.

**Correction suggérée :** Désactiver le bouton Sauvegarder pendant une mutation, ou considérer un conflit comme un succès lorsque les valeurs soumises sont déjà égales aux réglages confirmés.

### 3. [WARNING] `popup.js:262` — La sauvegarde réussie supprime les brouillons non concernés

**Confiance :** 95 %

**Problème :** Le rappel de succès appelle `setFormSettings(settings)`, qui réécrit tous les champs et réinitialise l’éditeur de règles ainsi que le nom de thème en cours de saisie. Il ne retire pas uniquement les modifications réellement enregistrées, contrairement au plan. Toute modification faite pendant la requête ou tout brouillon sans rapport est perdu.

**Correction suggérée :** Mettre à jour `persistedSettings` et appliquer les valeurs confirmées uniquement aux clés incluses dans la mutation ; préserver les autres champs et les brouillons des éditeurs.

### 4. [WARNING] `popup.js:56` — « Réappliquer » utilise un instantané obsolète

**Confiance :** 90 %

**Problème :** `pendingConflict.mutation` contient les valeurs de la sauvegarde échouée. Si l’utilisateur modifie le formulaire après le conflit puis clique sur « Réappliquer », ces nouvelles valeurs sont ignorées. Le rappel de succès peut ensuite réinitialiser le formulaire et faire perdre les modifications faites après l’affichage du conflit.

**Correction suggérée :** Reconstruire la mutation à partir du formulaire courant et des attentes rafraîchies au moment du clic sur « Réappliquer », plutôt que de réutiliser la mutation capturée.

### 5. [WARNING] `popup.js:489` — Un événement externe efface un nom de thème en cours de saisie

**Confiance :** 95 %

**Problème :** Le gestionnaire identifie un nom de thème saisi comme un brouillon local via `pendingThemeName`, mais appelle quand même `updateThemeLibraryControls()` sans condition. Cette fonction réinitialise `#theme-name` au nom du thème enregistré sélectionné, ou à une chaîne vide. Tout événement de stockage efface donc le nom en cours de saisie.

**Correction suggérée :** Ne pas rafraîchir le champ du nom tant qu’un brouillon de nom existe, ou restaurer la valeur saisie après `updateThemeLibraryControls()`.

### 6. [WARNING] `popup.js:106` — Le nom d’hôte privé reste visible après la fermeture de l’onglet source

**Confiance :** 95 %

**Problème :** `disableSiteActions()` vide `activeSite` et désactive les contrôles, mais laisse `#current-site` et `#effective-site-rule` remplis. Comme Chrome ouvre désormais la page de paramètres dans une fenêtre normale pour un onglet source privé, fermer cet onglet laisse le nom d’hôte privé visible dans une fenêtre normale.

**Correction suggérée :** Vider `#current-site` et `#effective-site-rule`, réinitialiser `#current-site-mode` à sa valeur par défaut, et masquer ou réinitialiser la section du site lorsque l’onglet source a disparu.

### 7. [SUGGESTION] `background.js:553` — Branche `SET_DOMAIN_RULE` inatteignable

**Confiance :** 95 %

**Problème :** Le listener de messages traite `SET_DOMAIN_RULE` avant la branche des réglages de site et retourne immédiatement. La branche `SET_DOMAIN_RULE` à l’intérieur de `handleSiteSettings` ne peut pas être atteinte via l’API de messages.

**Correction suggérée :** Supprimer la branche, ou faire passer `SET_DOMAIN_RULE` par `handleSiteSettings` à un seul endroit si l’objectif est de conserver un point d’entrée unique.

### 8. [SUGGESTION] `tests/browser/check-browser.cjs:44` — Réducteur de mutations dupliqué avec une validation plus faible

**Confiance :** 90 %

**Problème :** `mutateSavedSettings` réimplémente le réducteur du worker mais omet la liste blanche des clés scalaires et la validation des thèmes et domaines. Le contrôle navigateur peut donc accepter des mutations que le worker de production rejetterait, et les deux implémentations peuvent diverger.

**Correction suggérée :** Extraire un réducteur pur `applySettingsMutation(current, message)` dans `settings.js` et l’utiliser depuis `background.js` et le harnais, ou ajouter des tests de parité exécutant les mêmes mutations dans les deux implémentations.

## Recommandation

**CHANGEMENTS NÉCESSAIRES** — Les avertissements concernant la détection des conflits, la préservation des brouillons et la visibilité du contexte privé doivent être corrigés avant un commit.
