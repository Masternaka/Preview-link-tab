const PEEK_DEFAULT_SETTINGS = {
  size: "medium",
  openMode: "overlay",
  customWidth: 920,
  customHeight: 760,
  position: "topRight",
  customLeft: 80,
  customTop: 80,
  trigger: "alt",
  theme: "catppuccin",
  savedThemes: [],
  customAccent: "#2563eb",
  customBackground: "#f8fafc",
  customHeader: "#ffffff",
  customFrame: "#ffffff",
  customText: "#0f172a",
  customMuted: "#64748b",
  customBorder: "#cbd5e1",
  customBackdrop: "#111827",
  customBackdropOpacity: 32,
  animation: "slide",
  animationSpeed: "normal",
  frameStyle: "rounded",
  panelShadow: "default",
  closeOutside: true,
  closeWithEsc: true,
  dimBackdrop: true,
  closeAfterOpen: false,
  domainListMode: "off",
  domainList: "",
  middleClick: false,
  domainRules: "",
  autoCompactFallback: true,
  compactFallbackDomains: "",
  backdropOpacity: 35,
  backdropBlur: 0,
  backdropMode: "dim"
};

const PEEK_SETTING_OPTIONS = {
  openMode: ["overlay", "compact", "split"],
  size: ["small", "medium", "large", "full", "custom"],
  position: ["topRight", "bottomRight", "topLeft", "bottomLeft", "center", "custom"],
  trigger: ["alt", "meta", "shift"],
  theme: ["catppuccin", "nordic", "nord", "gruvbox", "tokyoNight", "dracula", "everforest", "custom"],
  animation: ["slide", "slideUp", "slideDown", "scale", "fade", "bounce", "blur", "none"],
  animationSpeed: ["instant", "quick", "normal", "relaxed", "slow", "leisurely"],
  frameStyle: ["rounded", "square", "glass", "outlined", "roundedLarge", "borderless", "double"],
  panelShadow: ["default", "none", "subtle", "medium", "strong", "dramatic", "ambient", "crisp", "glow"],
  domainListMode: ["off", "blacklist", "whitelist"],
  backdropMode: ["dim", "blur"]
};

const PEEK_ANIMATION_SPEED_MS = {
  instant: 70,
  quick: 160,
  normal: 300,
  relaxed: 420,
  slow: 560,
  leisurely: 720
};

function peekAnimationDurationMs(settings) {
  if (!settings || settings.animation === "none") {
    return 0;
  }
  return PEEK_ANIMATION_SPEED_MS[settings.animationSpeed] ?? PEEK_ANIMATION_SPEED_MS.normal;
}

