const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function storageHarness(initial = {}) {
  let windows = structuredClone(initial);
  let failNextWrite = false;
  return {
    snapshot: () => structuredClone(windows),
    failNextWrite() { failNextWrite = true; },
    session: {
      async get(key) {
        // Return a copy, just like Chrome: concurrent reads must not share data.
        const snapshot = structuredClone(windows);
        await new Promise(resolve => setImmediate(resolve));
        return { [key]: snapshot };
      },
      async set(value) {
        await new Promise(resolve => setImmediate(resolve));
        if (failNextWrite) {
          failNextWrite = false;
          throw new Error('storage unavailable');
        }
        windows = structuredClone(value.peekCompactWindows);
      }
    }
  };
}

function loadWorker(storage, { firefox = false } = {}) {
  const event = () => ({ addListener(listener) { this.listener = listener; } });
  let nextWindow = 10;
  const sent = [];
  const createdWindows = [];
  const chrome = {
    storage: { session: storage.session },
    runtime: { onInstalled: event(), onMessage: event(), getURL: name => `chrome-extension://test/${name}` },
    action: { onClicked: event() },
    contextMenus: { onClicked: event() },
    commands: { onCommand: event() },
    windows: {
      onRemoved: event(),
      async get(id) {
        return { id, left: 0, top: 0, width: 1400, height: 900 };
      },
      async create(options) {
        createdWindows.push(options);
        const id = nextWindow++;
        return { id, tabs: [{ id: id * 10 }] };
      },
      async remove(id) {
        chrome.tabs.onRemoved.listener(id * 10);
        chrome.windows.onRemoved.listener(id);
      }
    },
    tabs: {
      onRemoved: event(), onUpdated: event(),
      async sendMessage(id, message) { sent.push({ id, ...message }); }
    }
  };
  const context = vm.createContext(firefox ? { browser: chrome, URL } : { chrome, URL });
  const loadScript = name => vm.runInContext(
    fs.readFileSync(path.join(__dirname, '..', '..', name), 'utf8'), context
  );
  if (firefox) loadScript('settings.js');
  else context.importScripts = loadScript;
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'background.js'), 'utf8'), context);
  return { api: context, chrome, sent, createdWindows };
}

const request = { url: 'https://example.com/', settings: { size: 'medium', position: 'center' } };

function settingsWindowHarness(source, workArea, options) {
  const worker = loadWorker(storageHarness(), options);
  const windows = [];
  const creations = [];
  const updates = [];
  worker.chrome.windows.get = async () => source;
  worker.chrome.windows.getAll = async () => windows;
  worker.chrome.windows.create = async options => {
    creations.push(options);
    const window = { ...options, id: 20 + windows.length, tabs: [{ url: options.url }] };
    windows.push(window);
    return window;
  };
  worker.chrome.windows.update = async (id, options) => {
    updates.push({ id, ...options });
    return Object.assign(windows.find(window => window.id === id), options);
  };
  if (workArea) worker.chrome.system = { display: { getInfo: async () => [{ workArea }] } };
  return { ...worker, windows, creations, updates };
}

test('les paramètres s’ouvrent centrés sur le navigateur avec le contexte de l’onglet', async () => {
  const worker = settingsWindowHarness({ left: 100, top: 50, width: 1400, height: 900 });
  await worker.api.openSettingsWindow({ id: 12, windowId: 7 });
  const options = worker.creations[0];
  assert.equal(options.width, 1040);
  assert.equal(options.height, 760);
  assert.equal(options.left, 280);
  assert.equal(options.top, 120);
  assert.equal(options.url, 'chrome-extension://test/popup.html?sourceTabId=12');
  assert.equal(options.type, 'popup');
});

test('les paramètres restent dans la zone utilisable d’un petit écran secondaire', async () => {
  const workArea = { left: -640, top: 0, width: 640, height: 480 };
  const worker = settingsWindowHarness({ left: -620, top: 10, width: 620, height: 450 }, workArea);
  await worker.api.openSettingsWindow({ id: 12, windowId: 7 });
  const options = worker.creations[0];
  assert.equal(options.width, 592);
  assert.equal(options.height, 432);
  assert.ok(options.left >= workArea.left);
  assert.ok(options.top >= workArea.top);
  assert.ok(options.left + options.width <= 0);
  assert.ok(options.top + options.height <= 480);
});

