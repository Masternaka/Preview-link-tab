(() => {
  const ROOT_ID = "peek-preview-extension-root";
  const COMPACT_MENU_ID = "peek-compact-menu-root";
  const STATE = {
    root: null,
    panel: null,
    iframe: null,
    title: null,
    urlLabel: null,
    openButton: null,
    popupButton: null,
    helpOpenButton: null,
    helpPopupButton: null,
    settingsPanel: null,
    settingsButton: null,
    helpEl: null,
    compactMenu: null,
    compactSettings: null,
    compactSettingsButton: null,
    settings: { ...PEEK_DEFAULT_SETTINGS },
    currentUrl: ""
  };

  // Generation counter — incremented on every new preview open or close-cancel,
  // so stale animationend / setTimeout callbacks from a previous close are ignored.
  let closeId = 0;

  loadSettings().then(settings => {
    STATE.settings = settings;
    if (STATE.root) {
      applySettings();
      syncControls();
    }
  });

  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }
      const next = {};
      for (const key of Object.keys(PEEK_DEFAULT_SETTINGS)) {
        if (changes[key]) {
          next[key] = changes[key].newValue;
        }
      }
      if (Object.keys(next).length === 0) {
        return;
      }
      STATE.settings = cleanSettings({ ...STATE.settings, ...next });
      if (STATE.root) {
        applySettings();
        syncControls();
      }
      if (STATE.compactMenu) {
        applyCompactMenuSettings();
        syncCompactControls();
      }
    });
  }

  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener(message => {
      if (message?.type === "ENABLE_COMPACT_MENU") {
        ensureCompactMenu();
      }
    });
  }

  function ensureRoot() {
    if (STATE.root) {
      return STATE.root;
    }

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="peek-backdrop" data-peek-close></div>
      <section class="peek-panel" role="dialog" aria-modal="true" aria-label="Link preview">
        <header class="peek-header">
          <div class="peek-meta">
            <strong class="peek-title">Preview</strong>
            <span class="peek-url"></span>
          </div>
        </header>
        <form class="peek-settings" aria-label="Preview settings">
          <label>
            <span>Open mode</span>
            <select name="openMode">
              <option value="overlay">Embedded preview</option>
              <option value="compact">Compact window</option>
            </select>
          </label>
          <label>
            <span>Window size</span>
            <select name="size">
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="full">Full screen</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label>
            <span>Window position</span>
            <select name="position">
              <option value="right">Right</option>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="viewportCenter">Browser center</option>
              <option value="bottom">Bottom</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label>
            <span>Open shortcut</span>
            <select name="trigger">
              <option value="alt">Alt / Option + click</option>
              <option value="meta">Command / Ctrl + click</option>
              <option value="shift">Shift + click</option>
            </select>
          </label>
          <label>
            <span>Theme</span>
            <select name="theme">
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="graphite">Graphite</option>
              <option value="mint">Mint</option>
              <option value="catppuccin">Catppuccin</option>
              <option value="gruvbox">Gruvbox</option>
              <option value="dracula">Dracula</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label>
            <span>Open animation</span>
            <select name="animation">
              <option value="slide">Slide</option>
              <option value="scale">Scale</option>
              <option value="fade">Fade</option>
              <option value="none">None</option>
            </select>
          </label>
          <label>
            <span>Animation speed</span>
            <select name="animationSpeed">
              <option value="quick">Quick</option>
              <option value="normal">Normal</option>
              <option value="slow">Slow</option>
            </select>
          </label>
          <label>
            <span>Frame style</span>
            <select name="frameStyle">
              <option value="soft">Soft</option>
              <option value="crisp">Crisp</option>
              <option value="floating">Floating</option>
              <option value="minimal">Minimal</option>
            </select>
          </label>
          <label class="peek-check">
            <input type="checkbox" name="closeOutside">
            <span>Close when clicking outside</span>
          </label>
          <label class="peek-check">
            <input type="checkbox" name="closeWithEsc">
            <span>Close with Esc</span>
          </label>
          <label class="peek-check">
            <input type="checkbox" name="dimBackdrop">
            <span>Dim the page behind preview</span>
          </label>
          <label class="peek-check">
            <input type="checkbox" name="closeAfterOpen">
            <span>Close preview after opening new tab</span>
          </label>
        </form>
        <div class="peek-frame-wrap">
          <iframe class="peek-frame" title="Previewed page" referrerpolicy="strict-origin-when-cross-origin"></iframe>
          <div class="peek-help">
            <strong>Apercu bloque</strong>
            <span>Ce site refuse les apercus integres. Ouvre-le dans une fenetre compacte ou dans un nouvel onglet.</span>
            <div class="peek-help-actions">
              <button class="peek-help-popup" type="button">Fenetre compacte</button>
              <button class="peek-help-open" type="button">Nouvel onglet</button>
            </div>
          </div>
        </div>
        <div class="peek-actions">
          <button class="peek-settings-button" type="button" title="Preview settings" aria-label="Preview settings" aria-expanded="false">⚙</button>
          <button class="peek-popup" type="button" title="Open in a compact window" aria-label="Open in a compact window">▣</button>
          <button class="peek-open" type="button" title="Open in a new tab" aria-label="Open in a new tab">↗</button>
          <button class="peek-close" type="button" title="Close preview" aria-label="Close preview">×</button>
        </div>
      </section>
    `;

    document.documentElement.appendChild(root);

    STATE.root = root;
    STATE.panel = root.querySelector(".peek-panel");
    STATE.iframe = root.querySelector(".peek-frame");
    STATE.title = root.querySelector(".peek-title");
    STATE.urlLabel = root.querySelector(".peek-url");
    STATE.openButton = root.querySelector(".peek-open");
    STATE.popupButton = root.querySelector(".peek-popup");
    STATE.helpOpenButton = root.querySelector(".peek-help-open");
    STATE.helpPopupButton = root.querySelector(".peek-help-popup");
    STATE.settingsPanel = root.querySelector(".peek-settings");
    STATE.settingsButton = root.querySelector(".peek-settings-button");
    STATE.helpEl = root.querySelector(".peek-help");

    STATE.iframe.addEventListener("load", () => {
      if (!STATE.currentUrl) return;
      STATE.root.classList.remove("peek-loading");
      try {
        const frameUrl = STATE.iframe.contentDocument?.location?.href || "";
        if (frameUrl === "about:blank" || frameUrl.startsWith("chrome-error://")) {
          STATE.root.classList.add("peek-blocked");
          return;
        }
        STATE.root.classList.remove("peek-blocked");
      } catch {
        STATE.root.classList.remove("peek-blocked");
      }
    });

    root.querySelector(".peek-close").addEventListener("click", closePreview);
    root.querySelector("[data-peek-close]").addEventListener("click", () => {
      if (STATE.settings.closeOutside) {
        closePreview();
      }
    });
    STATE.openButton.addEventListener("click", () => {
      openCurrentInTab();
    });
    STATE.helpOpenButton.addEventListener("click", openCurrentInTab);
    STATE.popupButton.addEventListener("click", openCurrentInPopup);
    STATE.helpPopupButton.addEventListener("click", openCurrentInPopup);
    STATE.settingsButton.addEventListener("click", toggleSettings);
    STATE.settingsPanel.addEventListener("change", handleSettingsChange);

    applySettings();
    syncControls();

    return root;
  }

  function findLink(target) {
    if (!(target instanceof Element)) {
      return null;
    }
    return target.closest("a[href]");
  }

  function normalizeUrl(anchor) {
    try {
      const url = new URL(anchor.href, window.location.href);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return null;
      }
      return url;
    } catch {
      return null;
    }
  }

  function openPreview(anchor, url) {
    if (STATE.settings.openMode === "compact") {
      STATE.currentUrl = url.href;
      openUrlInPopup(url.href, false);
      return;
    }

    const root = ensureRoot();
    const label = anchor.textContent.trim() || anchor.getAttribute("aria-label") || "Preview";

    // Cancel any in-progress close animation so it doesn't clobber the new preview.
    closeId++;

    STATE.currentUrl = url.href;
    STATE.title.textContent = label.length > 90 ? `${label.slice(0, 87)}...` : label;
    STATE.urlLabel.textContent = url.hostname;
    STATE.iframe.removeAttribute("src");
    root.classList.add("peek-visible", "peek-loading");
    root.classList.remove("peek-settings-open", "peek-closing", "peek-blocked");
    STATE.settingsButton.setAttribute("aria-expanded", "false");

    requestAnimationFrame(() => {
      STATE.iframe.src = url.href;
    });
  }

  function doClose() {
    if (!STATE.root) return;
    STATE.root.classList.remove("peek-visible", "peek-loading", "peek-closing", "peek-blocked");
    STATE.currentUrl = "";
    STATE.iframe.removeAttribute("src");
  }

  function closePreview() {
    if (!STATE.root || !STATE.root.classList.contains("peek-visible")) {
      return;
    }

    // Skip animation when animation is disabled.
    if (STATE.settings.animation === "none") {
      doClose();
      return;
    }

    // Stamp this close attempt; stale callbacks from a cancelled close are ignored.
    const id = ++closeId;
    const guard = (fn) => () => { if (closeId === id) fn(); };

    const speedMs =
      STATE.settings.animationSpeed === "quick" ? 110
      : STATE.settings.animationSpeed === "slow" ? 300
      : 180;

    STATE.root.classList.add("peek-closing");
    STATE.root.classList.remove("peek-loading");

    const settle = guard(doClose);
    STATE.panel.addEventListener("animationend", settle, { once: true });
    // Fallback: ensures cleanup even when animation is suppressed (e.g. prefers-reduced-motion)
    // or when animationend never fires for another reason.
    setTimeout(() => {
      STATE.panel.removeEventListener("animationend", settle);
      guard(doClose)();
    }, speedMs + 60);
  }

  function openCurrentInTab() {
    if (!STATE.currentUrl) {
      return;
    }
    window.open(STATE.currentUrl, "_blank", "noopener,noreferrer");
    if (STATE.settings.closeAfterOpen) {
      closePreview();
    }
  }

  function openCurrentInPopup() {
    if (!STATE.currentUrl) {
      return;
    }
    openUrlInPopup(STATE.currentUrl, STATE.settings.closeAfterOpen);
  }

  function openUrlInPopup(url, closeAfterOpen) {
    const payload = {
      type: "OPEN_COMPACT_WINDOW",
      url,
      settings: {
        openMode: STATE.settings.openMode,
        size: STATE.settings.size,
        position: STATE.settings.position,
        customWidth: STATE.settings.customWidth,
        customHeight: STATE.settings.customHeight,
        customLeft: STATE.settings.customLeft,
        customTop: STATE.settings.customTop
      }
    };

    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      window.open(url, "_blank", "noopener,noreferrer,width=960,height=540");
      if (closeAfterOpen) {
        closePreview();
      }
      return;
    }

    chrome.runtime.sendMessage(payload, response => {
      if (chrome.runtime.lastError || !response?.ok) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      if (closeAfterOpen) {
        closePreview();
      }
    });
  }

  function toggleSettings() {
    if (!STATE.root) {
      return;
    }
    const isOpen = STATE.root.classList.toggle("peek-settings-open");
    STATE.settingsButton.setAttribute("aria-expanded", String(isOpen));
  }

  function ensureCompactMenu() {
    if (STATE.compactMenu) {
      return STATE.compactMenu;
    }

    const menu = document.createElement("div");
    menu.id = COMPACT_MENU_ID;
    menu.innerHTML = `
      <div class="peek-compact-settings">
        <label>
          <span>Mode</span>
          <select name="openMode">
            <option value="overlay">Embedded preview</option>
            <option value="compact">Compact window</option>
          </select>
        </label>
        <label>
          <span>Size</span>
          <select name="size">
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
            <option value="full">Full screen</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label>
          <span>Position</span>
          <select name="position">
            <option value="right">Right</option>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="viewportCenter">Browser center</option>
            <option value="bottom">Bottom</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label>
          <span>Theme</span>
          <select name="theme">
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="graphite">Graphite</option>
            <option value="mint">Mint</option>
            <option value="catppuccin">Catppuccin</option>
            <option value="gruvbox">Gruvbox</option>
            <option value="dracula">Dracula</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label class="peek-compact-check">
          <input type="checkbox" name="closeWithEsc">
          <span>Close with Esc</span>
        </label>
      </div>
      <div class="peek-compact-actions">
        <button class="peek-compact-settings-button" type="button" title="Settings" aria-label="Settings" aria-expanded="false">⚙</button>
        <button class="peek-compact-open" type="button" title="Open in a new tab" aria-label="Open in a new tab">↗</button>
        <button class="peek-compact-close" type="button" title="Close compact window" aria-label="Close compact window">×</button>
      </div>
    `;

    document.documentElement.appendChild(menu);
    STATE.compactMenu = menu;
    STATE.compactSettings = menu.querySelector(".peek-compact-settings");
    STATE.compactSettingsButton = menu.querySelector(".peek-compact-settings-button");

    STATE.compactSettingsButton.addEventListener("click", () => {
      const isOpen = menu.classList.toggle("peek-compact-settings-open");
      STATE.compactSettingsButton.setAttribute("aria-expanded", String(isOpen));
    });
    menu.querySelector(".peek-compact-open").addEventListener("click", () => {
      window.open(window.location.href, "_blank", "noopener,noreferrer");
    });
    menu.querySelector(".peek-compact-close").addEventListener("click", requestCompactWindowClose);
    STATE.compactSettings.addEventListener("change", handleCompactSettingsChange);

    applyCompactMenuSettings();
    syncCompactControls();
    return menu;
  }

  function applyCompactMenuSettings() {
    if (!STATE.compactMenu) {
      return;
    }
    STATE.compactMenu.dataset.theme = STATE.settings.theme;
    if (STATE.settings.theme === "custom") {
      const [r, g, b] = hexToRgbParts(STATE.settings.customBackdrop);
      STATE.compactMenu.style.setProperty("--peek-accent", STATE.settings.customAccent);
      STATE.compactMenu.style.setProperty("--peek-bg", STATE.settings.customBackground);
      STATE.compactMenu.style.setProperty("--peek-header-bg", STATE.settings.customHeader);
      STATE.compactMenu.style.setProperty("--peek-text", STATE.settings.customText);
      STATE.compactMenu.style.setProperty("--peek-muted", STATE.settings.customMuted);
      STATE.compactMenu.style.setProperty("--peek-border", STATE.settings.customBorder);
      STATE.compactMenu.style.setProperty("--peek-backdrop", `rgba(${r}, ${g}, ${b}, ${STATE.settings.customBackdropOpacity / 100})`);
    } else {
      [
        "--peek-accent",
        "--peek-bg",
        "--peek-header-bg",
        "--peek-text",
        "--peek-muted",
        "--peek-border",
        "--peek-backdrop"
      ].forEach(name => STATE.compactMenu.style.removeProperty(name));
    }
  }

  function syncCompactControls() {
    if (!STATE.compactSettings) {
      return;
    }
    STATE.compactSettings.elements.openMode.value = STATE.settings.openMode;
    STATE.compactSettings.elements.size.value = STATE.settings.size;
    STATE.compactSettings.elements.position.value = STATE.settings.position;
    STATE.compactSettings.elements.theme.value = STATE.settings.theme;
    STATE.compactSettings.elements.closeWithEsc.checked = STATE.settings.closeWithEsc;
  }

  function handleCompactSettingsChange(event) {
    const field = event.target;
    if (!(field instanceof HTMLInputElement) && !(field instanceof HTMLSelectElement)) {
      return;
    }
    STATE.settings = {
      ...STATE.settings,
      [field.name]: field.type === "checkbox" ? field.checked : field.value
    };
    applyCompactMenuSettings();
    saveSettings(STATE.settings);
  }

  function shouldOpenWithEvent(event) {
    if (STATE.settings.trigger === "meta") {
      return event.metaKey || event.ctrlKey;
    }
    if (STATE.settings.trigger === "shift") {
      return event.shiftKey;
    }
    return event.altKey;
  }

  function applySettings() {
    if (!STATE.root) {
      return;
    }
    STATE.root.dataset.size = STATE.settings.size;
    STATE.root.dataset.position = STATE.settings.position;
    STATE.root.dataset.theme = STATE.settings.theme;
    STATE.root.dataset.animation = STATE.settings.animation;
    STATE.root.dataset.animationSpeed = STATE.settings.animationSpeed;
    STATE.root.dataset.frameStyle = STATE.settings.frameStyle;
    STATE.root.dataset.dimBackdrop = String(STATE.settings.dimBackdrop);
    STATE.root.style.setProperty("--peek-custom-width", `${STATE.settings.customWidth}px`);
    STATE.root.style.setProperty("--peek-custom-height", `${STATE.settings.customHeight}px`);
    STATE.root.style.setProperty("--peek-custom-left", `${STATE.settings.customLeft}px`);
    STATE.root.style.setProperty("--peek-custom-top", `${STATE.settings.customTop}px`);

    if (STATE.settings.theme === "custom") {
      const [r, g, b] = hexToRgbParts(STATE.settings.customBackdrop);
      STATE.root.style.setProperty("--peek-accent", STATE.settings.customAccent);
      STATE.root.style.setProperty("--peek-bg", STATE.settings.customBackground);
      STATE.root.style.setProperty("--peek-header-bg", STATE.settings.customHeader);
      STATE.root.style.setProperty("--peek-frame-bg", STATE.settings.customFrame);
      STATE.root.style.setProperty("--peek-text", STATE.settings.customText);
      STATE.root.style.setProperty("--peek-muted", STATE.settings.customMuted);
      STATE.root.style.setProperty("--peek-settings-text", STATE.settings.customText);
      STATE.root.style.setProperty("--peek-border", STATE.settings.customBorder);
      STATE.root.style.setProperty("--peek-button-bg", STATE.settings.customHeader);
      STATE.root.style.setProperty("--peek-button-hover", STATE.settings.customBackground);
      STATE.root.style.setProperty("--peek-backdrop", `rgba(${r}, ${g}, ${b}, ${STATE.settings.customBackdropOpacity / 100})`);
    } else {
      [
        "--peek-accent",
        "--peek-bg",
        "--peek-header-bg",
        "--peek-frame-bg",
        "--peek-text",
        "--peek-muted",
        "--peek-settings-text",
        "--peek-border",
        "--peek-button-bg",
        "--peek-button-hover",
        "--peek-backdrop"
      ].forEach(name => STATE.root.style.removeProperty(name));
    }
  }

  function syncControls() {
    if (!STATE.settingsPanel) {
      return;
    }
    STATE.settingsPanel.elements.size.value = STATE.settings.size;
    STATE.settingsPanel.elements.openMode.value = STATE.settings.openMode;
    STATE.settingsPanel.elements.position.value = STATE.settings.position;
    STATE.settingsPanel.elements.trigger.value = STATE.settings.trigger;
    STATE.settingsPanel.elements.theme.value = STATE.settings.theme;
    STATE.settingsPanel.elements.animation.value = STATE.settings.animation;
    STATE.settingsPanel.elements.animationSpeed.value = STATE.settings.animationSpeed;
    STATE.settingsPanel.elements.frameStyle.value = STATE.settings.frameStyle;
    STATE.settingsPanel.elements.closeOutside.checked = STATE.settings.closeOutside;
    STATE.settingsPanel.elements.closeWithEsc.checked = STATE.settings.closeWithEsc;
    STATE.settingsPanel.elements.dimBackdrop.checked = STATE.settings.dimBackdrop;
    STATE.settingsPanel.elements.closeAfterOpen.checked = STATE.settings.closeAfterOpen;
  }

  function handleSettingsChange(event) {
    const field = event.target;
    if (!(field instanceof HTMLInputElement) && !(field instanceof HTMLSelectElement)) {
      return;
    }
    STATE.settings = {
      ...STATE.settings,
      [field.name]: field.type === "checkbox" ? field.checked : field.value
    };
    applySettings();
    saveSettings(STATE.settings);
  }

  function loadSettings() {
    return new Promise(resolve => {
      if (typeof chrome === "undefined" || !chrome.storage?.local) {
        resolve(readLocalStorageSettings());
        return;
      }
      chrome.storage.local.get(PEEK_DEFAULT_SETTINGS, stored => {
        if (chrome.runtime.lastError) {
          resolve(readLocalStorageSettings());
          return;
        }
        resolve(cleanSettings(stored));
      });
    });
  }

  function saveSettings(settings) {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      window.localStorage.setItem("peek-preview-settings", JSON.stringify(settings));
      return;
    }
    chrome.storage.local.set(settings);
  }

  function readLocalStorageSettings() {
    try {
      const stored = JSON.parse(window.localStorage.getItem("peek-preview-settings"));
      return cleanPeekSettings({ ...PEEK_DEFAULT_SETTINGS, ...stored });
    } catch {
      return { ...PEEK_DEFAULT_SETTINGS };
    }
  }

  function cleanSettings(settings) {
    return cleanPeekSettings(settings);
  }

  document.addEventListener(
    "click",
    event => {
      if (!shouldOpenWithEvent(event) || event.defaultPrevented) {
        return;
      }

      const anchor = findLink(event.target);
      if (!anchor) {
        return;
      }

      const url = normalizeUrl(anchor);
      if (!url) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      openPreview(anchor, url);
    },
    true
  );

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (!STATE.settings.closeWithEsc) {
        return;
      }
      if (window.top !== window) {
        window.top.postMessage({ source: "peek-preview", type: "CLOSE_PEEK_PREVIEW" }, "*");
        return;
      }
      if (STATE.root?.classList.contains("peek-settings-open")) {
        STATE.root.classList.remove("peek-settings-open");
        STATE.settingsButton?.setAttribute("aria-expanded", "false");
        return;
      }
      if (!STATE.root?.classList.contains("peek-visible")) {
        requestCompactWindowClose();
        return;
      }
      closePreview();
    }
  }, true);

  window.addEventListener("message", event => {
    if (event.data?.source !== "peek-preview" || event.data?.type !== "CLOSE_PEEK_PREVIEW") {
      return;
    }
    if (STATE.settings.closeWithEsc) {
      closePreview();
    }
  });

  function requestCompactWindowClose() {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      return;
    }
    chrome.runtime.sendMessage({ type: "CLOSE_COMPACT_WINDOW" });
  }
})();
