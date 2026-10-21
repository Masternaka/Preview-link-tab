# État du projet

État local au 21 octobre 2026. Version actuelle de `manifest.json` et `package.json` : `1.0.1`. Les sources étaient à cette version au début de la tâche d’automatisation. `npm run package` actualise maintenant les dossiers chargeables et les archives en une commande; `npm run dev` maintient ces sorties à jour tant que le terminal reste actif. Recharger l’extension dans le navigateur reste nécessaire. Les sections suivantes conservent les résultats historiques du même jour. Aucun changement de version, commit, push ou publication effectué pour cette automatisation.


## Fonctionnement et décisions

Les hooks sont activés dans ce clone : génération après chaque commit et avant
chaque push, sans terminal de surveillance. Le hook `pre-push` a été exécuté
avec `git hook run pre-push`, sans envoi distant, et a régénéré les ZIP `1.0.1`.
Les autres clones nécessitent `npm run hooks:install`.

La distribution locale conserve au maximum trois versions de ZIP : celle générée
et les deux autres numériquement les plus récentes. La suppression des anciennes
archives intervient après génération réussie et écriture des empreintes, sans
nettoyage des dossiers chargeables ni des fichiers étrangers aux archives.

Preview link tab permet de consulter un lien sans perdre sa page de départ. Le code commun Chrome/Chromium et Firefox propose l’aperçu intégré, la fenêtre compacte, la vue partagée native selon l’API disponible, les règles par domaine, la pause, les thèmes et la reprise de lecture en session. Les tests, builds et workflows de préparation des ZIP et de publication sont présents.

Conserver le déclenchement explicite sans aperçu automatique au survol, la vue partagée exclusivement native et le respect des protections d’intégration des sites. Les idées non retenues restent des propositions dans [Travaux restants](travaux-restants.md).

## Taille relative par défaut