// Official palette sources and variants: THEMES.md. Shared by both preview interfaces.
const PEEK_THEME_PRESETS = {
  "catppuccin": {
    "accent": "#cba6f7",
    "bg": "#1e1e2e",
    "header-bg": "#1e1e2e",
    "frame-bg": "#181825",
    "text": "#cdd6f4",
    "muted": "#a6adc8",
    "border": "#45475a",
    "button-bg": "#313244",
    "button-hover": "#45475a",
    "backdrop-color": "#11111b"
  },
  "nordic": {
    "accent": "#88c0d0",
    "bg": "#242933",
    "header-bg": "#1e222a",
    "frame-bg": "#191d24",
    "text": "#bbc3d4",
    "muted": "#bbc3d4",
    "border": "#434c5e",
    "button-bg": "#2e3440",
    "button-hover": "#3b4252",
    "backdrop-color": "#191d24"
  },
  "nord": {
    "accent": "#88c0d0",
    "bg": "#2e3440",
    "header-bg": "#3b4252",
    "frame-bg": "#2e3440",
    "text": "#eceff4",
    "muted": "#d8dee9",
    "border": "#4c566a",
    "button-bg": "#3b4252",
    "button-hover": "#434c5e",
    "backdrop-color": "#2e3440"
  },
  "gruvbox": {
    "accent": "#fabd2f",
    "bg": "#282828",
    "header-bg": "#282828",
    "frame-bg": "#1d2021",
    "text": "#ebdbb2",
    "muted": "#bdae93",
    "border": "#665c54",
    "button-bg": "#3c3836",
    "button-hover": "#504945",
    "backdrop-color": "#1d2021"
  },
  "tokyoNight": {
    "accent": "#7aa2f7",
    "bg": "#1a1b26",
    "header-bg": "#1a1b26",
    "frame-bg": "#16161e",
    "text": "#c0caf5",
    "muted": "#a9b1d6",
    "border": "#3b4261",
    "button-bg": "#24283b",
    "button-hover": "#292e42",
    "backdrop-color": "#16161e"
  },
  "dracula": {
    "accent": "#bd93f9",
    "bg": "#282a36",
    "header-bg": "#282a36",
    "frame-bg": "#282a36",
    "text": "#f8f8f2",
    "muted": "#f8f8f2",
    "border": "#6272a4",
    "button-bg": "#44475a",
    "button-hover": "#6272a4",
    "backdrop-color": "#282a36"
  },
  "everforest": {
    "accent": "#a7c080",
    "bg": "#2d353b",
    "header-bg": "#343f44",
    "frame-bg": "#232a2e",
    "text": "#d3c6aa",
    "muted": "#9da9a0",
    "border": "#56635f",
    "button-bg": "#343f44",
    "button-hover": "#3d484d",
    "backdrop-color": "#232a2e"
  }
};

const PEEK_THEME_COLOR_ROLES = {
  customAccent: "accent", customBackground: "bg", customHeader: "header-bg",
  customFrame: "frame-bg", customText: "text", customMuted: "muted",
  customBorder: "border", customBackdrop: "backdrop-color"
};

function peekPaletteFromCustom(colors) {
  return {
    ...Object.fromEntries(Object.entries(PEEK_THEME_COLOR_ROLES).map(([key, role]) => [role, colors[key]])),
    "button-bg": colors.customHeader,
    "button-hover": colors.customBackground
  };
}

function cleanPeekSavedThemes(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  return value.slice(0, 50).flatMap(item => {
    if (!item || typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) ||
        ids.has(item.id) || typeof item.name !== "string" || !item.name.trim() ||
        !item.colors || typeof item.colors !== "object" || Array.isArray(item.colors)) return [];
    ids.add(item.id);
    const colors = Object.fromEntries(Object.keys(PEEK_THEME_COLOR_ROLES).map(key => [
      key, cleanHexColor(item.colors[key], PEEK_DEFAULT_SETTINGS[key])
    ]));
    colors.customBackdropOpacity = clampNumber(item.colors.customBackdropOpacity, 0, 85, 32);
    return [{ id: item.id, name: item.name.trim().slice(0, 80), colors }];
  });
}

function populatePeekSavedThemes(select, settings) {
  if (!select) return;
  select.querySelector('[data-saved-themes]')?.remove();
  if (!settings.savedThemes?.length) return;
  const group = document.createElement("optgroup");
  group.label = "Mes thèmes";
  group.dataset.savedThemes = "true";
  for (const item of settings.savedThemes) {
    const option = document.createElement("option");
    option.value = `saved:${item.id}`;
    option.textContent = item.name;
    group.appendChild(option);
  }
  select.appendChild(group);
}

