# Documentation de Preview link tab

Depuis le 21 octobre 2026, les fichiers Markdown du dépôt sont la référence documentaire. Cette organisation reprend la règle actuelle de Menu de la semaine, vérifiée dans son `AGENTS.md` : README comme point d’entrée, AGENTS comme guide opérationnel et `docs/` pour les documents de projet. Les anciennes pages Notion restent des archives historiques, sans mise à jour ni synchronisation automatique.

## Lire et reprendre

| Document | Usage |
| --- | --- |
| [État du projet](etat-projet.md) | Version locale, corrections présentes, limites et prochaine étape. |
| [Résumé de session](resume-session.md) | Synthèse actuelle et journal daté pour reprendre. |
| [Installation](installation.md) | Charger et recharger l’extension dans les deux navigateurs. |
| [Utilisation](utilisation.md) | Modes, raccourcis, règles, pause, lecture et données. |
| [Thèmes](themes.md) | Palettes, sources et thèmes personnels. |
| [Architecture](architecture.md) | Fichiers, stockage, tests et chemins à préserver. |
| [Vérifications](verifications.md) | Contrôles automatiques et essais réels. |
| [Distribution](distribution.md) | ZIP, empreintes, CI et publication. |
| [Travaux restants](travaux-restants.md) | Priorités ouvertes et évolutions à réévaluer. |
| [AGENTS.md](../AGENTS.md) | Règles des assistants pour ce dépôt. |

## Archives des travaux réalisés

Ces documents décrivent les étapes antérieures aux corrections locales. Ils restent disponibles pour leur contexte et leur provenance; leurs anciens constats et cases ne sont pas la liste des tâches encore ouvertes.

| Archive | Statut |
| --- | --- |
| [Plan des quatre corrections](archives/corrections-revue-2026-10-21.md) | Lots implémentés et vérifiés automatiquement; essais réels des extensions à terminer. |
| [Revue générale](archives/revue-generale-2026-10-21.md) | Quatre constats historiques sur `61dd7b3`, suivis des correctifs locaux. |
| [Revue locale](archives/revue-locale-2026-10-21.md) | Six défauts et deux recommandations traités; rapport d’origine conservé. |

## Maintenir la documentation

Mettre à jour les guides, l’état et les travaux restants dans la même tâche qu’un changement de fonctionnement, de commande ou de structure. Archiver les plans et revues traités avec leur contexte. Garder l’état courant concis et regrouper les preuves de validation dans `verifications.md`; le journal reste dans `resume-session.md`. Les idées non retenues restent identifiées comme propositions, sans déclencher leur développement.

Une demande de résumé ou une clôture annoncée actualise `resume-session.md`. Préserver les décisions et notes de l’utilisateur et ajouter une entrée datée. Ne pas créer de nouveau résumé parallèle à la racine.

## Provenance du regroupement

Les fichiers locaux ont été regroupés le 21 octobre 2026. Les huit pages de la hiérarchie Notion ci-dessous ont été consultées, dont la page d’accueil et le conteneur des revues. Les cinq anciens imports documentaires proviennent du commit `61dd7b372a53b69194e13e528a0c231718e3b988`; les sources locales sont conservées ou réparties dans les guides correspondants. Le rapport général du 21 octobre apporte le contenu qui manquait localement. Aucune page Notion n’a été modifiée ou supprimée.

| Source | Destination locale |
| --- | --- |
| `README.md` initial | README d’entrée; [installation](installation.md), [utilisation](utilisation.md), [vérifications](verifications.md), [distribution](distribution.md) et [architecture](architecture.md). |
| `TODO.md` | [Travaux restants](travaux-restants.md), contenu et idées conservés. |
| `THEMES.md` | [Thèmes](themes.md), contenu conservé. |
| `testfirefox.md` | [Installation Firefox](installation.md#firefox), étapes intégrées et chemin rendu indépendant du poste. |
| `PLAN-CORRECTIONS-REVUE.md` | [Plan de correction](archives/corrections-revue-2026-10-21.md), avec notice de contexte et chemins actualisés. |
| `Revue locale.md` | [Revue locale](archives/revue-locale-2026-10-21.md), constats conservés et statut historique explicité. |
| [Accueil Notion](https://app.notion.com/p/3fb53e9aab0581b286cef0ab40a5f6e4) | Présentation, choix et architecture repris dans les guides et [l’état du projet](etat-projet.md). |
| [README Notion](https://app.notion.com/p/3fb53e9aab0581fdbc49eb82325c0828) | Ancienne copie du README, remplacée comme référence par les guides ci-dessus. |
| [TODO Notion](https://app.notion.com/p/3fb53e9aab0581d4937efa49fee7b84f) | Ancienne copie du TODO, reprise dans [Travaux restants](travaux-restants.md). |
| [Thèmes Notion](https://app.notion.com/p/3fb53e9aab0581a2a73ec0acc4824e5d) | [Thèmes](themes.md). |
| [Firefox Notion](https://app.notion.com/p/3fb53e9aab0581609b7df617586abd1b) | [Installation Firefox](installation.md#firefox). |
| [Contribution Notion](https://app.notion.com/p/3fb53e9aab0581e9b90dd2c3ae197dce) | Consignes conservées dans [.github/copilot-instructions.md](../.github/copilot-instructions.md) et [AGENTS.md](../AGENTS.md). |
| [Conteneur des revues Notion](https://app.notion.com/p/6ef53e9aab0582079197011b291dc42b) | Lien vers la revue générale, repris par cet index. |
| [Rapport général Notion](https://app.notion.com/p/40053e9aab0580f0b219f3ee86db14a5) | [Revue générale du 21 octobre](archives/revue-generale-2026-10-21.md). |

Les pages historiques conservent leur contexte et leurs liens. Leur consultation ne prouve pas une validation récente du code ni une mise à jour distante de ce dépôt.
