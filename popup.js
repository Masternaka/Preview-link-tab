const form = document.querySelector("#settings-form");
const resetButton = document.querySelector("#reset");
const statusEl = document.querySelector("#status");
const saveToast = document.querySelector("#save-toast");
const backdropDraft = {
  dim: PEEK_DEFAULT_SETTINGS.backdropOpacity,
  blur: PEEK_DEFAULT_SETTINGS.backdropBlur
};
let backdropDraftMode = "dim";
const themeColorRoles = PEEK_THEME_COLOR_ROLES;
let savedThemesDraft = [];
let activeSite = null;
let activeSitePaused = false;
const customThemeDraft = {};
let displayedTheme = null;


loadSettings();
initSectionNav();
initColorPickers();
initThemeLibrary();
initSiteControls();

form.addEventListener("submit", event => {
  event.preventDefault();
  saveSettings();
});

form.addEventListener("change", () => {
  updateThemeColors();
  updateAdvancedGroups();
  updateColorSwatches();
  updateAppearancePreview();
  showStatus("Modifications non sauvegardées");
});

form.addEventListener("input", () => {
  updateThemeColors();
  updateColorSwatches();
  updateAppearancePreview();
  showStatus("Modifications non sauvegardées");
});

function syncCurrentSiteRule() {
  if (!activeSite) return;
  const select = document.getElementById("current-site-mode");
  select.value = parseDomainRules(form.elements.domainRules.value).find(rule => rule.domain === activeSite.hostname)?.mode || "default";
}

function initSiteControls() {
  const button = document.getElementById("pause-site");
  const status = document.getElementById("site-status");
  const ruleButton = document.getElementById("save-site-rule");
  if (!button || !chrome.tabs?.query || !chrome.runtime?.sendMessage) return;
  const displayPause = () => {
    button.textContent = activeSitePaused ? "Réactiver sur ce site" : "Mettre en pause sur ce site";
    button.setAttribute("aria-pressed", String(activeSitePaused));
  };
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (chrome.runtime.lastError) { status.textContent = "Impossible de lire le site courant."; return; }
    const tab = tabs[0];
    try {
      const url = new URL(tab?.url);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      activeSite = { tabId: tab.id, url: url.href, hostname: url.hostname };
    } catch { status.textContent = "Disponible depuis une page web."; return; }
    document.getElementById("current-site").textContent = activeSite.hostname;
    ruleButton.disabled = false;
    document.getElementById("current-site-mode").disabled = false;
    syncCurrentSiteRule();
    chrome.runtime.sendMessage({ type: "GET_SITE_PAUSE", tabId: activeSite.tabId }, response => {
      if (chrome.runtime.lastError || !response?.ok) { status.textContent = "État de pause indisponible."; return; }
      activeSitePaused = response.paused;
      button.disabled = false;
      displayPause();
    });
  });
  button.addEventListener("click", () => {
    if (!activeSite) return;
    button.disabled = true;
    chrome.runtime.sendMessage({ type: "SET_SITE_PAUSE", tabId: activeSite.tabId, paused: !activeSitePaused }, response => {
      button.disabled = false;
      if (chrome.runtime.lastError || !response?.ok) { status.textContent = "Impossible de modifier la pause. Réessayez."; return; }
      activeSitePaused = response.paused;
      displayPause();
      status.textContent = activeSitePaused ? "Les déclencheurs sont en pause sur ce site." : "Les déclencheurs sont réactivés sur ce site.";
    });
  });
  ruleButton.addEventListener("click", () => {
    if (!activeSite) return;
    ruleButton.disabled = true;
    chrome.runtime.sendMessage({ type: "SET_DOMAIN_RULE", url: activeSite.url,
      mode: document.getElementById("current-site-mode").value }, response => {
      ruleButton.disabled = false;
      if (chrome.runtime.lastError || !response?.ok) { status.textContent = "Impossible de sauvegarder la règle."; return; }
      form.elements.domainRules.value = response.domainRules;
      syncCurrentSiteRule();
      status.textContent = "Règle du site enregistrée.";
    });
  });
}

function initSectionNav() {
  document.querySelectorAll(".section-nav-btn").forEach(btn => {
    btn.addEventListener("click", () => switchSection(btn.dataset.section));
  });
}