function applyPeekTheme(element, theme, settings = PEEK_DEFAULT_SETTINGS) {
  const custom = theme === "custom" ? cleanPeekSettings(settings) : null;
  const saved = settings.savedThemes?.find(item => `saved:${item.id}` === theme);
  const colors = custom || saved?.colors;
  const palette = colors ? peekPaletteFromCustom(colors) : PEEK_THEME_PRESETS[theme] || PEEK_THEME_PRESETS.catppuccin;
  const opacity = (colors ? colors.customBackdropOpacity : 50) / 100;
  for (const [role, color] of Object.entries(palette)) {
    if (role === "backdrop-color") {
      const rgb = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
      element.style.setProperty("--peek-backdrop-color", rgb.join(", "));
      element.style.setProperty("--peek-backdrop", `rgba(${rgb.join(", ")}, ${opacity})`);
    } else {
      element.style.setProperty(`--peek-${role}`, color);
    }
  }
  element.style.setProperty("--peek-settings-text", palette.text);
  element.style.setProperty("--peek-select-arrow", `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='${palette.muted.replace('#', '%23')}' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`);
  const [r, g, b] = [1, 3, 5].map(offset => parseInt(palette.bg.slice(offset, offset + 2), 16));
  const isLight = (0.2126 * r + 0.7152 * g + 0.0722 * b) > 150;
  element.style.setProperty("color-scheme", isLight ? "light" : "dark");
  element.style.setProperty("--peek-shadow-rgb", isLight ? "15, 23, 42" : "0, 0, 0");
  // Theme defaults may tint a shadow, but must never override the selected style.
  element.style.setProperty("--peek-theme-shadow-opacity", isLight ? ".24" : ".42");
  if (settings.backdropMode !== "blur") {
    element.style.setProperty("--peek-backdrop-opacity", String(colors ? opacity : settings.backdropOpacity / 100));
  }
}

