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


## Taille relative — 21 octobre 2026

Après l’ajout du format par défaut **75 % du navigateur**, 158 tests Node.js réussissent sous Node.js 24.10.0. Ils vérifient le défaut, le nettoyage et l’import de tous les formats, la conservation des dimensions personnalisées, les proportions sur plusieurs zones de page, les marges et le calcul compact à partir d’une fenêtre source plus petite que l’écran, avec replis lorsque la source manque.

`npm run build`, `npm run package` et `git diff --check` réussissent. Les builds Chrome/Firefox et leurs ZIP locaux `0.2.3` sont régénérés sans changement de version.

Le contrôle `npm run test:browser` réussit avec le Chrome installé et les API d’extension simulées. Les dimensions mesurées du panneau suivent 75 % à `1040 × 760`, `1600 × 900`, `900 × 700` et `520 × 640`; les commandes restent accessibles. Les parcours de lecture, navigation, délai, refus d’intégration, nouvel onglet et annulation des suppressions passent aussi, sans erreur JavaScript. Les refus iframe provoqués par le scénario `X-Frame-Options` sont attendus. La capture du panneau avec ses alternatives a été inspectée et reste hors dépôt sous `/private/tmp/preview-relative-qa/preview-blocked.png`.

L’outil d’exécution du navigateur intégré étant indisponible après découverte, le contrôle Playwright existant du projet a été utilisé. Sa première exécution a été bloquée par le bac à sable lors de l’ouverture du port local; la relance autorisée hors bac à sable a réussi. Aucun essai avec une extension réellement chargée, lint Firefox ou contrôle CI distant n’a été exécuté pour cet ajout.

## Centrage et cadres — 21 octobre 2026

Les 159 tests Node.js passent après l’ajout du défaut centré, la conservation des
positions enregistrées et l’adaptation des tests de position et de mutation.
Le contrôle Playwright inclut désormais le centrage après redimensionnement,
l’accès à la barre d’actions, les rayons intérieurs calculés dans le DOM et les
contours de focus du panneau et des commandes. `QA_SCREENSHOT_DIR` permet aussi
de capturer le cadre arrondi sur l’article local. Son exécution réussit, avec
centrage mesuré à `1040 × 760`, `1600 × 900`, `900 × 700` et `520 × 640`.
La navigation par Tab affiche un contour sur la commande active, tandis que le
dialogue conserve le focus initial sans contour parasite. Le premier test de
focus utilisait seulement `focus()` après un clic; il a été adapté pour exercer
une vraie touche Tab et la modalité clavier de `:focus-visible`.

Un contrôle Playwright temporaire complémentaire vérifie les sept cadres avec
Catppuccin et une palette personnelle claire à `1440 × 1000` : panneau centré de
`1080 × 750`, rayons intérieurs cohérents, choix « aucune ombre » respecté et
plein écran sans arrondi. La miniature et les paramètres sont aussi contrôlés
à `1440 × 1000` et `390 × 844`, sans débordement horizontal ni erreur JavaScript.
Captures inspectées : cadre arrondi avec focus clavier, double contour sombre,
verre clair, miniature sur ordinateur et fenêtre étroite. Les captures restent
hors dépôt sous `/private/tmp/preview-centred-qa` et `/private/tmp/preview-frames-qa`.

`npm run build`, `npm run package` et `git diff --check` réussissent; les sorties
locales `0.2.3` sont régénérées sans changement de version. Ces contrôles utilisent
des API d’extension simulées; ils ne valident pas une installation réelle Chrome,
Firefox ou Helium. Aucun lint Firefox ni contrôle CI distant relancé pour cette
modification.

## Stabilisation du test de focus clavier — 21 octobre 2026

L’utilisateur a fourni un échec GitHub Actions sous Ubuntu dans
`tests/browser/check-browser.cjs` : après la première touche Tab depuis le
panneau, l’élément actif ne correspondait pas à un bouton `:focus-visible`.
Ce résultat provient du journal transmis; l’exécution distante n’a pas été
consultée directement sur GitHub.

Le contrôle ancre maintenant le focus sur `.peek-open`, vérifie cet ancrage,
puis utilise une vraie touche Tab. Il attend au maximum deux secondes que
`.peek-close` soit l’élément actif avec `:focus-visible`, puis contrôle son
contour `solid`. Cette séquence évite de dépendre de l’entrée dans l’iframe
depuis le panneau, dont l’ordre natif peut varier selon la plateforme, tout en
conservant la vérification réelle de la navigation et de l’indicateur clavier.
Aucun changement de CSS ni de code applicatif.