function switchSection(sectionId) {
  document.querySelectorAll(".section-nav-btn").forEach(btn => {
    const active = btn.dataset.section === sectionId;
    btn.classList.toggle("section-nav-btn-active", active);
  });
  document.querySelectorAll(".form-section").forEach(section => {
    const active = section.dataset.section === sectionId;
    section.classList.toggle("form-section-active", active);
    section.hidden = !active;
  });
}

function saveSettings() {
  if (!form.checkValidity()) {
    showStatus("Valeur invalide");
    return;
  }
  const settings = getFormSettings();
  storeSettings(settings, () => {
    updateAdvancedGroups();
    showStatus("Sauvegardé");
    showSaveNotification();
  });
}

function storeSettings(settings, onSuccess) {
  try {
    chrome.storage.local.set(settings, () => {
      if (chrome.runtime.lastError) {
        showStatus("Échec de la sauvegarde. Réessayez.");
        return;
      }
      onSuccess();
    });
  } catch {
    showStatus("Échec de la sauvegarde. Réessayez.");
  }
}

resetButton.addEventListener("click", () => {
  storeSettings(PEEK_DEFAULT_SETTINGS, () => {
    setFormSettings(PEEK_DEFAULT_SETTINGS);
    showStatus("Paramètres réinitialisés");
  });
});

function loadSettings() {
  chrome.storage.local.get(PEEK_DEFAULT_SETTINGS, stored => {
    setFormSettings(cleanPeekSettings(stored));
  });
}

function getRadioValue(name) {
  const checked = form.querySelector(`input[type="radio"][name="${name}"]:checked`);
  return checked?.value;
}

function setRadioValue(name, value) {
  const input = form.querySelector(`input[type="radio"][name="${name}"][value="${value}"]`);
  if (input) {
    input.checked = true;
  }
}

function getFormSettings() {
  rememberBackdropIntensity();
  updateThemeColors();
  rememberCustomTheme();
  return cleanPeekSettings({
    openMode: form.elements.openMode.value,
    size: getRadioValue("size"),
    customWidth: form.elements.customWidth.value,
    customHeight: form.elements.customHeight.value,
    position: form.elements.position.value,
    customLeft: form.elements.customLeft.value,
    customTop: form.elements.customTop.value,
    trigger: getRadioValue("trigger"),
    theme: form.elements.theme.value,
    savedThemes: savedThemesDraft,
    customAccent: customThemeDraft.customAccent,
    customBackground: customThemeDraft.customBackground,
    customHeader: customThemeDraft.customHeader,
    customFrame: customThemeDraft.customFrame,
    customText: customThemeDraft.customText,
    customMuted: customThemeDraft.customMuted,
    customBorder: customThemeDraft.customBorder,
    customBackdrop: customThemeDraft.customBackdrop,
    customBackdropOpacity: customThemeDraft.customBackdropOpacity,
    animation: form.elements.animation.value,
    animationSpeed: getRadioValue("animationSpeed"),
    frameStyle: form.elements.frameStyle.value,
    panelShadow: form.elements.panelShadow.value,
    backdropMode: getRadioValue("backdropMode") || "dim",
    backdropOpacity: backdropDraft.dim,
    backdropBlur: backdropDraft.blur,
    domainListMode: form.elements.domainListMode.value,
    domainList: form.elements.domainList.value,
    domainRules: form.elements.domainRules.value,
    middleClick: form.elements.middleClick.checked,
    closeOutside: form.elements.closeOutside.checked,
    closeWithEsc: form.elements.closeWithEsc.checked,
    dimBackdrop: true,
    closeAfterOpen: form.elements.closeAfterOpen.checked,
    autoCompactFallback: form.elements.autoCompactFallback.checked,
    compactFallbackDomains: form.elements.compactFallbackDomains.value
  });
}

