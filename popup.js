const form = document.querySelector("#settings-form");
const resetButton = document.querySelector("#reset");
const statusEl = document.querySelector("#status");
const saveToast = document.querySelector("#save-toast");

loadSettings();

form.addEventListener("submit", event => {
  event.preventDefault();
  saveSettings();
});

form.addEventListener("change", () => {
  applyThemePresetToFields();
  updateAdvancedGroups();
  updateColorSwatches();
  showStatus("Modifications non sauvegardees");
});

form.addEventListener("input", () => {
  updateColorSwatches();
  showStatus("Modifications non sauvegardees");
});

function saveSettings() {
  if (!form.checkValidity()) {
    showStatus("Valeur invalide");
    return;
  }
  const settings = getFormSettings();
  chrome.storage.local.set(settings, () => {
    updateAdvancedGroups();
    updateColorSwatches();
    showStatus("Sauvegarde");
    showSaveNotification();
  });
}

resetButton.addEventListener("click", () => {
  chrome.storage.local.set(PEEK_DEFAULT_SETTINGS, () => {
    setFormSettings(PEEK_DEFAULT_SETTINGS);
    showStatus("Parametres remis par defaut");
  });
});

function loadSettings() {
  chrome.storage.local.get(PEEK_DEFAULT_SETTINGS, stored => {
    setFormSettings(cleanPeekSettings(stored));
  });
}

function getFormSettings() {
  return cleanPeekSettings({
    openMode: form.elements.openMode.value,
    size: form.elements.size.value,
    customWidth: form.elements.customWidth.value,
    customHeight: form.elements.customHeight.value,
    position: form.elements.position.value,
    customLeft: form.elements.customLeft.value,
    customTop: form.elements.customTop.value,
    trigger: form.elements.trigger.value,
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
    animationSpeed: form.elements.animationSpeed.value,
    frameStyle: form.elements.frameStyle.value,
    closeOutside: form.elements.closeOutside.checked,
    closeWithEsc: form.elements.closeWithEsc.checked,
    dimBackdrop: form.elements.dimBackdrop.checked,
    closeAfterOpen: form.elements.closeAfterOpen.checked
  });
}

function setFormSettings(settings) {
  const clean = cleanPeekSettings(settings);
  const display = {
    ...clean,
    ...(PEEK_THEME_PRESETS[clean.theme] || {})
  };
  form.elements.size.value = clean.size;
  form.elements.openMode.value = clean.openMode;
  form.elements.customWidth.value = clean.customWidth;
  form.elements.customHeight.value = clean.customHeight;
  form.elements.position.value = clean.position;
  form.elements.customLeft.value = clean.customLeft;
  form.elements.customTop.value = clean.customTop;
  form.elements.trigger.value = clean.trigger;
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
  form.elements.animationSpeed.value = clean.animationSpeed;
  form.elements.frameStyle.value = clean.frameStyle;
  form.elements.closeOutside.checked = clean.closeOutside;
  form.elements.closeWithEsc.checked = clean.closeWithEsc;
  form.elements.dimBackdrop.checked = clean.dimBackdrop;
  form.elements.closeAfterOpen.checked = clean.closeAfterOpen;
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
  document.querySelectorAll(".advanced-group").forEach(group => {
    const controller = form.elements[group.dataset.enabledBy];
    const isEnabled = controller?.value === group.dataset.enabledValue;
    group.dataset.active = String(isEnabled);
    group.disabled = !isEnabled;
  });
}

function updateColorSwatches() {
  document.querySelectorAll("[data-color-for]").forEach(swatch => {
    const field = form.elements[swatch.dataset.colorFor];
    const value = field?.value?.trim();
    swatch.style.background = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "transparent";
  });
}

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
