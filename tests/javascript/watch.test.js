const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const { watch, INPUTS } = require('../../scripts/watch');
const ROOT = path.resolve(__dirname, '../..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check) {
  const end = Date.now() + 10000;
  while (!await check()) {
    if (Date.now() > end) throw new Error('Délai de surveillance dépassé');
    await pause(20);
  }
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'peek-watch-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const file of INPUTS) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.copyFile(path.join(ROOT, file), path.join(root, file));
  }
  return root;
}
async function setVersion(root, version) {
  for (const file of ['manifest.json', 'package.json']) {
    const destination = path.join(root, file);
    const value = JSON.parse(await fs.readFile(destination));
    value.version = version;
    await fs.writeFile(`${destination}.tmp`, JSON.stringify(value));
    await fs.rename(`${destination}.tmp`, destination);
  }
}
test('le CLI actualise dossiers et archives sans inclure des fichiers périmés', async t => {
  const root = await fixture(t);
  const output = path.join(root, 'output');
  await fs.mkdir(path.join(output, 'chrome'), { recursive: true });
  await fs.writeFile(path.join(output, 'chrome', 'obsolete.txt'), 'ancien');
  execFileSync(process.execPath, [path.join(root, 'scripts/package.js'), output]);
  const initialVersion = JSON.parse(await fs.readFile(path.join(root, 'package.json'))).version;
  await setVersion(root, '2.0.0');
  execFileSync(process.execPath, [path.join(root, 'scripts/package.js'), output]);
  for (const target of ['chrome', 'firefox']) {
    assert.equal(JSON.parse(await fs.readFile(path.join(output, target, 'manifest.json'))).version, '2.0.0');
    const archive = path.join(output, 'packages', `preview-link-tab-2.0.0-${target}.zip`);
    assert.ok(!execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).includes('obsolete.txt'));
  }
  assert.ok((await fs.readdir(path.join(output, 'packages'))).some(name => name.startsWith(`preview-link-tab-${initialVersion}-`)));
});
test('la surveillance utilise les versions fraîches et ignore documents et sorties', async t => {
  const root = await fixture(t);
  let successes = 0;
  const stop = watch({ root, interval: 20, debounce: 20, log: message => {
    if (message.startsWith('Distribution locale')) successes++;
  } });
  t.after(stop);
  await until(() => successes === 1);
  await fs.mkdir(path.join(root, 'docs'));
  await fs.writeFile(path.join(root, 'docs', 'note.md'), 'note');
  await fs.writeFile(path.join(root, 'dist', 'note.txt'), 'sortie');
  await pause(150);
  assert.equal(successes, 1);
  await setVersion(root, '2.0.0');
  await until(() => successes === 2);
  assert.equal(JSON.parse(await fs.readFile(path.join(root, 'dist/firefox/manifest.json'))).version, '2.0.0');
});
test('une modification pendant une génération attend, puis une erreur peut être corrigée', async t => {
  const root = await fixture(t);
  let calls = 0;
  let active = 0;
  let maximum = 0;
  let release;
  const messages = [];
  const stop = watch({ root, interval: 10, debounce: 10, log: message => messages.push(message), run: async () => {
    calls++;
    active++;
    maximum = Math.max(maximum, active);
    try {
      if (calls === 1) await new Promise(resolve => { release = resolve; });
      if (calls === 2) throw new Error('JSON transitoire');
    } finally { active--; }
  } });
  t.after(stop);
  await until(() => calls === 1);
  await fs.appendFile(path.join(root, 'content.js'), '\n// modification');
  await pause(80);
  assert.equal(calls, 1);
  release();
  await until(() => messages.some(message => message.includes('JSON transitoire')));
  await fs.appendFile(path.join(root, 'content.js'), '\n// correction');
  await until(() => calls === 3 && active === 0);
  assert.equal(maximum, 1);
});

test('les versions incohérentes échouent avant de produire une distribution', async t => {
  const root = await fixture(t);
  const file = path.join(root, 'package.json');
  const value = JSON.parse(await fs.readFile(file));
  value.version = '99.0.0';
  await fs.writeFile(file, JSON.stringify(value));
  assert.throws(() => execFileSync(process.execPath, [path.join(root, 'scripts/package.js')], { stdio: 'pipe' }),
    error => error.status === 1 && error.stderr.toString().includes('Versions du manifeste'));
  await assert.rejects(fs.access(path.join(root, 'dist')));
});

test('un échec pendant la génération des ZIP ne supprime aucune ancienne archive', async t => {
  const root = await fixture(t);
  const packages = path.join(root, 'dist/packages');
  await fs.mkdir(packages, { recursive: true });
  const previous = ['0.1.0', '0.2.0', '0.3.0', '0.4.0'].flatMap(value =>
    ['chrome', 'firefox'].map(target => `preview-link-tab-${value}-${target}.zip`));
  for (const name of previous) await fs.writeFile(path.join(packages, name), 'ancienne archive');
  await fs.writeFile(path.join(packages, 'SHA256SUMS'), 'anciennes empreintes');
  // The Chrome ZIP succeeds before the Firefox build encounters invalid JSON.
  await fs.writeFile(path.join(root, 'manifests/firefox.json'), '{');
  const script = 'require(process.argv[1]).packageExtensions(process.argv[2]).catch(() => { process.exitCode = 1; })';
  assert.throws(() => execFileSync(process.execPath, ['-e', script, path.join(root, 'scripts/package.js'), packages], { stdio: 'pipe' }));
  for (const name of previous) assert.equal(await fs.readFile(path.join(packages, name), 'utf8'), 'ancienne archive');
  assert.equal(await fs.readFile(path.join(packages, 'SHA256SUMS'), 'utf8'), 'anciennes empreintes');
});
