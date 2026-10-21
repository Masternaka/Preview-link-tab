# Vérifications

Exécuter les commandes depuis la racine du dépôt. Les résultats courants sont résumés dans [l’état du projet](etat-projet.md); les validations détaillées et leurs limites sont conservées ci-dessous.

## Tests automatisés Node.js

Avec une installation actuelle de Node.js, lancer :

```bash
npm test
```

Le workflow [Tests et extensions](../.github/workflows/tests.yml) lance cette commande sur Node.js
22 et 24 à chaque push et pull request. Aucune dépendance npm n’est nécessaire pour la suite ; les tests des archives
utilisent aussi les commandes système `zip` et `unzip`.

Les tests couvrent aussi la génération des deux versions et les API Firefox
simulées. Après les corrections du 21 octobre 2026, le paquet Firefox a été validé avec `web-ext lint` : aucune erreur,
trois avertissements (deux insertions de HTML construit par le code et une
compatibilité minimale Android ; seule la version ordinateur est ciblée).
Les essais visuels dans Firefox restent à faire : aperçu et Échap, paramètres,
fenêtre compacte, copie d'URL, pause par site et raccourci global.

Après avoir commité et poussé les changements sur GitHub, ouvrir l’onglet
**Actions → Tests et extensions** pour consulter le résultat. Une coche verte indique que les
tests ont réussi ; une croix rouge permet d’ouvrir les journaux du test en échec.
Le workflow peut aussi être lancé manuellement depuis **Run workflow**, une fois
présent sur la branche par défaut. Ces tests ne remplacent pas les essais visuels
de l’extension dans les navigateurs.

Les tests sont regroupés dans `tests/javascript/`. `npm test` conserve la découverte automatique de Node.js. Node.js 22 et 24 sont les versions exercées par la CI actuelle. Les assertions des tests existants ont été conservées pendant le déplacement.

## Intégration dans Chromium avec API simulées

Un contrôle complémentaire avec de vraies pages locales et les scripts de
l’extension est disponible :

```bash
PLAYWRIGHT_MODULE=/chemin/vers/playwright node tests/browser/check-browser.cjs
```

Playwright est installé séparément avec `npm ci --prefix tools/ci`.
Sans `PLAYWRIGHT_MODULE`, le script utilise cette installation verrouillée.
`CHROMIUM_PATH` permet de choisir un exécutable existant ; sinon, le Chromium
installé par Playwright est utilisé. `QA_SCREENSHOT_DIR` permet d’enregistrer des captures hors du
dépôt. Aucun paquet supplémentaire n’est requis pour `npm test` ou la génération.

Ce contrôle vérifie la reprise de lecture dans une iframe d’une autre origine,
les redirections, les changements d’URL sans rechargement, les pages lentes,
les refus `X-Frame-Options`, le bouton Réessayer, la fermeture à l’ouverture d’un
onglet et l’annulation des suppressions. Les API d’extension sont simulées ; ce
contrôle complète les essais avec l’extension réellement chargée dans Chrome
et Firefox, sans les remplacer.

Le contrôle est situé dans `tests/browser/check-browser.cjs`. Il n’est pas lancé par `npm test`; `npm run test:browser` l’exécute explicitement après préparation de Playwright.

## Génération, archives et validation Firefox

```sh
npm run build
npm run package
tools/ci/node_modules/.bin/web-ext lint --source-dir dist/firefox
git diff --check
```

La génération et les archives n’exigent pas de dépendance npm applicative. Le lint nécessite l’outil optionnel installé sous `tools/ci`; les ZIP nécessitent `zip` et `unzip`. Voir [Distribution](distribution.md) pour la préparation complète des outils.

## Essais avec l’extension réellement chargée

Charger les paquets selon [Installation](installation.md), puis relever le navigateur, sa version, le contexte normal ou privé, les réglages et le résultat pour chaque scénario. Utiliser des adresses de test non sensibles.

