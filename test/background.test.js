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

function loadWorker(storage) {
  const event = () => ({ addListener(listener) { this.listener = listener; } });
  let nextWindow = 10;
  const sent = [];
  const chrome = {
    storage: { session: storage.session },
    runtime: { onInstalled: event(), onMessage: event() },
    contextMenus: { onClicked: event() },
    commands: { onCommand: event() },
    windows: {
      onRemoved: event(),
      async create() {
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
  const context = vm.createContext({ chrome, URL });
  context.importScripts = name => vm.runInContext(
    fs.readFileSync(path.join(__dirname, '..', name), 'utf8'), context
  );
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8'), context);
  return { api: context, chrome, sent };
}

const request = { url: 'https://example.com/', settings: { size: 'medium', position: 'center' } };

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

function siteHarness() {
  const worker = loadWorker(storageHarness());
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
