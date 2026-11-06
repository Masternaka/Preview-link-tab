// Optional integration checks: provide Playwright externally, without changing
// the extension's dependency-free build/test workflow.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '../../tools/ci/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..', '..');
const scripts = ['settings.js', 'peek-icons.js', 'content.js'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const settingsContext = vm.createContext({ URL });
vm.runInContext(`${fs.readFileSync(path.join(root, 'settings.js'), 'utf8')}
this.settingsApi = { PEEK_DEFAULT_SETTINGS, cleanPeekSettings, applySettingsMutation };`, settingsContext);
const settingsApi = settingsContext.settingsApi;
const styles = ['appearance.css', 'styles.css'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const article = '<!doctype html><title>Article de test</title><h1>Article</h1><div style="height:5000px;background:linear-gradient(white,lightblue)">Texte long</div>';
const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (req.url === '/redirect') { res.writeHead(302, { Location: '/article?redirected' }); res.end(); return; }
  if (req.url === '/blocked') res.setHeader('X-Frame-Options', 'DENY');
  if (req.url === '/slow') { const timer = setTimeout(() => res.end(article), 13000); res.on('close', () => clearTimeout(timer)); return; }
  if (req.url === '/host') {
    res.end('<!doctype html><title>Preview integration</title><h1>Liens de test</h1>' +
      ['article', 'redirect', 'blocked', 'slow'].map(p => `<p><a id="${p}" href="http://127.0.0.1:${server.address().port}/${p}">${p}</a></p>`).join('') +
      '<div style="height:5000px">Page principale défilante</div>');
  } else if (req.url.startsWith('/popup') || /\.(js|css|png)$/.test(req.url)) {
    const file = path.resolve(root, '.' + req.url.split('?')[0]);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404); res.end(); return; }
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
      res.end(data);
    });
  } else res.end(article);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 1040, height: 760 } });
    const positions = new Map();
    let saved = settingsApi.cleanPeekSettings({ animation: 'none', autoCompactFallback: false, closeAfterOpen: false });
    const mutateSavedSettings = message => {
      const result = settingsApi.applySettingsMutation(saved, message);
      if (!result.conflict) saved = result.settings;
      return { ok: true, ...result };
    };
    const errors = []; const requests = [];
    const compactPages = new Set();
    await context.exposeBinding('previewTestApi', async ({ frame, page }, message) => {
      requests.push(message);
      if (message.type === 'GET_COMPACT_CONTEXT') return { ok: true, windowId: compactPages.has(page) ? 42 : null };
      if (message.type === 'GET_READING_POSITION') return { ok: true, position: positions.get(message.url) || null };
      if (message.type === 'SAVE_READING_POSITION') { positions.set(message.url, { x: message.x, y: message.y }); return { ok: true }; }
      if (message.type === 'READ_SETTINGS') return saved;
      if (message.type === 'WRITE_SETTINGS') { saved = settingsApi.cleanPeekSettings({ ...saved, ...message.settings }); return { ok: true, settings: saved }; }
      if (message.type === 'MUTATE_SETTINGS') return mutateSavedSettings(message);
      if (message.type === 'OPEN_URL_IN_TAB') { const tab = await context.newPage(); await tab.goto(message.url); return { ok: true }; }
      return { ok: true, paused: false };
    });
    // The host's managed Chromium policy blocks unpacked extensions. Browser
    // APIs are simulated; actual content scripts, DOM, HTTP navigation, iframe
    // restrictions, timers and scroll restoration run in the real browser.
    await context.addInitScript(({ scripts, styles }) => {
      window.chrome = {
        runtime: { onMessage: { addListener(listener) { window.previewTestMessageListener = listener; } }, sendMessage(message, cb) {
          const operation = window.previewTestApi(message);
          // Fault injection: opening succeeds, but the source page receives no
          // reply. Closing must happen before this background request.
          if (message.type !== 'OPEN_URL_IN_TAB') operation.then(response => {
            cb?.(response);
            if (message.type === 'GET_COMPACT_CONTEXT') window.previewTestCompactReady = true;
          });
        } },
        tabs: { query(o, cb) { cb([{ id: 1, url: location.origin + '/article' }]); } },
        storage: { local: {
          get(defaults, cb) { window.previewTestApi({ type: 'READ_SETTINGS' }).then(values => cb({ ...defaults, ...values })); },
          set(settings, cb) { window.previewTestApi({ type: 'WRITE_SETTINGS', settings }).then(() => cb?.()); }
        } }
      };
      if (location.pathname === '/popup.html') return;
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style'); style.textContent = styles; document.head.appendChild(style);
        // Evaluate in the same isolated test scope, matching content-script order.
        new Function(scripts)();
      }, { once: true });
    }, { scripts, styles });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    // Google News links target news.google.com before redirecting to publishers;
    // the built-in google.com fallback opens these in compact mode.
    const compactPage = await context.newPage();
    compactPages.add(compactPage);
    compactPage.on('pageerror', e => errors.push(e.message));
    await compactPage.goto(`${base}/article`);
    const assertNoCompactToolbar = async () => {
      await compactPage.waitForFunction(() => window.previewTestCompactReady === true);
      assert.equal(await compactPage.locator('#peek-compact-menu-root, .peek-compact-actions').count(), 0);
      assert.equal(await compactPage.locator('h1').innerText(), 'Article');
    };
    for (const width of [1040, 390]) {
      await compactPage.setViewportSize({ width, height: 844 });
      await assertNoCompactToolbar();
    }
    await compactPage.goto(`${base}/redirect`);
    assert.equal(new URL(compactPage.url()).search, '?redirected');
    await assertNoCompactToolbar();
    await compactPage.reload();
    await assertNoCompactToolbar();
    const closeRequests = requests.filter(message => message.type === 'CLOSE_COMPACT_WINDOW').length;
    await compactPage.keyboard.press('Escape');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.filter(message => message.type === 'CLOSE_COMPACT_WINDOW').length, closeRequests + 1);
    assert.equal(requests.filter(message => message.type === 'CLOSE_COMPACT_WINDOW').at(-1).windowId, 42);
    if (process.env.QA_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.QA_SCREENSHOT_DIR, { recursive: true });
      await compactPage.screenshot({ path: path.join(process.env.QA_SCREENSHOT_DIR, 'compact-without-toolbar.png') });
    }
    await compactPage.close();
    compactPages.delete(compactPage);
    console.log('PASS: compact pages have no toolbar after redirect or reload; Escape still requests window closure.');
    console.log('Browser started; opening fixture pages.');
    page.on('console', m => { if (m.type() === 'error') console.error(m.text()); });
    page.on('pageerror', e => console.error(e.message));
    await page.goto(`${base.replace("127.0.0.1", "localhost")}/host`);
    console.log('Fixture host loaded.');
    assert.match(await page.title(), /Preview integration/);
    const open = async id => { console.log(`Checking ${id}…`); await page.locator(`#${id}`).click({ modifiers: ['Alt'] }); await page.locator('#peek-preview-extension-root.peek-visible').waitFor({ state: 'attached' }); };
    const ready = () => page.waitForFunction(() => { const root = document.getElementById('peek-preview-extension-root'); return root && !root.classList.contains('peek-loading') && !root.classList.contains('peek-blocked'); });
    const frame = () => page.frames().find(frame => frame.parentFrame() === page.mainFrame() && frame.url().includes('/article'));
    const assertPanelInsideViewport = async (width, height, limits = {}) => {
      await page.setViewportSize({ width, height });
      const minWidth = limits.minWidth ?? 0;
      const maxWidth = limits.maxWidth ?? width;
      await page.waitForFunction(({ width, height, minWidth, maxWidth }) => {
        const panel = document.querySelector('.peek-panel');
        if (!panel) return false;
        const box = panel.getBoundingClientRect();
        return box.left >= -1.5 && box.top >= -1.5
          && box.right <= width + 1.5 && box.bottom <= height + 1.5
          && box.width >= minWidth - 1.5 && box.width <= maxWidth + 1.5;
      }, { width, height, minWidth, maxWidth }, { timeout: 5000, polling: 100 }).catch(() => {});
      const box = await page.locator('.peek-panel').boundingBox();
      assert(box, `panneau absent après redimensionnement à ${width}×${height}`);
      const tolerance = 1.5;
      assert(Math.abs(box.width - Math.round(width * 0.75)) <= tolerance, `largeur relative incorrecte à ${width}×${height}`);
      assert(Math.abs(box.height - Math.min(Math.round(height * 0.75), height - 128)) <= tolerance, `hauteur relative incorrecte à ${width}×${height}`);
      assert(Math.abs(box.x - (width - box.width) / 2) <= tolerance, 'panneau non centré horizontalement');
      assert(Math.abs(box.y - (height - box.height) / 2) <= tolerance, 'panneau non centré verticalement');
      assert(box.x >= -tolerance && box.y >= -tolerance, `panneau hors cadre à ${width}×${height}: ${JSON.stringify(box)}`);
      assert(box.width >= minWidth - tolerance, `panneau non agrandi à ${width}×${height}: ${JSON.stringify(box)}`);
      assert(box.width <= maxWidth + tolerance, `panneau trop large à ${width}×${height}: ${JSON.stringify(box)}`);
      assert(box.x + box.width <= width + tolerance, `panneau débordant à ${width}×${height}: ${JSON.stringify(box)}`);
      assert(box.y + box.height <= height + tolerance, `panneau trop haut à ${width}×${height}: ${JSON.stringify(box)}`);
      assert(await page.locator('.peek-actions').isVisible(), `actions inaccessibles à ${width}×${height}`);
    };
    if (process.env.QA_FLOW !== 'settings') {
    await open('article'); await ready();
    const initialViewport = page.viewportSize();
    await assertPanelInsideViewport(initialViewport.width, initialViewport.height);
    const decoration = await page.locator('.peek-panel').evaluate(panel => {
      const style = getComputedStyle(panel);
      const header = getComputedStyle(panel.querySelector('.peek-header'));
      const wrap = getComputedStyle(panel.querySelector('.peek-frame-wrap'));
      return { outline: style.outlineStyle, inner: parseFloat(style.borderTopLeftRadius) - parseFloat(style.paddingTop) - parseFloat(style.borderTopWidth), header: parseFloat(header.borderTopLeftRadius), wrap: parseFloat(wrap.borderBottomLeftRadius) };
    });
    assert.equal(decoration.outline, 'none');
    assert.equal(decoration.header, decoration.inner);
    assert.equal(decoration.wrap, decoration.inner);
    const settingsButton = page.getByRole('button', { name: 'Paramètres de l’aperçu', exact: true });
    await settingsButton.click();
    assert.equal(await settingsButton.getAttribute('aria-expanded'), 'true');
    assert(await page.locator('.peek-settings').isVisible());
    await settingsButton.click();
    assert.equal(await settingsButton.getAttribute('aria-expanded'), 'false');
    // Depuis le panneau, l'ordre natif de tabulation peut passer par l'iframe selon la plateforme.
    await page.locator('.peek-open').focus();
    assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('.peek-open')), true, 'la commande Nouvel onglet doit recevoir le focus avant la tabulation');
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => document.activeElement === document.querySelector('.peek-close') && document.activeElement.matches(':focus-visible'), null, { timeout: 2000 })
      .catch(error => assert.fail(`Tab depuis Nouvel onglet doit donner le focus visible à Fermer : ${error.message}`));
    assert.equal(await page.locator('.peek-close').evaluate(button => getComputedStyle(button).outlineStyle), 'solid', 'la commande Fermer doit afficher son contour de focus clavier');
    if (process.env.QA_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.QA_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(process.env.QA_SCREENSHOT_DIR, 'preview-rounded.png') });
    }
    await frame().waitForFunction(() => document.body.scrollHeight > 3000);
    assert.equal(await page.locator('.peek-split, option[value="split"]').count(), 0,
      'aucun bouton ni mode de vue partagée dans l’aperçu');
    // Real wheel events must scroll the cross-origin preview, never its host,
    // including at both ends and over the header or floating actions.
    await page.evaluate(() => scrollTo(0, 300));
    const sourceY = await page.evaluate(() => scrollY);
    const wheelAt = async (locator, deltaY) => {
      const box = await locator.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, deltaY);
      await page.waitForTimeout(250); // Native scrolling and wheel latching settle.
    };
    await frame().evaluate(() => scrollTo(0, 0));
    await wheelAt(page.locator('.peek-frame'), 500);
    assert(await frame().evaluate(() => scrollY > 0), 'l’article doit défiler normalement');
    assert.equal(await page.evaluate(() => scrollY), sourceY, 'la page derrière ne doit pas suivre l’article');
    await frame().evaluate(() => scrollTo(0, document.scrollingElement.scrollHeight));
    await wheelAt(page.locator('.peek-frame'), 700);
    assert.equal(await page.evaluate(() => scrollY), sourceY, 'le bas de l’article ne doit pas transmettre le défilement');
    await frame().evaluate(() => scrollTo(0, 0));
    await wheelAt(page.locator('.peek-frame'), -700);
    assert.equal(await page.evaluate(() => scrollY), sourceY, 'le haut de l’article ne doit pas transmettre le défilement');
    for (const selector of ['.peek-header', '.peek-actions']) {
      await wheelAt(page.locator(selector), 500);
      assert.equal(await page.evaluate(() => scrollY), sourceY, `défilement transmis depuis ${selector}`);
    }
    await page.locator('.peek-pin').click();
    await page.mouse.move(10, 700);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => scrollY), sourceY, 'la page principale doit rester bloquée aussi en dehors de l’aperçu');
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => scrollY), sourceY, 'le clavier ne doit pas faire défiler la page derrière');
    console.log('PASS: host scrolling stays blocked inside and outside the preview, including keyboard scrolling.');
    await frame().evaluate(() => scrollTo(0, 1100));
    for (let attempt = 0; attempt < 60 && positions.get(`${base}/article`)?.y !== 1100; attempt++) {
      await require('node:timers/promises').setTimeout(50);
    }
    assert.equal(positions.get(`${base}/article`).y, 1100);
    await page.locator('.peek-close').click();
    assert.equal(await page.evaluate(() => scrollY), sourceY, 'la fermeture doit conserver la position de lecture de la page principale');
    await page.mouse.move(10, 700);
    await page.mouse.wheel(0, 500);
    await page.waitForFunction(y => scrollY > y, sourceY);
    await page.evaluate(() => scrollTo(0, 0));
    await open('article'); await ready();
    await frame().waitForFunction(() => scrollY === 1100);
    console.log('PASS: page reopen restores reading position in a real iframe.');
    await assertPanelInsideViewport(1600, 900, { minWidth: 950 });
    await assertPanelInsideViewport(900, 700, { maxWidth: 800 });
    await assertPanelInsideViewport(520, 640, { maxWidth: 420 });
    await page.setViewportSize({ width: 1040, height: 760 });
    console.log('PASS: panel and actions stay inside the viewport after enlarging and shrinking it.');
    await frame().evaluate(() => history.pushState({}, '', '/article?spa'));
    await page.waitForFunction(() => document.querySelector('.peek-open') && document.querySelector('.peek-url').title.includes('?spa'));
    saved.animation = 'slide';
    // Reopen with animations enabled before testing the external-tab action.
    await page.locator('.peek-close').click();
    await page.locator('#peek-preview-extension-root.peek-visible').waitFor({ state: 'detached' });
    await page.reload();
    await open('article'); await ready();
    await frame().evaluate(() => history.pushState({}, '', '/article?spa'));
    await page.waitForFunction(() => document.querySelector('.peek-url').title.includes('?spa'));
    const openedTab = context.waitForEvent('page');
    await page.locator('.peek-open').click();
    await page.locator('#peek-preview-extension-root.peek-visible').waitFor({ state: 'detached' });
    const externalTab = await openedTab;
    await externalTab.waitForURL(`${base}/article?spa`);
    assert.equal(await page.locator('.peek-frame').getAttribute('src'), null);
    assert.equal(requests.filter(r => r.type === 'OPEN_URL_IN_TAB').at(-1).url, `${base}/article?spa`);
    console.log('PASS: animated preview closes on click even when the new-tab request is never acknowledged.');
    if (process.env.QA_FLOW === 'tab') { assert.deepEqual(errors, []); return; }
    await open('redirect'); await ready();
    assert.equal(frame().url(), `${base}/article?redirected`);
    await page.locator('.peek-close').click();
    await open('slow');
    await page.locator('#peek-preview-extension-root.peek-blocked').waitFor({ state: 'attached', timeout: 15000 });
    await ready();
    console.log('PASS: slow page times out, then its late confirmation recovers the preview.');
    await page.locator('.peek-close').click(); await open('blocked');
    await page.locator('#peek-preview-extension-root.peek-blocked').waitFor({ state: 'attached', timeout: 15000 });
    assert(await page.locator('.peek-help-open').isVisible()); assert(await page.locator('.peek-help-popup').isVisible());
    await page.locator('.peek-help-retry').click();
    assert.equal(await page.locator('#peek-preview-extension-root.peek-loading').count(), 1);
    console.log('PASS: X-Frame-Options refusal shows alternatives; Retry restarts loading.');
    if (process.env.QA_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.QA_SCREENSHOT_DIR, { recursive: true });
      await page.locator('#peek-preview-extension-root.peek-blocked').waitFor({ state: 'attached', timeout: 15000 });
      await page.screenshot({ path: path.join(process.env.QA_SCREENSHOT_DIR, 'preview-blocked.png') });
    }
    await page.locator('.peek-close').click();
    }
    await page.goto(`${base}/popup.html`);
    assert.equal(await page.locator('option[value="split"]').count(), 0, 'aucun mode de vue partagée dans les paramètres');
    await page.locator('#tab-sites').click(); await page.locator('.domain-rules-details summary').click();
    await page.locator('#rule-domain').fill('example.com'); await page.locator('#add-domain-rule').click();
    await page.getByRole('button', { name: 'Supprimer la règle de example.com', exact: true }).click();
    await page.locator('#undo-delete').click(); assert.equal(await page.locator('.domain-rule-row').count(), 1);
    await page.locator('#tab-appearance').click();
    await page.locator('details').filter({ has: page.locator('#theme-name') }).locator('summary').click();
    await page.locator('#theme-name').fill('Lecture'); await page.locator('#save-theme').click();
    console.log('Theme save status:', await page.locator('#status').innerText());
    await page.locator('#delete-theme').click(); await page.locator('#undo-delete').click();
    await page.waitForFunction(() => document.querySelector('[name="theme"]').selectedOptions[0].textContent === 'Lecture');
    console.log('PASS: rule and personal-theme deletion undo through the real settings UI.');
    for (const width of [1040, 390]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert(await page.locator('#save').isVisible());
    }
    assert.deepEqual(errors, []);
    console.log('PASS: desktop/narrow settings layout, no JavaScript page errors. Extension APIs simulated; Chrome/Firefox extension installation remains a manual check.');
  } finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