Le nouveau format **75 % du navigateur** est le défaut en l’absence de taille enregistrée. Il suit la largeur et la hauteur de la zone de page pour l’aperçu intégré, et celles de la fenêtre source pour la fenêtre compacte, avec les limites d’espace existantes. Les cinq formats antérieurs et les dimensions personnalisées sauvegardées ou importées sont conservés. Les paramètres et les deux menus intégrés proposent ce choix. Validation de cet ajout : 158 tests Node.js réussis, builds et ZIP Chrome/Firefox `0.2.3` régénérés et `git diff --check` réussi. Le contrôle Playwright dans Chrome avec API simulées confirme les proportions après ouverture et redimensionnement; les essais des extensions réellement chargées restent à effectuer. Voir [les résultats détaillés](verifications.md#taille-relative--21-octobre-2026).

## Centrage et cadres

Sans position enregistrée, le placement est désormais centré; les positions
existantes et importées sont conservées. Les sept cadres partagent avec la
miniature un calcul de rayon intérieur qui tient compte des bordures et de
l’espacement. Le contour de focus automatique du conteneur est supprimé, avec
un indicateur explicite sur les commandes au clavier. Les palettes et la priorité
du choix d’ombre sont conservées. Ces changements restent locaux. Les 159 tests
Node.js et le contrôle Chrome avec API simulées réussissent; les sept cadres ont
aussi été contrôlés avec des palettes sombre et claire, le plein écran et les
paramètres sur ordinateur et fenêtre étroite. Les builds et ZIP `0.2.3` sont
régénérés. Les [vérifications détaillées](verifications.md#centrage-et-cadres--21-octobre-2026)
restent distinctes des essais des extensions réellement chargées.

## Corrections implémentées localement

### Test du focus clavier en CI — 21 octobre 2026

L’échec Ubuntu fourni par l’utilisateur signale une hypothèse incorrecte du
contrôle navigateur : une première touche Tab depuis le panneau ne cible pas
nécessairement un bouton, car l’iframe participe à l’ordre natif de tabulation.
Le test place désormais le focus sur Nouvel onglet, vérifie cet ancrage, puis
appuie réellement sur Tab et attend le focus visible sur Fermer avant de
contrôler son contour. Le code applicatif et les styles restent inchangés.
Les 159 tests Node.js et le contrôle Playwright complet passent localement sous
Node.js 24.10.0, avec Chrome et des API d’extension simulées. La CI distante
n’a pas été relancée ni son échec vérifié directement sur GitHub pour cette
correction; le résultat navigateur local est détaillé dans
[Vérifications](verifications.md#stabilisation-du-test-de-focus-clavier--21-octobre-2026).

### Corrections applicatives antérieures

Les quatre lots initiaux sont présents : contexte privé des fenêtres compactes, paramètres accessibles depuis un onglet privé, redimensionnement et sauvegardes concurrentes. Les six défauts et deux recommandations de la revue locale ont ensuite été traités :

- Références de conflit distinctes de la dernière version stockée, par réglage, domaine et thème.
- Un seul envoi par fenêtre; réponses et notifications réconciliées en conservant les saisies ultérieures, les noms et les éditeurs.
- Réapplication construite depuis le formulaire courant; protection des thèmes recréés ailleurs.
- Statut explicite lorsqu’une sauvegarde laisse des modifications à enregistrer.
- Contexte du site source effacé à sa fermeture ou navigation, actions désactivées et réponses tardives ignorées.
- Réducteur partagé entre worker et tests, avec suppression de la branche inaccessible.

Les contrôles significatifs ont été effectués avec Sol 6.1 Moyen et l’extraction cadrée avec Sol 6.1 Léger. Le [plan initial](archives/corrections-revue-2026-10-21.md), la [revue générale](archives/revue-generale-2026-10-21.md) et la [revue locale](archives/revue-locale-2026-10-21.md) sont archivés; ils ne sont plus le backlog actif.

## Vérifications connues

| Contrôle | Dernier résultat documenté |
| --- | --- |
| Tests Node.js | 155 tests réussis avec Node.js 24.10.0 après les corrections. |
| Builds et archives | Chrome/Firefox et ZIP `0.2.2` vérifiés contre les dernières sources et leurs empreintes SHA-256. |
| Lint Firefox | Aucune erreur ni notice; trois avertissements préexistants : deux `innerHTML` et une compatibilité Android. |
| Contrôles Chrome avec API simulées | Parcours existants et scénarios ciblés réussis; captures inspectées sur ordinateur et fenêtre étroite, aucune erreur applicative dans le contrôle ciblé. |

Les commandes, scénarios, preuves et limites sont regroupés dans [Vérifications](verifications.md#résultats-des-corrections--21-octobre-2026). Aucun essai avec l’extension réellement chargée dans Chrome ou Firefox ni exécution distante de la matrice CI Node.js 22/24 n’a été effectué. Un build local, un ZIP, une release GitHub et une signature Firefox sont des étapes distinctes.

## Ménage du 21 octobre 2026

Suppression de `.DS_Store` et du marqueur redondant `icons/.gitkeep`. L’ancienne image d’icône a été conservée sous `icons/sources/`; les trois documents de travaux réalisés ont été déplacés dans `docs/archives/`, avec correction de leurs liens. Les dossiers documentaires devenus vides ont été retirés.

Les fichiers applicatifs, tests, manifestes, ressources utilisées, dépendances optionnelles, configurations locales des outils et builds existants ont été préservés. L’état du projet est recentré sur la situation actuelle; les détails de validation sont dans le guide correspondant et le journal dans [Résumé de session](resume-session.md).

Contrôles exécutés après ce ménage : 155 tests Node.js réussis, aucun échec ni test ignoré; builds Chrome/Firefox et deux ZIP `0.2.2` régénérés; 87 liens locaux et ancres valides; `git diff --check` réussi. Les empreintes des fichiers applicatifs, tests, scripts, configurations locales et icônes confirment leur préservation; l’image déplacée est identique à l’original.

Aucun essai navigateur supplémentaire n’a été exécuté pour ce ménage. Les résultats Chrome et lint détaillés dans le guide restent ceux de la correction précédente, distincts de ces contrôles. Aucun changement de code, de version, commit, push ou publication effectué.

## Prochaine étape

Valider l’extension réellement chargée dans Chrome et Firefox : navigation privée, plusieurs fenêtres de paramètres, focus, gestes et API native de vue partagée. Reprendre ensuite les sujets ouverts du [suivi](travaux-restants.md), notamment le secours des réglages et la liste d’autorisation vide, après vérification du code courant.

## Hooks locaux de génération

`npm run hooks:install` prépare une activation propre à chaque clone pour générer
après commit et avant push sans surveillance active. Les hooks utilisent le
répertoire de travail, pas nécessairement le commit envoyé, et ne lancent pas les
tests. Un échec bloque le push; après commit, il annonce que le commit existe déjà.
Voir [Distribution](distribution.md#génération-après-commit-et-avant-push).
