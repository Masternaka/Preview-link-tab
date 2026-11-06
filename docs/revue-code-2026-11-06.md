# Révision du code — 6 novembre 2026

**Statut : revue terminée, corrections proposées non appliquées.**

La révision porte sur la copie de travail locale en version `1.0.1`, à partir
de `d502e65`, avec les modifications non commitées déjà présentes. Elle inclut
le retrait de la vue partagée et de la barre des fenêtres compactes. Les constats
historiques ont été confrontés au code actuel.

**Résultat : six défauts reproduits avec des API simulées et un comportement
de liste blanche à clarifier.** La priorité est de protéger les préférences
contre les écrasements concurrents, puis de fiabiliser les parcours d’erreur.
Les 171 tests existants passent : ils ne couvrent pas tous les cas ci-dessous.

## Périmètre et méthode

- Lecture des scripts applicatifs `background.js`, `content.js`, `popup.js`
  et `settings.js`, des manifestes, des styles concernés, des outils de build,
  d’archives, de surveillance et de hooks, ainsi que des workflows.
- Examen des tests de réglages, d’interactions et du worker, et de la
  documentation actuelle. La revue n’est pas une certification exhaustive.
- Exécution des tests existants et de huit scénarios ciblés dans Node.js
  avec `node:vm` : deux scénarios pour C1, puis un pour chacun de C2 à C7.
  Les scénarios réutilisent les harnais existants en mémoire et simulent les
  erreurs, notifications et messages; les fichiers applicatifs ne sont pas modifiés.
- Les références de lignes ci-dessous désignent la copie de travail au moment
  de cette revue; elles pourront changer lors des corrections.

**Priorités de ce rapport :** P1 = risque d’écrasement de préférences à traiter
en premier; P2 = correction ciblée ensuite. Ces niveaux ne reprennent pas
nécessairement les priorités des anciens rapports.

## Synthèse des constats

| Identifiant | Priorité | Constat | Vérification |
| --- | --- | --- | --- |
| C1 | P1 | Le panneau intégré peut écraser un choix concurrent ou perdre une saisie en attente. | Deux scénarios simulés reproduits. |
| C2 | P2 | Le secours des réglages utilise encore le stockage du site visité. | Écriture reproduite après invalidation du contexte. |
| C3 | P2 | Une règle rapide peut être enregistrée alors que son onglet source est fermé. | Message accepté sans lecture de l’onglet source. |
| C4 | P2 | Un export peut annoncer une réussite après une erreur de lecture et contenir les valeurs par défaut. | Échec de stockage simulé, téléchargement observé. |
| C5 | P2 | Des règles importées en double provoquent un conflit persistant lors de leur modification. | Sauvegarde puis Réappliquer restent en conflit. |
| C7 | P2 | Échap ne ferme pas une fenêtre compacte lorsque le focus est dans une iframe. | Relais de frame ignoré, fermeture depuis le document principal fonctionnelle. |
| C6 | Décision produit | Une liste blanche vide autorise tous les domaines via cette liste. | Résultat reproduit; choix attendu à expliciter. |

## Défauts à corriger

### C1 — Les préférences du panneau intégré ne protègent pas tous les changements concurrents

**Code :** [notifications de stockage](../content.js), lignes 168–187;
`saveSettings`, lignes 1335–1381; sauvegarde différée, lignes 1402–1415.

Deux problèmes ont été reproduits :

1. Un panneau soumet `position = topLeft` à partir de `center`. Avant le
   traitement de cette demande, une autre fenêtre enregistre `bottomRight`.
   Le worker détecte bien le conflit. Cependant, le panneau remplace
   automatiquement la valeur attendue par `bottomRight`, puis renvoie
   `topLeft`. Le choix plus récent est écrasé sans décision explicite.
2. Le curseur d’assombrissement contient une saisie locale `80`, en attente
   dans le délai de 180 ms. Une autre fenêtre enregistre `20` avant l’envoi.
   `storage.onChanged` remplace le brouillon et sa référence par `20`.
   À l’expiration du délai, aucune mutation n’est envoyée : la saisie `80`
   a disparu.

