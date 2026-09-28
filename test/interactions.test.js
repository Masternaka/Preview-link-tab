const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function element() {
  const listeners = {};
  const classes = new Set();
  return {
    value: '', checked: false, style: { setProperty() {}, removeProperty(name) { delete this[name]; } },
    listeners, textContent: '',
    addEventListener(name, handler) { listeners[name] = handler; },
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
      contains(name) { return classes.has(name); },
      toggle(name, on) { on ? classes.add(name) : classes.delete(name); }
    }
  };
}

function baseContext() {
  const timers = new Map();
  let timerId = 0;
  const window = {
    ...element(), location: { href: 'https://source.example/' },
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); }
  };
  window.top = window.self = window;
  const context = vm.createContext({ URL, console, window });
  vm.runInContext(source('settings.js'), context);
  return { context, window, timers };
}

async function contentHarness() {
  const harness = baseContext();
  const { context } = harness;
  class Element {}
  const document = element();
  const messages = [];
  Object.assign(context, {
    document, Element, HTMLElement: Element,
    chrome: {
      storage: { local: { get(defaults, cb) { cb(defaults); } } },
      runtime: { sendMessage(message, cb) { messages.push(message); cb?.({ ok: true }); } }
    }
  });
  const script = source('content.js').replace(/\}\)\(\);\s*$/, 'this.testApi = { STATE, startPreviewLoadTimer, doClose, openPreview }; })();');
  vm.runInContext(script, context);
  await Promise.resolve();
  const { STATE } = context.testApi;
  STATE.settings.openMode = 'compact';
  STATE.settings.middleClick = true;
  function click(url, type = 'auxclick') {
    const anchor = Object.assign(new Element(), { href: url, textContent: 'Lien' });
    anchor.closest = () => anchor;
    let prevented = false;
    let stopped = false;
    document.listeners[type]({ target: anchor, button: 1, altKey: true,
      preventDefault() { prevented = true; }, stopPropagation() { stopped = true; }
    });
    return { prevented, stopped };
  }
  return { ...harness, STATE, click, messages };
}

for (const type of ['click', 'auxclick']) {
  test(`${type} : un domaine exclu conserve le comportement natif`, async () => {
    const { STATE, click, messages } = await contentHarness();
    STATE.settings.domainRules = 'blocked.example = blocked';
    assert.deepEqual(click('https://blocked.example/', type), { prevented: false, stopped: false });
    STATE.settings.domainRules = '';
    STATE.settings.domainListMode = 'blacklist';
    STATE.settings.domainList = 'blocked.example';
    assert.equal(click('https://sub.blocked.example/', type).prevented, false);
    STATE.settings.domainListMode = 'whitelist';
    STATE.settings.domainList = 'allowed.example';
    assert.equal(click('https://other.example/', type).prevented, false);
    assert.equal(messages.length, 0);
    assert.deepEqual(click('https://allowed.example/', type), { prevented: true, stopped: true });
    assert.equal(messages[0].type, 'OPEN_COMPACT_WINDOW');
  });
}

test('une règle explicite autorisée prend priorité sur la liste des exclusions', async () => {
  const { STATE, click, messages } = await contentHarness();
  STATE.settings.domainListMode = 'blacklist';
  STATE.settings.domainList = 'example.com';
  STATE.settings.domainRules = 'docs.example.com = compact';
  assert.equal(click('https://docs.example.com/').prevented, true);
  assert.equal(messages.length, 1);
});

