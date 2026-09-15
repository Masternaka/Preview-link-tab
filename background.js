importScripts("settings.js");

const SIZE_MAP = {
  small: { width: 640, height: 360 },
  medium: { width: 960, height: 540 },
  large: { width: 1280, height: 720 }
};

const compactWindowIds = new Set();
const compactTabIds = new Set();
const CONTEXT_MENU_ID = "peek-preview-link";
const COMPACT_WINDOWS_STORAGE_KEY = "peekCompactWindows";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "Preview with Preview link tab",
      contexts: ["link"]
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !info.linkUrl || !tab?.id) {
    return;
  }
  chrome.tabs
    .sendMessage(tab.id, {
      type: "PREVIEW_URL",
      url: info.linkUrl
    })
    .catch(() => {});
});

chrome.commands.onCommand.addListener(command => {
  if (command !== "preview-link") {
    return;
  }
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tabId = tabs[0]?.id;
    if (!tabId) {
      return;
    }
    chrome.tabs.sendMessage(tabId, { type: "PREVIEW_HOVERED_LINK" }).catch(() => {});
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
    chrome.tabs.create({ url: message.url, active: true })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  return false;
});

async function openCompactWindow(message, sender) {
  const sourceWindow = sender.tab?.windowId
    ? await chrome.windows.get(sender.tab.windowId)
    : null;
  const display = await getDisplayForWindow(sourceWindow);
  const size = clampSize(message.settings, sourceWindow, display);
  const position = getPosition(message.settings, size, sourceWindow, display);

  const createdWindow = await chrome.windows.create({
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
  await chrome.windows.remove(windowId);
  compactWindowIds.delete(windowId);
  await forgetCompactWindow(windowId);
  return true;
}

chrome.windows.onRemoved.addListener(windowId => {
  compactWindowIds.delete(windowId);
  forgetCompactWindow(windowId).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") {
    return;
  }
  isCompactTab(tabId).then(isCompact => {
    if (isCompact) {
      enableCompactMenu(tabId, tab.windowId);
    }
  }).catch(() => {});
});

chrome.tabs.onRemoved.addListener(tabId => {
  compactTabIds.delete(tabId);
  forgetCompactTab(tabId).catch(() => {});
});

async function getCompactWindows() {
  if (!chrome.storage?.session) {
    return {};
  }
  const stored = await chrome.storage.session.get(COMPACT_WINDOWS_STORAGE_KEY);
  return stored[COMPACT_WINDOWS_STORAGE_KEY] || {};
}

async function setCompactWindows(windows) {
  if (chrome.storage?.session) {
    await chrome.storage.session.set({ [COMPACT_WINDOWS_STORAGE_KEY]: windows });
  }
}

async function rememberCompactWindow(windowId, tabId) {
  if (!windowId || !tabId) {
    return;
  }
  const windows = await getCompactWindows();
  windows[windowId] = tabId;
  await setCompactWindows(windows);
}

async function isCompactWindow(windowId) {
  if (compactWindowIds.has(windowId)) {
    return true;
  }
  const windows = await getCompactWindows();
  return Object.prototype.hasOwnProperty.call(windows, windowId);
}

async function isCompactTab(tabId) {
  if (compactTabIds.has(tabId)) {
    return true;
  }
  const windows = await getCompactWindows();
  return Object.values(windows).includes(tabId);
}

async function forgetCompactWindow(windowId) {
  const windows = await getCompactWindows();
  if (!Object.prototype.hasOwnProperty.call(windows, windowId)) {
    return;
  }
  delete windows[windowId];
  await setCompactWindows(windows);
}

async function forgetCompactTab(tabId) {
  const windows = await getCompactWindows();
  const windowId = Object.keys(windows).find(id => windows[id] === tabId);
  if (windowId) {
    delete windows[windowId];
    await setCompactWindows(windows);
  }
}

function enableCompactMenu(tabId, windowId) {
  chrome.tabs
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
  const screenBase = display || {
    left: 0,
    top: 0,
    width: 1280,
    height: 900
  };

  return peekPanelScreenOrigin(settings, size.width, size.height, screenBase, sourceWindow);
}

async function getDisplayForWindow(sourceWindow) {
  if (!chrome.system?.display?.getInfo) {
    return null;
  }

  const displays = await chrome.system.display.getInfo();
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
