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
let persistedSettings = null;
let latestSettings = null;
let mutationInFlight = false;
const deferredSettingsChanges = [];
let editingRuleDomain = null;
let pendingDeletion = null;
let pendingConflict = null;
let undoDeletionTimer = 0;
let activeSite = null;
let activeSitePaused = false;
const customThemeDraft = {};
let displayedTheme = null;

const SCALAR_SETTING_KEYS = Object.keys(PEEK_DEFAULT_SETTINGS)
  .filter(key => !["savedThemes", "domainRules"].includes(key));
const RADIO_SETTING_KEYS = new Set(["size", "trigger", "animationSpeed", "backdropMode"]);
const BOOLEAN_SETTING_KEYS = new Set(SCALAR_SETTING_KEYS
  .filter(key => typeof PEEK_DEFAULT_SETTINGS[key] === "boolean"));

const RULE_MODE_LABELS = { overlay: "Aperçu intégré", compact: "Fenêtre compacte", split: "Vue partagée native", blocked: "Désactivé" };

loadSettings();
initSectionNav();
initColorPickers();
initThemeLibrary();
initSiteControls();
initDomainRuleEditor();
initSettingsSync();
document.getElementById("discard-changes")?.addEventListener("click", () => {
  if (!persistedSettings || mutationInFlight) return;
  clearDeletionUndo();
  clearConflictNotice();
  persistedSettings = latestSettings || persistedSettings;
  setFormSettings(persistedSettings);
  saveToast.classList.remove("save-toast-visible");
  showStatus("Modifications annulées. Derniers réglages sauvegardés rétablis.");
});

document.getElementById("reload-settings")?.addEventListener("click", () => {
  if (mutationInFlight) return;
  clearConflictNotice();
  if (persistedSettings) {
    persistedSettings = latestSettings || persistedSettings;
    setFormSettings(persistedSettings);
  }
  showStatus("Version enregistrée chargée.");
});

document.getElementById("reapply-settings")?.addEventListener("click", () => {
  if (mutationInFlight) return;
  const conflict = pendingConflict;
  clearConflictNotice();
  if (!conflict || !persistedSettings) return;
  persistedSettings = latestSettings || persistedSettings;
  if (conflict.retry) conflict.retry();
  else mutateSettings(refreshMutationExpectations(conflict.mutation, persistedSettings), conflict.onSuccess);
});

form.addEventListener("submit", event => {
  event.preventDefault();
  saveSettings();
});

form.addEventListener("invalid", event => {
  revealInvalidField(event.target);
  showStatus("Vérifiez la valeur indiquée.");
}, true);

