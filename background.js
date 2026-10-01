// Chromium loads settings in its worker; Firefox lists it before this script.
if (typeof importScripts === "function") importScripts("settings.js");

// Firefox's browser namespace returns promises; its chrome namespace uses callbacks.
const extensionApi = typeof browser !== "undefined" ? browser : chrome;

const SIZE_MAP = {
  small: { width: 640, height: 360 },
  medium: { width: 960, height: 540 },
  large: { width: 1280, height: 720 }
};

const compactWindowIds = new Set();
const compactTabIds = new Set();
const CONTEXT_MENU_ID = "peek-preview-link";
const COMPACT_WINDOWS_STORAGE_KEY = "peekCompactWindows";
let compactWindowsQueue = Promise.resolve();
let siteSettingsQueue = Promise.resolve();
const PAUSED_SITES_KEY = "peekPausedSites";
let settingsWindowQueue = Promise.resolve();

extensionApi.action.onClicked.addListener(tab => {
  openSettingsWindow(tab).catch(error => console.warn("Impossible d’ouvrir les paramètres", error));
});

function openSettingsWindow(tab) {
  const operation = settingsWindowQueue.then(() => createOrFocusSettingsWindow(tab));
  settingsWindowQueue = operation.catch(() => {});
  return operation;
}

async function createOrFocusSettingsWindow(tab) {
  const url = new URL(extensionApi.runtime.getURL("popup.html"));
  if (tab?.id != null) url.searchParams.set("sourceTabId", String(tab.id));
  const windows = await extensionApi.windows.getAll({ populate: true, windowTypes: ["popup"] });
  // Reuse this tab's settings without reloading its unsaved changes. Searching
  // real windows also works after the background service worker restarts.
  const existing = windows.find(item => item.incognito === Boolean(tab?.incognito)
    && item.tabs?.some(candidate => candidate.url === url.href || candidate.pendingUrl === url.href));
  if (existing) {
    return extensionApi.windows.update(existing.id, { focused: true, ...(existing.state === "minimized" ? { state: "normal" } : {}) });
  }

  const source = tab?.windowId != null
    ? await extensionApi.windows.get(tab.windowId)
    : await extensionApi.windows.getLastFocused();
  const display = await getDisplayForWindow(source).catch(() => null);
  const available = display || source;
  const width = Math.max(320, Math.min(1040, available.width - 48));
  const height = Math.max(300, Math.min(760, available.height - 48));
  const left = Math.min(available.left + available.width - width,
    Math.max(available.left, source.left + Math.round((source.width - width) / 2)));
  const top = Math.min(available.top + available.height - height,
    Math.max(available.top, source.top + Math.round((source.height - height) / 2)));
  return extensionApi.windows.create({
    url: url.href, type: "popup", focused: true,
    incognito: Boolean(tab?.incognito), width, height, left, top
  });
}

extensionApi.runtime.onInstalled.addListener(() => {
  extensionApi.contextMenus.removeAll().then(() => {
    extensionApi.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "Preview with Preview link tab",
      contexts: ["link"]
    });
  }).catch(error => console.warn("Impossible de créer le menu contextuel", error));
});

extensionApi.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !info.linkUrl || !tab?.id) {
    return;
  }
  extensionApi.tabs
    .sendMessage(tab.id, {
      type: "PREVIEW_URL",
      url: info.linkUrl
    })
    .catch(() => {});
});

