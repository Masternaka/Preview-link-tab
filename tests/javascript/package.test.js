const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const test = require('node:test');
const { packageExtensions } = require('../../scripts/package');
const { version } = require('../../package.json');

test('les archives contiennent les manifestes à la racine et des empreintes vérifiables', async t => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'peek-archives-'));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  await packageExtensions(folder);
  const sums = await fs.readFile(path.join(folder, 'SHA256SUMS'), 'utf8');
  for (const target of ['chrome', 'firefox']) {
    const name = `preview-link-tab-${version}-${target}.zip`;
    const archive = path.join(folder, name);
    const entries = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trim().split('\n');
    assert.ok(entries.includes('manifest.json'));
    assert.ok(entries.includes('content.js'));
    assert.ok(entries.includes('icons/icon16.png'));
    assert.ok(entries.every(entry => !entry.includes('..') && !entry.startsWith('/') && !entry.includes('node_modules') && !entry.includes('test/') && !entry.startsWith('tests/') && !entry.startsWith('docs/') && entry !== 'AGENTS.md'));
    const manifest = JSON.parse(execFileSync('unzip', ['-p', archive, 'manifest.json'], { encoding: 'utf8' }));
    assert.equal(manifest.version, version);
    assert.equal(Boolean(manifest.background.service_worker), target === 'chrome');
    assert.equal(Boolean(manifest.background.scripts), target === 'firefox');
    const hash = createHash('sha256').update(await fs.readFile(archive)).digest('hex');
    assert.ok(sums.split('\n').includes(`${hash}  ${name}`));
    // A previous, damaged output must be replaced, rather than updated in place.
    await fs.writeFile(archive, 'ancien fichier');
  }
  await packageExtensions(folder);
  for (const target of ['chrome', 'firefox']) {
    execFileSync('unzip', ['-tq', path.join(folder, `preview-link-tab-${version}-${target}.zip`)]);
  }
});