form.addEventListener("change", event => {
  updateThemeColors();
  updateAdvancedGroups();
  updateColorSwatches();
  updateAppearancePreview();
  if (["animation", "animationSpeed"].includes(event?.target?.name)) replayAppearanceAnimation();
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
  const rule = getDomainRule(activeSite.hostname, { domainRules: form.elements.domainRules.value });
  const effective = document.getElementById("effective-site-rule");
  if (effective) effective.textContent = rule
    ? `Règle appliquée à la sauvegarde : ${RULE_MODE_LABELS[rule.mode]} (${rule.domain}${rule.domain !== activeSite.hostname ? ", héritée du domaine parent" : ""}).`
    : "Aucune règle par domaine : les réglages généraux et les listes de sites s’appliquent.";
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
  const disableSiteActions = message => {
    activeSite = null;
    activeSitePaused = false;
    document.getElementById("current-site").textContent = "";
    document.getElementById("effective-site-rule").textContent = "";
    document.getElementById("current-site-mode").value = "default";
    displayPause();
    button.disabled = true;
    ruleButton.disabled = true;
    document.getElementById("current-site-mode").disabled = true;
    status.textContent = message;
  };
  const closedTabs = new Set();
  chrome.tabs.onRemoved?.addListener(tabId => {
    closedTabs.add(tabId);
    if (activeSite?.tabId === tabId) disableSiteActions("L’onglet d’origine a été fermé. Les réglages généraux restent disponibles.");
  });
  chrome.tabs.onUpdated?.addListener((tabId, change) => {
    if (activeSite?.tabId === tabId && change.url && change.url !== activeSite.url) {
      disableSiteActions("Le site d’origine a changé. Rouvrez les paramètres depuis cet onglet.");
    }
  });
  const loadSite = tabs => {
    if (chrome.runtime.lastError) { status.textContent = "Impossible de lire le site courant."; return; }
    const tab = tabs[0];
    if (closedTabs.has(tab?.id)) {
      disableSiteActions("L’onglet d’origine a été fermé. Les réglages généraux restent disponibles.");
      return;
    }
    try {
      const url = new URL(tab?.url);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      activeSite = { tabId: tab.id, url: url.href, hostname: url.hostname };
    } catch { status.textContent = "Disponible depuis une page web."; return; }
    document.getElementById("current-site").textContent = activeSite.hostname;
    ruleButton.disabled = false;
    document.getElementById("current-site-mode").disabled = false;
    syncCurrentSiteRule();
    const source = activeSite;
    chrome.runtime.sendMessage({ type: "GET_SITE_PAUSE", tabId: source.tabId }, response => {
      if (activeSite !== source) return;
      if (chrome.runtime.lastError || !response?.ok) {
        if (/onglet|tab/i.test(response?.error || "")) {
          disableSiteActions("L’onglet d’origine a été fermé. Les réglages généraux restent disponibles.");
        } else {
          status.textContent = "État de pause indisponible.";
        }
        return;
      }
      activeSitePaused = response.paused;
      button.disabled = false;
      displayPause();
    });
  };
  const sourceTab = new URL(window.location.href).searchParams.get("sourceTabId");
  if (sourceTab !== null && /^\d+$/.test(sourceTab)) {
    // The active tab in this window is the settings page itself.
    chrome.tabs.get(Number(sourceTab), tab => {
      if (chrome.runtime.lastError || !tab) {
        disableSiteActions("L’onglet d’origine a été fermé. Les réglages généraux restent disponibles.");
        return;
      }
      loadSite([tab]);
    });
  } else {
    chrome.tabs.query({ active: true, currentWindow: true }, loadSite);
  }
  button.addEventListener("click", () => {
    if (!activeSite) return;
    button.disabled = true;
    const source = activeSite;
    chrome.runtime.sendMessage({ type: "SET_SITE_PAUSE", tabId: source.tabId, paused: !activeSitePaused }, response => {
      if (activeSite !== source) return;
      button.disabled = false;
      if (chrome.runtime.lastError || !response?.ok) {
        if (/onglet|tab/i.test(response?.error || "")) {
          disableSiteActions("L’onglet d’origine a été fermé. Les réglages généraux restent disponibles.");
        } else {
          status.textContent = "Impossible de modifier la pause. Réessayez.";
        }
        return;
      }
      activeSitePaused = response.paused;
      displayPause();
      status.textContent = activeSitePaused ? "Les déclencheurs sont en pause sur ce site." : "Les déclencheurs sont réactivés sur ce site.";
    });
  });
  ruleButton.addEventListener("click", () => {
    if (!activeSite || mutationInFlight || !persistedSettings) return;
    ruleButton.disabled = true;
    mutationInFlight = true;
    const source = activeSite;
    const reference = { ...persistedSettings, domainRules: setPeekDomainRule(persistedSettings.domainRules, source.hostname,
      rulesByDomain(form.elements.domainRules.value).get(source.hostname) || "default") };
    try {
      chrome.runtime.sendMessage({ type: "SET_DOMAIN_RULE", tabId: source.tabId, url: source.url,
        mode: document.getElementById("current-site-mode").value }, response => {
        mutationInFlight = false;
        if (activeSite !== source) { flushSettingsNotifications(); return; }
        ruleButton.disabled = false;
        if (chrome.runtime.lastError || !response?.ok) {
          flushSettingsNotifications();
          if (/onglet|tab/i.test(response?.error || "")) {
            disableSiteActions("L’onglet d’origine a été fermé. Les réglages généraux restent disponibles.");
          } else {
            status.textContent = "Impossible de sauvegarder la règle.";
          }
          return;
        }
        reconcileSettings(cleanPeekSettings({ ...(latestSettings || persistedSettings), domainRules: response.domainRules }),
          reference, { domainRules: [{ domain: source.hostname }] });
        flushSettingsNotifications();
        status.textContent = "Règle du site enregistrée.";
      });
    } catch {
      mutationInFlight = false;
      flushSettingsNotifications();
      ruleButton.disabled = !activeSite;
      status.textContent = "Impossible de sauvegarder la règle.";
    }
  });
}

function initSectionNav() {
  const buttons = [...document.querySelectorAll(".section-nav-btn")];
  buttons.forEach((btn, index) => {
    btn.addEventListener("click", () => switchSection(btn.dataset.section));
    btn.addEventListener("keydown", event => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % buttons.length;
      else if (event.key === "ArrowLeft") next = (index - 1 + buttons.length) % buttons.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = buttons.length - 1;
      else return;
      event.preventDefault();
      switchSection(buttons[next].dataset.section);
      buttons[next].focus();
    });
  });
}