**Impact :** perte silencieuse de préférences ou de modifications en cours,
malgré la sérialisation correcte des écritures dans le worker. La fenêtre
principale de paramètres possède une réconciliation plus complète; le panneau
intégré ne bénéficie pas de la même protection.

**Correction recommandée :** conserver une référence et un brouillon par champ,
réconcilier les notifications sans remplacer les champs localement modifiés,
limiter à une requête en cours par panneau et rendre les conflits visibles.
Retirer la réapplication automatique d’une ancienne valeur après conflit.
Conserver le passage par `MUTATE_SETTINGS`.

**Tests à ajouter :** les deux séquences ci-dessus, deux changements rapides
pendant une réponse retardée, puis échec et nouvelle tentative sans perte
du brouillon.

### C2 — Le secours des réglages écrit dans le localStorage de la page

**Code :** [content.js](../content.js), lignes 1314–1330, 1335–1362 et 1418–1424.

**Reproduction :** modifier un réglage puis faire lever
`runtime.sendMessage` avec une erreur d’invalidation du contexte. Le code
enregistre les 36 clés des préférences dans
`window.localStorage["peek-preview-settings"]` du site visité. L’absence de
stockage d’extension déclenche également ce secours. Les erreurs de lecture
peuvent relire cette valeur.

**Impact :** la page peut lire ces préférences, notamment les listes de domaines
et les thèmes personnels, et modifier le contenu qui sera repris lors d’un
prochain échec de lecture. Le secours crée aussi des réglages divergents
selon le site. Ce constat déjà suivi dans les travaux restants subsiste.

**Correction recommandée :** garder seulement un état temporaire en mémoire
si le contexte de l’extension n’est plus disponible, afficher une invitation
à recharger la page et réserver la persistance au worker. Retirer aussi
la branche d’écriture directe `chrome.storage.local.set` du panneau pour que
toutes les écritures normales conservent le même protocole.

**Tests à ajouter :** absence d’API, exception synchrone, erreur par callback
et valeur préexistante fournie par le site. Aucun de ces parcours ne doit lire
ou écrire les préférences dans le stockage de la page.

### C3 — La règle rapide ne vérifie pas l’existence de l’onglet source au traitement

**Code :** [background.js](../background.js), route `SET_DOMAIN_RULE`, lignes
127–131, et `setDomainRuleFromMessage`, lignes 427–432;
[popup.js](../popup.js), envoi de la règle depuis `initSiteControls`.

**Reproduction :** envoyer une demande de règle rapide avec un `tabId` fermé
et une URL HTTP valide. Le worker répond `ok: true` et enregistre la règle,
sans appeler `tabs.get`. Le défaut peut se produire lorsqu’une demande attend
dans la file puis que l’onglet est fermé avant son traitement.

**Impact :** la popup désactive correctement les commandes lorsqu’elle apprend
la fermeture, mais ignorer une réponse tardive ne défait pas l’écriture déjà
réalisée par le worker. Une navigation de la source peut également rendre le
contexte affiché obsolète sans vérification au traitement de la règle.

**Correction recommandée :** transmettre le `sender` au traitement et vérifier
l’onglet source dans l’opération mise en file, avant la mutation. Pour la popup,
vérifier aussi que l’URL source correspond encore à celle de la demande.
Pour le panneau intégré, distinguer l’URL du document source de celle du site
prévisualisé auquel la règle s’applique.

**Tests à ajouter :** fermer ou faire naviguer l’onglet pendant l’attente dans
la file; attendre une réponse d’échec sans nouvelle règle enregistrée.

### C4 — L’export ignore les erreurs de lecture du stockage

**Code :** [popup.js](../popup.js), gestionnaire `exportButton`, lignes 966–979.

**Reproduction :** faire échouer `storage.local.get`, avec
`runtime.lastError` renseigné et aucun objet renvoyé. Le callback appelle quand
même `cleanPeekSettings(undefined)`, construit un téléchargement contenant
les valeurs par défaut et affiche « Exporté ».

**Impact :** le fichier présenté comme une sauvegarde peut être vide de thèmes
personnels et de règles. Le réimporter ensuite remplace les véritables réglages.
L’erreur de lecture ne supprime pas à elle seule les préférences enregistrées.