Validation locale : les 159 tests Node.js réussissent sous Node.js 24.10.0.
Le contrôle complet `npm run test:browser` réussit avec le Chrome installé sur
macOS et les API d’extension simulées : focus clavier, dimensions, navigation,
lecture, alternatives et paramètres. Aucune erreur JavaScript; les refus
`X-Frame-Options` du scénario prévu sont attendus. `git diff --check` réussit.
Cette validation locale ne reproduit pas l’environnement Ubuntu de GitHub Actions.
La CI distante n’a pas été relancée pour cette correction; les résultats
navigateur antérieurs ci-dessus restent des validations historiques distinctes.

## Automatisation de la distribution locale — 21 octobre 2026

Sous Node.js 24.10.0, les 163 tests Node.js réussissent, ainsi que `npm run build`,
`npm run package` et `git diff --check`. Les dossiers Chrome/Firefox et les ZIP
locaux `1.0.0` sont régénérés. Aucun changement de version ni publication.
Un lancement réel de `npm run dev` a également généré les deux dossiers et ZIP
`1.0.0`, annoncé la réussite, puis été arrêté avec `Ctrl+C`.

Les nouveaux tests utilisent exclusivement des copies temporaires : le CLI
actualise les manifestes des dossiers chargeables et les ZIP, conserve les
anciennes archives et exclut les fichiers périmés des archives. Une incohérence
de version échoue avant toute sortie. La surveillance détecte une modification
de version par remplacement atomique et relance un processus avec la nouvelle
version; les documents et sorties sont ignorés. Un contrôle avec génération
injectée vérifie l’absence de chevauchement, la reprise des changements reçus
pendant une génération et la reprise après une erreur suivie d’une correction.

Aucun contrôle navigateur, installation réelle, lint Firefox ou CI distante
n’a été exécuté pour ce changement d’outillage. La surveillance ne recharge pas
l’extension dans un navigateur.

## Rétention des archives locales — 21 octobre 2026

Les 165 tests Node.js réussissent sous Node.js 24.10.0. Les nouveaux scénarios
vérifient la limite de trois versions, les paires Chrome/Firefox, le tri numérique
(dont `1.10.0` après `1.9.0` et une quatrième composante), la conservation de la
version générée même plus ancienne, l’idempotence et la préservation des fichiers
étrangers, dossiers, liens symboliques et empreintes. Une génération Firefox en
échec après le ZIP Chrome préserve toutes les anciennes archives et empreintes.
Le scénario complet de génération vérifie aussi la rétention et les SHA-256.

`npm run build`, `npm run package` et `git diff --check` réussissent. Les dossiers
chargeables et ZIP locaux `1.0.0` sont régénérés; les trois versions présentes
dans `dist/packages` sont conservées. Aucun contrôle navigateur, lint Firefox,
CI distante, changement de version ou publication effectué pour cette rétention.

## Hooks Git locaux — 21 octobre 2026

Les 170 tests Node.js réussissent sous Node.js 24.10.0, ainsi que `npm run build`,
`npm run package` et `git diff --check`. Les dossiers chargeables et ZIP `1.0.1`
sont régénérés; ce numéro était déjà présent dans les sources avant les hooks.

Les nouveaux tests utilisent des dépôts Git temporaires isolés : installation
et réinstallation, préservation d’une autre configuration locale ou globale,
refus d’un hook actif existant avant écriture du runtime, chemins avec espaces,
exécution sans Node dans le PATH et arguments Git exclus de la génération.
Ils vérifient aussi la copie d’un exécutable temporaire, dont `/tmp` quand le
dossier temporaire système est différent, l’avertissement après commit et
le blocage avant push lors d’un échec. Les hooks sont invoqués directement dans
ces dépôts; aucun commit ni push du dépôt de travail n’est effectué pour le test.
La copie utilise un petit exécutable injecté dans les tests; la validation réelle
du binaire Node est faite par l’installateur à son activation.

Activation effectuée dans le clone courant : `core.hooksPath` local vaut
`.githooks`. Le Node temporaire a été copié sous `tools/local-runtime/node`,
vérifié en `v24.10.0` et confirmé ignoré par Git. L’exécution réelle
`git hook run pre-push` réussit et régénère les ZIP `1.0.1` sans effectuer de
push. Aucun commit ni push n’a été créé pour cette activation.

Aucun essai navigateur, lint Firefox ou CI distante exécuté pour ces hooks.
L’installation est propre au clone et leur génération ne valide pas les tests
ni l’identité entre répertoire de travail et commit envoyé.