function switchSection(sectionId) {
  document.querySelectorAll(".section-nav-btn").forEach(btn => {
    const active = btn.dataset.section === sectionId;
    btn.classList.toggle("section-nav-btn-active", active);
    btn.setAttribute("aria-selected", String(active));
    btn.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll(".form-section").forEach(section => {
    const active = section.dataset.section === sectionId;
    section.classList.toggle("form-section-active", active);
    section.hidden = !active;
  });
  const workspace = document.getElementById("settings-workspace");
  if (workspace) workspace.dataset.section = sectionId;
  const preview = document.getElementById("appearance-preview");
  if (preview) preview.hidden = sectionId !== "appearance";
  const scrollArea = document.querySelector(".settings-scroll");
  if (scrollArea) scrollArea.scrollTop = 0;
}

function revealInvalidField(invalid) {
  const section = invalid?.closest(".form-section");
  if (section) switchSection(section.dataset.section);
  let container = invalid?.parentElement;
  while (container && container !== form) {
    if (container.tagName === "DETAILS") container.open = true;
    container = container.parentElement;
  }
  invalid?.focus();
}

function saveSettings() {
  if (mutationInFlight) return;
  if (document.getElementById("rule-domain")?.value.trim() && !applyDomainRuleEdit()) return;
  if (!form.checkValidity()) {
    revealInvalidField(form.querySelector("input:invalid, select:invalid, textarea:invalid"));
    showStatus("Valeur invalide");
    return;
  }
  if (!persistedSettings) {
    showStatus("Réglages encore en cours de chargement. Réessayez.");
    return;
  }
  const mutation = buildSettingsMutation(getFormSettings(), persistedSettings);
  if (!hasMutation(mutation)) {
    clearDeletionUndo();
    showSettingsSaveResult("Sauvegardé", true);
    return;
  }
  mutateSettings(mutation, () => {
    clearDeletionUndo();
    showSettingsSaveResult("Sauvegardé", true);
  }, saveSettings);
}

function storeSettings(settings, onSuccess) {
  mutateSettings({ replace: cleanPeekSettings(settings) }, onSuccess);
}

function sameSettingValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function rulesByDomain(value) {
  return new Map(parseDomainRules(value).map(rule => [rule.domain, rule.mode]));
}

function themesById(value) {
  return new Map(value.map(item => [item.id, item]));
}

function mergeDomainRulesDraft(draft, previous, incoming) {
  let merged = incoming;
  const draftRules = rulesByDomain(draft);
  const previousRules = rulesByDomain(previous);
  for (const [domain, mode] of draftRules) {
    if (previousRules.get(domain) !== mode) {
      merged = setPeekDomainRule(merged, domain, mode);
    }
  }
  for (const domain of previousRules.keys()) {
    if (!draftRules.has(domain)) {
      merged = setPeekDomainRule(merged, domain, "default");
    }
  }
  return merged;
}

function mergeSavedThemesDraft(draft, previous, incoming) {
  const merged = themesById(incoming);
  const draftThemes = themesById(draft);
  const previousThemes = themesById(previous);
  for (const [id, theme] of draftThemes) {
    if (!sameSettingValue(theme, previousThemes.get(id))) {
      merged.set(id, theme);
    }
  }
  for (const id of previousThemes.keys()) {
    if (!draftThemes.has(id)) {
      merged.delete(id);
    }
  }
  return cleanPeekSavedThemes([...merged.values()]);
}

function buildSettingsMutation(draft, reference) {
  const scalars = SCALAR_SETTING_KEYS
    .filter(key => !sameSettingValue(draft[key], reference[key]))
    .map(key => ({ key, value: draft[key], expected: reference[key] }));

  const domainRules = [];
  const draftRules = rulesByDomain(draft.domainRules);
  const referenceRules = rulesByDomain(reference.domainRules);
  for (const [domain, mode] of draftRules) {
    if (referenceRules.get(domain) !== mode) {
      domainRules.push({ domain, mode, expected: referenceRules.has(domain) ? referenceRules.get(domain) : null });
    }
  }
  for (const [domain, mode] of referenceRules) {
    if (!draftRules.has(domain)) {
      domainRules.push({ domain, mode: "default", expected: mode });
    }
  }

  const savedThemes = [];
  const draftThemes = themesById(draft.savedThemes);
  const referenceThemes = themesById(reference.savedThemes);
  for (const [id, theme] of draftThemes) {
    if (!sameSettingValue(theme, referenceThemes.get(id))) {
      savedThemes.push({ id, theme, expected: referenceThemes.get(id) ?? null });
    }
  }
  for (const [id, theme] of referenceThemes) {
    if (!draftThemes.has(id)) {
      savedThemes.push({ id, theme: null, expected: theme });
    }
  }

  return { scalars, domainRules, savedThemes };
}

function hasMutation(mutation) {
  return (mutation.scalars?.length || 0) + (mutation.domainRules?.length || 0) + (mutation.savedThemes?.length || 0) > 0;
}

function refreshMutationExpectations(mutation, settings) {
  const rules = rulesByDomain(settings.domainRules);
  const themes = themesById(settings.savedThemes);
  return {
    scalars: (mutation.scalars || []).map(change => ({ key: change.key, value: change.value, expected: settings[change.key] })),
    domainRules: (mutation.domainRules || []).map(operation => ({
      ...operation,
      expected: rules.has(operation.domain) ? rules.get(operation.domain) : null
    })),
    savedThemes: (mutation.savedThemes || []).map(operation => ({
      ...operation,
      // A restore must not overwrite a theme recreated elsewhere.
      expected: operation.expected === null && operation.theme != null
        ? null
        : (themes.get(operation.id) ?? null)
    }))
  };
}

// Reconcile each entry independently: locally changed entries retain their original
// comparison value until an explicit retry or a successful write acknowledges them.
function reconcileSettings(next, reference = persistedSettings, acknowledge = null) {
  const draft = getFormSettings();
  const rawDraft = {};
  for (const key of SCALAR_SETTING_KEYS) {
    if (RADIO_SETTING_KEYS.has(key) || BOOLEAN_SETTING_KEYS.has(key) || ["theme", "backdropOpacity", "backdropBlur"].includes(key)) continue;
    if ((Object.hasOwn(themeColorRoles, key) || key === "customBackdropOpacity") && displayedTheme !== "custom") continue;
    if (form.elements[key]) rawDraft[key] = form.elements[key].value;
  }
  const merged = { ...next };
  const baseline = { ...next };
  for (const [key, value] of Object.entries(rawDraft)) {
    // Invalid intermediate text can normalize back to the old value, while
    // still being a local edit that an unrelated notification must preserve.
    if (String(value) !== String(draft[key]) && String(value) !== String(reference[key])) {
      merged[key] = draft[key];
      baseline[key] = persistedSettings[key];
    }
  }
  for (const key of SCALAR_SETTING_KEYS) {
    if (!sameSettingValue(draft[key], reference[key])) {
      merged[key] = draft[key];
      baseline[key] = persistedSettings[key];
    }
  }
  merged.domainRules = mergeDomainRulesDraft(draft.domainRules, reference.domainRules, next.domainRules);
  merged.savedThemes = mergeSavedThemesDraft(draft.savedThemes, reference.savedThemes, next.savedThemes);
  baseline.domainRules = mergeDomainRulesDraft(persistedSettings.domainRules, draft.domainRules, next.domainRules);
  baseline.savedThemes = mergeSavedThemesDraft(persistedSettings.savedThemes, draft.savedThemes, next.savedThemes);
  if (acknowledge) {
    for (const change of acknowledge.scalars || []) baseline[change.key] = next[change.key];
    for (const operation of acknowledge.domainRules || []) {
      baseline.domainRules = setPeekDomainRule(baseline.domainRules, operation.domain,
        rulesByDomain(next.domainRules).get(operation.domain) || "default");
    }
    const themes = themesById(baseline.savedThemes);
    for (const operation of acknowledge.savedThemes || []) {
      const actual = themesById(next.savedThemes).get(operation.id);
      if (actual) themes.set(operation.id, actual); else themes.delete(operation.id);
    }
    baseline.savedThemes = [...themes.values()];
    if (acknowledge.replace) Object.assign(baseline, next);
  }
  latestSettings = next;
  persistedSettings = baseline;
  setFormSettings(merged, true);
  // Partial/invalid text is still a draft; cleaning it is reserved for submit.
  for (const [key, value] of Object.entries(rawDraft)) {
    if (sameSettingValue(merged[key], draft[key]) &&
        (!sameSettingValue(draft[key], reference[key]) || String(value) !== String(draft[key]))) {
      form.elements[key].value = value;
    }
  }
  updateColorSwatches();
}

function flushSettingsNotifications() {
  for (const incoming of deferredSettingsChanges.splice(0)) {
    const next = cleanPeekSettings({ ...(latestSettings || persistedSettings), ...incoming });
    if (!sameSettingValue(next, latestSettings)) reconcileSettings(next);
  }
}

function mutateSettings(mutation, onSuccess, retry = null) {
  if (mutationInFlight) return;
  clearConflictNotice();
  mutationInFlight = true;
  // Only submitted entries may be acknowledged by this reply. Other drafts and
  // edits made while the worker is running must survive its notification/reply.
  const submitted = getFormSettings();
  const reference = { ...persistedSettings };
  if (mutation.replace) Object.assign(reference, submitted);
  for (const change of mutation.scalars || []) reference[change.key] = submitted[change.key];
  if (mutation.domainRules?.length) {
    for (const operation of mutation.domainRules) reference.domainRules = setPeekDomainRule(reference.domainRules,
      operation.domain, rulesByDomain(submitted.domainRules).get(operation.domain) || "default");
  }
  if (mutation.savedThemes?.length) {
    const themes = themesById(reference.savedThemes);
    for (const operation of mutation.savedThemes) {
      const item = themesById(submitted.savedThemes).get(operation.id);
      if (item) themes.set(operation.id, item); else themes.delete(operation.id);
    }
    reference.savedThemes = [...themes.values()];
  }
  try {
    chrome.runtime.sendMessage({ type: "MUTATE_SETTINGS", ...mutation }, response => {
      mutationInFlight = false;
      if (chrome.runtime.lastError || !response?.ok) {
        flushSettingsNotifications();
        showStatus("Échec de la sauvegarde. Réessayez.");
        return;
      }
      if (response.conflict) {
        reconcileSettings(cleanPeekSettings(response.settings));
        flushSettingsNotifications();
        pendingConflict = { mutation, onSuccess, retry };
        const notice = document.getElementById("conflict-notice");
        const message = document.getElementById("conflict-message");
        if (message) message.textContent = describeConflict(response.conflict);
        if (notice) notice.hidden = false;
        showStatus("Conflit : des réglages ont changé dans une autre fenêtre.");
        return;
      }
      reconcileSettings(cleanPeekSettings(response.settings), reference, mutation);
      flushSettingsNotifications();
      onSuccess(persistedSettings);
    });
  } catch {
    mutationInFlight = false;
    flushSettingsNotifications();
    showStatus("Échec de la sauvegarde. Réessayez.");
  }
}

function describeConflict(conflict) {
  if (conflict?.kind === "domainRule") {
    return `La règle de ${conflict.key} a changé dans une autre fenêtre.`;
  }
  if (conflict?.kind === "theme") {
    return `Le thème « ${conflict.key} » a changé dans une autre fenêtre.`;
  }
  return `Le réglage « ${conflict?.key || "inconnu"} » a changé dans une autre fenêtre.`;
}

function clearConflictNotice() {
  pendingConflict = null;
  const notice = document.getElementById("conflict-notice");
  if (notice) notice.hidden = true;
}

function initSettingsSync() {
  if (!chrome.storage?.onChanged) return;
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !persistedSettings) return;
    const incoming = {};
    for (const key of Object.keys(PEEK_DEFAULT_SETTINGS)) {
      if (Object.hasOwn(changes, key)) incoming[key] = changes[key].newValue;
    }
    if (Object.keys(incoming).length === 0) return;
    // Process the reply before notifications observed during this request, so
    // a delayed reply cannot roll back a newer write from another window.
    if (mutationInFlight) { deferredSettingsChanges.push(incoming); return; }

    const next = cleanPeekSettings({ ...(latestSettings || persistedSettings), ...incoming });
    reconcileSettings(next);
    showStatus("Réglages actualisés ; vos modifications locales sont conservées.");
  });
}