extensionApi.commands.onCommand.addListener(command => {
  if (command !== "preview-link") {
    return;
  }
  extensionApi.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    const tabId = tabs[0]?.id;
    if (!tabId) {
      return;
    }
    return extensionApi.tabs.sendMessage(tabId, { type: "PREVIEW_HOVERED_LINK" });
  }).catch(() => {});
});

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (["GET_SITE_PAUSE", "SET_SITE_PAUSE", "SET_DOMAIN_RULE"].includes(message?.type)) {
    const operation = siteSettingsQueue.then(() => handleSiteSettings(message, sender));
    siteSettingsQueue = operation.catch(() => {});
    operation.then(result => sendResponse({ ok: true, ...result }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "OPEN_URL_IN_SPLIT_VIEW") {
    openUrlInSplitView(message.url, sender)
      .then(tab => sendResponse({ ok: true, tabId: tab.id }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "CLOSE_COMPACT_WINDOW") {
    closeCompactWindow(message, sender)
      .then(ok => sendResponse({ ok }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === "OPEN_COMPACT_WINDOW") {
    if (!isHttpUrl(message.url)) {
      sendResponse({ ok: false });
      return true;
    }
    openCompactWindow(message, sender)
      .then(result => sendResponse({ ok: true, ...result }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === "OPEN_URL_IN_TAB" && isHttpUrl(message.url)) {
    extensionApi.tabs.create({ url: message.url, active: true })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  return false;
});

async function openUrlInSplitView(url, sender) {
  if (!isHttpUrl(url)) {
    throw new Error("Ce lien ne peut pas être ouvert en vue partagée.");
  }
  if (typeof extensionApi.tabs.createSplit !== "function") {
    throw new Error("Ce navigateur ne permet pas encore aux extensions d’ouvrir une vue partagée native. Ouvrez le lien dans un nouvel onglet, puis utilisez la commande « Vue partagée / Split View » du menu contextuel des onglets, si elle est disponible.");
  }
  if (sender.tab?.id == null) {
    throw new Error("Ouvrez la vue partagée depuis un onglet.");
  }
  const source = await extensionApi.tabs.get(sender.tab.id);
  if (source.splitViewId != null && source.splitViewId !== -1) {
    throw new Error("Cet onglet est déjà en vue partagée. Séparez les onglets avant de réessayer.");
  }
  try {
    return await extensionApi.tabs.create({ url, splitWithTabId: source.id, windowId: source.windowId, active: true });
  } catch {
    throw new Error("Impossible d’ouvrir la vue partagée dans cette fenêtre. Réessayez depuis un onglet d’une fenêtre normale.");
  }
}

async function openCompactWindow(message, sender) {
  const sourceWindow = sender.tab?.windowId
    ? await extensionApi.windows.get(sender.tab.windowId)
    : null;
  const display = await getDisplayForWindow(sourceWindow).catch(() => null);
  const size = clampSize(message.settings, sourceWindow, display);
  const position = getPosition(message.settings, size, sourceWindow, display);

  const createdWindow = await extensionApi.windows.create({
    url: message.url,
    type: "popup",
    focused: true,
    width: size.width,
    height: size.height,
    left: position.left,
    top: position.top
  });
  const windowId = createdWindow?.id;
  if (windowId) {
    compactWindowIds.add(windowId);
  }
  const tabId = createdWindow?.tabs?.[0]?.id;
  if (tabId) {
    compactTabIds.add(tabId);
    await rememberCompactWindow(windowId, tabId);
    enableCompactMenu(tabId, windowId);
  }
  return { windowId, tabId };
}

async function closeCompactWindow(message, sender) {
  const windowId = message?.windowId ?? sender.tab?.windowId;
  if (!windowId || !(await isCompactWindow(windowId))) {
    return false;
  }
  await extensionApi.windows.remove(windowId);
  compactWindowIds.delete(windowId);
  await forgetCompactWindow(windowId);
  return true;
}

extensionApi.windows.onRemoved.addListener(windowId => {
  compactWindowIds.delete(windowId);
  forgetCompactWindow(windowId).catch(() => {});
});

extensionApi.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    updatePauseBadge(tab).catch(() => {});
  }
  if (changeInfo.status !== "complete") {
    return;
  }
  isCompactTab(tabId).then(isCompact => {
    if (isCompact) {
      enableCompactMenu(tabId, tab.windowId);
    }
  }).catch(() => {});
});

extensionApi.tabs.onRemoved.addListener(tabId => {
  compactTabIds.delete(tabId);
  forgetCompactTab(tabId).catch(() => {});
});

async function getCompactWindows() {
  if (!extensionApi.storage?.session) {
    return {};
  }
  const stored = await extensionApi.storage.session.get(COMPACT_WINDOWS_STORAGE_KEY);
  return stored[COMPACT_WINDOWS_STORAGE_KEY] || {};
}

async function setCompactWindows(windows) {
  if (extensionApi.storage?.session) {
    await extensionApi.storage.session.set({ [COMPACT_WINDOWS_STORAGE_KEY]: windows });
  }
}

function queueCompactWindowsUpdate(update) {
  // Keep the entire read/modify/write operation ordered, including removals
  // from browser events. A failed operation must not block later updates.
  const operation = compactWindowsQueue.then(update);
  compactWindowsQueue = operation.catch(() => {});
  return operation;
}

async function rememberCompactWindow(windowId, tabId) {
  if (!windowId || !tabId) {
    return;
  }
  return queueCompactWindowsUpdate(async () => {
    const windows = await getCompactWindows();
    windows[windowId] = tabId;
    await setCompactWindows(windows);
  });
}

async function isCompactWindow(windowId) {
  await compactWindowsQueue;
  if (compactWindowIds.has(windowId)) {
    return true;
  }
  const windows = await getCompactWindows();
  return Object.prototype.hasOwnProperty.call(windows, windowId);
}

async function isCompactTab(tabId) {
  await compactWindowsQueue;
  if (compactTabIds.has(tabId)) {
    return true;
  }
  const windows = await getCompactWindows();
  return Object.values(windows).includes(tabId);
}

async function forgetCompactWindow(windowId) {
  return queueCompactWindowsUpdate(async () => {
    const windows = await getCompactWindows();
    if (!Object.prototype.hasOwnProperty.call(windows, windowId)) {
      return;
    }
    const tabId = windows[windowId];
    delete windows[windowId];
    await setCompactWindows(windows);
    compactWindowIds.delete(windowId);
    compactTabIds.delete(tabId);
  });
}

async function forgetCompactTab(tabId) {
  return queueCompactWindowsUpdate(async () => {
    const windows = await getCompactWindows();
    const windowId = Object.keys(windows).find(id => windows[id] === tabId);
    if (windowId) {
      delete windows[windowId];
      await setCompactWindows(windows);
      compactWindowIds.delete(Number(windowId));
      compactTabIds.delete(tabId);
    }
  });
}

function enableCompactMenu(tabId, windowId) {
  extensionApi.tabs
    .sendMessage(tabId, {
      type: "ENABLE_COMPACT_MENU",
      windowId: windowId ?? null
    })
    .catch(() => {});
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function clampSize(settings, sourceWindow, display) {
  const fallback = SIZE_MAP.medium;
  const sizeName = settings?.size;
  const availableWidth = Math.max(520, (display?.width ?? sourceWindow?.width ?? 1280) - 48);
  const availableHeight = Math.max(420, (display?.height ?? sourceWindow?.height ?? 900) - 72);

  if (sizeName === "full" && display) {
    return {
      width: Math.min(display.width - 24, availableWidth),
      height: Math.min(display.height - 48, availableHeight)
    };
  }
  if (sizeName === "full" && sourceWindow) {
    return { width: availableWidth, height: availableHeight };
  }

  const size = SIZE_MAP[sizeName] || fallback;
  if (sizeName === "custom") {
    return {
      width: Math.min(clampNumber(settings.customWidth, 320, 1800, fallback.width), availableWidth),
      height: Math.min(clampNumber(settings.customHeight, 240, 1200, fallback.height), availableHeight)
    };
  }
  return {
    width: Math.min(size.width, availableWidth),
    height: Math.min(size.height, availableHeight)
  };
}

function getPosition(settings, size, sourceWindow, display) {
  const screenBase = display || sourceWindow || {
    left: 0,
    top: 0,
    width: 1280,
    height: 900
  };

  return peekPanelScreenOrigin(settings, size.width, size.height, screenBase, sourceWindow);
}

async function getDisplayForWindow(sourceWindow) {
  if (!extensionApi.system?.display?.getInfo) {
    return null;
  }

  const displays = await extensionApi.system.display.getInfo();
  if (!displays.length) {
    return null;
  }

  return peekGetDisplayBounds(sourceWindow, displays);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}


function pausedSiteKey(tab) {
  if (!isHttpUrl(tab?.url)) throw new Error("Cette action est disponible sur une page web.");
  return `${tab.incognito ? "private" : "normal"}:${new URL(tab.url).hostname}`;
}

async function updatePauseBadge(tab, paused) {
  if (!extensionApi.action?.setBadgeText || tab?.id == null) return;
  if (paused == null) {
    const stored = await extensionApi.storage.session.get(PAUSED_SITES_KEY);
    paused = isHttpUrl(tab.url) && (stored[PAUSED_SITES_KEY] || []).includes(pausedSiteKey(tab));
  }
  await extensionApi.action.setBadgeText({ tabId: tab.id, text: paused ? "II" : "" });
  await extensionApi.action.setTitle({ tabId: tab.id, title: paused ? "Aperçu en pause sur ce site — cliquer pour réactiver" : "Preview link tab settings" });
}

async function handleSiteSettings(message, sender) {
  if (message.type === "SET_DOMAIN_RULE") {
    if (!isHttpUrl(message.url)) throw new Error("Adresse de site invalide.");
    const hostname = new URL(message.url).hostname;
    const stored = await extensionApi.storage.local.get({ domainRules: "" });
    const domainRules = setPeekDomainRule(stored.domainRules, hostname, message.mode);
    await extensionApi.storage.local.set({ domainRules });
    return { domainRules, hostname };
  }
  const tabId = sender.tab?.id ?? message.tabId;
  if (!Number.isInteger(tabId)) throw new Error("Ouvrez cette action depuis un onglet.");
  const tab = await extensionApi.tabs.get(tabId);
  const key = pausedSiteKey(tab);
  const stored = await extensionApi.storage.session.get(PAUSED_SITES_KEY);
  const pausedSites = new Set(Array.isArray(stored[PAUSED_SITES_KEY]) ? stored[PAUSED_SITES_KEY] : []);
  if (message.type === "SET_SITE_PAUSE") {
    if (typeof message.paused !== "boolean") throw new Error("État de pause invalide.");
    message.paused ? pausedSites.add(key) : pausedSites.delete(key);
    await extensionApi.storage.session.set({ [PAUSED_SITES_KEY]: [...pausedSites] });
    const tabs = await extensionApi.tabs.query({});
    await Promise.allSettled(tabs.filter(item => isHttpUrl(item.url) && pausedSiteKey(item) === key).map(async item => {
      await updatePauseBadge(item, message.paused).catch(() => {});
      await extensionApi.tabs.sendMessage(item.id, {
        type: "SITE_PAUSE_CHANGED", hostname: new URL(tab.url).hostname, paused: message.paused
      });
    }));
  }
  const paused = pausedSites.has(key);
  await updatePauseBadge(tab, paused).catch(() => {});
  return { paused, hostname: new URL(tab.url).hostname };
}