function setFormSettings(settings) {
  const clean = cleanPeekSettings(settings);
  setRadioValue("size", clean.size);
  form.elements.openMode.value = clean.openMode;
  form.elements.customWidth.value = clean.customWidth;
  form.elements.customHeight.value = clean.customHeight;
  form.elements.position.value = clean.position;
  form.elements.customLeft.value = clean.customLeft;
  form.elements.customTop.value = clean.customTop;
  setRadioValue("trigger", clean.trigger);
  savedThemesDraft = clean.savedThemes;
  populatePeekSavedThemes(form.elements.theme, clean);
  form.elements.theme.value = clean.theme;
  customThemeDraft.customAccent = clean.customAccent;
  customThemeDraft.customBackground = clean.customBackground;
  customThemeDraft.customHeader = clean.customHeader;
  customThemeDraft.customFrame = clean.customFrame;
  customThemeDraft.customText = clean.customText;
  customThemeDraft.customMuted = clean.customMuted;
  customThemeDraft.customBorder = clean.customBorder;
  customThemeDraft.customBackdrop = clean.customBackdrop;
  customThemeDraft.customBackdropOpacity = clean.customBackdropOpacity;
  form.elements.animation.value = clean.animation;
  setRadioValue("animationSpeed", clean.animationSpeed);
  form.elements.frameStyle.value = clean.frameStyle;
  form.elements.panelShadow.value = clean.panelShadow;

  // Backdrop control
  backdropDraft.dim = clean.backdropOpacity;
  backdropDraft.blur = clean.backdropBlur;
  backdropDraftMode = clean.backdropMode;
  setRadioValue("backdropMode", clean.backdropMode || "dim");
  const isBlur = clean.backdropMode === "blur";
  const intensity = isBlur ? clean.backdropBlur : clean.backdropOpacity;
  const sliderEl = document.getElementById("backdropIntensitySlider");
  const valueEl = document.getElementById("backdropIntensityValue");
  if (sliderEl) {
    sliderEl.value = intensity;
    const pct = (intensity / 100) * 100;
    sliderEl.style.setProperty("--popup-slider-pct", `${pct}%`);
  }
  if (valueEl) valueEl.textContent = `${intensity}%`;

  form.elements.domainListMode.value = clean.domainListMode;
  form.elements.domainList.value = clean.domainList;
  form.elements.domainRules.value = clean.domainRules;
  form.elements.middleClick.checked = clean.middleClick;
  form.elements.closeOutside.checked = clean.closeOutside;
  form.elements.closeWithEsc.checked = clean.closeWithEsc;
  form.elements.closeAfterOpen.checked = clean.closeAfterOpen;
  form.elements.autoCompactFallback.checked = clean.autoCompactFallback;
  form.elements.compactFallbackDomains.value = clean.compactFallbackDomains;
  displayedTheme = null;
  updateThemeColors();
  updateAdvancedGroups();
  updateColorSwatches();
  updateThemeLibraryControls();
  updateAppearancePreview();
  syncCurrentSiteRule();
}

function rememberCustomTheme() {
  if (displayedTheme !== "custom") return;
  for (const key of [...Object.keys(themeColorRoles), "customBackdropOpacity"]) {
    customThemeDraft[key] = form.elements[key].value;
  }
}

function updateThemeColors() {
  const theme = form.elements.theme.value;
  rememberCustomTheme();
  if (theme === "custom") {
    if (displayedTheme !== "custom") {
      for (const [key, value] of Object.entries(customThemeDraft)) {
        form.elements[key].value = value;
      }
    }
  } else {
    const saved = savedThemesDraft.find(item => `saved:${item.id}` === theme);
    const palette = saved ? peekPaletteFromCustom(saved.colors) : PEEK_THEME_PRESETS[theme];
    if (palette) {
      for (const [key, role] of Object.entries(themeColorRoles)) {
        form.elements[key].value = palette[role];
      }
      form.elements.customBackdropOpacity.value = saved ? saved.colors.customBackdropOpacity : backdropDraft.dim;
    }
  }
  const changed = displayedTheme !== theme;
  displayedTheme = theme;
  if (changed) updateThemeLibraryControls();
}

function selectedThemeColors() {
  const settings = getFormSettings();
  const saved = savedThemesDraft.find(item => `saved:${item.id}` === settings.theme);
  if (saved) return { ...saved.colors };
  if (settings.theme === "custom") return { ...customThemeDraft };
  const palette = PEEK_THEME_PRESETS[settings.theme];
  return {
    ...Object.fromEntries(Object.entries(themeColorRoles).map(([key, role]) => [key, palette[role]])),
    customBackdropOpacity: settings.backdropOpacity
  };
}

function updateThemeLibraryControls() {
  const saved = savedThemesDraft.find(item => `saved:${item.id}` === form.elements.theme.value);
  const name = document.getElementById("theme-name");
  if (name) name.value = saved?.name || "";
  const remove = document.getElementById("delete-theme");
  if (remove) remove.disabled = !saved;
  const copy = document.getElementById("copy-theme");
  if (copy) copy.disabled = form.elements.theme.value === "custom";
}