function cleanPeekSettings(settings) {
  const next = Object.fromEntries(Object.entries(PEEK_DEFAULT_SETTINGS).map(([key, fallback]) => [
    key, settings && Object.hasOwn(settings, key) ? settings[key] : fallback
  ]));
  // Drop the removed hover option when importing older settings.
  delete next.hoverPreviewDelay;

  if (next.position === "right") {
    next.position = "topRight";
  } else if (next.position === "left") {
    next.position = "topLeft";
  } else if (next.position === "bottom") {
    next.position = "bottomRight";
  } else if (next.position === "viewportCenter") {
    next.position = "center";
  }

  if (["soft", "floating", "elevated"].includes(next.frameStyle)) {
    next.frameStyle = "rounded";
  } else if (["crisp", "minimal", "flat"].includes(next.frameStyle)) {
    next.frameStyle = "square";
  }

  next.savedThemes = cleanPeekSavedThemes(next.savedThemes);
  for (const [key, values] of Object.entries(PEEK_SETTING_OPTIONS)) {
    if (key === "theme" && next.savedThemes.some(item => `saved:${item.id}` === next.theme)) continue;
    if (!values.includes(next[key])) {
      next[key] = PEEK_DEFAULT_SETTINGS[key];
    }
  }

  next.closeOutside = cleanBoolean(next.closeOutside, PEEK_DEFAULT_SETTINGS.closeOutside);
  next.closeWithEsc = cleanBoolean(next.closeWithEsc, PEEK_DEFAULT_SETTINGS.closeWithEsc);
  next.dimBackdrop = cleanBoolean(next.dimBackdrop, PEEK_DEFAULT_SETTINGS.dimBackdrop);
  next.closeAfterOpen = cleanBoolean(next.closeAfterOpen, PEEK_DEFAULT_SETTINGS.closeAfterOpen);
  next.middleClick = cleanBoolean(next.middleClick, PEEK_DEFAULT_SETTINGS.middleClick);
  next.autoCompactFallback = cleanBoolean(next.autoCompactFallback, PEEK_DEFAULT_SETTINGS.autoCompactFallback);
  next.domainList = typeof next.domainList === "string" ? next.domainList : PEEK_DEFAULT_SETTINGS.domainList;
  next.domainRules = typeof next.domainRules === "string" ? next.domainRules : PEEK_DEFAULT_SETTINGS.domainRules;
  next.compactFallbackDomains = typeof next.compactFallbackDomains === "string" ? next.compactFallbackDomains : PEEK_DEFAULT_SETTINGS.compactFallbackDomains;
  next.backdropOpacity = clampNumber(next.backdropOpacity, 0, 100, PEEK_DEFAULT_SETTINGS.backdropOpacity);
  next.backdropBlur = clampNumber(next.backdropBlur, 0, 100, PEEK_DEFAULT_SETTINGS.backdropBlur);
  if (!PEEK_SETTING_OPTIONS.backdropMode.includes(next.backdropMode)) {
    next.backdropMode = PEEK_DEFAULT_SETTINGS.backdropMode;
  }
  if (!PEEK_SETTING_OPTIONS.domainListMode.includes(next.domainListMode)) {
    next.domainListMode = PEEK_DEFAULT_SETTINGS.domainListMode;
  }
  next.customWidth = clampNumber(next.customWidth, 320, 1800, PEEK_DEFAULT_SETTINGS.customWidth);
  next.customHeight = clampNumber(next.customHeight, 240, 1200, PEEK_DEFAULT_SETTINGS.customHeight);
  next.customLeft = clampNumber(next.customLeft, 0, 4000, PEEK_DEFAULT_SETTINGS.customLeft);
  next.customTop = clampNumber(next.customTop, 0, 3000, PEEK_DEFAULT_SETTINGS.customTop);
  next.customBackdropOpacity = clampNumber(next.customBackdropOpacity, 0, 85, PEEK_DEFAULT_SETTINGS.customBackdropOpacity);
  next.customAccent = cleanHexColor(next.customAccent, PEEK_DEFAULT_SETTINGS.customAccent);
  next.customBackground = cleanHexColor(next.customBackground, PEEK_DEFAULT_SETTINGS.customBackground);
  next.customHeader = cleanHexColor(next.customHeader, PEEK_DEFAULT_SETTINGS.customHeader);
  next.customFrame = cleanHexColor(next.customFrame, PEEK_DEFAULT_SETTINGS.customFrame);
  next.customText = cleanHexColor(next.customText, PEEK_DEFAULT_SETTINGS.customText);
  next.customMuted = cleanHexColor(next.customMuted, PEEK_DEFAULT_SETTINGS.customMuted);
  next.customBorder = cleanHexColor(next.customBorder, PEEK_DEFAULT_SETTINGS.customBorder);
  next.customBackdrop = cleanHexColor(next.customBackdrop, PEEK_DEFAULT_SETTINGS.customBackdrop);
  return next;
}

function parsePeekSettingsImport(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
      !Object.keys(PEEK_DEFAULT_SETTINGS).some(key => Object.hasOwn(parsed, key))) {
    throw new Error("Le fichier doit contenir un objet de réglages de l’extension.");
  }
  return cleanPeekSettings(parsed);
}

function cleanBoolean(value, fallback) {
  if (value === true || value === "true") {
    return true;
  }
  if (value === false || value === "false") {
    return false;
  }
  return fallback;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}

function cleanHexColor(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : fallback;
}

function hexToRgbParts(hex) {
  const clean = cleanHexColor(hex, "#000000").slice(1);
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16)
  ];
}

function parseDomainList(value) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  return value
    .split(/[\n,;]+/)
    .map(normalizeDomainEntry)
    .filter(Boolean);
}

function normalizeDomainEntry(value) {
  if (typeof value !== "string") {
    return "";
  }
  let entry = value.trim().toLowerCase().replace(/^\*\./, "");
  if (!entry) {
    return "";
  }
  try {
    if (!/^[a-z][a-z\d+.-]*:\/\//i.test(entry)) {
      entry = `https://${entry.replace(/^\/\//, "")}`;
    }
    return new URL(entry).hostname.replace(/\.$/, "");
  } catch {
    return "";
  }
}

