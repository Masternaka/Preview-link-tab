(() => {
  // In embedded documents, only relay keyboard/navigation information to the
  // top-level preview. The full interface must never be rendered in a frame.
  if (window.top !== window.self) {
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        window.top.postMessage({ source: "peek-preview", type: "CLOSE_PEEK_PREVIEW" }, "*");
      }
    }, true);
    window.top.postMessage({
      source: "peek-preview",
      type: "PEEK_FRAME_NAVIGATION",
      url: window.location.href
    }, "*");
    return;
  }

  const ROOT_ID = "peek-preview-extension-root";
  const COMPACT_MENU_ID = "peek-compact-menu-root";
  const ACTIONS_BAR_GUTTER = 64;
  const STATE = {
    root: null,
    panel: null,
    iframe: null,
    title: null,
    urlLabel: null,
    favicon: null,
    openButton: null,
    popupButton: null,
    copyButton: null,
    refreshButton: null,
    helpOpenButton: null,
    helpPopupButton: null,
    backButton: null,
    forwardButton: null,
    pinButton: null,
    settingsPanel: null,
    settingsButton: null,
    helpEl: null,
    compactMenu: null,
    compactSettings: null,
    compactSettingsButton: null,
    compactWindowId: null,
    settings: { ...PEEK_DEFAULT_SETTINGS },
    currentUrl: "",
    previouslyFocused: null,
    previewHistory: [],
    previewHistoryIndex: -1,
    isPinned: false
  };

  let closeId = 0;
  let lastHoveredAnchor = null;
  let overlayPositionFrame = 0;
  let overlayResizeTimer = 0;
  let overlayPositionAttempts = 0;
  let overlayPanelObserver = null;
  let hoverPreviewTimer = 0;
  let hoveredAnchor = null;
  let previewLoadTimer = 0;
  let settingsSaveTimer = 0;

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
        if (window.top !== window.self) {
          return;
        }
        STATE.compactWindowId = message.windowId ?? null;
        ensureCompactMenu();
        return;
      }
      if (message?.type === "PREVIEW_URL" && message.url) {
        previewUrl(message.url, "Lien");
        return;
      }
      if (message?.type === "PREVIEW_HOVERED_LINK") {
        if (lastHoveredAnchor) {
          const url = normalizeUrl(lastHoveredAnchor);
          if (url) {
            openPreview(lastHoveredAnchor, url);
          }
        }
      }
    });
  }

  document.addEventListener("pointerover", event => {
    const anchor = findLink(event.target);
    if (!anchor || anchor === hoveredAnchor) {
      return;
    }
    lastHoveredAnchor = anchor;
    hoveredAnchor = anchor;
    scheduleHoverPreview(anchor);
  }, true);

  document.addEventListener("pointerout", event => {
    const anchor = findLink(event.target);
    if (anchor && anchor === hoveredAnchor && !anchor.contains(event.relatedTarget)) {
      hoveredAnchor = null;
      window.clearTimeout(hoverPreviewTimer);
    }
  }, true);

  function ensureRoot() {
    if (STATE.root) {
      return STATE.root;
    }

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="peek-backdrop" data-peek-close></div>
      <section class="peek-panel" role="dialog" aria-modal="true" aria-label="Aperçu du lien" tabindex="-1">
        <div class="peek-resize-handle peek-resize-n" data-direction="n"></div>
        <div class="peek-resize-handle peek-resize-s" data-direction="s"></div>
        <div class="peek-resize-handle peek-resize-e" data-direction="e"></div>
        <div class="peek-resize-handle peek-resize-w" data-direction="w"></div>
        <div class="peek-resize-handle peek-resize-nw" data-direction="nw"></div>
        <div class="peek-resize-handle peek-resize-ne" data-direction="ne"></div>
        <div class="peek-resize-handle peek-resize-sw" data-direction="sw"></div>
        <div class="peek-resize-handle peek-resize-se" data-direction="se"></div>
        <header class="peek-header">
          <div class="peek-meta">
            <img class="peek-favicon" width="18" height="18" alt="" decoding="async">
            <div class="peek-meta-text">
              <strong class="peek-title">Aperçu</strong>
              <span class="peek-url"></span>
            </div>
          </div>
        </header>
        <form class="peek-settings" aria-label="Paramètres d'aperçu">
          <div class="peek-settings-tabs" role="tablist">
            <button type="button" class="peek-settings-tab peek-settings-tab-active" data-tab="display" role="tab" aria-selected="true">Affichage</button>
            <button type="button" class="peek-settings-tab" data-tab="behavior" role="tab" aria-selected="false">Comportement</button>
          </div>
          <div class="peek-settings-panel peek-settings-panel-active" data-panel="display">
            <label>
              <span>Mode d'ouverture</span>
              <select name="openMode">
                <option value="overlay">Aperçu intégré</option>
                <option value="compact">Fenêtre compacte</option>
              </select>
            </label>
            <label>
              <span>Taille</span>
              <select name="size">
                <option value="small">Petite</option>
                <option value="medium">Moyenne</option>
                <option value="large">Grande</option>
                <option value="full">Plein écran</option>
                <option value="custom">Personnalisée</option>
              </select>
            </label>
            <label>
              <span>Position</span>
              <select name="position">
                <option value="topRight">En haut à droite</option>
                <option value="bottomRight">En bas à droite</option>
                <option value="topLeft">En haut à gauche</option>
                <option value="bottomLeft">En bas à gauche</option>
                <option value="center">Centre</option>
                <option value="custom">Personnalisée</option>
              </select>
            </label>
            <label>
              <span>Thème</span>
              <select name="theme">
                <option value="system">Système</option>
                <option value="light">Clair</option>
                <option value="dark">Sombre</option>
                <option value="graphite">Graphite</option>
                <option value="mint">Menthe</option>
                <option value="catppuccin">Catppuccin</option>
                <option value="gruvbox">Gruvbox</option>
                <option value="dracula">Dracula</option>
                <option value="custom">Personnalisé</option>
              </select>
            </label>
            <label>
              <span>Animation</span>
              <select name="animation">
                <option value="slide">Glissement</option>
                <option value="slideUp">Montée</option>
                <option value="slideDown">Descente</option>
                <option value="scale">Zoom</option>
                <option value="fade">Fondu</option>
                <option value="bounce">Rebond</option>
                <option value="blur">Flou</option>
                <option value="none">Aucune</option>
              </select>
            </label>
            <label>
              <span>Vitesse</span>
              <select name="animationSpeed">
                <option value="instant">Instantanée</option>
                <option value="quick">Rapide</option>
                <option value="normal">Normale</option>
                <option value="relaxed">Détendue</option>
                <option value="slow">Lente</option>
                <option value="leisurely">Très lente</option>
              </select>
            </label>
            <label>
              <span>Cadre</span>
              <select name="frameStyle">
                <option value="rounded">Arrondi</option>
                <option value="square">Carré</option>
                <option value="glass">Verre</option>
                <option value="outlined">Contour accent</option>
              </select>
            </label>
            <label>
              <span>Ombre</span>
              <select name="panelShadow">
                <option value="default">Thème</option>
                <option value="none">Aucune</option>
                <option value="subtle">Légère</option>
                <option value="medium">Moyenne</option>
                <option value="strong">Forte</option>
                <option value="dramatic">Dramatique</option>
                <option value="glow">Lueur accent</option>
              </select>
            </label>
          </div>
          <div class="peek-settings-panel" data-panel="behavior" hidden>
            <label>
              <span>Raccourci</span>
              <select name="trigger">
                <option value="alt">Alt / Option + clic</option>
                <option value="meta">Commande / Ctrl + clic</option>
                <option value="shift">Maj + clic</option>
              </select>
            </label>
            <label class="peek-check">
              <input type="checkbox" name="middleClick">
              <span>Aussi au clic molette sur un lien</span>
            </label>
            <label class="peek-check">
              <input type="checkbox" name="closeOutside">
              <span>Fermer au clic extérieur</span>
            </label>
            <label class="peek-check">
              <input type="checkbox" name="closeWithEsc">
              <span>Fermer avec Échap</span>
            </label>
            <div class="peek-backdrop-control">
              <label><span>Arrière-plan</span></label>
              <div class="peek-backdrop-mode">
                <button type="button" class="peek-backdrop-mode-btn" data-mode="dim">🌑 Assombrissement</button>
                <button type="button" class="peek-backdrop-mode-btn" data-mode="blur">🌫 Flou</button>
              </div>
              <div class="peek-backdrop-slider-row">
                <input type="range" class="peek-backdrop-slider" name="backdropIntensity" min="0" max="100" step="1">
                <span class="peek-backdrop-value">50%</span>
              </div>
            </div>
            <label class="peek-check">
              <input type="checkbox" name="closeAfterOpen">
              <span>Fermer après ouverture externe</span>
            </label>
          </div>
        </form>
        <div class="peek-frame-wrap">
          <iframe class="peek-frame" title="Page prévisualisée" referrerpolicy="strict-origin-when-cross-origin"></iframe>
          <div class="peek-loading-skeleton" aria-hidden="true"></div>
          <div class="peek-help">
            <strong>Aperçu bloqué</strong>
            <span>Ce site refuse l'intégration. Ouvrez-le dans une fenêtre compacte ou un nouvel onglet.</span>
            <div class="peek-help-actions">
              <button class="peek-help-popup" type="button">Fenêtre compacte</button>
              <button class="peek-help-open" type="button">Nouvel onglet</button>
            </div>
          </div>
        </div>
      </div>
      </section>
      <div class="peek-actions">
        ${peekIconButton("peek-settings-button", "settings", "Paramètres", "Paramètres")}
        ${peekIconButton("peek-back", "back", "Page précédente", "Page précédente")}
        ${peekIconButton("peek-forward", "forward", "Page suivante", "Page suivante")}
        ${peekIconButton("peek-refresh", "refresh", "Actualiser", "Actualiser")}
        ${peekIconButton("peek-copy", "copy", "Copier l'URL", "Copier l'URL")}
        ${peekIconButton("peek-pin", "pin", "Épingler l'aperçu", "Épingler l'aperçu")}
        ${peekIconButton("peek-popup", "popup", "Fenêtre compacte", "Fenêtre compacte")}
        ${peekIconButton("peek-open", "external", "Nouvel onglet", "Nouvel onglet")}
        ${peekIconButton("peek-close", "close", "Fermer", "Fermer")}
      </div>
    `;

    document.documentElement.appendChild(root);

    STATE.root = root;
    STATE.panel = root.querySelector(".peek-panel");
    STATE.iframe = root.querySelector(".peek-frame");
    STATE.title = root.querySelector(".peek-title");
    STATE.urlLabel = root.querySelector(".peek-url");
    STATE.favicon = root.querySelector(".peek-favicon");
    STATE.openButton = root.querySelector(".peek-open");
    STATE.popupButton = root.querySelector(".peek-popup");
    STATE.copyButton = root.querySelector(".peek-copy");
    STATE.refreshButton = root.querySelector(".peek-refresh");
    STATE.helpOpenButton = root.querySelector(".peek-help-open");
    STATE.helpPopupButton = root.querySelector(".peek-help-popup");
    STATE.settingsPanel = root.querySelector(".peek-settings");
    STATE.settingsButton = root.querySelector(".peek-settings-button");
    STATE.helpEl = root.querySelector(".peek-help");
    STATE.backButton = root.querySelector(".peek-back");
    STATE.forwardButton = root.querySelector(".peek-forward");
    STATE.pinButton = root.querySelector(".peek-pin");

    root.querySelectorAll(".peek-settings-tab").forEach(tab => {
      tab.addEventListener("click", () => switchSettingsTab(tab.dataset.tab));
    });

    STATE.iframe.addEventListener("load", () => {
      clearPreviewLoadTimer();
      if (!STATE.currentUrl) {
        return;
      }
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
    STATE.iframe.addEventListener("error", () => setPreviewBlocked());

    root.querySelector(".peek-close").addEventListener("click", closePreview);
    root.querySelector("[data-peek-close]").addEventListener("click", () => {
      if (STATE.settings.closeOutside && !STATE.isPinned) {
        closePreview();
      }
    });
    STATE.openButton.addEventListener("click", openCurrentInTab);
    STATE.helpOpenButton.addEventListener("click", openCurrentInTab);
    STATE.popupButton.addEventListener("click", () => openCurrentInPopup(true));
    STATE.helpPopupButton.addEventListener("click", () => openCurrentInPopup(true));
    STATE.copyButton.addEventListener("click", copyCurrentUrl);
    STATE.backButton.addEventListener("click", () => navigatePreviewHistory(-1));
    STATE.forwardButton.addEventListener("click", () => navigatePreviewHistory(1));
    STATE.pinButton.addEventListener("click", togglePinnedPreview);
    STATE.refreshButton.addEventListener("click", refreshPreview);
    STATE.settingsButton.addEventListener("click", toggleSettings);
    STATE.settingsPanel.addEventListener("change", handleSettingsChange);
    root.addEventListener("keydown", trapFocus);

    // Backdrop mode buttons
    root.querySelectorAll(".peek-backdrop-mode-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode;
        STATE.settings = { ...STATE.settings, backdropMode: mode };
        applySettings();
        syncControls();
        scheduleSettingsSave();
      });
    });

    // Backdrop slider live update
    const backdropSlider = root.querySelector(".peek-backdrop-slider");
    if (backdropSlider) {
      backdropSlider.addEventListener("input", () => {
        const mode = STATE.settings.backdropMode || "dim";
        const val = Number(backdropSlider.value);
        const pct = (val / 100) * 100;
        backdropSlider.style.setProperty("--peek-slider-pct", `${pct}%`);
        const valueEl = backdropSlider.closest(".peek-backdrop-slider-row")?.querySelector(".peek-backdrop-value");
        if (valueEl) valueEl.textContent = `${val}%`;
        if (mode === "blur") {
          STATE.settings = { ...STATE.settings, backdropBlur: val };
        } else {
          STATE.settings = { ...STATE.settings, backdropOpacity: val };
        }
        applySettings();
        scheduleSettingsSave();
      });
      backdropSlider.addEventListener("change", flushSettingsSave);
    }

    initResizeListeners(root);

    applySettings();
    syncControls();

    return root;
  }

  function switchSettingsTab(tabName) {
    if (!STATE.settingsPanel) {
      return;
    }
    STATE.settingsPanel.querySelectorAll(".peek-settings-tab").forEach(tab => {
      const active = tab.dataset.tab === tabName;
      tab.classList.toggle("peek-settings-tab-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    STATE.settingsPanel.querySelectorAll(".peek-settings-panel").forEach(panel => {
      const active = panel.dataset.panel === tabName;
      panel.classList.toggle("peek-settings-panel-active", active);
      panel.hidden = !active;
    });
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

  function updateHeaderMeta(anchor, url, label) {
    const text = label.length > 90 ? `${label.slice(0, 87)}…` : label;
    STATE.title.textContent = text;
    STATE.urlLabel.textContent = url.hostname;
    STATE.urlLabel.title = url.href;
    if (STATE.favicon) {
      // Do not disclose every previewed domain to a third-party favicon service.
      STATE.favicon.src = new URL("/favicon.ico", url.origin).href;
      STATE.favicon.hidden = false;
      STATE.favicon.onerror = () => {
        STATE.favicon.hidden = true;
      };
    }
  }

  function scheduleHoverPreview(anchor) {
    window.clearTimeout(hoverPreviewTimer);
    const delay = STATE.settings.hoverPreviewDelay;
    if (!delay || STATE.root?.classList.contains("peek-visible")) {
      return;
    }
    hoverPreviewTimer = window.setTimeout(() => {
      if (hoveredAnchor !== anchor) {
        return;
      }
      const url = normalizeUrl(anchor);
      if (url) {
        openPreview(anchor, url);
      }
    }, delay);
  }

  function previewUrl(href, labelFallback) {
    try {
      const url = new URL(href, window.location.href);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return;
      }
      const fakeAnchor = { href: url.href, textContent: labelFallback, getAttribute: () => null };
      openPreview(fakeAnchor, url);
    } catch {
      /* ignore */
    }
  }

  function openPreview(anchor, url) {
    const domainRule = getDomainRule(url.hostname, STATE.settings);
    if (domainRule?.mode === "blocked" || (!domainRule && !isPeekAllowedForHost(url.hostname, STATE.settings))) {
      return;
    }
    if (domainRule?.mode !== "overlay" && (domainRule?.mode === "compact" || STATE.settings.openMode === "compact" || shouldAutoCompact(url, STATE.settings))) {
      STATE.currentUrl = url.href;
      openUrlInPopup(url.href, false);
      return;
    }

    const root = ensureRoot();
    const label = anchor.textContent?.trim() || anchor.getAttribute?.("aria-label") || "Aperçu";

    closeId++;

    STATE.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    STATE.currentUrl = url.href;
    STATE.previewHistory = [url.href];
    STATE.previewHistoryIndex = 0;
    STATE.isPinned = false;
    updateHeaderMeta(anchor, url, label);
    syncPreviewControls();
    STATE.iframe.removeAttribute("src");
    root.classList.add("peek-visible", "peek-loading");
    root.classList.remove("peek-settings-open", "peek-closing", "peek-blocked", "peek-to-compact");
    STATE.settingsButton.setAttribute("aria-expanded", "false");

    startOverlayPanelObserver();

    requestAnimationFrame(() => {
      STATE.iframe.src = url.href;
      startPreviewLoadTimer();
      scheduleOverlayLayout();
      STATE.panel.focus({ preventScroll: true });
    });
  }

  function recordPreviewNavigation(href) {
    let url;
    try {
      url = new URL(href);
    } catch {
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return;
    }
    if (STATE.previewHistory[STATE.previewHistoryIndex] === url.href) {
      return;
    }
    const existingIndex = STATE.previewHistory.lastIndexOf(url.href, STATE.previewHistoryIndex - 1);
    if (existingIndex >= 0) {
      STATE.previewHistoryIndex = existingIndex;
    } else {
      STATE.previewHistory = STATE.previewHistory.slice(0, STATE.previewHistoryIndex + 1);
      STATE.previewHistory.push(url.href);
      STATE.previewHistoryIndex = STATE.previewHistory.length - 1;
    }
    STATE.currentUrl = url.href;
    updateHeaderMeta({ textContent: "Aperçu", getAttribute: () => null }, url, "Aperçu");
    syncPreviewControls();
  }

  function navigatePreviewHistory(direction) {
    const nextIndex = STATE.previewHistoryIndex + direction;
    if (!STATE.iframe || nextIndex < 0 || nextIndex >= STATE.previewHistory.length) {
      return;
    }
    STATE.previewHistoryIndex = nextIndex;
    STATE.currentUrl = STATE.previewHistory[nextIndex];
    STATE.iframe.src = STATE.currentUrl;
    startPreviewLoadTimer();
    try {
      updateHeaderMeta({ textContent: "Aperçu", getAttribute: () => null }, new URL(STATE.currentUrl), "Aperçu");
    } catch {
      /* URL was already validated when it entered history. */
    }
    syncPreviewControls();
  }

  function togglePinnedPreview() {
    STATE.isPinned = !STATE.isPinned;
    STATE.root?.classList.toggle("peek-pinned", STATE.isPinned);
    syncPreviewControls();
  }

  function syncPreviewControls() {
    if (STATE.backButton) {
      STATE.backButton.disabled = STATE.previewHistoryIndex <= 0;
    }
    if (STATE.forwardButton) {
      STATE.forwardButton.disabled = STATE.previewHistoryIndex >= STATE.previewHistory.length - 1;
    }
    if (STATE.pinButton) {
      STATE.pinButton.classList.toggle("peek-active", STATE.isPinned);
      STATE.pinButton.setAttribute("aria-pressed", String(STATE.isPinned));
      STATE.pinButton.title = STATE.isPinned ? "Désépingler l'aperçu" : "Épingler l'aperçu";
    }
  }

  function startPreviewLoadTimer() {
    clearPreviewLoadTimer();
    previewLoadTimer = window.setTimeout(() => {
      if (STATE.root?.classList.contains("peek-loading")) {
        setPreviewBlocked("Le chargement a expiré ou ce site refuse l’intégration.");
      }
    }, 12000);
  }

  function clearPreviewLoadTimer() {
    window.clearTimeout(previewLoadTimer);
    previewLoadTimer = 0;
  }

  function setPreviewBlocked(message) {
    clearPreviewLoadTimer();
    STATE.root?.classList.remove("peek-loading");
    STATE.root?.classList.add("peek-blocked");
    const text = STATE.helpEl?.querySelector("span");
    if (text && message) {
      text.textContent = message;
    }
  }

  function measureOverlayPanelSize() {
    if (!STATE.panel) {
      return peekEstimateOverlayPanelSize(
        STATE.settings,
        window.innerWidth,
        window.innerHeight
      );
    }
    const rect = STATE.panel.getBoundingClientRect();
    const estimated = peekEstimateOverlayPanelSize(
      STATE.settings,
      window.innerWidth,
      window.innerHeight
    );
    return {
      width: rect.width > 1 ? rect.width : estimated.width,
      height: rect.height > 1 ? rect.height : estimated.height
    };
  }

  function clampToViewport(left, top, panelWidth, panelHeight) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxLeft = Math.max(0, vw - panelWidth);
    const maxTop = Math.max(0, vh - panelHeight);
    return {
      left: Math.min(maxLeft, Math.max(0, Math.round(left))),
      top: Math.min(maxTop, Math.max(0, Math.round(top)))
    };
  }

  function applyOverlayDimensions() {
    if (!STATE.panel) {
      return measureOverlayPanelSize();
    }

    if (STATE.settings.size === "full") {
      STATE.panel.style.width = "100vw";
      STATE.panel.style.height = "100vh";
      STATE.panel.style.minHeight = "";
      STATE.panel.style.maxHeight = "";
      return { width: window.innerWidth, height: window.innerHeight };
    }

    const dims = peekEstimateOverlayPanelSize(
      STATE.settings,
      window.innerWidth,
      window.innerHeight
    );
    const maxHeight = Math.max(240, window.innerHeight - 48);
    const maxWidth = Math.max(320, window.innerWidth - 64 - ACTIONS_BAR_GUTTER);
    const width = Math.min(dims.width, maxWidth);
    const height = Math.min(dims.height, maxHeight);
    STATE.panel.style.width = `${width}px`;
    STATE.panel.style.height = `${height}px`;
    STATE.panel.style.minHeight = "";
    STATE.panel.style.maxHeight = `${maxHeight}px`;
    return { width, height };
  }

  function clearOverlayPanelLayout() {
    if (!STATE.panel) {
      return;
    }
    STATE.root?.classList.remove("peek-layout-ready", "peek-position-calculated");
    STATE.panel.style.removeProperty("left");
    STATE.panel.style.removeProperty("top");
    STATE.panel.style.removeProperty("right");
    STATE.panel.style.removeProperty("bottom");
    STATE.panel.style.removeProperty("transform");
    STATE.panel.style.removeProperty("width");
    STATE.panel.style.removeProperty("height");
    STATE.panel.style.removeProperty("min-height");
    STATE.panel.style.removeProperty("max-height");
  }

  async function resolveOverlayViewportPosition(panelWidth, panelHeight) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const position = peekOverlayViewportPosition(STATE.settings, panelWidth, panelHeight, vw, vh);
    return clampToViewport(position.left, position.top, panelWidth, panelHeight);
  }

  function applyOverlayPanelPosition(left, top) {
    STATE.root.classList.add("peek-layout-ready", "peek-position-calculated");
    STATE.panel.style.left = `${left}px`;
    STATE.panel.style.top = `${top}px`;
    STATE.panel.style.right = "auto";
    STATE.panel.style.bottom = "auto";
    STATE.panel.style.transform = "none";
    requestAnimationFrame(positionActionsBar);
  }

  function positionActionsBar() {
    const actionsEl = STATE.root?.querySelector(".peek-actions");
    if (!actionsEl || !STATE.panel) {
      return;
    }
    const position = STATE.settings?.position;
    const size = STATE.settings?.size;
    // For full-screen previews, actions are inline (handled by CSS).
    if (size === "full") {
      actionsEl.style.removeProperty("left");
      actionsEl.style.removeProperty("top");
      actionsEl.style.removeProperty("right");
      actionsEl.style.removeProperty("bottom");
      return;
    }
    const rect = STATE.panel.getBoundingClientRect();
    const actionsRect = actionsEl.getBoundingClientRect();
    const margin = 8;
    const gap = 8;
    const rightSideLeft = rect.right + gap;
    const leftSideLeft = rect.left - actionsRect.width - gap;
    const fitsRight = rightSideLeft + actionsRect.width <= window.innerWidth - margin;
    const fitsLeft = leftSideLeft >= margin;
    const preferredLeft = fitsRight || !fitsLeft ? rightSideLeft : leftSideLeft;
    const maxLeft = Math.max(margin, window.innerWidth - actionsRect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - actionsRect.height - margin);
    const top = rect.top + rect.height / 2 - actionsRect.height / 2;
    const left = Math.min(maxLeft, Math.max(margin, preferredLeft));
    actionsEl.style.left = `${left}px`;
    actionsEl.style.top = `${Math.min(maxTop, Math.max(margin, top))}px`;
    actionsEl.style.right = "auto";
    actionsEl.style.bottom = "auto";
  }

  function stopOverlayPanelObserver() {
    if (overlayPanelObserver) {
      overlayPanelObserver.disconnect();
      overlayPanelObserver = null;
    }
  }

  function startOverlayPanelObserver() {
    stopOverlayPanelObserver();
    if (!STATE.panel || typeof ResizeObserver === "undefined") {
      return;
    }
    let lastObservedHeight = 0;
    overlayPanelObserver = new ResizeObserver(() => {
      if (!STATE.root?.classList.contains("peek-visible")) {
        return;
      }
      const height = STATE.panel.getBoundingClientRect().height;
      if (Math.abs(height - lastObservedHeight) < 8) {
        return;
      }
      lastObservedHeight = height;
      scheduleOverlayLayout({ debounce: true, resetAttempts: false, updateDimensions: false });
    });
    overlayPanelObserver.observe(STATE.panel);
  }

  async function applyOverlayPositionOnly() {
    if (!STATE.root || !STATE.panel || !STATE.root.classList.contains("peek-visible")) {
      return false;
    }
    if (STATE.settings.size === "full") {
      return true;
    }
    const { width: panelWidth, height: panelHeight } = measureOverlayPanelSize();
    const position = await resolveOverlayViewportPosition(panelWidth, panelHeight);
    applyOverlayPanelPosition(position.left, position.top);
    return true;
  }

  async function applyOverlayLayout(options = {}) {
    const { updateDimensions = true } = options;
    if (!STATE.root || !STATE.panel || !STATE.root.classList.contains("peek-visible")) {
      return false;
    }

    if (updateDimensions) {
      applyOverlayDimensions();
    }

    if (STATE.settings.size === "full") {
      STATE.root.classList.add("peek-layout-ready", "peek-position-calculated");
      STATE.panel.style.inset = "0";
      STATE.panel.style.width = "100vw";
      STATE.panel.style.height = "100vh";
      STATE.panel.style.left = "0";
      STATE.panel.style.top = "0";
      STATE.panel.style.right = "auto";
      STATE.panel.style.bottom = "auto";
      STATE.panel.style.transform = "none";
      requestAnimationFrame(positionActionsBar);
      return true;
    }

    STATE.panel.style.removeProperty("inset");

    await new Promise(resolve => requestAnimationFrame(resolve));
    const { width: panelWidth, height: panelHeight } = measureOverlayPanelSize();
    const position = await resolveOverlayViewportPosition(panelWidth, panelHeight);
    applyOverlayPanelPosition(position.left, position.top);
    return true;
  }

  function scheduleOverlayLayout(options = {}) {
    const { debounce = false, resetAttempts = true, updateDimensions = true } = options;
    if (resetAttempts) {
      overlayPositionAttempts = 0;
    }

    if (debounce) {
      window.clearTimeout(overlayResizeTimer);
      overlayResizeTimer = window.setTimeout(
        () => scheduleOverlayLayout({ resetAttempts: false, updateDimensions: false }),
        120
      );
      return;
    }

    cancelAnimationFrame(overlayPositionFrame);
    overlayPositionFrame = requestAnimationFrame(() => {
      overlayPositionFrame = requestAnimationFrame(async () => {
        const ok = await applyOverlayLayout({ updateDimensions });
        if (!ok && overlayPositionAttempts < 6) {
          overlayPositionAttempts += 1;
          window.setTimeout(() => scheduleOverlayLayout({ resetAttempts: false }), 60);
        }
      });
    });
  }

  window.addEventListener("resize", () => {
    if (!STATE.root?.classList.contains("peek-visible")) {
      return;
    }
    scheduleOverlayLayout({ debounce: true });
  });

  function getAnimationMs() {
    return peekAnimationDurationMs(STATE.settings);
  }

  function doClose() {
    if (!STATE.root) {
      return;
    }
    STATE.root.classList.remove(
      "peek-visible",
      "peek-loading",
      "peek-closing",
      "peek-blocked",
      "peek-to-compact"
    );
    STATE.currentUrl = "";
    STATE.previewHistory = [];
    STATE.previewHistoryIndex = -1;
    STATE.isPinned = false;
    STATE.iframe.removeAttribute("src");
    clearPreviewLoadTimer();
    stopOverlayPanelObserver();
    clearOverlayPanelLayout();
    if (STATE.previouslyFocused?.isConnected) {
      STATE.previouslyFocused.focus({ preventScroll: true });
    }
    STATE.previouslyFocused = null;
  }

  function closePreview() {
    if (!STATE.root || !STATE.root.classList.contains("peek-visible")) {
      return;
    }

    if (STATE.settings.animation === "none") {
      doClose();
      return;
    }

    const id = ++closeId;
    const guard = fn => () => {
      if (closeId === id) {
        fn();
      }
    };

    const speedMs = getAnimationMs();

    STATE.root.classList.add("peek-closing");
    STATE.root.classList.remove("peek-loading");

    const settle = guard(doClose);
    STATE.panel.addEventListener("animationend", settle, { once: true });
    setTimeout(() => {
      STATE.panel.removeEventListener("animationend", settle);
      guard(doClose)();
    }, speedMs + 60);
  }

  function copyCurrentUrl() {
    if (!STATE.currentUrl || !navigator.clipboard?.writeText) {
      return;
    }
    navigator.clipboard.writeText(STATE.currentUrl).then(() => {
      STATE.copyButton.title = "URL copiée";
      window.setTimeout(() => {
        if (STATE.copyButton) STATE.copyButton.title = "Copier l'URL";
      }, 1200);
    }).catch(() => {});
  }

  function refreshPreview() {
    if (!STATE.currentUrl || !STATE.iframe) {
      return;
    }
    STATE.root?.classList.add("peek-loading");
    STATE.root?.classList.remove("peek-blocked");
    STATE.iframe.src = STATE.currentUrl;
    startPreviewLoadTimer();
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

  function openCurrentInPopup(closeAfterOpen = STATE.settings.closeAfterOpen) {
    if (!STATE.currentUrl) {
      return;
    }
    openUrlInPopup(STATE.currentUrl, closeAfterOpen);
  }

  function openUrlInPopup(url, closeAfterOpen) {
    const launch = () => {
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
          chrome.runtime.sendMessage({ type: "OPEN_URL_IN_TAB", url }, fallback => {
            if (chrome.runtime.lastError || !fallback?.ok) {
              window.open(url, "_blank", "noopener,noreferrer");
            }
          });
        }
        if (closeAfterOpen) {
          closePreview();
        }
      });
    };

    if (STATE.root?.classList.contains("peek-visible") && getAnimationMs() > 0) {
      STATE.root.classList.add("peek-to-compact");
      setTimeout(() => {
        STATE.root?.classList.remove("peek-to-compact");
        launch();
        if (closeAfterOpen) {
          closePreview();
        }
      }, getAnimationMs());
      return;
    }

    launch();
    if (closeAfterOpen && STATE.root?.classList.contains("peek-visible")) {
      closePreview();
    }
  }

  function toggleSettings() {
    if (!STATE.root) {
      return;
    }
    const isOpen = STATE.root.classList.toggle("peek-settings-open");
    STATE.settingsButton.setAttribute("aria-expanded", String(isOpen));
    if (STATE.root.classList.contains("peek-visible")) {
      window.setTimeout(() => applyOverlayPositionOnly(), 0);
    }
  }

  function ensureCompactMenu() {
    if (window.top !== window.self) {
      return null;
    }
    if (STATE.compactMenu) {
      return STATE.compactMenu;
    }

    const menu = document.createElement("div");
    menu.id = COMPACT_MENU_ID;
    menu.innerHTML = `
      <form class="peek-compact-settings">
        <label>
          <span>Mode</span>
          <select name="openMode">
            <option value="overlay">Aperçu intégré</option>
            <option value="compact">Fenêtre compacte</option>
          </select>
        </label>
        <label>
          <span>Taille</span>
          <select name="size">
            <option value="small">Petite</option>
            <option value="medium">Moyenne</option>
            <option value="large">Grande</option>
            <option value="full">Plein écran</option>
            <option value="custom">Personnalisée</option>
          </select>
        </label>
        <label>
          <span>Position</span>
          <select name="position">
            <option value="topRight">En haut à droite</option>
            <option value="bottomRight">En bas à droite</option>
            <option value="topLeft">En haut à gauche</option>
            <option value="bottomLeft">En bas à gauche</option>
            <option value="center">Centre</option>
            <option value="custom">Personnalisée</option>
          </select>
        </label>
        <label>
          <span>Thème</span>
          <select name="theme">
            <option value="system">Système</option>
            <option value="light">Clair</option>
            <option value="dark">Sombre</option>
            <option value="graphite">Graphite</option>
            <option value="mint">Menthe</option>
            <option value="catppuccin">Catppuccin</option>
            <option value="gruvbox">Gruvbox</option>
            <option value="dracula">Dracula</option>
            <option value="custom">Personnalisé</option>
          </select>
        </label>
        <label class="peek-compact-check">
          <input type="checkbox" name="closeWithEsc">
          <span>Fermer avec Échap</span>
        </label>
      </form>
      <div class="peek-compact-actions">
        ${peekIconButton("peek-compact-settings-button", "settings", "Paramètres", "Paramètres")}
        ${peekIconButton("peek-compact-open", "external", "Nouvel onglet", "Nouvel onglet")}
        ${peekIconButton("peek-compact-close", "close", "Fermer la fenêtre", "Fermer la fenêtre")}
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
      STATE.compactMenu.style.setProperty(
        "--peek-backdrop",
        `rgba(${r}, ${g}, ${b}, ${STATE.settings.customBackdropOpacity / 100})`
      );
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

  function shouldOpenWithModifier(event) {
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
    STATE.root.dataset.panelShadow = STATE.settings.panelShadow;
    STATE.root.dataset.dimBackdrop = String(STATE.settings.dimBackdrop);
    STATE.root.dataset.backdropMode = STATE.settings.backdropMode || "dim";

    // Backdrop CSS variables (slider 0-100 maps to: blur 0-25px, dim 0-1.0 opacity)
    if (STATE.settings.backdropMode === "blur") {
      const blurPx = Math.round((STATE.settings.backdropBlur / 100) * 25);
      STATE.root.style.setProperty("--peek-backdrop-blur", `${blurPx}px`);
      // Keep a very light dim even in blur mode (handled by CSS * 0.25)
      STATE.root.style.setProperty("--peek-backdrop-opacity", String(STATE.settings.backdropBlur / 100));
    } else {
      STATE.root.style.setProperty("--peek-backdrop-opacity", String(STATE.settings.backdropOpacity / 100));
      STATE.root.style.setProperty("--peek-backdrop-blur", "0px");
    }
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
      STATE.root.style.setProperty(
        "--peek-backdrop",
        `rgba(${r}, ${g}, ${b}, ${STATE.settings.customBackdropOpacity / 100})`
      );
      STATE.root.style.setProperty("--peek-backdrop-color", `${r}, ${g}, ${b}`);
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
        "--peek-backdrop",
        "--peek-backdrop-color"
      ].forEach(name => STATE.root.style.removeProperty(name));
    }

    if (STATE.root.classList.contains("peek-visible")) {
      scheduleOverlayLayout();
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
    STATE.settingsPanel.elements.panelShadow.value = STATE.settings.panelShadow;
    STATE.settingsPanel.elements.middleClick.checked = STATE.settings.middleClick;
    STATE.settingsPanel.elements.closeOutside.checked = STATE.settings.closeOutside;
    STATE.settingsPanel.elements.closeWithEsc.checked = STATE.settings.closeWithEsc;
    STATE.settingsPanel.elements.closeAfterOpen.checked = STATE.settings.closeAfterOpen;

    // Sync backdrop control
    const backdropMode = STATE.settings.backdropMode || "dim";
    STATE.settingsPanel.querySelectorAll(".peek-backdrop-mode-btn").forEach(btn => {
      btn.classList.toggle("peek-active", btn.dataset.mode === backdropMode);
    });
    const intensity = backdropMode === "blur" ? STATE.settings.backdropBlur : STATE.settings.backdropOpacity;
    const sliderEl = STATE.settingsPanel.querySelector(".peek-backdrop-slider");
    const valueEl = STATE.settingsPanel.querySelector(".peek-backdrop-value");
    if (sliderEl && valueEl) {
      sliderEl.value = intensity;
      const pct = ((intensity - 0) / 100) * 100;
      sliderEl.style.setProperty("--peek-slider-pct", `${pct}%`);
      valueEl.textContent = `${intensity}%`;
    }
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
    if (field.name === "position" || field.name === "customLeft" || field.name === "customTop") {
      scheduleOverlayLayout({ updateDimensions: false });
    } else if (field.name === "size") {
      scheduleOverlayLayout({ updateDimensions: true });
    }
  }

  function loadSettings() {
    return new Promise(resolve => {
      if (typeof chrome === "undefined" || !chrome.storage?.local) {
        resolve(readLocalStorageSettings());
        return;
      }
      try {
        chrome.storage.local.get(PEEK_DEFAULT_SETTINGS, stored => {
          if (chrome.runtime.lastError) {
            resolve(readLocalStorageSettings());
            return;
          }
          resolve(cleanSettings(stored));
        });
      } catch (err) {
        console.warn("loadSettings: failed to read from chrome.storage", err.message);
        resolve(readLocalStorageSettings());
      }
    });
  }

  function saveSettings(settings) {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      try {
        window.localStorage.setItem("peek-preview-settings", JSON.stringify(settings));
      } catch (e) {
        /* ignore */
      }
      return;
    }
    try {
      chrome.storage.local.set(settings, () => {
        if (chrome.runtime.lastError) {
          console.warn("saveSettings: error saving to storage", chrome.runtime.lastError.message);
        }
      });
    } catch (err) {
      console.warn("saveSettings: extension context might be invalidated, falling back to localStorage", err.message);
      try {
        window.localStorage.setItem("peek-preview-settings", JSON.stringify(settings));
      } catch (e) {
        /* ignore */
      }
    }
  }

  function scheduleSettingsSave() {
    window.clearTimeout(settingsSaveTimer);
    settingsSaveTimer = window.setTimeout(() => {
      settingsSaveTimer = 0;
      saveSettings(STATE.settings);
    }, 180);
  }

  function flushSettingsSave() {
    if (settingsSaveTimer) {
      window.clearTimeout(settingsSaveTimer);
      settingsSaveTimer = 0;
    }
    saveSettings(STATE.settings);
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

  function tryOpenPreviewFromEvent(event) {
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
  }

  document.addEventListener(
    "click",
    event => {
      if (event.defaultPrevented || !shouldOpenWithModifier(event)) {
        return;
      }
      tryOpenPreviewFromEvent(event);
    },
    true
  );

  document.addEventListener(
    "auxclick",
    event => {
      if (!STATE.settings.middleClick || event.button !== 1 || event.defaultPrevented) {
        return;
      }
      tryOpenPreviewFromEvent(event);
    },
    true
  );

  document.addEventListener(
    "keydown",
    event => {
      const previewIsOpen = STATE.root?.classList.contains("peek-visible");
      const editable = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
      if (previewIsOpen && !editable && !event.altKey && !event.ctrlKey && !event.metaKey) {
        if (event.key === "r") {
          event.preventDefault();
          refreshPreview();
          return;
        }
        if (event.key === "o") {
          event.preventDefault();
          openCurrentInTab();
          return;
        }
        if (event.key === "c") {
          event.preventDefault();
          copyCurrentUrl();
          return;
        }
        if (event.key === "p") {
          event.preventDefault();
          togglePinnedPreview();
          return;
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          navigatePreviewHistory(-1);
          return;
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          navigatePreviewHistory(1);
          return;
        }
      }
      if (event.key !== "Escape" || !STATE.settings.closeWithEsc) {
        return;
      }
      if (STATE.root?.classList.contains("peek-settings-open")) {
        STATE.root.classList.remove("peek-settings-open");
        STATE.settingsButton?.setAttribute("aria-expanded", "false");
        return;
      }
      if (STATE.compactMenu && !STATE.root?.classList.contains("peek-visible")) {
        requestCompactWindowClose();
        return;
      }
      if (!STATE.root?.classList.contains("peek-visible")) {
        return;
      }
      closePreview();
    },
    true
  );

  window.addEventListener("message", event => {
    if (event.data?.source !== "peek-preview" || event.source !== STATE.iframe?.contentWindow) {
      return;
    }
    if (event.data.type === "CLOSE_PEEK_PREVIEW" && STATE.settings.closeWithEsc) {
      closePreview();
    }
    if (event.data.type === "PEEK_FRAME_NAVIGATION" && typeof event.data.url === "string") {
      recordPreviewNavigation(event.data.url);
    }
  });

  function trapFocus(event) {
    if (event.key !== "Tab" || !STATE.root?.classList.contains("peek-visible")) {
      return;
    }
    const focusable = [...STATE.root.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'
    )].filter(element => !element.hidden && element.offsetParent !== null);
    if (!focusable.length) {
      event.preventDefault();
      STATE.panel?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function requestCompactWindowClose() {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      window.close();
      return;
    }
    chrome.runtime.sendMessage({
      type: "CLOSE_COMPACT_WINDOW",
      windowId: STATE.compactWindowId
    });
  }

  function initResizeListeners(rootEl) {
    const panel = rootEl.querySelector(".peek-panel");
    if (!panel) return;

    panel.querySelectorAll(".peek-resize-handle").forEach(handle => {
      handle.addEventListener("mousedown", event => {
        event.preventDefault();
        event.stopPropagation();

        const direction = handle.dataset.direction;
        const startX = event.clientX;
        const startY = event.clientY;

        const startRect = panel.getBoundingClientRect();
        const startWidth = startRect.width;
        const startHeight = startRect.height;
        const startLeft = startRect.left;
        const startTop = startRect.top;

        rootEl.classList.add("peek-resizing");

        let currentWidth = startWidth;
        let currentHeight = startHeight;
        let currentLeft = startLeft;
        let currentTop = startTop;

        const onMouseMove = moveEvent => {
          const dx = moveEvent.clientX - startX;
          const dy = moveEvent.clientY - startY;

          // Horizontal resize
          if (direction.includes("w")) {
            const maxW = window.innerWidth - 32;
            const targetWidth = startWidth - dx;
            if (targetWidth < 320) {
              currentWidth = 320;
              currentLeft = startLeft + startWidth - 320;
            } else if (targetWidth > maxW) {
              currentWidth = maxW;
              currentLeft = startLeft + startWidth - maxW;
            } else {
              currentWidth = targetWidth;
              currentLeft = startLeft + dx;
            }
          } else if (direction.includes("e")) {
            currentWidth = Math.max(320, Math.min(startWidth + dx, window.innerWidth - 32));
          }

          // Vertical resize
          if (direction.includes("n")) {
            const maxH = window.innerHeight - 32;
            const targetHeight = startHeight - dy;
            if (targetHeight < 240) {
              currentHeight = 240;
              currentTop = startTop + startHeight - 240;
            } else if (targetHeight > maxH) {
              currentHeight = maxH;
              currentTop = startTop + startHeight - maxH;
            } else {
              currentHeight = targetHeight;
              currentTop = startTop + dy;
            }
          } else if (direction.includes("s")) {
            currentHeight = Math.max(240, Math.min(startHeight + dy, window.innerHeight - 32));
          }

          panel.style.width = `${currentWidth}px`;
          panel.style.height = `${currentHeight}px`;
          panel.style.left = `${currentLeft}px`;
          panel.style.top = `${currentTop}px`;
        };

        const onMouseUp = () => {
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);

          rootEl.classList.remove("peek-resizing");

          const updates = {
            size: "custom",
            customWidth: Math.round(currentWidth),
            customHeight: Math.round(currentHeight)
          };

          if (STATE.settings.position === "custom") {
            updates.customLeft = Math.round(currentLeft);
            updates.customTop = Math.round(currentTop);
          }

          STATE.settings = cleanSettings({ ...STATE.settings, ...updates });
          try {
            chrome.storage.local.set(updates, () => {
              if (chrome.runtime.lastError) {
                console.warn("Resize storage error:", chrome.runtime.lastError.message);
              }
              scheduleOverlayLayout({ updateDimensions: true });
            });
          } catch (err) {
            console.warn("Resize storage failed:", err.message);
            scheduleOverlayLayout({ updateDimensions: true });
          }
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      });
    });
  }
})();