function initThemeLibrary() {
  document.getElementById("copy-theme")?.addEventListener("click", () => {
    Object.assign(customThemeDraft, selectedThemeColors());
    displayedTheme = null;
    form.elements.theme.value = "custom";
    updateThemeColors();
    updateAdvancedGroups();
    updateColorSwatches();
    updateAppearancePreview();
    showStatus("Copié vers Personnalisé. Modifiez les couleurs puis sauvegardez.");
  });
  document.getElementById("save-theme")?.addEventListener("click", () => {
    const name = document.getElementById("theme-name").value.trim();
    if (!name) { showStatus("Donnez un nom au thème."); return; }
    if (!form.checkValidity()) { showStatus("Corrigez les valeurs invalides."); return; }
    const existing = savedThemesDraft.find(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (!existing && savedThemesDraft.length >= 50) { showStatus("Maximum 50 thèmes personnels."); return; }
    const entry = { id: existing?.id || crypto.randomUUID(), name, colors: selectedThemeColors() };
    const savedThemes = cleanPeekSavedThemes([...savedThemesDraft.filter(item => item.id !== entry.id), entry]);
    storeSettings({ savedThemes, theme: `saved:${entry.id}` }, () => {
      savedThemesDraft = savedThemes;
      populatePeekSavedThemes(form.elements.theme, { savedThemes });
      form.elements.theme.value = `saved:${entry.id}`;
      updateThemeColors();
      updateAdvancedGroups();
      updateColorSwatches();
      updateThemeLibraryControls();
      updateAppearancePreview();
      showStatus("Thème enregistré dans Mes thèmes.");
    });
  });
  document.getElementById("delete-theme")?.addEventListener("click", () => {
    const id = form.elements.theme.value;
    const saved = savedThemesDraft.find(item => `saved:${item.id}` === id);
    if (!saved) return;
    const savedThemes = savedThemesDraft.filter(item => item !== saved);
    storeSettings({ savedThemes, theme: "custom", ...saved.colors }, () => {
      savedThemesDraft = savedThemes;
      Object.assign(customThemeDraft, saved.colors);
      displayedTheme = null;
      populatePeekSavedThemes(form.elements.theme, { savedThemes });
      form.elements.theme.value = "custom";
      updateThemeColors();
      updateAdvancedGroups();
      updateColorSwatches();
      updateAppearancePreview();
      showStatus("Thème supprimé. Ses couleurs restent dans Personnalisé.");
    });
  });
  document.getElementById("replay-preview")?.addEventListener("click", () => {
    const panel = document.getElementById("sample-panel");
    if (!panel) return;
    panel.classList.remove("sample-animate");
    void panel.offsetWidth;
    panel.classList.add("sample-animate");
  });
}

function updateAppearancePreview() {
  const preview = document.getElementById("theme-preview");
  if (!preview) return;
  const settings = getFormSettings();
  applyPeekTheme(preview, settings.theme, settings);
  preview.dataset.size = settings.size;
  preview.dataset.frame = settings.frameStyle;
  preview.dataset.shadow = settings.panelShadow;
  preview.dataset.animation = settings.animation;
  preview.dataset.position = settings.position;
  preview.dataset.backdrop = settings.backdropMode;
  preview.style.setProperty("--sample-duration", `${peekAnimationDurationMs(settings)}ms`);
  preview.style.setProperty("--sample-blur", `${settings.backdropBlur / 20}px`);
  const dimensions = peekEstimateOverlayPanelSize(settings, 1400, 900);
  preview.style.setProperty("--sample-width", `${Math.max(25, dimensions.width / 1400 * 100)}%`);
  preview.style.setProperty("--sample-height", `${Math.max(35, dimensions.height / 900 * 100)}%`);
  preview.style.setProperty("--sample-left", `${Math.min(100, settings.customLeft / 1400 * 100)}%`);
  preview.style.setProperty("--sample-top", `${Math.min(100, settings.customTop / 900 * 100)}%`);
}

function updateAdvancedGroups() {
  const sizeValue = getRadioValue("size");
  document.querySelectorAll(".advanced-group").forEach(group => {
    const controllerName = group.dataset.enabledBy;
    let controllerValue = null;
    if (controllerName === "size") {
      controllerValue = sizeValue;
    } else if (form.elements[controllerName]) {
      controllerValue = form.elements[controllerName].value;
    }
    const isEnabled = controllerValue === group.dataset.enabledValue;
    group.dataset.active = String(isEnabled);
    group.disabled = !isEnabled;
  });
}

function updateColorSwatches() {
  document.querySelectorAll("[data-color-for]").forEach(swatch => {
    const field = form.elements[swatch.dataset.colorFor];
    const value = field?.value?.trim();
    if (swatch.tagName === "INPUT" && swatch.type === "color") {
      if (/^#[0-9a-fA-F]{6}$/.test(value)) {
        swatch.value = value.toLowerCase();
      }
    } else {
      swatch.style.background = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "transparent";
    }
  });
}

function initColorPickers() {
  document.querySelectorAll("input[type='color'].color-swatch").forEach(swatch => {
    swatch.addEventListener("input", (e) => {
      const field = form.elements[swatch.dataset.colorFor];
      if (field) {
        field.value = e.target.value;
        field.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  });
}

// ── Backdrop slider live feedback ──
function updateBackdropSliderDisplay(val) {
  const sliderEl = document.getElementById("backdropIntensitySlider");
  const valueEl = document.getElementById("backdropIntensityValue");
  if (!sliderEl) return;
  const num = val !== undefined ? val : Number(sliderEl.value);
  const pct = (num / 100) * 100;
  sliderEl.style.setProperty("--popup-slider-pct", `${pct}%`);
  if (valueEl) valueEl.textContent = `${num}%`;
}

function rememberBackdropIntensity() {
  const sliderEl = document.getElementById("backdropIntensitySlider");
  if (sliderEl) backdropDraft[backdropDraftMode] = Number(sliderEl.value);
}

(function initBackdropControl() {
  const sliderEl = document.getElementById("backdropIntensitySlider");
  if (!sliderEl) return;

  sliderEl.addEventListener("input", () => {
    rememberBackdropIntensity();
    updateBackdropSliderDisplay();
  });

  // When mode radio changes, update slider to show the value for the new mode
  form.querySelectorAll("input[name='backdropMode']").forEach(radio => {
    radio.addEventListener("change", () => {
      rememberBackdropIntensity();
      backdropDraftMode = radio.value;
      sliderEl.value = backdropDraft[backdropDraftMode];
      updateBackdropSliderDisplay();
    });
  });
})();

function showStatus(text) {
  statusEl.textContent = text;
  window.clearTimeout(showStatus.timeoutId);
  showStatus.timeoutId = window.setTimeout(() => {
    statusEl.textContent = "";
  }, 1400);
}

function showSaveNotification() {
  saveToast.classList.add("save-toast-visible");
  window.clearTimeout(showSaveNotification.timeoutId);
  showSaveNotification.timeoutId = window.setTimeout(() => {
    saveToast.classList.remove("save-toast-visible");
  }, 1800);
}

// Export / Import Settings
const exportButton = document.querySelector("#export-settings");
const importButton = document.querySelector("#import-settings");
const importFileInput = document.querySelector("#import-file");

if (exportButton && importButton && importFileInput) {
  exportButton.addEventListener("click", () => {
    chrome.storage.local.get(PEEK_DEFAULT_SETTINGS, settings => {
      const clean = cleanPeekSettings(settings);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(clean, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "preview-link-tab-settings.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showStatus("Exporté");
    });
  });

  importButton.addEventListener("click", () => {
    importFileInput.click();
  });

  importFileInput.addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    if (file.size > 1024 * 1024) {
      showStatus("Fichier trop volumineux (maximum 1 Mo).");
      importFileInput.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const cleaned = parsePeekSettingsImport(e.target.result);
        storeSettings(cleaned, () => {
          setFormSettings(cleaned);
          showStatus("Importé !");
          showSaveNotification();
        });
      } catch (err) {
        showStatus("Fichier invalide");
      }
    };
    reader.onerror = () => showStatus("Impossible de lire le fichier.");
    reader.onabort = () => showStatus("Lecture du fichier annulée.");
    try {
      reader.readAsText(file);
    } catch {
      showStatus("Impossible de lire le fichier.");
    }
    importFileInput.value = ""; // Reset
  });
}