**Correction recommandée :** vérifier `runtime.lastError` et la validité de la
réponse avant de créer le téléchargement; gérer aussi une exception synchrone.
Afficher un échec explicite et ne produire aucun fichier dans ces cas.

**Tests à ajouter :** export normal conservant thèmes et règles, erreur par
callback et exception; seul le premier doit télécharger un fichier et annoncer
une réussite.

### C5 — Des règles en double rendent la résolution des conflits incohérente

**Code :** [settings.js](../settings.js), `parseDomainRules`,
`getDomainRule` et `peekMutationDomainRuleMode`;
[popup.js](../popup.js), `rulesByDomain`, lignes 320–321.

**Reproduction :** importer ces règles, actuellement acceptées :

```text
example.com = overlay
example.com = blocked
```

Le code d’ouverture et le worker retiennent la **première** règle pour ce
domaine (`overlay`, via `find`). La popup construit un `Map`, qui retient
la **dernière** (`blocked`). Modifier la règle en `compact` produit une mutation
avec `expected: "blocked"`, alors que le worker lit `overlay`.
La sauvegarde signale donc un conflit; **Réappliquer** recalcule encore
`expected: "blocked"` et reste en conflit.

**Impact :** la modification du domaine peut rester bloquée sans aucune autre
fenêtre ouverte. Une liste importée peut aussi afficher plusieurs règles
contradictoires pour le même site.

**Correction recommandée :** définir une seule politique de doublons dans les
fonctions partagées. Détecter les doublons à l’import et les signaler avant
de les normaliser; éviter de changer silencieusement le mode réellement actif
dans une ancienne configuration.

**Tests à ajouter :** import avec deux modes pour le même domaine, modification,
suppression et résolution d’un vrai conflit après normalisation.

### C7 — Échap est perdu depuis une iframe dans une fenêtre compacte

**Code :** [content.js](../content.js), relais des sous-documents, lignes 17–23;
fermeture compacte, lignes 1505–1515; filtre des messages, lignes 1525–1530.

**Reproduction :** ouvrir une fenêtre compacte avec `closeWithEsc` activé,
puis donner le focus à une iframe HTTP/HTTPS où le script est injecté et
appuyer sur Échap. Le sous-document relaie `CLOSE_PEEK_PREVIEW` au document
principal. Celui-ci n’a pas de `STATE.iframe` d’aperçu et rejette le message
avant de pouvoir fermer la fenêtre. La même touche dans le document principal
envoie correctement `CLOSE_COMPACT_WINDOW`.

**Impact :** la fermeture au clavier dépend de la zone qui détient le focus,
notamment sur les pages comportant un lecteur ou un formulaire intégré.

**Correction recommandée :** prévoir un relais de fermeture des frames vers
le worker pour une fenêtre compacte, en vérifiant son identité côté worker.
Conserver les protections IME, la préférence de fermeture et le filtrage
strict des messages du panneau intégré.

**Tests à ajouter :** document principal, iframe directe et iframe imbriquée,
avec préférence active/inactive et composition IME. Confirmer ensuite le
parcours dans les deux extensions réellement chargées.

## Comportement à clarifier

### C6 — Une liste blanche vide autorise tous les domaines

**Code :** [settings.js](../settings.js), `isPeekAllowedForHost`, lignes 568–580;
[popup.html](../popup.html), réglages des listes de sites.

**Vérification actuelle :** `domainListMode: "whitelist"` avec `domainList: ""`
ou `" , "` renvoie `true` pour `example.com`. Le retour anticipé
`list.length === 0` précède le traitement du mode liste blanche.
Les règles explicites par domaine restent prioritaires.

Le comportement est confirmé, mais son classement comme bug dépend de la
décision produit. Il figure déjà dans les travaux restants et n’est pas corrigé.

**Recommandation :** une liste blanche vide devrait n’autoriser aucun domaine
via cette liste, avec un message explicite dans l’interface. Préserver et
expliquer la priorité des règles explicites. Ajouter les cas vide, séparateurs
seuls, domaine, sous-domaine et règle explicite aux tests avant tout changement.