test('une fenêtre compacte reprend le contexte privé de l’onglet émetteur', async () => {
  const { api, createdWindows } = loadWorker(storageHarness());
  await api.openCompactWindow(request, { tab: { incognito: true, windowId: 7 } });
  assert.equal(createdWindows[0].incognito, true);
  assert.equal(createdWindows[0].url, request.url);
  await api.openCompactWindow(request, { tab: { incognito: false, windowId: 7 } });
  assert.equal(createdWindows[1].incognito, false);
  await api.openCompactWindow(request, {});
  assert.equal(createdWindows[2].incognito, false);
});

test('le message ne peut pas imposer une fenêtre compacte normale depuis un onglet privé', async () => {
  const { api, createdWindows } = loadWorker(storageHarness());
  await api.openCompactWindow({ ...request, incognito: false }, { tab: { incognito: true } });
  assert.equal(createdWindows[0].incognito, true);
});

test('un refus de fenêtre compacte privée n’ouvre pas de fenêtre normale de secours', async () => {
  const { chrome, createdWindows } = loadWorker(storageHarness());
  let attempts = 0;
  chrome.windows.create = async options => {
    attempts++;
    createdWindows.push(options);
    throw new Error('private window refused');
  };
  const response = await new Promise(resolve => {
    chrome.runtime.onMessage.listener(
      { type: 'OPEN_COMPACT_WINDOW', url: request.url, settings: request.settings },
      { tab: { incognito: true } },
      resolve
    );
  });
  assert.equal(response.ok, false);
  assert.equal(attempts, 1);
  assert.equal(createdWindows[0].incognito, true);
});

test('les paramètres d’un onglet privé Chrome s’ouvrent dans une fenêtre normale avec le bon sourceTabId', async () => {
  const worker = settingsWindowHarness({ left: 100, top: 50, width: 1400, height: 900 });
  await worker.api.openSettingsWindow({ id: 12, windowId: 7, incognito: true });
  assert.equal(worker.creations[0].incognito, false);
  assert.equal(worker.creations[0].url, 'chrome-extension://test/popup.html?sourceTabId=12');
  assert.equal(worker.creations[0].type, 'popup');
  worker.windows[0].tabs[0] = { url: worker.creations[0].url };
  await worker.api.openSettingsWindow({ id: 12, windowId: 7, incognito: true });
  assert.equal(worker.creations.length, 1, 'la fenêtre normale existante est réutilisée');
  assert.equal(worker.updates.length, 1);
});

test('les paramètres Firefox conservent le contexte privé de l’onglet source', async () => {
  const worker = settingsWindowHarness({ left: 0, top: 0, width: 1400, height: 900 }, null, { firefox: true });
  worker.chrome.runtime.getURL = name => `moz-extension://test/${name}`;
  await worker.api.openSettingsWindow({ id: 12, windowId: 7, incognito: true });
  assert.equal(worker.creations[0].incognito, true);
  assert.equal(worker.creations[0].url, 'moz-extension://test/popup.html?sourceTabId=12');
});

test('deux onglets sources distincts gardent chacun leur fenêtre de paramètres', async () => {
  const worker = settingsWindowHarness({ left: 0, top: 0, width: 1400, height: 900 });
  await worker.api.openSettingsWindow({ id: 12, windowId: 7 });
  await worker.api.openSettingsWindow({ id: 13, windowId: 7 });
  assert.deepEqual(worker.creations.map(item => item.url), [
    'chrome-extension://test/popup.html?sourceTabId=12',
    'chrome-extension://test/popup.html?sourceTabId=13'
  ]);
});

test('des clics répétés réutilisent les paramètres sans recharger les changements en cours', async () => {
  const worker = settingsWindowHarness({ left: 0, top: 0, width: 1400, height: 900 });
  const tab = { id: 12, windowId: 7 };
  await Promise.all([worker.api.openSettingsWindow(tab), worker.api.openSettingsWindow(tab)]);
  assert.equal(worker.creations.length, 1);
  assert.equal(worker.updates.length, 1);
  worker.windows[0].tabs[0] = { pendingUrl: worker.creations[0].url };
  await worker.api.openSettingsWindow(tab);
  assert.equal(worker.creations.length, 1, 'une page encore en chargement est réutilisée');
  worker.windows[0].state = 'minimized';
  const restarted = loadWorker(storageHarness());
  Object.assign(restarted.chrome.windows, worker.chrome.windows);
  await restarted.api.openSettingsWindow(tab);
  assert.equal(worker.creations.length, 1);
  assert.equal(worker.updates.at(-1).state, 'normal');
});

