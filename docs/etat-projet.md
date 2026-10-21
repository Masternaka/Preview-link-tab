# État du projet

État local au 21 octobre 2026. Référence Git de départ : `61dd7b3`; version de `manifest.json` et `package.json` : `0.2.2`. Les modifications restent locales et non commitées.

## Fonctionnement et décisions

Preview link tab permet de consulter un lien sans perdre sa page de départ. Le code commun Chrome/Chromium et Firefox propose l’aperçu intégré, la fenêtre compacte, la vue partagée native selon l’API disponible, les règles par domaine, la pause, les thèmes et la reprise de lecture en session. Les tests, builds et workflows de préparation des ZIP et de publication sont présents.

Conserver le déclenchement explicite sans aperçu automatique au survol, la vue partagée exclusivement native et le respect des protections d’intégration des sites. Les idées non retenues restent des propositions dans [Travaux restants](travaux-restants.md).

## Corrections implémentées localement

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
