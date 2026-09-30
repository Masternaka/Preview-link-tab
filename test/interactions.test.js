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
    listeners, textContent: '', dataset: {},
    addEventListener(name, handler) { listeners[name] = handler; },
    removeEventListener(name, handler) { if (listeners[name] === handler) delete listeners[name]; },
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

async function contentHarness({ embedded = false } = {}) {
  const harness = baseContext();
  const { context } = harness;
  class Element {
    matches(selector) { return selector.split(', ').includes(this.tagName); }
  }
  const document = element();
  const messages = [];
  Object.assign(context, {
    document, Element, HTMLElement: Element,
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
    chrome: {
      storage: { local: { get(defaults, cb) { cb(defaults); } } },
      runtime: { sendMessage(message, cb) { messages.push(message); cb?.({ ok: true }); } }
    }
  });
  if (embedded) {
    harness.window.top = { postMessage(message) { messages.push(message); } };
    vm.runInContext(source('content.js'), context);
    return { ...harness, document, messages };
  }
  const script = source('content.js').replace(/\}\)\(\);\s*$/, 'this.testApi = { STATE, startPreviewLoadTimer, doClose, openPreview, panelGestureRect, initResizeListeners, applyOverlayLayout }; })();');
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
  return { ...harness, STATE, click, messages, document, Element };
}

test('les raccourcis préservent les champs, les éditeurs riches et les champs du Shadow DOM', async () => {
  const { STATE, document, Element } = await contentHarness();
  STATE.root = element();
  STATE.root.classList.add('peek-visible');
  const targets = ['input', 'textarea', 'select'].map(tagName => Object.assign(new Element(), { tagName }));
  // isContentEditable includes children inheriting editability and plaintext-only editors.
  targets.push(Object.assign(new Element(), { isContentEditable: true }));
  for (const target of targets) {
    for (const shadow of [false, true]) {
      for (const key of ['r', 'o', 'c', 'p', 'ArrowLeft', 'ArrowRight']) {
        document.listeners.keydown({ key, target: shadow ? new Element() : target,
          composedPath: () => shadow ? [target, new Element()] : [target],
          preventDefault() { assert.fail(`${key} a intercepté la saisie`); }
        });
      }
    }
  }
  assert.equal(STATE.isPinned, false);
});