test('deux ouvertures simultanées restent reconnues après redémarrage du worker', async () => {
  const storage = storageHarness();
  const { api } = loadWorker(storage);
  await Promise.all([api.openCompactWindow(request, {}), api.openCompactWindow(request, {})]);
  assert.deepEqual(storage.snapshot(), { 10: 100, 11: 110 });
  const restarted = loadWorker(storage);
  for (const [windowId, tabId] of [[10, 100], [11, 110]]) {
    assert.equal(await restarted.api.isCompactWindow(windowId), true);
    assert.equal(await restarted.api.isCompactTab(tabId), true);
  }
  assert.equal(await restarted.api.isCompactWindow(99), false);
});

test('suppression et ajout simultanés ne perdent aucune mise à jour', async () => {
  const storage = storageHarness({ 1: 101, 2: 202 });
  const { api } = loadWorker(storage);
  await Promise.all([
    api.forgetCompactWindow(1),
    api.rememberCompactWindow(3, 303),
    api.forgetCompactTab(202)
  ]);
  assert.deepEqual(storage.snapshot(), { 3: 303 });
});

test('les événements de fermeture et la fermeture explicite sont idempotents', async () => {
  const storage = storageHarness();
  const { api, chrome } = loadWorker(storage);
  await Promise.all([api.openCompactWindow(request, {}), api.openCompactWindow(request, {})]);
  await Promise.all([
    api.closeCompactWindow({ windowId: 10 }, {}),
    api.closeCompactWindow({ windowId: 11 }, {})
  ]);
  // A late duplicate removal must not resurrect either entry.
  chrome.windows.onRemoved.listener(10);
  assert.equal(await api.isCompactWindow(10), false);
  assert.equal(await api.isCompactTab(100), false);
  assert.equal(await api.isCompactWindow(11), false);
  assert.equal(await api.isCompactTab(110), false);
  assert.deepEqual(storage.snapshot(), {});
});

test('la lecture attend les ajouts et suppressions déjà en cours', async () => {
  const storage = storageHarness();
  const { api } = loadWorker(storage);
  const add = api.rememberCompactWindow(1, 101);
  assert.equal(await api.isCompactTab(101), true);
  await add;
  const remove = api.forgetCompactWindow(1);
  assert.equal(await api.isCompactWindow(1), false);
  await remove;
});

test('une erreur de stockage est propagée sans bloquer les mises à jour suivantes', async () => {
  const storage = storageHarness({ 1: 101 });
  const { api } = loadWorker(storage);
  storage.failNextWrite();
  const failed = api.rememberCompactWindow(2, 202);
  const next = api.rememberCompactWindow(3, 303);
  await assert.rejects(failed, /storage unavailable/);
  await next;
  assert.deepEqual(storage.snapshot(), { 1: 101, 3: 303 });
});

test('la suppression par fenêtre ou onglet nettoie les deux caches', async () => {
  const storage = storageHarness();
  const { api, chrome } = loadWorker(storage);
  await api.openCompactWindow(request, {});
  chrome.tabs.onRemoved.listener(100);
  assert.equal(await api.isCompactWindow(10), false);
  assert.equal(await api.isCompactTab(100), false);
  await api.openCompactWindow(request, {});
  chrome.windows.onRemoved.listener(11);
  assert.equal(await api.isCompactWindow(11), false);
  assert.equal(await api.isCompactTab(110), false);
});

test('la vue partagée ouvre le lien avec l’onglet émetteur dans sa fenêtre', async () => {
  const { api, chrome } = loadWorker(storageHarness());
  chrome.tabs.createSplit = async () => {};
  chrome.tabs.get = async id => ({ id, windowId: 7, splitViewId: -1 });
  let created;
  chrome.tabs.create = async options => { created = options; return { id: 123 }; };
  const result = await api.openUrlInSplitView('https://example.com/', { tab: { id: 42 } });
  assert.equal(result.id, 123);
  assert.deepEqual(JSON.parse(JSON.stringify(created)), {
    url: 'https://example.com/', splitWithTabId: 42, windowId: 7, active: true
  });
});

test('ouvrir dans un onglet reste dans la fenêtre privée de l’onglet émetteur', async () => {
  const { chrome } = loadWorker(storageHarness());
  const created = [];
  chrome.tabs.create = async options => { created.push(options); return { id: 1 }; };
  const send = sender => new Promise(resolve => {
    chrome.runtime.onMessage.listener({ type: 'OPEN_URL_IN_TAB', url: 'https://example.com/' }, sender, resolve);
  });
  assert.equal((await send({ tab: { id: 7, windowId: 3, incognito: true } })).ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(created[0])), { url: 'https://example.com/', active: true, windowId: 3 });
  assert.equal((await send({})).ok, true);
  assert.equal(created[1].windowId, undefined);
});