test('aperçu : confirmation valide, délai expiré, confirmation tardive et nouvelle navigation', async () => {
  const { context, STATE, window, timers } = await contentHarness();
  STATE.root = element();
  STATE.root.classList.add('peek-visible');
  STATE.iframe = { contentWindow: {} };
  STATE.currentUrl = 'https://preview.example/';
  STATE.previewHistory = [STATE.currentUrl];
  STATE.previewHistoryIndex = 0;
  const help = element();
  STATE.helpEl = { querySelector: () => help };
  const message = {
    source: STATE.iframe.contentWindow, origin: 'https://preview.example',
    data: { source: 'peek-preview', type: 'PEEK_FRAME_NAVIGATION', url: STATE.currentUrl }
  };
  context.testApi.startPreviewLoadTimer();
  window.listeners.message({ ...message, source: {} });
  window.listeners.message({ ...message, origin: 'https://wrong.example' });
  assert.equal(STATE.root.classList.contains('peek-loading'), true);
  assert.equal(timers.size, 1);
  [...timers.values()][0]();
  assert.equal(STATE.root.classList.contains('peek-blocked'), true);
  assert.match(help.textContent, /n’a pas pu être confirmé/);
  window.listeners.message(message);
  assert.equal(STATE.root.classList.contains('peek-loading'), false);
  assert.equal(STATE.root.classList.contains('peek-blocked'), false);
  assert.equal(timers.size, 0);
  context.testApi.startPreviewLoadTimer();
  assert.equal(STATE.root.classList.contains('peek-loading'), true);
  window.listeners.message(message);
  assert.equal(timers.size, 0);
});

function popupHarness() {
  const harness = baseContext();
  const { context } = harness;
  const fields = {};
  const radios = {};
  const nodes = {};
  let readCount = 0;
  let failWrite = false;
  let throwWrite = false;
  const writes = [];
  const form = element();
  form.elements = new Proxy(fields, { get(target, key) { return target[key] ||= element(); } });
  const radio = (name, value) => radios[`${name}:${value}`] ||= { ...element(), name, value };
  form.querySelector = selector => {
    const name = selector.match(/name="([^"]+)"/)[1];
    const value = selector.match(/value="([^"]+)"/)?.[1];
    return value ? radio(name, value) : Object.values(radios).find(item => item.name === name && item.checked);
  };
  form.querySelectorAll = () => [radio('backdropMode', 'dim'), radio('backdropMode', 'blur')];
  form.checkValidity = () => true;
  nodes['settings-form'] = form;
  const node = id => nodes[id] ||= element();
  context.document = {
    querySelector: selector => node(selector.slice(1)),
    querySelectorAll: () => [], getElementById: node
  };
  context.chrome = {
    runtime: {}, storage: { local: {
      get(defaults, cb) { readCount++; cb({ ...defaults, backdropOpacity: 35, backdropBlur: 60 }); },
      set(value, cb) {
        if (throwWrite) throw new Error('storage unavailable');
        context.chrome.runtime.lastError = failWrite ? { message: 'quota exceeded' } : undefined;
        if (!failWrite) writes.push(value);
        cb();
        context.chrome.runtime.lastError = undefined;
      }
    } }
  };
  context.FileReader = class {
    readAsText(file) { this.onload({ target: { result: file.contents } }); }
  };
  vm.runInContext(source('popup.js'), context);
  function switchMode(mode) {
    form.querySelectorAll().forEach(item => { item.checked = item.value === mode; });
    radio('backdropMode', mode).listeners.change();
  }
  return { ...harness, node, switchMode, writes, reads: () => readCount,
    fail() { failWrite = true; }, throwOnWrite() { throwWrite = true; } };
}

test('les deux intensités survivent aux changements de mode et à la sauvegarde', () => {
  const { context, node, switchMode, writes, reads } = popupHarness();
  const slider = node('backdropIntensitySlider');
  slider.value = '72';
  slider.listeners.input();
  switchMode('blur');
  assert.equal(Number(slider.value), 60);
  slider.value = '44';
  slider.listeners.input();
  switchMode('dim');
  assert.equal(Number(slider.value), 72);
  context.saveSettings();
  assert.equal(writes[0].backdropOpacity, 72);
  assert.equal(writes[0].backdropBlur, 44);
  switchMode('blur');
  context.saveSettings();
  assert.equal(writes[1].backdropOpacity, 72);
  assert.equal(writes[1].backdropBlur, 44);
  assert.equal(reads(), 1);
});

