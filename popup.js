const form = document.querySelector("#settings-form");
const resetButton = document.querySelector("#reset");
const statusEl = document.querySelector("#status");
const saveToast = document.querySelector("#save-toast");

loadSettings();
initSectionNav();
initColorPickers();

form.addEventListener("submit", event => {
  event.preventDefault();
  saveSettings();
});

form.addEventListener("change", () => {
  applyThemePresetToFields();
  updateAdvancedGroups();
  updateColorSwatches();
  showStatus("Modifications non sauvegardées");
});

form.addEventListener("input", () => {
  updateColorSwatches();
  showStatus("Modifications non sauvegardées");
});

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
  chrome.storage.local.set(settings, () => {
    updateAdvancedGroups();
    updateColorSwatches();
    showStatus("Sauvegardé");
    showSaveNotification();
  });
}

resetButton.addEventListener("click", () => {
  chrome.storage.local.set(PEEK_DEFAULT_SETTINGS, () => {
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
    customAccent: form.elements.customAccent.value,
    customBackground: form.elements.customBackground.value,
    customHeader: form.elements.customHeader.value,
    customFrame: form.elements.customFrame.value,
    customText: form.elements.customText.value,
    customMuted: form.elements.customMuted.value,
    customBorder: form.elements.customBorder.value,
    customBackdrop: form.elements.customBackdrop.value,
    customBackdropOpacity: form.elements.customBackdropOpacity.value,
    animation: form.elements.animation.value,
    animationSpeed: getRadioValue("animationSpeed"),
    frameStyle: form.elements.frameStyle.value,
    panelShadow: form.elements.panelShadow.value,
    backdropMode: getRadioValue("backdropMode") || "dim",
    backdropOpacity: getRadioValue("backdropMode") !== "blur"
      ? Number(form.elements.backdropIntensity?.value ?? PEEK_DEFAULT_SETTINGS.backdropOpacity)
      : PEEK_DEFAULT_SETTINGS.backdropOpacity,
    backdropBlur: getRadioValue("backdropMode") === "blur"
      ? Number(form.elements.backdropIntensity?.value ?? PEEK_DEFAULT_SETTINGS.backdropBlur)
      : 0,
    domainListMode: form.elements.domainListMode.value,
    domainList: form.elements.domainList.value,
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
  const display = {
    ...clean,
    ...(PEEK_THEME_PRESETS[clean.theme] || {})
  };
  setRadioValue("size", clean.size);
  form.elements.openMode.value = clean.openMode;
  form.elements.customWidth.value = clean.customWidth;
  form.elements.customHeight.value = clean.customHeight;
  form.elements.position.value = clean.position;
  form.elements.customLeft.value = clean.customLeft;
  form.elements.customTop.value = clean.customTop;
  setRadioValue("trigger", clean.trigger);
  form.elements.theme.value = clean.theme;
  form.elements.customAccent.value = display.customAccent;
  form.elements.customBackground.value = display.customBackground;
  form.elements.customHeader.value = display.customHeader;
  form.elements.customFrame.value = display.customFrame;
  form.elements.customText.value = display.customText;
  form.elements.customMuted.value = display.customMuted;
  form.elements.customBorder.value = display.customBorder;
  form.elements.customBackdrop.value = display.customBackdrop;
  form.elements.customBackdropOpacity.value = display.customBackdropOpacity;
  form.elements.animation.value = clean.animation;
  setRadioValue("animationSpeed", clean.animationSpeed);
  form.elements.frameStyle.value = clean.frameStyle;
  form.elements.panelShadow.value = clean.panelShadow;

  // Backdrop control
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
  form.elements.middleClick.checked = clean.middleClick;
  form.elements.closeOutside.checked = clean.closeOutside;
  form.elements.closeWithEsc.checked = clean.closeWithEsc;
  form.elements.closeAfterOpen.checked = clean.closeAfterOpen;
  form.elements.autoCompactFallback.checked = clean.autoCompactFallback;
  form.elements.compactFallbackDomains.value = clean.compactFallbackDomains;
  updateAdvancedGroups();
  updateColorSwatches();
}

function applyThemePresetToFields() {
  const preset = PEEK_THEME_PRESETS[form.elements.theme.value];
  if (!preset) {
    return;
  }
  for (const [key, value] of Object.entries(preset)) {
    if (form.elements[key]) {
      form.elements[key].value = value;
    }
  }
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

(function initBackdropControl() {
  const sliderEl = document.getElementById("backdropIntensitySlider");
  if (!sliderEl) return;

  sliderEl.addEventListener("input", () => {
    updateBackdropSliderDisplay();
  });

  // When mode radio changes, update slider to show the value for the new mode
  form.querySelectorAll("input[name='backdropMode']").forEach(radio => {
    radio.addEventListener("change", () => {
      // Re-read stored settings to get the right value for this mode
      chrome.storage.local.get(PEEK_DEFAULT_SETTINGS, stored => {
        const clean = cleanPeekSettings(stored);
        const isBlur = radio.value === "blur";
        const newIntensity = isBlur ? clean.backdropBlur : clean.backdropOpacity;
        sliderEl.value = newIntensity;
        updateBackdropSliderDisplay(newIntensity);
      });
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
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target.result);
        const cleaned = cleanPeekSettings(parsed);
        chrome.storage.local.set(cleaned, () => {
          setFormSettings(cleaned);
          showStatus("Importé !");
          showSaveNotification();
        });
      } catch (err) {
        showStatus("Fichier invalide");
      }
    };
    reader.readAsText(file);
    importFileInput.value = ""; // Reset
  });
}