test('une vue partagée indisponible ou déjà active ne crée pas d’onglet supplémentaire', async () => {
  const { api, chrome } = loadWorker(storageHarness());
  let creations = 0;
  chrome.tabs.create = async () => { creations++; };
  await assert.rejects(api.openUrlInSplitView('https://example.com/', { tab: { id: 1 } }), /Ce navigateur/);
  chrome.tabs.createSplit = async () => {};
  await assert.rejects(api.openUrlInSplitView('javascript:alert(1)', { tab: { id: 1 } }), /Ce lien/);
  await assert.rejects(api.openUrlInSplitView('https://example.com/', {}), /depuis un onglet/);
  chrome.tabs.get = async () => ({ id: 1, splitViewId: 0 });
  await assert.rejects(api.openUrlInSplitView('https://example.com/', { tab: { id: 1 } }), /déjà/);
  assert.equal(creations, 0);
});

test('un échec de création split est transmis au script sans ouverture de secours', async () => {
  const { chrome } = loadWorker(storageHarness());
  chrome.tabs.createSplit = async () => {};
  chrome.tabs.get = async () => ({ id: 1, windowId: 7, splitViewId: -1 });
  let creations = 0;
  chrome.tabs.create = async () => { creations++; throw new Error('not supported'); };
  const response = await new Promise(resolve => {
    assert.equal(chrome.runtime.onMessage.listener({ type: 'OPEN_URL_IN_SPLIT_VIEW', url: 'https://example.com/' }, { tab: { id: 1 } }, resolve), true);
  });
  assert.equal(response.ok, false);
  assert.match(response.error, /Impossible/);
  assert.equal(creations, 1);
});

function siteHarness(options) {
  const worker = loadWorker(storageHarness(), options);
  const session = {};
  const local = { domainRules: 'other.example = overlay' };
  const tabs = [
    { id: 1, url: 'https://example.com/a', incognito: false },
    { id: 2, url: 'https://example.com/b', incognito: false },
    { id: 3, url: 'https://sub.example.com/', incognito: false },
    { id: 4, url: 'https://example.com/', incognito: true },
    { id: 5, url: 'chrome://settings/', incognito: false }
  ];
  const area = store => ({
    async get() { await new Promise(resolve => setImmediate(resolve)); return structuredClone(store); },
    async set(value) { await new Promise(resolve => setImmediate(resolve)); Object.assign(store, structuredClone(value)); }
  });
  const configure = chrome => {
    chrome.storage.session = area(session);
    chrome.storage.local = area(local);
    chrome.tabs.get = async id => tabs.find(tab => tab.id === id);
    chrome.tabs.query = async () => tabs;
  };
  configure(worker.chrome);
  const message = (data, sender = {}) => new Promise(resolve => {
    assert.equal(worker.chrome.runtime.onMessage.listener(data, sender, resolve), true);
  });
  return { ...worker, local, session, tabs, configure, message };
}

test('la pause se propage aux onglets du même site et survit au redémarrage du worker', async () => {
  const { chrome, sent, message, configure } = siteHarness();
  const result = await message({ type: 'SET_SITE_PAUSE', tabId: 1, paused: true });
  assert.equal(result.ok, true);
  assert.equal(result.paused, true);
  assert.deepEqual(sent.map(item => item.id), [1, 2]);
  const restarted = loadWorker(storageHarness());
  configure(restarted.chrome);
  const state = await restarted.api.handleSiteSettings({ type: 'GET_SITE_PAUSE', tabId: 2 }, {});
  assert.equal(state.paused, true);
  assert.equal((await message({ type: 'GET_SITE_PAUSE', tabId: 3 })).paused, false);
  assert.equal((await message({ type: 'GET_SITE_PAUSE', tabId: 4 })).paused, false);
  await message({ type: 'SET_SITE_PAUSE', tabId: 1, paused: false });
  assert.equal((await message({ type: 'GET_SITE_PAUSE', tabId: 2 })).paused, false);
  assert.equal((await message({ type: 'GET_SITE_PAUSE', tabId: 5 })).ok, false);
  // Content scripts must act on their own tab, not a supplied alternate tab ID.
  assert.equal((await message({ type: 'GET_SITE_PAUSE', tabId: 1 }, { tab: { id: 3 } })).hostname, 'sub.example.com');
});

