// Optional integration checks: provide Playwright externally, without changing
// the extension's dependency-free build/test workflow.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const scripts = ['settings.js', 'peek-icons.js', 'content.js'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const styles = ['appearance.css', 'styles.css'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const article = '<!doctype html><title>Article de test</title><h1>Article</h1><div style="height:5000px;background:linear-gradient(white,lightblue)">Texte long</div>';
const server = http.createServer((req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (req.url === '/redirect') { res.writeHead(302, { Location: '/article?redirected' }); res.end(); return; }
  if (req.url === '/blocked') res.setHeader('X-Frame-Options', 'DENY');
  if (req.url === '/slow') { const timer = setTimeout(() => res.end(article), 13000); res.on('close', () => clearTimeout(timer)); return; }
  if (req.url === '/host') {
    res.end('<!doctype html><title>Preview integration</title><h1>Liens de test</h1>' +
      ['article', 'redirect', 'blocked', 'slow'].map(p => `<p><a id="${p}" href="http://127.0.0.1:${server.address().port}/${p}">${p}</a></p>`).join(''));
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
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 1040, height: 760 } });
    const positions = new Map(); const saved = { animation: 'none', autoCompactFallback: false, closeAfterOpen: false };
    const errors = []; const requests = [];
    await context.exposeBinding('previewTestApi', async ({ frame }, message) => {
      requests.push(message);
      if (message.type === 'GET_READING_POSITION') return { ok: true, position: positions.get(message.url) || null };
      if (message.type === 'SAVE_READING_POSITION') { positions.set(message.url, { x: message.x, y: message.y }); return { ok: true }; }
      if (message.type === 'READ_SETTINGS') return saved;
      if (message.type === 'WRITE_SETTINGS') { Object.assign(saved, message.settings); return { ok: true }; }
      if (message.type === 'OPEN_URL_IN_TAB') { const tab = await context.newPage(); await tab.goto(message.url); return { ok: true }; }
      return { ok: true, paused: false };
    });
    // The host's managed Chromium policy blocks unpacked extensions. Browser
    // APIs are simulated; actual content scripts, DOM, HTTP navigation, iframe
    // restrictions, timers and scroll restoration run in the real browser.
    await context.addInitScript(({ scripts, styles }) => {
      window.chrome = {
        runtime: { sendMessage(message, cb) {
          const operation = window.previewTestApi(message);
          // Fault injection: opening succeeds, but the source page receives no
          // reply. Closing must happen before this background request.
          if (message.type !== 'OPEN_URL_IN_TAB') operation.then(response => cb?.(response));
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
    console.log('Browser started; opening fixture pages.');
    page.on('console', m => { if (m.type() === 'error') console.error(m.text()); });
    page.on('pageerror', e => console.error(e.message));
    await page.goto(`${base.replace("127.0.0.1", "localhost")}/host`);
    console.log('Fixture host loaded.');
    assert.match(await page.title(), /Preview integration/);
    const open = async id => { console.log(`Checking ${id}…`); await page.locator(`#${id}`).click({ modifiers: ['Alt'] }); await page.locator('#peek-preview-extension-root.peek-visible').waitFor({ state: 'attached' }); };
    const ready = () => page.waitForFunction(() => { const root = document.getElementById('peek-preview-extension-root'); return root && !root.classList.contains('peek-loading') && !root.classList.contains('peek-blocked'); });
    const frame = () => page.frames().find(frame => frame.parentFrame() === page.mainFrame() && frame.url().includes('/article'));
    if (process.env.QA_FLOW !== 'settings') {
    await open('article'); await ready();
    await frame().waitForFunction(() => document.body.scrollHeight > 3000);
    await frame().evaluate(() => scrollTo(0, 1100));
    for (let attempt = 0; attempt < 60 && positions.get(`${base}/article`)?.y !== 1100; attempt++) {
      await require('node:timers/promises').setTimeout(50);
    }
    assert.equal(positions.get(`${base}/article`).y, 1100);
    await page.locator('.peek-close').click(); await open('article'); await ready();
    await frame().waitForFunction(() => scrollY === 1100);
    console.log('PASS: page reopen restores reading position in a real iframe.');
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
