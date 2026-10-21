# Revue générale — 21 octobre 2026

> Archive : constats antérieurs aux correctifs locaux. Pour les corrections et validations restantes, consulter [l’état actuel](../etat-projet.md).

Source : [rapport Notion](https://app.notion.com/p/40053e9aab0580f0b219f3ee86db14a5), rapatrié le 21 octobre 2026.

Ce rapport concerne le commit `61dd7b3`, avant les corrections locales déjà présentes. Les numéros de ligne et les limites d’exécution ci-dessous sont historiques; ils ne décrivent pas les résultats actuels. Voir [l’état du projet](../etat-projet.md).

La revue générale avec **Sol 6.1, niveau Moyen**, a relevé **quatre problèmes** dans la révision `61dd7b3`.

1. **P1 — Le mode compact peut sortir de la navigation privée.**
   [background.js (line 177)](../../background.js) : depuis un onglet privé, la création de fenêtre omet `incognito`. Chrome peut donc ouvrir l’URL dans une fenêtre normale et l’exposer à son historique. Transmettre explicitement le contexte privé de l’onglet source.

2. **P2 — Les paramètres sont inaccessibles depuis une fenêtre privée Chrome.**
   [background.js (line 59)](../../background.js) : le code ouvre `popup.html` dans une fenêtre privée, mais le mode `spanning` implicite du manifeste interdit ce chargement. Adapter le mode de navigation privée ou ouvrir les paramètres dans une fenêtre normale. [Restriction documentée par Chrome](https://developer.chrome.com/docs/extensions/reference/manifest/incognito).

3. **P2 — L’aperçu peut déborder après réduction de la fenêtre.**
   [content.js (line 974)](../../content.js) : le rappel temporisé désactive le recalcul des dimensions. Un panneau ouvert dans une grande fenêtre conserve alors sa taille après réduction, rendant une partie du contenu inaccessible. Préserver le recalcul lors du redimensionnement.

4. **P2 — Une ancienne fenêtre de paramètres peut effacer des réglages récents.**
   [popup.js (line 194)](../../popup.js) : chaque formulaire sauvegarde toutes ses préférences sans suivre les changements externes. Sauvegarder une fenêtre A après avoir ajouté une règle ou un thème dans B peut supprimer cet ajout. Enregistrer uniquement les champs modifiés et fusionner les collections actuelles.

Trois reproductions ciblées ont été exécutées avec JavaScriptCore et des API simulées. `git diff --check` réussit. **La suite `npm test` n’a pas pu démarrer**, car Node.js/npm sont absents; aucun essai réel dans Chrome ou Firefox n’a été effectué.

Aucun fichier n’a été modifié.