test('la pause d’un site privé reste séparée de la pause normale du même domaine', async () => {
  const { message } = siteHarness();
  await message({ type: 'SET_SITE_PAUSE', tabId: 4, paused: true });
  assert.equal((await message({ type: 'GET_SITE_PAUSE', tabId: 4 })).paused, true);
  assert.equal((await message({ type: 'GET_SITE_PAUSE', tabId: 1 })).paused, false);
  await message({ type: 'SET_SITE_PAUSE', tabId: 1, paused: true });
  assert.equal((await message({ type: 'GET_SITE_PAUSE', tabId: 4 })).paused, true);
  await message({ type: 'SET_SITE_PAUSE', tabId: 4, paused: false });
  assert.equal((await message({ type: 'GET_SITE_PAUSE', tabId: 1 })).paused, true);
});

test('une pause demandée pour un onglet disparu échoue sans toucher un autre onglet', async () => {
  const { message, sent } = siteHarness();
  const response = await message({ type: 'SET_SITE_PAUSE', tabId: 999, paused: true });
  assert.equal(response.ok, false);
  assert.match(response.error, /fermé/);
  assert.deepEqual(sent, []);
});

test('les changements de pause concurrents ne perdent pas de site', async () => {
  const { message } = siteHarness();
  await Promise.all([
    message({ type: 'SET_SITE_PAUSE', tabId: 1, paused: true }),
    message({ type: 'SET_SITE_PAUSE', tabId: 3, paused: true })
  ]);
  assert.equal((await message({ type: 'GET_SITE_PAUSE', tabId: 1 })).paused, true);
  assert.equal((await message({ type: 'GET_SITE_PAUSE', tabId: 3 })).paused, true);
});

test('les règles rapides sont fusionnées avec les dernières règles enregistrées', async () => {
  const { message, local } = siteHarness();
  await Promise.all([
    message({ type: 'SET_DOMAIN_RULE', url: 'https://example.com/path', mode: 'compact' }),
    message({ type: 'SET_DOMAIN_RULE', url: 'https://sub.example.com/', mode: 'split' })
  ]);
  assert.match(local.domainRules, /other.example = overlay/);
  assert.match(local.domainRules, /example.com = compact/);
  assert.match(local.domainRules, /sub.example.com = split/);
  await message({ type: 'SET_DOMAIN_RULE', url: 'https://sub.example.com/', mode: 'default' });
  assert.doesNotMatch(local.domainRules, /sub.example/);
  assert.equal((await message({ type: 'SET_DOMAIN_RULE', url: 'javascript:alert(1)', mode: 'blocked' })).ok, false);
});

test('un échec de stockage de pause ou de règle est signalé et ne bloque pas la suite', async () => {
  const { chrome, message, configure } = siteHarness();
  chrome.storage.session.set = async () => { throw new Error('storage failed'); };
  assert.equal((await message({ type: 'SET_SITE_PAUSE', tabId: 1, paused: true })).ok, false);
  configure(chrome);
  assert.equal((await message({ type: 'GET_SITE_PAUSE', tabId: 1 })).paused, false);
  chrome.storage.local.set = async () => { throw new Error('storage failed'); };
  assert.equal((await message({ type: 'SET_DOMAIN_RULE', url: 'https://example.com/', mode: 'compact' })).ok, false);
  configure(chrome);
  assert.equal((await message({ type: 'SET_DOMAIN_RULE', url: 'https://example.com/', mode: 'compact' })).ok, true);
});

test('Firefox : scripts sans importScripts, paramètres et fenêtres compactes sur l’écran source', async () => {
  const source = { left: -1600, top: 100, width: 1400, height: 900 };
  const worker = settingsWindowHarness(source, null, { firefox: true });
  assert.equal(worker.api.importScripts, undefined);
  assert.equal(worker.api.chrome, undefined);
  worker.chrome.runtime.getURL = name => `moz-extension://test/${name}`;
  await worker.api.openSettingsWindow({ id: 12, windowId: 7 });
  assert.equal(worker.creations[0].url, 'moz-extension://test/popup.html?sourceTabId=12');
  assert.equal(worker.creations[0].left, -1420);
  for (const position of ['topLeft', 'topRight', 'bottomLeft', 'bottomRight', 'center']) {
    await worker.api.openCompactWindow({
      ...request, settings: { size: 'full', position }
    }, { tab: { windowId: 7 } });
    const created = worker.creations.at(-1);
    assert.equal(created.width, 1352);
    assert.equal(created.height, 828);
    assert.ok(created.left >= source.left);
    assert.ok(created.top >= source.top);
    assert.ok(created.left + created.width <= source.left + source.width);
    assert.ok(created.top + created.height <= source.top + source.height);
  }
});

