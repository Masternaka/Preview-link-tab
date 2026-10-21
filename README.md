# Preview link tab

Extension Manifest V3 pour consulter un lien sans quitter sa page de départ, sur Chrome/Chromium et Firefox sur ordinateur. Elle propose un aperçu intégré, une fenêtre compacte et la vue partagée native lorsque l’API du navigateur est disponible.

## Installer et utiliser

- **Chrome / Chromium** : ouvrir `chrome://extensions`, activer le mode développeur et charger la racine de ce dépôt comme extension non empaquetée.
- **Firefox** : avec Node.js, exécuter `npm run build:firefox`, puis charger `dist/firefox/manifest.json` depuis `about:debugging#/runtime/this-firefox`.
- Sur une page HTTP ou HTTPS, **Alt + clic** prévisualise un lien. Cliquer sur l’icône de l’extension ouvre les paramètres.

Les étapes de rechargement, les restrictions et les options sont détaillées dans [Installation](docs/installation.md) et [Utilisation](docs/utilisation.md).

## Documentation de référence

Depuis le 21 octobre 2026, la documentation est créée et maintenue **en Markdown dans le dépôt**. `docs/` rassemble les guides, les travaux restants, les plans, les revues et les résumés de session. Les anciennes pages Notion sont des sources historiques et ne sont plus mises à jour.

Les plans réalisés et les revues traitées sont rangés dans `docs/archives/`; les priorités actuelles figurent dans les travaux restants. Les résultats détaillés des essais sont regroupés dans le guide de vérification.

| Document | Contenu |
| --- | --- |
| [Index documentaire](docs/README.md) | Tous les guides et la provenance des documents regroupés. |
| [État du projet](docs/etat-projet.md) | État local, vérifications connues et prochaine étape. |
| [Architecture](docs/architecture.md) | Responsabilités des fichiers et structure du dépôt. |
| [Travaux restants](docs/travaux-restants.md) | Priorités et validations à terminer. |
| [Vérifications](docs/verifications.md) | Tests automatisés et essais réels dans les navigateurs. |
| [Distribution](docs/distribution.md) | Archives, GitHub Actions et publication. |
| [Résumé de session](docs/resume-session.md) | Reprise du travail et décisions datées. |
| [AGENTS.md](AGENTS.md) | Consignes opérationnelles des assistants. |

## Développer et vérifier

Depuis la racine, avec Node.js 22 ou 24 :

```sh
npm test
npm run build
npm run package
git diff --check
```

Pour maintenir les dossiers chargeables et les ZIP à jour pendant le développement :

```sh
npm run dev
```

Garder cette commande active; elle génère d’abord `dist/chrome`, `dist/firefox` et `dist/packages`, puis les actualise après modification des entrées de génération. `Ctrl+C` arrête la surveillance. Recharger ensuite l’extension et les pages ouvertes dans le navigateur. `npm run package` réalise la même préparation une seule fois. Voir [Distribution](docs/distribution.md) pour les limites.

Pour générer aussi après chaque commit et avant chaque push sans garder de terminal
ouvert, exécuter une fois `npm run hooks:install` dans ce clone. Les hooks locaux
actualisent les sorties; leur échec bloque le push, mais ne défait pas un commit.
Ils utilisent les fichiers du répertoire de travail et ne lancent pas les tests.
Voir [Distribution](docs/distribution.md#génération-après-commit-et-avant-push).

Les tests JavaScript et la génération ne nécessitent aucune dépendance npm applicative. Les tests d’archives et la préparation des ZIP nécessitent `zip` et `unzip`. Les outils Playwright et `web-ext` sont optionnels et installés séparément sous `tools/ci`; voir [Vérifications](docs/verifications.md).

Les fichiers chargés par l’extension restent à la racine; les variantes de manifeste sont dans `manifests/`, les outils dans `scripts/`, les tests dans `tests/` et les sorties non versionnées dans `dist/`. Les mêmes scripts et styles servent aux deux navigateurs.

## Limites

Certains sites refusent les iframes ou empêchent le script de confirmer le chargement. L’extension propose alors les alternatives prévues. La vue partagée dépend de l’API réellement exposée, sans remplacement par deux fenêtres. Firefox cible la version ordinateur 140 ou ultérieure; le chargement temporaire doit être renouvelé après redémarrage. Une distribution permanente Firefox nécessite une signature Mozilla.

Les tests avec des API simulées complètent les essais de l’extension réellement chargée dans Chrome et Firefox. Aucun commit, push ou publication n’est effectué automatiquement par une demande de modification.