for (const failure of ['fail', 'throwOnWrite']) {
  test(`une erreur de stockage (${failure}) ne produit pas de confirmation de succès`, () => {
    const harness = popupHarness();
    harness[failure]();
    harness.context.saveSettings();
    assert.match(harness.node('status').textContent, /Échec/);
    assert.equal(harness.node('save-toast').classList.contains('save-toast-visible'), false);
    let succeeded = false;
    harness.context.storeSettings({}, () => { succeeded = true; });
    assert.equal(succeeded, false);
    harness.node('reset').listeners.click();
    assert.match(harness.node('status').textContent, /Échec/);
    harness.node('import-file').listeners.change({ target: { files: [{ contents: '{"backdropBlur":80}' }] } });
    assert.match(harness.node('status').textContent, /Échec/);
    assert.equal(harness.node('save-toast').classList.contains('save-toast-visible'), false);
  });
}

test('un import recharge les deux intensités du brouillon', () => {
  const { context, node, switchMode, writes } = popupHarness();
  node('import-file').listeners.change({ target: { files: [{
    contents: '{"backdropOpacity":21,"backdropBlur":83,"backdropMode":"blur"}'
  }] } });
  assert.equal(Number(node('backdropIntensitySlider').value), 83);
  switchMode('dim');
  assert.equal(Number(node('backdropIntensitySlider').value), 21);
  context.saveSettings();
  assert.equal(writes.at(-1).backdropBlur, 83);
});


test('le panneau est positionné avant affichage, sans navigation intermédiaire ni ouverture différée', async () => {
  const { context, STATE, window } = await contentHarness();
  window.innerWidth = 1400;
  window.innerHeight = 900;
  STATE.settings.openMode = 'overlay';
  STATE.settings.autoCompactFallback = false;
  STATE.root = element();
  STATE.panel = element();
  STATE.panel.getBoundingClientRect = () => ({
    width: parseFloat(STATE.panel.style.width) || 960,
    height: parseFloat(STATE.panel.style.height) || 540
  });
  STATE.panel.focus = () => {
    assert.equal(STATE.root.classList.contains('peek-preparing'), false);
    assert.equal(STATE.root.classList.contains('peek-position-calculated'), true);
  };
  STATE.root.querySelector = () => null;
  STATE.title = element();
  STATE.urlLabel = element();
  STATE.settingsButton = { setAttribute() {} };
  const navigations = [];
  let cleared = 0;
  STATE.iframe = {
    set src(value) {
      assert.equal(STATE.root.classList.contains('peek-preparing'), true);
      assert.equal(STATE.root.classList.contains('peek-position-calculated'), true);
      assert.equal(STATE.root.classList.contains('peek-loading'), true);
      assert.equal(STATE.panel.style.left, '408px');
      assert.equal(STATE.panel.style.top, '32px');
      navigations.push(value);
    },
    removeAttribute() { cleared++; }
  };
  context.testApi.openPreview({ textContent: 'Premier' }, new URL('https://preview.example/one'));
  context.testApi.openPreview({ textContent: 'Second' }, new URL('https://preview.example/two'));
  assert.deepEqual(navigations, ['https://preview.example/one', 'https://preview.example/two']);
  assert.equal(cleared, 0);
  context.testApi.doClose();
  assert.equal(cleared, 1);
  assert.equal(STATE.root.classList.contains('peek-visible'), false);
});

test('le mode split prime sur le repli compact automatique, mais respecte les règles de domaine', async () => {
  const { STATE, click, messages } = await contentHarness();
  STATE.settings.openMode = 'split';
  click('https://github.com/');
  assert.equal(messages[0].type, 'OPEN_URL_IN_SPLIT_VIEW');
  STATE.settings.domainRules = 'github.com = compact';
  click('https://github.com/');
  assert.equal(messages[1].type, 'OPEN_COMPACT_WINDOW');
  STATE.settings.domainRules = 'github.com = blocked';
  assert.equal(click('https://github.com/').prevented, false);
  assert.equal(messages.length, 2);
});