test('Firefox : le menu contextuel et la commande utilisent les API à promesses', async () => {
  const { chrome: api, sent } = loadWorker(storageHarness(), { firefox: true });
  const menus = [];
  api.contextMenus.removeAll = async () => {};
  api.contextMenus.create = options => { menus.push(options); return options.id; };
  api.tabs.query = async () => [{ id: 42 }];
  api.runtime.onInstalled.listener();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(menus[0].id, 'peek-preview-link');
  api.contextMenus.onClicked.listener({ menuItemId: menus[0].id, linkUrl: request.url }, { id: 42 });
  api.commands.onCommand.listener('preview-link');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(sent.map(item => item.type), ['PREVIEW_URL', 'PREVIEW_HOVERED_LINK']);
  const response = await new Promise(resolve => {
    api.runtime.onMessage.listener({ type: 'OPEN_URL_IN_SPLIT_VIEW', url: request.url }, { tab: { id: 42 } }, resolve);
  });
  assert.equal(response.ok, false);
  assert.match(response.error, /vue partagée native/);
});

test('Firefox : pause de site, règles et stockage de session après redémarrage', async () => {
  const worker = siteHarness({ firefox: true });
  assert.equal((await worker.message({ type: 'SET_SITE_PAUSE', tabId: 1, paused: true })).ok, true);
  assert.deepEqual(worker.sent.map(item => item.id), [1, 2]);
  const restarted = loadWorker(storageHarness(), { firefox: true });
  worker.configure(restarted.chrome);
  assert.equal((await restarted.api.handleSiteSettings({ type: 'GET_SITE_PAUSE', tabId: 2 }, {})).paused, true);
  assert.equal((await restarted.api.handleSiteSettings({ type: 'GET_SITE_PAUSE', tabId: 4 }, {})).paused, false);
  await worker.message({ type: 'SET_DOMAIN_RULE', url: request.url, mode: 'compact' });
  assert.match(worker.local.domainRules, /example.com = compact/);
});

function localArea(initial = {}) {
  let data = structuredClone(initial);
  let failNext = false;
  return {
    snapshot: () => structuredClone(data),
    failNextWrite() { failNext = true; },
    async get(defaults) {
      await new Promise(resolve => setImmediate(resolve));
      const values = defaults && typeof defaults === 'object' && !Array.isArray(defaults)
        ? structuredClone(defaults) : {};
      return { ...values, ...structuredClone(data) };
    },
    async set(value) {
      await new Promise(resolve => setImmediate(resolve));
      if (failNext) {
        failNext = false;
        throw new Error('storage unavailable');
      }
      data = { ...data, ...structuredClone(value) };
    }
  };
}

function mutationHarness(options, local = localArea({ domainRules: 'other.example = overlay' })) {
  const worker = loadWorker(storageHarness(), options);
  worker.chrome.storage.local = local;
  const message = (data, sender = {}) => new Promise(resolve => {
    assert.equal(worker.chrome.runtime.onMessage.listener(data, sender, resolve), true);
  });
  return { ...worker, local, message };
}

test('deux fenêtres conservent une règle et un réglage modifiés en parallèle', async () => {
  const { local, message } = mutationHarness();
  const [rule, scalar] = await Promise.all([
    message({ type: 'MUTATE_SETTINGS', domainRules: [{ domain: 'example.com', mode: 'compact', expected: null }] }),
    message({ type: 'MUTATE_SETTINGS', scalars: [{ key: 'theme', value: 'nord', expected: 'catppuccin' }] })
  ]);
  assert.equal(rule.ok, true);
  assert.equal(scalar.ok, true);
  assert.match(local.snapshot().domainRules, /other\.example = overlay/);
  assert.match(local.snapshot().domainRules, /example\.com = compact/);
  assert.equal(local.snapshot().theme, 'nord');
});

test('deux créations de thèmes distinctes sont conservées', async () => {
  const { local, message } = mutationHarness();
  const theme = (id, name) => ({ id, name, colors: { customAccent: '#123456' } });
  await Promise.all([
    message({ type: 'MUTATE_SETTINGS', savedThemes: [{ id: 'theme-a', theme: theme('theme-a', 'A'), expected: null }] }),
    message({ type: 'MUTATE_SETTINGS', savedThemes: [{ id: 'theme-b', theme: theme('theme-b', 'B'), expected: null }] })
  ]);
  assert.deepEqual(local.snapshot().savedThemes.map(item => item.id), ['theme-a', 'theme-b']);
});

test('deux règles simultanées sur des domaines différents sont conservées', async () => {
  const { local, message } = mutationHarness();
  await Promise.all([
    message({ type: 'MUTATE_SETTINGS', domainRules: [{ domain: 'one.example', mode: 'compact', expected: null }] }),
    message({ type: 'MUTATE_SETTINGS', domainRules: [{ domain: 'two.example', mode: 'split', expected: null }] })
  ]);
  assert.match(local.snapshot().domainRules, /one\.example = compact/);
  assert.match(local.snapshot().domainRules, /two\.example = split/);
});

