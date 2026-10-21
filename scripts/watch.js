const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const { RUNTIME_FILES } = require('./build');

const ROOT = path.resolve(__dirname, '..');
const INPUTS = [...RUNTIME_FILES, 'manifest.json', 'manifests/firefox.json', 'package.json',
  'scripts/build.js', 'scripts/package.js', 'scripts/watch.js'];

async function fingerprint(root) {
  const hash = createHash('sha256');
  for (const file of INPUTS) {
    hash.update(file);
    try { hash.update(await fs.readFile(path.join(root, file))); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      hash.update('missing');
    }
  }
  return hash.digest('hex');
}

// Poll contents instead of watching file inodes: atomic saves and Git replacements
// must remain visible. Only build inputs are read, so outputs cannot cause a loop.
function watch({ root = ROOT, interval = 250, debounce = 150, run, log = console.log } = {}) {
  let child;
  run ??= () => new Promise((resolve, reject) => {
    child = spawn(process.execPath, [path.join(root, 'scripts/package.js')], { cwd: root, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      child = undefined;
      if (code === 0) resolve();
      else reject(new Error(`Génération interrompue (${signal || code}).`));
    });
  });
  let stopped = false;
  let previous;
  let dirty = false;
  let running = false;
  let changedAt = 0;
  let timer;
  async function tick() {
    try {
      const current = await fingerprint(root);
      if (stopped) return;
      if (current !== previous) {
        previous = current;
        dirty = true;
        changedAt = Date.now();
      }
      if (dirty && !running && Date.now() - changedAt >= debounce) {
        dirty = false;
        running = true;
        log('Génération Chrome, Firefox et ZIP…');
        Promise.resolve().then(run).then(() => {
          if (!stopped) log('Distribution locale actualisée. Recharger l’extension dans le navigateur.');
        }, error => {
          if (!stopped) log(`Échec : ${error.message} En attente d’une correction.`);
        }).finally(() => { running = false; });
      }
    } catch (error) {
      if (!stopped) log(`Surveillance : ${error.message}`);
    } finally {
      if (!stopped) timer = setTimeout(tick, interval);
    }
  }
  tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
    child?.kill('SIGTERM');
  };
}

if (require.main === module) {
  console.log('Surveillance active. Ctrl+C pour arrêter.');
  const stop = watch();
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
}
module.exports = { watch, INPUTS };