## Options sans effet ou à simplifier

Complément demandé après la revue : distinguer un réglage sans effet dans
le code actuel des choix de simplification de l’interface. Ces propositions
ne constituent pas une décision de supprimer les options.

### Une préférence actuellement sans effet

**« Fermer après passage en fenêtre compacte » (`closeAfterOpen`).**
La préférence est affichée, enregistrée et synchronisée. Cependant, les deux
boutons de passage en fenêtre compacte appellent explicitement
`openCurrentInPopup(true)` dans [content.js](../content.js), lignes 475–476.
Ils imposent donc la fermeture sans utiliser la valeur par défaut de cette
fonction, définie à la ligne 1131. L’ouverture directe en mode compact passe
également une valeur explicite à `openUrlInPopup`.

Cocher ou décocher cette option ne change donc pas les parcours actuels.
**Recommandation :** retirer cette préférence de l’interface en conservant
la fermeture automatique lors du passage de l’aperçu à une fenêtre compacte.
Prévoir la compatibilité des anciens réglages et exports lors d’une éventuelle
implémentation.

Ce constat provient de la lecture des appels actuels; aucun scénario navigateur
ni nouveau test automatisé n’a été exécuté pour ce complément.

### Simplifications proposées, à décider

| Option actuelle | Avis et proposition |
| --- | --- |
| Six vitesses d’animation | Trois vitesses — rapide, normale et lente — pourraient suffire, avec le choix « Aucune animation » conservé. |
| Position personnalisée par coordonnées X/Y | Peu utile au quotidien grâce au déplacement à la souris; conserver ce réglage comme option avancée. |
| Neuf choix d’ombre | Quelques styles visuellement distincts pourraient alléger le choix; la diversité actuelle reste une préférence esthétique. |

Ces options fonctionnent; elles ne sont pas classées comme bugs. Une éventuelle
réduction des choix devra préserver les valeurs déjà enregistrées ou prévoir
une migration explicite.

### Options à conserver

Les deux modes d’ouverture, les sept thèmes et les palettes personnelles,
les tailles, les règles par domaine, la pause, l’épinglage et l’import/export
répondent à des usages distincts et méritent d’être conservés.

La première simplification conseillée concerne la préférence sans effet.
Les réglages décoratifs ne devraient être réduits que si l’utilisateur souhaite
alléger l’interface. Aucune option n’est retirée par cette documentation.

## Utilité de l’onglet Sites

**Avis produit : une gestion complète des sites n’est pas indispensable pour
cette extension.** L’aperçu nécessite déjà une action explicite; les restrictions
par domaine ont donc moins d’intérêt que pour un aperçu automatique au survol.
L’objectif principal reste d’ouvrir un lien rapidement, lire son contenu, puis
fermer l’aperçu ou continuer dans un onglet.

La gestion des sites apporte surtout un confort : mémoriser les exceptions,
par exemple toujours ouvrir un domaine en fenêtre compacte lorsqu’il refuse
l’intégration. Cette possibilité reste utile sans nécessiter une rubrique
principale entière.

L’interface actuelle propose plusieurs mécanismes qui se chevauchent :
liste d’exclusion et règles « Désactivé », liste personnalisée des sites
incompatibles et règles « Fenêtre compacte ». La liste d’autorisation exclusive
correspond davantage à un usage avancé.

**Direction recommandée, à décider :**

1. Conserver la mémorisation d’une exception directement depuis l’aperçu,
   notamment « Toujours ouvrir ce site en fenêtre compacte ».
2. Ranger la liste des règles enregistrées dans les paramètres avancés.
3. Supprimer l’onglet « Sites » dédié et simplifier les listes parallèles,
   en prévoyant une migration explicite des préférences existantes.

La pause sur la page de départ et les règles visant le domaine de destination
restent deux comportements différents : une éventuelle interface simplifiée
doit expliquer cette distinction. L’intérêt des fonctions citées parmi les
options à conserver ne justifie pas, à lui seul, un onglet dédié.