test('une modification scalaire fondée sur un état ancien signale un conflit sans écraser', async () => {
  const { local, message } = mutationHarness();
  await message({ type: 'MUTATE_SETTINGS', scalars: [{ key: 'theme', value: 'nord', expected: 'catppuccin' }] });
  const conflict = await message({ type: 'MUTATE_SETTINGS', scalars: [{ key: 'theme', value: 'dracula', expected: 'catppuccin' }] });
  assert.equal(conflict.ok, true);
  assert.equal(conflict.conflict.kind, 'scalar');
  assert.equal(conflict.conflict.key, 'theme');
  assert.equal(local.snapshot().theme, 'nord');
});

test('une règle modifiée ailleurs produit un conflit de domaine', async () => {
  const { local, message } = mutationHarness();
  await message({ type: 'MUTATE_SETTINGS', domainRules: [{ domain: 'example.com', mode: 'compact', expected: null }] });
  const conflict = await message({ type: 'MUTATE_SETTINGS', domainRules: [{ domain: 'example.com', mode: 'split', expected: null }] });
  assert.equal(conflict.conflict.kind, 'domainRule');
  assert.match(local.snapshot().domainRules, /example\.com = compact/);
});

test('une modification de thème fondée sur une version ancienne signale un conflit', async () => {
  const { local, message } = mutationHarness();
  const colors = { customAccent: '#123456' };
  await message({ type: 'MUTATE_SETTINGS', savedThemes: [{ id: 'theme-a', theme: { id: 'theme-a', name: 'A', colors }, expected: null }] });
  const reference = structuredClone(local.snapshot().savedThemes[0]);
  await message({ type: 'MUTATE_SETTINGS', savedThemes: [{ id: 'theme-a', theme: { id: 'theme-a', name: 'A2', colors }, expected: reference }] });
  const conflict = await message({ type: 'MUTATE_SETTINGS', savedThemes: [{ id: 'theme-a', theme: { id: 'theme-a', name: 'A3', colors }, expected: reference }] });
  assert.equal(conflict.conflict.kind, 'theme');
  assert.equal(local.snapshot().savedThemes[0].name, 'A2');
});

test('la règle rapide et les mutations de préférences partagent la même file', async () => {
  const { local, message } = mutationHarness();
  await Promise.all([
    message({ type: 'SET_DOMAIN_RULE', url: 'https://quick.example/page', mode: 'compact' }),
    message({ type: 'MUTATE_SETTINGS', domainRules: [{ domain: 'draft.example', mode: 'blocked', expected: null }] })
  ]);
  assert.match(local.snapshot().domainRules, /quick\.example = compact/);
  assert.match(local.snapshot().domainRules, /draft\.example = blocked/);
});

test('une erreur d’écriture ne bloque pas les mutations suivantes de la file', async () => {
  const { local, message } = mutationHarness();
  local.failNextWrite();
  const failed = await message({ type: 'MUTATE_SETTINGS', scalars: [{ key: 'theme', value: 'nord', expected: 'catppuccin' }] });
  assert.equal(failed.ok, false);
  const next = await message({ type: 'MUTATE_SETTINGS', scalars: [{ key: 'openMode', value: 'compact', expected: 'overlay' }] });
  assert.equal(next.ok, true);
  assert.equal(local.snapshot().openMode, 'compact');
});

test('après redémarrage du worker, une mutation repart de l’état réellement enregistré', async () => {
  const first = mutationHarness();
  await first.message({ type: 'MUTATE_SETTINGS', scalars: [{ key: 'theme', value: 'nord', expected: 'catppuccin' }] });
  const restarted = mutationHarness(undefined, first.local);
  const result = await restarted.message({ type: 'MUTATE_SETTINGS', scalars: [{ key: 'openMode', value: 'split', expected: 'overlay' }] });
  assert.equal(result.ok, true);
  assert.equal(first.local.snapshot().theme, 'nord');
  assert.equal(first.local.snapshot().openMode, 'split');
});

test('un import ou une réinitialisation remplace l’état dans la même file', async () => {
  const { local, message } = mutationHarness();
  await message({ type: 'MUTATE_SETTINGS', scalars: [{ key: 'theme', value: 'nord', expected: 'catppuccin' }] });
  const replaced = await message({
    type: 'MUTATE_SETTINGS',
    replace: { theme: 'dracula', domainRules: 'example.com = blocked' }
  });
  assert.equal(replaced.ok, true);
  assert.equal(local.snapshot().theme, 'dracula');
  assert.equal(local.snapshot().domainRules, 'example.com = blocked');
  assert.equal(local.snapshot().openMode, 'overlay');
});

