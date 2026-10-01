const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = ['chrome', 'firefox'];
const RUNTIME_FILES = [
  'background.js', 'settings.js', 'peek-icons.js', 'content.js',
  'appearance.css', 'styles.css', 'popup.html', 'popup.css', 'popup.js',
  ...[16, 32, 48, 128].map(size => `icons/icon${size}.png`)
];

async function build(target, outputRoot = path.join(ROOT, 'dist')) {
  if (!TARGETS.includes(target)) throw new Error(`Navigateur inconnu : ${target}`);
  const manifest = JSON.parse(await fs.readFile(path.join(ROOT, 'manifest.json'), 'utf8'));
  if (target === 'firefox') {
    Object.assign(manifest, JSON.parse(await fs.readFile(path.join(ROOT, 'manifests/firefox.json'), 'utf8')));
  }
  const output = path.join(outputRoot, target);
  await fs.mkdir(output, { recursive: true });
  for (const file of RUNTIME_FILES) {
    const destination = path.join(output, file);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(path.join(ROOT, file), destination);
  }
  await fs.writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return output;
}

if (require.main === module) {
  (async () => {
    const targets = process.argv.slice(2);
    for (const target of targets.length ? targets : TARGETS) {
      console.log(`Version ${target} : ${await build(target)}`);
    }
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { build };
