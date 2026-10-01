const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { build } = require('../scripts/build');

test('les versions générées partagent les ressources et chargent leurs scripts d’arrière-plan', async t => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'peek-build-'));
  t.after(() => fs.rm(output, { recursive: true, force: true }));
  for (const target of ['chrome', 'firefox']) {
    const folder = await build(target, output);
    const manifest = JSON.parse(await fs.readFile(path.join(folder, 'manifest.json')));
    const resources = [
      ...Object.values(manifest.icons),
      ...Object.values(manifest.action.default_icon),
      ...manifest.content_scripts.flatMap(script => [...script.js, ...script.css]),
      ...(manifest.background.scripts || [manifest.background.service_worker]),
      'popup.html', 'popup.js', 'popup.css'
    ];
    for (const file of resources) await fs.access(path.join(folder, file));
    assert.equal(manifest.version, require('../package.json').version);
    assert.equal((await fs.readdir(folder)).includes('test'), false);
    if (target === 'firefox') {
      assert.deepEqual(manifest.background.scripts, ['settings.js', 'background.js']);
      assert.equal(manifest.background.service_worker, undefined);
      assert.equal(manifest.permissions.includes('system.display'), false);
      assert.equal(manifest.permissions.includes('windows'), false);
      assert.ok(manifest.browser_specific_settings.gecko.id);
    } else {
      assert.equal(manifest.background.service_worker, 'background.js');
      assert.equal(manifest.browser_specific_settings, undefined);
    }
    for (const file of ['content.js', 'settings.js', 'background.js', 'popup.js', 'appearance.css']) {
      assert.deepEqual(await fs.readFile(path.join(folder, file)), await fs.readFile(path.join(__dirname, '..', file)));
    }
  }
  await assert.rejects(build('../other', output), /Navigateur inconnu/);
});