resetButton.addEventListener("click", () => {
  storeSettings(PEEK_DEFAULT_SETTINGS, () => {
    clearDeletionUndo();
    showSettingsSaveResult("Paramètres réinitialisés");
  });
});

function loadSettings() {
  chrome.storage.local.get(PEEK_DEFAULT_SETTINGS, stored => {
    if (chrome.runtime.lastError) { showStatus("Impossible de charger les réglages. Rouvrez les paramètres."); return; }
    persistedSettings = cleanPeekSettings(stored);
    latestSettings = persistedSettings;
    setFormSettings(persistedSettings);
    const discard = document.getElementById("discard-changes");
    if (discard) discard.disabled = false;
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

function setFormSettings(settings, preserveEditors = false) {
  const themeName = document.getElementById("theme-name")?.value;
  const oldSelection = form.elements.theme.value;
  const oldName = savedThemesDraft.find(item => `saved:${item.id}` === oldSelection)?.name || "";
  const preserveName = preserveEditors && (themeName !== oldName);
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
  renderDomainRules();
  if (!preserveEditors) resetRuleEditor();
  if (preserveName && themeName !== undefined) document.getElementById("theme-name").value = themeName;
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
  if (changed && theme === "custom") {
    const colorsSection = document.querySelector(".color-group")?.closest?.("details");
    if (colorsSection) colorsSection.open = true;
  }
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
  const saveTheme = () => {
    if (mutationInFlight) return;
    const name = document.getElementById("theme-name").value.trim();
    if (!name) { showStatus("Donnez un nom au thème."); return; }
    if (!form.checkValidity()) { showStatus("Corrigez les valeurs invalides."); return; }
    const existing = savedThemesDraft.find(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (!existing && savedThemesDraft.length >= 50) { showStatus("Maximum 50 thèmes personnels."); return; }
    const [entry] = cleanPeekSavedThemes([{
      id: existing?.id || crypto.randomUUID(), name, colors: selectedThemeColors()
    }]);
    if (!entry) { showStatus("Thème invalide."); return; }
    const reference = persistedSettings?.savedThemes.find(item => item.id === entry.id) || null;
    mutateSettings({
      scalars: [{ key: "theme", value: `saved:${entry.id}`, expected: persistedSettings?.theme }],
      savedThemes: [{ id: entry.id, theme: entry, expected: reference }]
    }, () => {
      showStatus("Thème enregistré dans Mes thèmes.");
    }, saveTheme);
  };
  document.getElementById("save-theme")?.addEventListener("click", saveTheme);
  document.getElementById("delete-theme")?.addEventListener("click", () => {
    const id = form.elements.theme.value;
    const saved = savedThemesDraft.find(item => `saved:${item.id}` === id);
    if (!saved) return;
    const reference = persistedSettings?.savedThemes.find(item => item.id === saved.id) || null;
    const scalars = [
      { key: "theme", value: "custom", expected: persistedSettings?.theme },
      ...[...Object.keys(themeColorRoles), "customBackdropOpacity"].map(key => ({
        key, value: saved.colors[key], expected: persistedSettings?.[key]
      }))
    ];
    mutateSettings({
      scalars,
      savedThemes: [{ id: saved.id, theme: null, expected: reference }]
    }, () => {
      offerDeletionUndo({ type: "theme", saved }, "Thème supprimé.");
      showStatus("Thème supprimé. Ses couleurs restent dans Personnalisé.");
    });
  });
  document.getElementById("replay-preview")?.addEventListener("click", replayAppearanceAnimation);
}

function replayAppearanceAnimation() {
  const panel = document.getElementById("sample-panel");
  if (!panel) return;
  panel.classList.remove("sample-animate");
  void panel.offsetWidth;
  panel.classList.add("sample-animate");
}

function updateAppearancePreview() {
  const preview = document.getElementById("theme-preview");
  if (!preview) return;
  const settings = getFormSettings();
  applyPeekTheme(preview, settings.theme, settings);
  preview.dataset.size = settings.size;
  preview.dataset.frameStyle = settings.frameStyle;
  preview.dataset.panelShadow = settings.panelShadow;
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
  if (text === "Modifications non sauvegardées") return;
  showStatus.timeoutId = window.setTimeout(() => {
    statusEl.textContent = "";
  }, 4000);
}

function showSettingsSaveResult(message, notify = false) {
  const draft = getFormSettings();
  const selectedName = savedThemesDraft.find(item => `saved:${item.id}` === draft.theme)?.name || "";
  const pendingRule = document.getElementById("rule-domain")?.value.trim();
  const pendingName = (document.getElementById("theme-name")?.value || "") !== selectedName;
  if (hasMutation(buildSettingsMutation(draft, latestSettings || persistedSettings)) ||
      pendingRule || pendingName || !form.checkValidity()) {
    saveToast.classList.remove("save-toast-visible");
    showStatus("Sauvegarde terminée ; des modifications restent à sauvegarder.");
    return;
  }
  showStatus(message);
  if (notify) showSaveNotification();
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
          clearDeletionUndo();
          showSettingsSaveResult("Importé !", true);
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

function resetRuleEditor() {
  editingRuleDomain = null;
  const domain = document.getElementById("rule-domain");
  if (!domain) return;
  domain.value = "";
  domain.removeAttribute?.("aria-invalid");
  document.getElementById("rule-mode").value = "overlay";
  document.getElementById("add-domain-rule").textContent = "Ajouter la règle";
  document.getElementById("cancel-rule-edit").hidden = true;
  document.getElementById("rule-error").textContent = "";
}

function renderDomainRules() {
  const list = document.getElementById("domain-rules-list");
  if (!list) return;
  list.replaceChildren();
  const rules = parseDomainRules(form.elements.domainRules.value);
  if (!rules.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "Aucune règle par site.";
    list.appendChild(empty);
  }
  for (const rule of rules) {
    const row = document.createElement("div");
    row.className = "domain-rule-row";
    const description = document.createElement("span");
    description.textContent = `${rule.domain} — ${RULE_MODE_LABELS[rule.mode]}`;
    row.appendChild(description);
    for (const action of ["Modifier", "Supprimer"]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action;
      button.setAttribute("aria-label", `${action} la règle de ${rule.domain}`);
      button.addEventListener("click", () => {
        if (action === "Modifier") {
          editingRuleDomain = rule.domain;
          document.getElementById("rule-domain").value = rule.domain;
          document.getElementById("rule-mode").value = rule.mode;
          document.getElementById("add-domain-rule").textContent = "Appliquer la modification";
          document.getElementById("cancel-rule-edit").hidden = false;
          document.getElementById("rule-error").textContent = "";
          document.getElementById("rule-domain").focus?.();
        } else {
          const removed = parseDomainRules(form.elements.domainRules.value).filter(item => item.domain === rule.domain);
          form.elements.domainRules.value = setPeekDomainRule(form.elements.domainRules.value, rule.domain, "default");
          offerDeletionUndo({ type: "rule", removed }, `Règle de ${rule.domain} supprimée.`);
          resetRuleEditor();
          renderDomainRules();
          syncCurrentSiteRule();
          showStatus("Règle supprimée. Modifications non sauvegardées.");
        }
      });
      row.appendChild(button);
    }
    list.appendChild(row);
  }
}

function applyDomainRuleEdit() {
  const input = document.getElementById("rule-domain");
  const domain = normalizeDomainEntry(input.value);
  const error = document.getElementById("rule-error");
  const invalid = message => {
    error.textContent = message;
    input.setAttribute("aria-invalid", "true");
    revealInvalidField(input);
  };
  if (!domain || domain.length > 253 || !domain.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) {
    invalid("Saisissez un domaine ou une URL valide, par exemple exemple.com.");
    return false;
  }
  const rules = parseDomainRules(form.elements.domainRules.value);
  if (rules.some(rule => rule.domain === domain && domain !== editingRuleDomain)) {
    invalid("Une règle existe déjà pour ce domaine. Utilisez Modifier.");
    return false;
  }
  let value = form.elements.domainRules.value;
  if (editingRuleDomain && editingRuleDomain !== domain) value = setPeekDomainRule(value, editingRuleDomain, "default");
  form.elements.domainRules.value = setPeekDomainRule(value, domain, document.getElementById("rule-mode").value);
  resetRuleEditor();
  renderDomainRules();
  syncCurrentSiteRule();
  showStatus("Modifications non sauvegardées");
  return true;
}

function initDomainRuleEditor() {
  document.getElementById("add-domain-rule")?.addEventListener("click", applyDomainRuleEdit);
  document.getElementById("cancel-rule-edit")?.addEventListener("click", resetRuleEditor);
  document.getElementById("rule-domain")?.addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); applyDomainRuleEdit(); }
  });
}

function clearDeletionUndo() {
  pendingDeletion = null;
  window.clearTimeout(undoDeletionTimer);
  const notice = document.getElementById("undo-notice");
  if (notice) notice.hidden = true;
}

function offerDeletionUndo(deletion, message) {
  clearDeletionUndo();
  pendingDeletion = deletion;
  document.getElementById("undo-message").textContent = message;
  document.getElementById("undo-notice").hidden = false;
  undoDeletionTimer = window.setTimeout(clearDeletionUndo, 10000);
}

document.getElementById("undo-delete")?.addEventListener("click", () => {
  const deletion = pendingDeletion;
  if (!deletion) return;
  if (deletion.type === "rule") {
    const domain = deletion.removed[0].domain;
    if (parseDomainRules(form.elements.domainRules.value).some(rule => rule.domain === domain)) {
      showStatus("Une nouvelle règle existe pour ce domaine. Elle est conservée.");
      return;
    }
    form.elements.domainRules.value = [form.elements.domainRules.value, ...deletion.removed.map(rule => `${rule.domain} = ${rule.mode}`)].filter(Boolean).join("\n");
    clearDeletionUndo();
    renderDomainRules();
    syncCurrentSiteRule();
    showStatus("Règle rétablie. Modifications non sauvegardées.");
    return;
  }
  const saved = deletion.saved;
  if (savedThemesDraft.length >= 50 || savedThemesDraft.some(item => item.id === saved.id || item.name.toLocaleLowerCase() === saved.name.toLocaleLowerCase())) {
    showStatus("Un thème du même nom existe déjà ou la bibliothèque est pleine.");
    return;
  }
  const reference = persistedSettings?.savedThemes.find(item => item.id === saved.id) || null;
  mutateSettings({
    scalars: [{ key: "theme", value: `saved:${saved.id}`, expected: persistedSettings?.theme }],
    savedThemes: [{ id: saved.id, theme: saved, expected: reference }]
  }, () => {
    clearDeletionUndo();
    showStatus("Thème rétabli.");
  });
});