test('les mutations refusent les clés inconnues et les identifiants de thème invalides', async () => {
  const { message } = mutationHarness();
  const unknown = await message({ type: 'MUTATE_SETTINGS', scalars: [{ key: 'unknown', value: true }] });
  assert.equal(unknown.ok, false);
  const invalid = await message({ type: 'MUTATE_SETTINGS', savedThemes: [{ id: '../bad', theme: null }] });
  assert.equal(invalid.ok, false);
});

function readingHarness(options) {
  const values = {};
  const session = { async get(key) { return { [key]: structuredClone(values[key]) }; }, async set(patch) { Object.assign(values, structuredClone(patch)); } };
  return { ...loadWorker({ session }, options), values, session };
}

test('positions de lecture : reprise exacte, isolation privée et conservation après redémarrage du worker', async () => {
  for (const firefox of [false, true]) {
    const worker = readingHarness({ firefox });
    const sender = { frameId: 2, url: 'https://example.com/article', tab: { incognito: false } };
    const url = sender.url;
    await worker.api.handleReadingPosition({ type: 'SAVE_READING_POSITION', url, x: 0, y: 820 }, sender);
    const restarted = loadWorker({ session: worker.session }, { firefox });
    assert.equal((await restarted.api.handleReadingPosition({ type: 'GET_READING_POSITION', url }, sender)).y, 820);
    assert.equal(await worker.api.handleReadingPosition({ type: 'GET_READING_POSITION', url: `${url}?other` }, sender), null);
    assert.equal(await worker.api.handleReadingPosition({ type: 'GET_READING_POSITION', url }, { ...sender, tab: { incognito: true } }), null);
    await worker.api.handleReadingPosition({ type: 'SAVE_READING_POSITION', url, x: 0, y: 40 }, { ...sender, tab: { incognito: true } });
    assert.equal((await worker.api.handleReadingPosition({ type: 'GET_READING_POSITION', url }, sender)).y, 820);
  }
});

test('positions de lecture : validation, expiration et limite de 100 pages', async () => {
  const { api, values } = readingHarness();
  const sender = { frameId: 1, url: 'https://example.com/article', tab: {} };
  const save = { type: 'SAVE_READING_POSITION', url: sender.url, x: 0, y: 100 };
  await assert.rejects(api.handleReadingPosition(save, { ...sender, frameId: 0 }));
  await assert.rejects(api.handleReadingPosition({ ...save, url: 'https://other.example/' }, sender));
  for (const y of [-1, Infinity, '100', 10000001]) await assert.rejects(api.handleReadingPosition({ ...save, y }, sender));
  values['peekReadingPositions:normal'] = [{ url: save.url, x: 0, y: 50, time: Date.now() - 86400001 }];
  assert.equal(await api.handleReadingPosition({ type: 'GET_READING_POSITION', url: save.url }, sender), null);
  for (let i = 0; i < 102; i++) await api.handleReadingPosition({ ...save, url: `https://example.com/${i}` }, sender);
  assert.equal(values['peekReadingPositions:normal'].length, 100);
  assert.equal(await api.handleReadingPosition({ type: 'GET_READING_POSITION', url: 'https://example.com/0' }, sender), null);
});

test('les erreurs du stockage de lecture ne sont pas présentées comme un succès', async () => {
  const { chrome } = readingHarness();
  chrome.storage.session.set = async () => { throw new Error('quota'); };
  const sender = { frameId: 1, url: 'https://example.com/', tab: {} };
  const response = await new Promise(resolve => chrome.runtime.onMessage.listener({ type: 'SAVE_READING_POSITION', url: sender.url, x: 0, y: 10 }, sender, resolve));
  assert.equal(response.ok, false);
});

test('sans stockage de session, les positions utilisent seulement la mémoire temporaire', async () => {
  const { api } = loadWorker({});
  const sender = { frameId: 1, url: 'https://example.com/', tab: {} };
  await api.handleReadingPosition({ type: 'SAVE_READING_POSITION', url: sender.url, x: 0, y: 125 }, sender);
  assert.equal((await api.handleReadingPosition({ type: 'GET_READING_POSITION', url: sender.url }, sender)).y, 125);
  const restarted = loadWorker({});
  assert.equal(await restarted.api.handleReadingPosition({ type: 'GET_READING_POSITION', url: sender.url }, sender), null);
});