function parseDomainRules(value) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  return value
    .split(/[\n,;]+/)
    .map(line => line.trim())
    .map(line => {
      const match = line.match(/^(.+?)\s*(?:=|:)\s*(overlay|compact|split|blocked)\s*$/i);
      if (!match) {
        return null;
      }
      const domain = normalizeDomainEntry(match[1]);
      return domain ? { domain, mode: match[2].toLowerCase() } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.domain.length - a.domain.length);
}

function setPeekDomainRule(value, hostname, mode) {
  const domain = normalizeDomainEntry(hostname);
  if (!domain || !["default", "overlay", "compact", "split", "blocked"].includes(mode)) {
    throw new Error("Règle de site invalide.");
  }
  const lines = (typeof value === "string" ? value : "").split(/[\n,;]+/).filter(line => {
    const rule = parseDomainRules(line)[0];
    return !rule || rule.domain !== domain;
  }).map(line => line.trim()).filter(Boolean);
  if (mode !== "default") lines.push(`${domain} = ${mode}`);
  return lines.join("\n");
}

function hostMatchesDomain(host, domain) {
  if (!host || !domain) {
    return false;
  }
  return host === domain || host.endsWith(`.${domain}`);
}

function peekGetDisplayBounds(sourceWindow, displays) {
  if (!displays?.length) {
    return { left: 0, top: 0, width: 1280, height: 900 };
  }

  const center = {
    x: (sourceWindow?.left ?? 0) + Math.round((sourceWindow?.width ?? 1280) / 2),
    y: (sourceWindow?.top ?? 0) + Math.round((sourceWindow?.height ?? 900) / 2)
  };
  const display =
    displays.find(item => {
      const bounds = item.workArea || item.bounds;
      return (
        center.x >= bounds.left &&
        center.x <= bounds.left + bounds.width &&
        center.y >= bounds.top &&
        center.y <= bounds.top + bounds.height
      );
    }) || displays[0];
  const bounds = display.workArea || display.bounds;
  return {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height
  };
}

/** Screen coordinates for overlay/compact panel (same rules as background getPosition). */
const PEEK_OVERLAY_CSS_ANCHORS = new Set(["topRight", "bottomRight", "topLeft", "bottomLeft"]);

function peekOverlayUsesCssAnchor(position) {
  return PEEK_OVERLAY_CSS_ANCHORS.has(position);
}

/** Position de repli dans le viewport de l'onglet (aperçu intégré). */
function peekOverlayViewportPosition(settings, panelWidth, panelHeight, viewportWidth, viewportHeight) {
  const vw = Math.max(320, viewportWidth ?? 1280);
  const vh = Math.max(240, viewportHeight ?? 900);
  const position = settings?.position || "topRight";

  if (position === "center") {
    return {
      left: Math.round((vw - panelWidth) / 2),
      top: Math.round((vh - panelHeight) / 2)
    };
  }

  if (position === "topLeft") {
    return { left: 32, top: 32 };
  }

  if (position === "bottomLeft") {
    return {
      left: 32,
      top: Math.max(24, vh - panelHeight - 24)
    };
  }

  if (position === "bottomRight") {
    return {
      left: Math.max(24, vw - panelWidth - 32),
      top: Math.max(24, vh - panelHeight - 24)
    };
  }

  if (position === "custom") {
    return {
      left: clampNumber(settings.customLeft, 0, Math.max(0, vw - panelWidth), 80),
      top: clampNumber(settings.customTop, 0, Math.max(0, vh - panelHeight), 80)
    };
  }

  return {
    left: Math.max(24, vw - panelWidth - 32),
    top: 32
  };
}