test('un raccourci reste actif hors saisie et respecte les événements réservés', async () => {
  const { STATE, document, Element } = await contentHarness();
  STATE.root = element();
  STATE.root.classList.add('peek-visible');
  for (const flags of [{ isComposing: true }, { keyCode: 229 }, { defaultPrevented: true },
    { altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
    document.listeners.keydown({ key: 'p', target: new Element(), ...flags,
      preventDefault() { assert.fail('Événement réservé intercepté'); }
    });
    assert.equal(STATE.isPinned, false);
  }
  let prevented = false;
  document.listeners.keydown({ key: 'p', target: new Element(),
    preventDefault() { prevented = true; }
  });
  assert.equal(prevented, true);
  assert.equal(STATE.isPinned, true);
});

test('Échap préserve la composition dans la page source et dans une iframe', async () => {
  for (const embedded of [false, true]) {
    const { STATE, document, messages } = await contentHarness({ embedded });
    if (STATE) {
      STATE.root = element();
      STATE.root.classList.add('peek-visible', 'peek-settings-open');
    }
    messages.length = 0;
    for (const flags of [{ isComposing: true }, { keyCode: 229 }, { defaultPrevented: true }]) {
      document.listeners.keydown({ key: 'Escape', ...flags });
      if (STATE) assert.equal(STATE.root.classList.contains('peek-settings-open'), true);
      assert.equal(messages.length, 0);
    }
    document.listeners.keydown({ key: 'Escape' });
    if (STATE) assert.equal(STATE.root.classList.contains('peek-settings-open'), false);
    else assert.equal(messages[0].type, 'CLOSE_PEEK_PREVIEW');
  }
});

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
  node('theme-colors').dataset = { enabledBy: 'theme', enabledValue: 'custom' };
  context.document = {
    querySelector: selector => node(selector.slice(1)),
    querySelectorAll: selector => selector === '.advanced-group' ? [node('theme-colors')] : [], getElementById: node
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


test('déplacement : les quatre limites du viewport sont respectées', async () => {
  const { context } = await contentHarness();
  const rect = { left: 100, top: 80, width: 640, height: 360 };
  const move = (dx, dy) => context.testApi.panelGestureRect(rect, '', dx, dy, 1000, 800);
  assert.equal(move(-5000, -5000).left, 0);
  assert.equal(move(-5000, -5000).top, 0);
  assert.equal(move(5000, 5000).left, 360);
  assert.equal(move(5000, 5000).top, 440);
  assert.equal(move(30, 40).left, 130);
  assert.equal(move(30, 40).top, 120);
});

test('redimensionnement : chaque bord et coin reste visible et conserve le bord opposé', async () => {
  const { context } = await contentHarness();
  for (const [vw, vh] of [[1400, 900], [700, 500], [280, 200]]) {
    const start = { left: 30, top: 20, width: Math.min(500, vw - 40), height: Math.min(350, vh - 30) };
    for (const direction of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
      for (const dx of [-5000, 0, 5000]) for (const dy of [-5000, 0, 5000]) {
        const rect = context.testApi.panelGestureRect(start, direction, dx, dy, vw, vh);
        assert.ok(rect.left >= 0 && rect.top >= 0);
        assert.ok(rect.width > 0 && rect.height > 0);
        assert.ok(rect.left + rect.width <= vw && rect.top + rect.height <= vh);
        if (direction.includes('w')) assert.equal(rect.left + rect.width, start.left + start.width);
        else assert.equal(rect.left, start.left);
        if (direction.includes('n')) assert.equal(rect.top + rect.height, start.top + start.height);
        else assert.equal(rect.top, start.top);
      }
    }
  }
});

async function gestureHarness() {
  const harness = await contentHarness();
  const { STATE, context, window } = harness;
  window.innerWidth = 1400;
  window.innerHeight = 900;
  const handle = () => {
    const node = element();
    let captured = false;
    node.setPointerCapture = () => { captured = true; };
    node.hasPointerCapture = () => captured;
    node.releasePointerCapture = () => { captured = false; };
    return node;
  };
  const header = handle();
  const west = handle();
  west.dataset.direction = 'w';
  const panel = element();
  panel.getBoundingClientRect = () => ({
    left: parseFloat(panel.style.left ?? '200'), top: parseFloat(panel.style.top ?? '100'),
    width: parseFloat(panel.style.width ?? '640'), height: parseFloat(panel.style.height ?? '360')
  });
  panel.querySelector = () => header;
  panel.querySelectorAll = () => [west];
  STATE.panel = panel;
  STATE.root = element();
  STATE.root.querySelector = selector => selector === '.peek-panel' ? panel : null;
  STATE.root.classList.add('peek-visible');
  STATE.settings.openMode = 'overlay';
  const writes = [];
  context.chrome.storage.local.set = (settings, cb) => { writes.push({ ...settings }); cb?.(); };
  context.testApi.initResizeListeners(STATE.root);
  const down = (node, extra = {}) => node.listeners.pointerdown({ button: 0, pointerId: 1,
    clientX: 200, clientY: 100, target: { closest: () => null },
    preventDefault() {}, stopPropagation() {}, ...extra });
  return { ...harness, header, west, down, writes };
}

test('glisser mémorise la position sans changer la taille et nettoie les événements', async () => {
  const { header, down, writes, STATE, context, window } = await gestureHarness();
  down(header);
  header.listeners.pointermove({ pointerId: 1, clientX: 350, clientY: 180 });
  assert.equal(STATE.panel.style.left, '350px');
  context.testApi.applyOverlayLayout();
  assert.equal(STATE.panel.style.left, '350px', 'un recalcul ne doit pas interrompre le geste');
  header.listeners.pointerup({ pointerId: 1 });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].position, 'custom');
  assert.equal(writes[0].customLeft, 350);
  assert.equal(writes[0].customTop, 180);
  assert.equal(writes[0].size, 'medium');
  assert.equal(header.hasPointerCapture(), false);
  assert.equal(header.listeners.pointermove, undefined);
  assert.equal(window.listeners.blur, undefined);
  assert.equal(STATE.root.classList.contains('peek-resizing'), false);
  context.testApi.applyOverlayLayout();
  assert.equal(STATE.panel.style.left, '350px', 'la position doit survivre au recalcul');
  assert.equal(STATE.panel.style.top, '180px');
});

test('un simple clic, un bouton secondaire et le plein écran ne déplacent rien', async () => {
  const { header, down, writes, STATE } = await gestureHarness();
  down(header, { button: 2 });
  assert.equal(header.listeners.pointermove, undefined);
  down(header);
  header.listeners.pointerup({ pointerId: 1 });
  assert.equal(writes.length, 0);
  STATE.settings.size = 'full';
  down(header);
  assert.equal(header.listeners.pointermove, undefined);
});

test('redimensionner à gauche sauvegarde aussi la nouvelle position', async () => {
  const { west, down, writes, STATE, context } = await gestureHarness();
  down(west);
  west.listeners.pointermove({ pointerId: 1, clientX: -800, clientY: 100 });
  west.listeners.pointerup({ pointerId: 1 });
  assert.equal(writes[0].customLeft, 0);
  assert.equal(writes[0].customWidth, 840);
  assert.equal(writes[0].position, 'custom');
  assert.equal(writes[0].size, 'custom');
  assert.equal(STATE.panel.style.left, '0px');
  context.testApi.applyOverlayLayout();
  assert.equal(STATE.panel.style.left, '0px');
  assert.equal(STATE.panel.style.width, '840px');
});

for (const end of ['pointercancel', 'lostpointercapture', 'blur']) {
  test(`le geste se termine lors de ${end}`, async () => {
    const { header, down, window, STATE, writes } = await gestureHarness();
    down(header);
    header.listeners.pointermove({ pointerId: 1, clientX: 250, clientY: 150 });
    if (end === 'blur') window.listeners.blur();
    else header.listeners[end]({ pointerId: 1 });
    assert.equal(header.listeners.pointermove, undefined);
    assert.equal(STATE.root.classList.contains('peek-resizing'), false);
    assert.equal(writes.length, 1);
  });
}


test('les couleurs manuelles survivent à la sauvegarde avec un thème connu sélectionné', () => {
  const { context, node, writes } = popupHarness();
  const fields = node('settings-form').elements;
  fields.theme.value = 'custom';
  node('settings-form').listeners.change();
  fields.customAccent.value = '#123456';
  fields.customBackground.value = '#fafafa';
  context.saveSettings();
  assert.equal(writes.at(-1).theme, 'custom');
  assert.equal(writes.at(-1).customAccent, '#123456');
  fields.theme.value = 'nord';
  node('settings-form').listeners.change();
  context.saveSettings();
  context.setFormSettings(writes.at(-1));
  fields.theme.value = 'custom';
  node('settings-form').listeners.change();
  context.saveSettings();
  assert.equal(writes.at(-1).customAccent, '#123456');
  assert.equal(writes.at(-1).customBackground, '#fafafa');
});


test('les couleurs affichées suivent le thème sans écraser le brouillon personnalisé', () => {
  const { context, node, writes } = popupHarness();
  const form = node('settings-form');
  const fields = form.elements;
  assert.equal(node('theme-colors').disabled, true);
  assert.equal(fields.customAccent.value, '#cba6f7');
  assert.equal(fields.customBackground.value, '#1e1e2e');
  fields.theme.value = 'custom';
  form.listeners.change();
  assert.equal(node('theme-colors').disabled, false);
  fields.customAccent.value = '#abcdef';
  fields.customBackground.value = '#123456';
  fields.customBackdropOpacity.value = '42';
  fields.theme.value = 'everforest';
  form.listeners.change();
  assert.equal(node('theme-colors').disabled, true);
  assert.equal(fields.customAccent.value, '#a7c080');
  assert.equal(fields.customBackground.value, '#2d353b');
  context.saveSettings();
  assert.equal(writes.at(-1).customAccent, '#abcdef');
  assert.equal(writes.at(-1).customBackdropOpacity, 42);
  context.setFormSettings(writes.at(-1));
  assert.equal(fields.customBackground.value, '#2d353b');
  fields.theme.value = 'custom';
  form.listeners.change();
  assert.equal(fields.customAccent.value, '#abcdef');
  assert.equal(fields.customBackground.value, '#123456');
  assert.equal(Number(fields.customBackdropOpacity.value), 42);
});