| Parcours | Vérification attendue |
| --- | --- |
| Aperçu intégré | Alt + clic, Échap, épinglage et fermeture fonctionnent; les champs éditables et la composition IME restent utilisables. |
| Navigation | Précédent/suivant, redirection et changement d’URL mettent à jour Copier et Nouvel onglet. |
| Pages lentes ou bloquées | Le délai de confirmation propose les alternatives; une confirmation tardive rétablit la page. |
| Fenêtre compacte | Une source privée ouvre une fenêtre privée; un refus ne provoque pas un repli normal. |
| Paramètres et site source | Le bon onglet est ciblé, les brouillons sont conservés et la fermeture de la source désactive les actions de site. |
| Pause | Le même hôte partage sa pause dans un contexte, avec séparation normal/privé. |
| Redimensionnement | Après réduction puis agrandissement, panneau et barre d’actions restent accessibles; tester aussi les gestes manuels et le zoom. |
| Plusieurs paramètres | Des modifications indépendantes restent conservées; un conflit sur le même élément ne doit pas effacer un brouillon silencieusement. |
| Vue partagée | Seule l’API native est utilisée; l’indisponibilité affiche une aide sans créer de fenêtres de remplacement. |
| Données et apparence | Import/export, annulation, thèmes personnels et réduction des animations restent cohérents. |

Ne cocher une vérification réelle que lorsqu’elle a été effectuée. Un test avec des API simulées ne confirme ni le contexte privé réel, ni les permissions, ni le focus, ni l’exposition de l’API native.


## Résultats des corrections — 21 octobre 2026

Les corrections locales ont été vérifiées avec 155 tests Node.js réussis sous Node.js 24.10.0, les builds et ZIP des deux navigateurs, et le lint Firefox (aucune erreur ni notice, trois avertissements). Le binaire Node temporaire a été téléchargé et vérifié par SHA-256 lors de la préparation précédente, sans installation globale. La matrice Node.js 22/24 de GitHub Actions n’a pas été exécutée à distance.

Le contrôle existant `tests/browser/check-browser.cjs` a réussi après les corrections principales : reprise de lecture, redimensionnement, fermeture immédiate, pages lentes et bloquées, annulation des suppressions et paramètres étroits. Le contrôle ciblé complémentaire a réussi sur le dernier état des sources, y compris le message de sauvegarde partielle.

Environnement du contrôle ciblé : Google Chrome `155.0.8059.86`, Playwright `1.64.1`, serveur temporaire `http://127.0.0.1:<port-temporaire>/popup.html?sourceTabId=12`, profils isolés, dimensions `1040 × 760` et `390 × 844`. Cette adresse correspond à une exécution terminée; elle n’est pas un serveur permanent. Les API d’extension et événements d’onglets sont simulés, avec le réducteur de production partagé.

| Vérification observée | Résultat |
| --- | --- |
| Identité, contenu et rendu | Titre « Paramètres — Preview link tab », formulaire présent, aucune page vide ni écran d’erreur. |
| Conflit entre deux fenêtres | Notification livrée, brouillon local conservé, écrasement bloqué et avertissement visible. |
| Réapplication | Une valeur modifiée après le conflit est celle effectivement enregistrée. |
| Réponse différée | Second envoi ignoré; champs, éditeur de règle et nom de thème saisis pendant la requête conservés. |
| Statut de sauvegarde | Les brouillons restants sont annoncés explicitement et le toast global de succès est masqué. |
| Nom de thème | Une modification indépendante dans l’autre fenêtre ne l’efface pas. |
| Fermeture de source | Hôte et règle effacés immédiatement; commandes du site désactivées. |
| Fenêtre étroite | Aucun débordement horizontal; saisie et commandes accessibles. |
| Console | Aucune erreur ni avertissement applicatif pendant le contrôle ciblé. |

Captures inspectées : conflit sur ordinateur, brouillon sur fenêtre étroite, source fermée. Elles restent temporaires sous `/private/tmp/preview-adaptive-qa`, hors du dépôt. La connexion au navigateur intégré n’a pas pu être initialisée, car son outil d’exécution n’était pas disponible après découverte; le contrôle a utilisé le Chrome externe déjà autorisé dans cette session. Aucune dépendance supplémentaire installée.

Ces essais avec API simulées ont été exécutés pendant la correction. Le ménage documentaire ultérieur n’a pas relancé les navigateurs ni le lint. Après ce ménage : 155 tests Node.js réussis, builds et ZIP Chrome/Firefox régénérés, 87 liens locaux et ancres valides, `git diff --check` réussi. Les empreintes confirment que le code, les tests, les scripts et les ressources conservées sont inchangés; l’image rangée dans `icons/sources/` a gardé son contenu. Les détails du rangement figurent dans [l’état du projet](etat-projet.md).
