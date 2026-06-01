const PEEK_DEFAULT_SETTINGS = {
  size: "medium",
  openMode: "overlay",
  customWidth: 920,
  customHeight: 760,
  position: "topRight",
  customLeft: 80,
  customTop: 80,
  trigger: "alt",
  theme: "system",
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
  autoCompactFallback: true,
  compactFallbackDomains: "",
  backdropOpacity: 35,
  backdropBlur: 0
};

const PEEK_SETTING_OPTIONS = {
  openMode: ["overlay", "compact"],
  size: ["small", "medium", "large", "full", "custom"],
  position: ["topRight", "bottomRight", "topLeft", "bottomLeft", "center", "custom"],
  trigger: ["alt", "meta", "shift"],
  theme: ["system", "light", "dark", "graphite", "mint", "catppuccin", "gruvbox", "dracula", "custom"],
  animation: ["slide", "slideUp", "slideDown", "scale", "fade", "bounce", "blur", "none"],
  animationSpeed: ["instant", "quick", "normal", "relaxed", "slow", "leisurely"],
  frameStyle: ["rounded", "square", "glass", "outlined"],
  panelShadow: ["default", "none", "subtle", "medium", "strong", "dramatic", "glow"],
  domainListMode: ["off", "blacklist", "whitelist"]
};

const PEEK_ANIMATION_SPEED_MS = {
  instant: 70,
  quick: 110,
  normal: 180,
  relaxed: 260,
  slow: 340,
  leisurely: 480
};

function peekAnimationDurationMs(settings) {
  if (!settings || settings.animation === "none") {
    return 0;
  }
  return PEEK_ANIMATION_SPEED_MS[settings.animationSpeed] ?? PEEK_ANIMATION_SPEED_MS.normal;
}

const PEEK_THEME_PRESETS = {
  light: {
    customAccent: "#2563eb",
    customBackground: "#f8fafc",
    customHeader: "#ffffff",
    customFrame: "#ffffff",
    customText: "#0f172a",
    customMuted: "#64748b",
    customBorder: "#cbd5e1",
    customBackdrop: "#111827",
    customBackdropOpacity: 32
  },
  dark: {
    customAccent: "#38bdf8",
    customBackground: "#111827",
    customHeader: "#111827",
    customFrame: "#0f172a",
    customText: "#f8fafc",
    customMuted: "#94a3b8",
    customBorder: "#475569",
    customBackdrop: "#030712",
    customBackdropOpacity: 56
  },
  graphite: {
    customAccent: "#f97316",
    customBackground: "#1f2937",
    customHeader: "#242f3f",
    customFrame: "#111827",
    customText: "#f9fafb",
    customMuted: "#cbd5e1",
    customBorder: "#6b7280",
    customBackdrop: "#0f172a",
    customBackdropOpacity: 38
  },
  mint: {
    customAccent: "#0f766e",
    customBackground: "#f0fdfa",
    customHeader: "#f8fffd",
    customFrame: "#ffffff",
    customText: "#042f2e",
    customMuted: "#3f6f69",
    customBorder: "#5eead4",
    customBackdrop: "#082f49",
    customBackdropOpacity: 28
  },
  catppuccin: {
    customAccent: "#cba6f7",
    customBackground: "#1e1e2e",
    customHeader: "#1e1e2e",
    customFrame: "#181825",
    customText: "#cdd6f4",
    customMuted: "#a6adc8",
    customBorder: "#cba6f7",
    customBackdrop: "#11111b",
    customBackdropOpacity: 48
  },
  gruvbox: {
    customAccent: "#fabd2f",
    customBackground: "#282828",
    customHeader: "#282828",
    customFrame: "#1d2021",
    customText: "#fbf1c7",
    customMuted: "#bdae93",
    customBorder: "#d79921",
    customBackdrop: "#282828",
    customBackdropOpacity: 50
  },
  dracula: {
    customAccent: "#bd93f9",
    customBackground: "#282a36",
    customHeader: "#282a36",
    customFrame: "#21222c",
    customText: "#f8f8f2",
    customMuted: "#bdc2d8",
    customBorder: "#bd93f9",
    customBackdrop: "#282a36",
    customBackdropOpacity: 52
  }
};

function cleanPeekSettings(settings) {
  const next = { ...PEEK_DEFAULT_SETTINGS, ...settings };

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

  for (const [key, values] of Object.entries(PEEK_SETTING_OPTIONS)) {
    if (!values.includes(next[key])) {
      next[key] = PEEK_DEFAULT_SETTINGS[key];
    }
  }

  next.closeOutside = Boolean(next.closeOutside);
  next.closeWithEsc = Boolean(next.closeWithEsc);
  next.dimBackdrop = Boolean(next.dimBackdrop);
  next.closeAfterOpen = Boolean(next.closeAfterOpen);
  next.middleClick = Boolean(next.middleClick);
  next.autoCompactFallback = Boolean(next.autoCompactFallback);
  next.domainList = typeof next.domainList === "string" ? next.domainList : PEEK_DEFAULT_SETTINGS.domainList;
  next.compactFallbackDomains = typeof next.compactFallbackDomains === "string" ? next.compactFallbackDomains : PEEK_DEFAULT_SETTINGS.compactFallbackDomains;
  next.backdropOpacity = clampNumber(next.backdropOpacity, 0, 90, PEEK_DEFAULT_SETTINGS.backdropOpacity);
  next.backdropBlur = clampNumber(next.backdropBlur, 0, 25, PEEK_DEFAULT_SETTINGS.backdropBlur);
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
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean)
    .map(entry => entry.replace(/^\*\./, ""));
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
