const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadSettings() {
  const source = fs.readFileSync(path.join(__dirname, "..", "settings.js"), "utf8");
  const context = { URL };
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.exportsForTest = { setPeekDomainRule, cleanPeekSavedThemes, parsePeekSettingsImport, PEEK_THEME_PRESETS, PEEK_SETTING_OPTIONS, applyPeekTheme, cleanPeekSettings, parseDomainList, parseDomainRules, getDomainRule, isPeekAllowedForHost, peekOverlayViewportPosition };`, context);
  return context.exportsForTest;
}

const settings = loadSettings();

test("normalise les réglages importés", () => {
  const clean = settings.cleanPeekSettings({
    closeWithEsc: "false",
    hoverPreviewDelay: 99999,
    customAccent: "invalid"
  });

  assert.equal(clean.closeWithEsc, false);
  assert.equal(Object.hasOwn(clean, 'hoverPreviewDelay'), false);
  assert.equal(clean.customAccent, "#2563eb");
});

test("accepte les domaines sous forme de nom, joker ou URL", () => {
  assert.equal(
    JSON.stringify(settings.parseDomainList("*.example.com, https://docs.example.org/path\nBANQUE.FR")),
    JSON.stringify(["example.com", "docs.example.org", "banque.fr"])
  );
  assert.equal(settings.isPeekAllowedForHost("sub.example.com", {
    domainListMode: "blacklist",
    domainList: "example.com"
  }), false);
});

test("la règle de domaine la plus spécifique est retenue", () => {
  const rule = settings.getDomainRule("docs.example.com", {
    domainRules: "example.com = compact\ndocs.example.com = overlay"
  });
  assert.equal(JSON.stringify(rule), JSON.stringify({ domain: "docs.example.com", mode: "overlay" }));
});

test("positionne le panneau sans sortir du viewport", () => {
  assert.equal(
    JSON.stringify(settings.peekOverlayViewportPosition({ position: "bottomRight" }, 960, 540, 1000, 600)),
    JSON.stringify({ left: 24, top: 36 })
  );
});

test("le mode vue partagée est conservé dans les réglages", () => {
  assert.equal(settings.cleanPeekSettings({ openMode: "split" }).openMode, "split");
});


test("les sept thèmes officiels sont acceptés et les anciens choix sont migrés", () => {
  const themes = ['catppuccin', 'nordic', 'nord', 'gruvbox', 'tokyoNight', 'dracula', 'everforest', 'custom'];
  assert.deepEqual(Array.from(settings.PEEK_SETTING_OPTIONS.theme), themes);
  for (const theme of themes) {
    assert.equal(settings.cleanPeekSettings({ theme }).theme, theme);
  }
  for (const theme of ['system', 'light', 'dark', 'graphite', 'mint', 'unknown']) {
    const clean = settings.cleanPeekSettings({ theme, backdropBlur: 73, position: 'bottomLeft' });
    assert.equal(clean.theme, 'catppuccin');
    assert.equal(clean.backdropBlur, 73);
    assert.equal(clean.position, 'bottomLeft');
  }
});

test("chaque thème remplace toute la palette sans couleurs résiduelles", () => {
  const values = new Map();
  const node = { style: { setProperty: (key, value) => values.set(key, value) } };
  const expectedBackgrounds = {
    catppuccin: '#1e1e2e', nordic: '#242933', nord: '#2e3440', gruvbox: '#282828',
    tokyoNight: '#1a1b26', dracula: '#282a36', everforest: '#2d353b'
  };
  for (const [theme, bg] of Object.entries(expectedBackgrounds)) {
    settings.applyPeekTheme(node, theme);
    assert.equal(values.get('--peek-bg'), bg);
    assert.equal(values.get('color-scheme'), 'dark');
    assert.match(values.get('--peek-backdrop-color'), /^\d+, \d+, \d+$/);
    for (const [role, color] of Object.entries(settings.PEEK_THEME_PRESETS[theme])) {
      assert.match(color, /^#[0-9a-f]{6}$/);
      if (role !== 'backdrop-color') assert.equal(values.get('--peek-' + role), color);
    }
  }
});

test('changer de thème préserve le choix d’ombre au lieu de le remplacer', () => {
  const values = new Map([['--peek-panel-shadow', 'none']]);
  const node = { style: { setProperty: (key, value) => values.set(key, value) } };
  settings.applyPeekTheme(node, 'nord');
  assert.equal(values.get('--peek-panel-shadow'), 'none');
  assert.equal(values.get('--peek-theme-shadow-opacity'), '.42');
  const light = settings.cleanPeekSettings({ theme: 'custom', customBackground: '#fafafa' });
  settings.applyPeekTheme(node, 'custom', light);
  assert.equal(values.get('--peek-panel-shadow'), 'none');
  assert.equal(values.get('--peek-theme-shadow-opacity'), '.24');
});

test('les nouveaux cadres et ombres survivent à la sauvegarde et à l’import', () => {
  for (const frameStyle of ['roundedLarge', 'borderless', 'double']) {
    for (const panelShadow of ['ambient', 'crisp']) {
      const saved = settings.cleanPeekSettings({ frameStyle, panelShadow });
      const imported = settings.parsePeekSettingsImport(JSON.stringify(saved));
      assert.equal(imported.frameStyle, frameStyle);
      assert.equal(imported.panelShadow, panelShadow);
    }
  }
  assert.equal(settings.cleanPeekSettings({ frameStyle: 'soft' }).frameStyle, 'rounded');
});

test("tous les sélecteurs proposent uniquement la même liste de thèmes", () => {
  let count = 0;
  for (const name of ['popup.html', 'content.js']) {
    const source = fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
    for (const match of source.matchAll(/<select name="theme">([\s\S]*?)<\/select>/g)) {
      const values = [...match[1].matchAll(/value="([^"]+)"/g)].map(item => item[1]);
      assert.deepEqual(values, Array.from(settings.PEEK_SETTING_OPTIONS.theme));
      count++;
    }
  }
  assert.equal(count, 3);
});


test("un thème personnalisé conserve ses couleurs et remplace un thème connu", () => {
  const clean = settings.cleanPeekSettings({ theme: 'custom', customAccent: '#123456',
    customBackground: '#fafafa', customBackdrop: '#102030', customBackdropOpacity: 24 });
  assert.equal(clean.theme, 'custom');
  const values = new Map();
  const node = { style: { setProperty: (key, value) => values.set(key, value) } };
  settings.applyPeekTheme(node, 'dracula');
  settings.applyPeekTheme(node, 'custom', clean);
  assert.equal(values.get('--peek-accent'), '#123456');
  assert.equal(values.get('--peek-bg'), '#fafafa');
  assert.equal(values.get('color-scheme'), 'light');
  assert.equal(values.get('--peek-backdrop-color'), '16, 32, 48');
  assert.equal(values.get('--peek-backdrop-opacity'), '0.24');
  settings.applyPeekTheme(node, 'nord', clean);
  assert.equal(values.get('--peek-bg'), '#2e3440');
  assert.equal(values.get('color-scheme'), 'dark');
  assert.equal(values.get('--peek-backdrop-opacity'), '0.35');
});


test('un import exige un objet de réglages et ignore les clés inconnues', () => {
  for (const input of ['null', '[]', '42', 'true', '"theme"', '{}', '{"unrelated":1}', '{']) {
    assert.throws(() => settings.parsePeekSettingsImport(input));
  }
  const imported = settings.parsePeekSettingsImport('{"theme":"nord","unknown":1,"__proto__":{"polluted":true}}');
  assert.equal(imported.theme, 'nord');
  assert.equal(Object.hasOwn(imported, 'unknown'), false);
  assert.equal(Object.hasOwn(imported, '__proto__'), false);
});


test('une règle rapide remplace seulement le domaine choisi et peut être supprimée', () => {
  const rules = 'example.com = compact\ndocs.example.com = overlay\nother.test = blocked';
  const updated = settings.setPeekDomainRule(rules, 'https://docs.example.com/path', 'split');
  assert.equal(settings.getDomainRule('docs.example.com', { domainRules: updated }).mode, 'split');
  assert.equal(settings.getDomainRule('example.com', { domainRules: updated }).mode, 'compact');
  const removed = settings.setPeekDomainRule(updated, 'docs.example.com', 'default');
  assert.equal(settings.getDomainRule('docs.example.com', { domainRules: removed }).mode, 'compact');
  assert.match(removed, /other.test = blocked/);
  assert.throws(() => settings.setPeekDomainRule(rules, 'example.com', 'invalid'));
});

test('les thèmes enregistrés survivent à un export/import et une référence absente est corrigée', () => {
  const colors = { customAccent: '#123456', customBackground: '#eeeeee', customBackdropOpacity: 23 };
  const clean = settings.cleanPeekSettings({ theme: 'saved:mon-theme', savedThemes: [{ id: 'mon-theme', name: 'Mon thème', colors }] });
  assert.equal(clean.theme, 'saved:mon-theme');
  const imported = settings.parsePeekSettingsImport(JSON.stringify(clean));
  assert.equal(imported.savedThemes[0].colors.customAccent, '#123456');
  const values = new Map();
  settings.applyPeekTheme({ style: { setProperty: (key, value) => values.set(key, value) } }, imported.theme, imported);
  assert.equal(values.get('--peek-bg'), '#eeeeee');
  assert.equal(values.get('--peek-backdrop-opacity'), '0.23');
  assert.equal(settings.cleanPeekSettings({ ...clean, savedThemes: [] }).theme, 'catppuccin');
});

test('une bibliothèque importée filtre les entrées invalides, les doublons et les champs inconnus', () => {
  const cleaned = settings.cleanPeekSavedThemes([
    null, { id: '<html>', name: 'Non', colors: {} },
    { id: 'ok', name: '  Mon thème  ', colors: { customAccent: 'bad', unwanted: 1 }, extra: 1 },
    { id: 'ok', name: 'Doublon', colors: {} }
  ]);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].name, 'Mon thème');
  assert.equal(cleaned[0].colors.customAccent, '#2563eb');
  assert.equal(Object.hasOwn(cleaned[0].colors, 'unwanted'), false);
  assert.equal(Object.hasOwn(cleaned[0], 'extra'), false);
});