Cette recommandation vise à garder une petite fonction de mémorisation des
exceptions, proportionnée à l’objectif de l’extension. Elle ne constitue ni
une décision produit acceptée ni une autorisation de retirer les fonctionnalités.
Aucune modification applicative n’est effectuée pour cet ajout documentaire.

## Autres recommandations

1. **Compléter les tests avec les extensions réellement chargées.** Les harnais
   sont utiles, mais ne prouvent pas les permissions, le réveil du worker,
   l’injection dans les frames ni le comportement privé réel. Commencer par
   Chrome et Firefox : paramètres depuis une fenêtre privée, fermeture de la
   source, navigation compacte, redémarrage du worker, concurrence et Échap.
   Conserver les essais Vivaldi/Helium comme validations distinctes.
2. **Partager progressivement la gestion des brouillons.** Extraire d’abord
   une petite couche commune de mutations et de réconciliation utilisée par
   `popup.js` et le panneau intégré. C1 montre une divergence concrète.
   Garder les ressources à leurs chemins actuels et éviter une réécriture
   générale de `content.js` avant les corrections ciblées.
3. **Vérifier le focus comme un parcours complet.** Le dialogue porte
   `aria-modal="true"`, mais le piège de focus est installé sur sa racine et
   ne reçoit pas les touches du document de l’iframe. Contrôler Tab/Maj+Tab
   depuis la page intégrée, l’accès au site sous-jacent et le retour au lien
   déclencheur. Il s’agit d’une vérification complémentaire, pas d’un échec
   navigateur démontré par cette revue.
4. **Rendre le suivi documentaire plus actuel.** La synthèse de
   `resume-session.md` indique encore `0.2.2`; l’état et les vérifications
   conservent plusieurs tableaux historiques et des dates du 21 octobre.
   Préparer une prochaine synthèse de reprise qui distingue clairement la
   version `1.0.1`, les retraits du 6 novembre et les validations récentes,
   tout en gardant le journal historique.
5. **Préparer une documentation de distribution concise.** Préciser le
   stockage des préférences, les positions de lecture en session, l’isolation
   privée et les requêtes vers le site prévisualisé et son favicon. Clarifier
   aussi la licence souhaitée et inventorier les permissions conservées.
   Aucun changement de permissions ni choix de licence n’est appliqué ici.

## Ordre de correction conseillé

1. C1 et C2 : protection des préférences et secours après invalidation.
2. C4 et C5 : export fiable et règles importées cohérentes.
3. C3 et C7 : contexte source et fermeture des fenêtres compactes.
4. Décider C6, puis effectuer les essais des extensions chargées.

Ces propositions n’autorisent pas leur implémentation automatique. Les modes
conservés, les thèmes, les originaux des icônes et les déclencheurs explicites
doivent rester préservés.

## Vérifications exécutées et limites

| Contrôle | Résultat du 6 novembre 2026 |
| --- | --- |
| Runtime existant | `tools/local-runtime/node --version` : `v24.10.0`. |
| Suite existante | `tools/local-runtime/node --test` : **171 réussites**, aucun échec ni test ignoré. |
| Builds et archives | Couverts par les tests existants, avec sorties temporaires et contrôle des ZIP; pas de régénération demandée des dossiers chargeables. |
| Reproductions ciblées | Huit scénarios VM réussis avec assertions : six défauts et C6 reproduits. Script temporaire hors dépôt. |
| Diff | `git diff --check` réussi avant et après rédaction. |
| Documentation | Liens locaux du rapport et des entrées de suivi ajoutées vérifiés. |

`npm` n’était pas sur le `PATH` de cette session; les tests ont été exécutés
directement avec le runtime Node.js 24 existant, sans installer d’outil.
Les simulations ne constituent pas des essais de rendu ou d’extension chargée.
Playwright, le lint Firefox, les navigateurs réels et la CI distante n’ont pas
été exécutés pour cette revue. Aucune publication n’a été vérifiée.

Seuls ce rapport et ses références documentaires sont ajoutés ou actualisés.
Les modifications applicatives préexistantes sont conservées. Aucun correctif,
changement de version, commit, push ou publication n’est réalisé par cette tâche.
