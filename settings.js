const PEEK_DEFAULT_SETTINGS = {
  size: "medium",
  openMode: "overlay",
  customWidth: 920,
  customHeight: 760,
  position: "right",
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
  frameStyle: "soft",
  closeOutside: true,
  closeWithEsc: true,
  dimBackdrop: true,
  closeAfterOpen: false
};

const PEEK_SETTING_OPTIONS = {
  openMode: ["overlay", "compact"],
  size: ["small", "medium", "large", "full", "custom"],
  position: ["right", "left", "center", "viewportCenter", "bottom", "custom"],
  trigger: ["alt", "meta", "shift"],
  theme: ["system", "light", "dark", "graphite", "mint", "catppuccin", "gruvbox", "dracula", "custom"],
  animation: ["slide", "scale", "fade", "none"],
  animationSpeed: ["quick", "normal", "slow"],
  frameStyle: ["soft", "crisp", "floating", "minimal"]
};

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

  for (const [key, values] of Object.entries(PEEK_SETTING_OPTIONS)) {
    if (!values.includes(next[key])) {
      next[key] = PEEK_DEFAULT_SETTINGS[key];
    }
  }

  next.closeOutside = Boolean(next.closeOutside);
  next.closeWithEsc = Boolean(next.closeWithEsc);
  next.dimBackdrop = Boolean(next.dimBackdrop);
  next.closeAfterOpen = Boolean(next.closeAfterOpen);
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
