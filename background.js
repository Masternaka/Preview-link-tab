const SIZE_MAP = {
  small: { width: 640, height: 360 },
  medium: { width: 960, height: 540 },
  large: { width: 1280, height: 720 },
  full: { width: 1280, height: 720 }
};

const compactWindowIds = new Set();
const compactTabIds = new Set();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "CLOSE_COMPACT_WINDOW") {
    closeCompactWindow(sender)
      .then(ok => sendResponse({ ok }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type !== "OPEN_COMPACT_WINDOW" || !isHttpUrl(message.url)) {
    sendResponse({ ok: false });
    return;
  }

  openCompactWindow(message, sender)
    .then(() => sendResponse({ ok: true }))
    .catch(() => sendResponse({ ok: false }));

  return true;
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
  if (createdWindow?.id) {
    compactWindowIds.add(createdWindow.id);
  }
  const tabId = createdWindow?.tabs?.[0]?.id;
  if (tabId) {
    compactTabIds.add(tabId);
    enableCompactMenu(tabId);
  }
}

async function closeCompactWindow(sender) {
  const windowId = sender.tab?.windowId;
  if (!windowId || !compactWindowIds.has(windowId)) {
    return false;
  }
  await chrome.windows.remove(windowId);
  compactWindowIds.delete(windowId);
  return true;
}

chrome.windows.onRemoved.addListener(windowId => {
  compactWindowIds.delete(windowId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete" && compactTabIds.has(tabId)) {
    enableCompactMenu(tabId);
  }
});

chrome.tabs.onRemoved.addListener(tabId => {
  compactTabIds.delete(tabId);
});

function enableCompactMenu(tabId) {
  chrome.tabs.sendMessage(tabId, { type: "ENABLE_COMPACT_MENU" }).catch(() => {});
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
  const size = SIZE_MAP[sizeName] || fallback;
  const availableWidth = Math.max(520, (display?.width ?? sourceWindow?.width ?? 1280) - 48);
  const availableHeight = Math.max(420, (display?.height ?? sourceWindow?.height ?? 900) - 72);
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
  const positionName = settings?.position;
  const browserBase = {
    left: sourceWindow?.left ?? 0,
    top: sourceWindow?.top ?? 0,
    width: sourceWindow?.width ?? 1280,
    height: sourceWindow?.height ?? 900
  };
  const screenBase = display || {
    left: 0,
    top: 0,
    width: 1280,
    height: 900
  };

  if (positionName === "left") {
    return {
      left: screenBase.left + 32,
      top: screenBase.top + 32
    };
  }

  if (positionName === "center") {
    return {
      left: screenBase.left + Math.round((screenBase.width - size.width) / 2),
      top: screenBase.top + Math.round((screenBase.height - size.height) / 2)
    };
  }

  if (positionName === "viewportCenter") {
    return {
      left: browserBase.left + Math.round((browserBase.width - size.width) / 2),
      top: browserBase.top + Math.round((browserBase.height - size.height) / 2)
    };
  }

  if (positionName === "bottom") {
    return {
      left: screenBase.left + Math.round((screenBase.width - size.width) / 2),
      top: screenBase.top + Math.max(24, screenBase.height - size.height - 48)
    };
  }

  if (positionName === "custom") {
    return {
      left: screenBase.left + clampNumber(settings.customLeft, 0, 4000, 80),
      top: screenBase.top + clampNumber(settings.customTop, 0, 3000, 80)
    };
  }

  return {
    left: screenBase.left + Math.max(24, screenBase.width - size.width - 32),
    top: screenBase.top + 32
  };
}

async function getDisplayForWindow(sourceWindow) {
  if (!chrome.system?.display?.getInfo) {
    return null;
  }

  const displays = await chrome.system.display.getInfo();
  if (!displays.length) {
    return null;
  }

  const center = {
    x: (sourceWindow?.left ?? 0) + Math.round((sourceWindow?.width ?? 1280) / 2),
    y: (sourceWindow?.top ?? 0) + Math.round((sourceWindow?.height ?? 900) / 2)
  };
  const display = displays.find(item => {
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

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}
