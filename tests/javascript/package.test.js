const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const test = require('node:test');
const { packageExtensions, pruneArchives } = require('../../scripts/package');
const { version } = require('../../package.json');

test('la rétention garde trois versions avec leurs deux navigateurs et protège les autres entrées', async t => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'peek-retention-'));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const versions = ['1.0.0', '1.9.0', '1.10.0', '1.10.0.1', '0.2.3'];
  for (const value of versions) {
    for (const target of ['chrome', 'firefox']) {
      await fs.writeFile(path.join(folder, `preview-link-tab-${value}-${target}.zip`), value);
    }
  }
  const unknown = ['notes.zip', 'preview-link-tab-0.1.0-chrome.zip.bak', 'preview-link-tab-0.1-chrome.zip', 'SHA256SUMS'];
  for (const name of unknown) await fs.writeFile(path.join(folder, name), 'préserver');
  const directory = 'preview-link-tab-0.0.1-chrome.zip';
  const symlink = 'preview-link-tab-0.0.1-firefox.zip';
  await fs.mkdir(path.join(folder, directory));
  await fs.symlink(path.join(folder, 'notes.zip'), path.join(folder, symlink));
  await pruneArchives(folder, '0.2.3');
  const expected = [...unknown, directory, symlink, ...['0.2.3', '1.10.0', '1.10.0.1']
    .flatMap(value => ['chrome', 'firefox'].map(target => `preview-link-tab-${value}-${target}.zip`))].sort();
  assert.deepEqual((await fs.readdir(folder)).sort(), expected);
  assert.equal(await fs.readFile(path.join(folder, 'SHA256SUMS'), 'utf8'), 'préserver');
  assert.ok((await fs.lstat(path.join(folder, symlink))).isSymbolicLink());
  await pruneArchives(folder, '0.2.3');
  assert.deepEqual((await fs.readdir(folder)).sort(), expected);
});

test('les archives contiennent les manifestes à la racine et des empreintes vérifiables', async t => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'peek-archives-'));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  for (const value of ['90.0.0', '91.0.0', '92.0.0']) {
    for (const target of ['chrome', 'firefox']) {
      await fs.writeFile(path.join(folder, `preview-link-tab-${value}-${target}.zip`), 'ancienne archive');
    }
  }
  await packageExtensions(folder);
  await assert.rejects(fs.access(path.join(folder, 'preview-link-tab-90.0.0-chrome.zip')));
  await assert.rejects(fs.access(path.join(folder, 'preview-link-tab-90.0.0-firefox.zip')));
  assert.equal((await fs.readdir(folder)).filter(name => name.endsWith('.zip')).length, 6);
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
