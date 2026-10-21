# Installation et rechargement

Depuis la racine du dépôt, utiliser les commandes ci-dessous.

## Chrome / Chromium

1. Ouvrir `chrome://extensions`.
2. Activer le **Mode développeur**.
3. Cliquer sur **Charger l'extension non empaquetée**.
4. Sélectionner la racine du dépôt, qui contient `manifest.json`, ou le dossier généré `dist/chrome` après `npm run build:chrome`.
5. Sur une page web, **Alt + clic** sur un lien pour le prévisualiser (le raccourci est configurable).

## Firefox

La version Firefox utilise les mêmes scripts et styles, avec un manifeste adapté.
Firefox **140 ou ultérieur** est ciblé sur ordinateur.

1. Avec Node.js installé, lancer `npm run build:firefox` dans ce dossier.
2. Ouvrir `about:debugging#/runtime/this-firefox` dans Firefox.
3. Cliquer sur **Charger un module complémentaire temporaire**.
4. Sélectionner `dist/firefox/manifest.json`.
5. Sur une page web HTTP ou HTTPS, essayer **Alt + clic** sur un lien.

Le chargement temporaire dure jusqu'au redémarrage de Firefox. Après chaque
modification des sources, relancer la génération puis cliquer sur **Recharger**
dans `about:debugging`. Recharger aussi les pages web déjà ouvertes.
Une installation permanente nécessitera une version signée par Mozilla.

La version Firefox conserve les aperçus intégrés, les fenêtres compactes,
les paramètres, les thèmes et les règles par site. Le script d'arrière-plan utilise
`background.scripts` et les API à promesses de Firefox. Sans API d'affichage,
le placement et la taille des fenêtres compactes se basent sur la fenêtre du
navigateur, y compris sur un écran secondaire. Le mode plein écran compact
remplit cette fenêtre avec des marges ; il ne passe pas le navigateur en plein écran.
La vue partagée conserve le contrôle de disponibilité de l'API native et affiche
le message explicatif si celle-ci est absente.

Les permissions d'accès aux sites peuvent être ajustées dans `about:addons`.
Les pages internes du navigateur et certains sites protégés par Firefox ne
permettent pas l'exécution des scripts de l'extension.

## Générer les deux versions

```bash
npm run build
```

Cette commande copie les fichiers nécessaires dans `dist/chrome` et
`dist/firefox`. `manifest.json` reste la source du manifeste Chrome ;
`manifests/firefox.json` remplace les clés propres à Firefox. Les dossiers
générés ne sont pas versionnés. Les archives et les workflows de publication sont décrits dans [Distribution](distribution.md).

## Après une modification

Recharger l’extension puis les pages déjà ouvertes pour remplacer leurs scripts. Une installation sous `dist/` exige aussi de relancer `npm run build`. La version de référence est celle de `manifest.json` et `package.json`; ne pas se fier à une ancienne note de mise à jour.

Pour les vérifications privées, autoriser explicitement l’extension à fonctionner en navigation privée dans un profil de test. Voir [les vérifications](verifications.md).
