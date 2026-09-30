# Thèmes

Les sept thèmes proposés utilisent les couleurs des projets ci-dessous, adaptées
aux rôles de l’interface (fond, en-tête, texte, boutons et bordures). Il ne s’agit
pas de ports officiels. Les ombres et transparences restent propres à l’extension.

| Thème | Variante et source |
| --- | --- |
| Catppuccin | [Mocha](https://github.com/catppuccin/catppuccin#-palette), accent Mauve |
| Nordic | [Nordic.nvim d’AlexvZyl](https://github.com/AlexvZyl/nordic.nvim/blob/main/lua/nordic/colors/nordic.lua), fond `#242933`, distinct de Nord |
| Nord | [Palette Nord](https://www.nordtheme.com/docs/colors-and-palettes/), fond Polar Night et accent Frost |
| Gruvbox | [Dark, contraste medium](https://github.com/morhetz/gruvbox/blob/master/colors/gruvbox.vim), accent jaune |
| Tokyo Night | [Night](https://github.com/folke/tokyonight.nvim/blob/main/lua/tokyonight/colors/night.lua), avec les couleurs héritées de [Storm](https://github.com/folke/tokyonight.nvim/blob/main/lua/tokyonight/colors/storm.lua) |
| Dracula | [Palette OSS](https://github.com/dracula/dracula-theme#color-palette), accent violet |
| Everforest | [Dark, contraste medium](https://github.com/sainnhe/everforest/blob/master/autoload/everforest.vim), accent vert |

Les palettes sont centralisées dans `PEEK_THEME_PRESETS` dans `settings.js` et
appliquées par `applyPeekTheme` à l’aperçu et au menu de la fenêtre compacte.
Elles modifient l’interface de l’extension ; les sites chargés gardent leur apparence.

Catppuccin Mocha est le thème par défaut. Les anciens choix Système, Clair,
Sombre, Graphite et Menthe sont normalisés vers Catppuccin au
chargement et à l’import. Les autres préférences sont conservées.

Le choix **Personnalisé** permet de régler manuellement les couleurs et l’opacité
de l’arrière-plan dans la popup. Les couleurs personnelles sont conservées
lorsqu’un thème connu est sélectionné, puis retrouvées en revenant à Personnalisé.

La section **Couleurs du thème** affiche la palette du thème sélectionné en
lecture seule. Ses champs deviennent modifiables avec **Personnalisé**, en
restaurant le brouillon personnel sans le remplacer par les couleurs du thème connu.