/** Estimated panel size before layout (matches overlay CSS min() rules). */
function peekEstimateOverlayPanelSize(settings, viewportWidth, viewportHeight) {
  const vw = Math.max(320, viewportWidth ?? 1280);
  const vh = Math.max(240, viewportHeight ?? 900);
  const sizeName = settings?.size || "medium";
  let width = 960;
  let height = 540;

  if (sizeName === "small") {
    width = 640;
    height = 360;
  } else if (sizeName === "large") {
    width = 1280;
    height = 720;
  } else if (sizeName === "custom") {
    width = clampNumber(settings.customWidth, 320, 1800, 920);
    height = clampNumber(settings.customHeight, 240, 1200, 760);
  }

  if (sizeName === "full") {
    return { width: vw, height: vh };
  }

  return {
    width: Math.min(width, vw - (sizeName === "large" ? 40 : 64)),
    height: Math.min(height, vh - 128)
  };
}

function peekPanelScreenOrigin(settings, panelWidth, panelHeight, screenBase, browserWindow) {
  const positionName = settings.position;
  const screen = screenBase || { left: 0, top: 0, width: 1280, height: 900 };
  const browser = browserWindow || screen;

  if (positionName === "topLeft") {
    return { left: screen.left + 32, top: screen.top + 32 };
  }

  if (positionName === "center") {
    return {
      left: browser.left + Math.round((browser.width - panelWidth) / 2),
      top: browser.top + Math.round((browser.height - panelHeight) / 2)
    };
  }

  if (positionName === "bottomLeft") {
    return {
      left: screen.left + 32,
      top: screen.top + Math.max(24, screen.height - panelHeight - 48)
    };
  }

  if (positionName === "bottomRight") {
    return {
      left: screen.left + Math.max(24, screen.width - panelWidth - 32),
      top: screen.top + Math.max(24, screen.height - panelHeight - 48)
    };
  }

  if (positionName === "custom") {
    return {
      left: screen.left + clampNumber(settings.customLeft, 0, 4000, 80),
      top: screen.top + clampNumber(settings.customTop, 0, 3000, 80)
    };
  }

  return {
    left: screen.left + Math.max(24, screen.width - panelWidth - 32),
    top: screen.top + 32
  };
}

function isPeekAllowedForHost(hostname, settings) {
  const host = (hostname || "").toLowerCase();
  const mode = settings?.domainListMode || "off";
  const list = parseDomainList(settings?.domainList);
  if (mode === "off" || list.length === 0) {
    return true;
  }
  const matched = list.some(domain => hostMatchesDomain(host, domain));
  if (mode === "blacklist") {
    return !matched;
  }
  if (mode === "whitelist") {
    return matched;
  }
  return true;
}

function getDomainRule(hostname, settings) {
  const host = (hostname || "").toLowerCase();
  return parseDomainRules(settings?.domainRules).find(rule => hostMatchesDomain(host, rule.domain)) || null;
}

const PEEK_BUILTIN_BLOCKED_DOMAINS = [
  "google.com", "google.fr", "google.ca", "google.co.uk", "google.com.br", "google.co.jp",
  "youtube.com", "youtu.be",
  "github.com",
  "facebook.com",
  "instagram.com",
  "twitter.com", "x.com",
  "linkedin.com",
  "reddit.com",
  "netflix.com",
  "amazon.com", "amazon.fr", "amazon.ca", "amazon.co.uk",
  "yahoo.com",
  "microsoft.com", "live.com", "outlook.com",
  "apple.com",
  "pinterest.com",
  "zoom.us",
  "slack.com",
  "trello.com",
  "spotify.com",
  "twitch.tv"
];

function shouldAutoCompact(urlObj, settings) {
  if (!settings || !settings.autoCompactFallback) {
    return false;
  }
  const host = (urlObj?.hostname || "").toLowerCase();
  
  // Check custom user domains first
  const customList = parseDomainList(settings.compactFallbackDomains);
  if (customList.some(domain => hostMatchesDomain(host, domain))) {
    return true;
  }
  
  // Check built-in list
  return PEEK_BUILTIN_BLOCKED_DOMAINS.some(domain => hostMatchesDomain(host, domain));
}
