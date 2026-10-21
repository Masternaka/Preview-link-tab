const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { build } = require('./build');
const ROOT = path.resolve(__dirname, '..');

async function readVersion() {
  const { version } = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'));
  const manifest = JSON.parse(await fs.readFile(path.join(ROOT, 'manifest.json'), 'utf8'));
  if (manifest.version !== version) throw new Error('Versions du manifeste et de package.json différentes.');
  return version;
}

async function pruneArchives(destination, currentVersion) {
  const archives = (await fs.readdir(destination, { withFileTypes: true }))
    .filter(entry => entry.isFile())
    .map(entry => ({ name: entry.name, match: /^preview-link-tab-(\d+\.\d+\.\d+(?:\.\d+)?)-(?:chrome|firefox)\.zip$/.exec(entry.name) }))
    .filter(entry => entry.match);
  const versions = [...new Set(archives.map(entry => entry.match[1]))];
  versions.sort((left, right) => {
    const a = left.split('.').map(Number);
    const b = right.split('.').map(Number);
    for (let index = 0; index < 4; index++) {
      const difference = (b[index] || 0) - (a[index] || 0);
      if (difference) return difference;
    }
    return left.localeCompare(right);
  });
  const retained = new Set([currentVersion, ...versions.filter(version => version !== currentVersion).slice(0, 2)]);
  for (const archive of archives) {
    if (!retained.has(archive.match[1])) await fs.unlink(path.join(destination, archive.name));
  }
}

async function packageExtensions(output = path.join(__dirname, '..', 'dist', 'packages')) {
  const version = await readVersion();
  const destination = path.resolve(output);
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'peek-package-'));
  try {
    await fs.mkdir(destination, { recursive: true });
    const checksums = [];
    for (const target of ['chrome', 'firefox']) {
      // Build into a fresh folder so stale files in dist/ cannot enter a ZIP.
      const folder = await build(target, path.join(temporary, 'build'));
      const manifest = JSON.parse(await fs.readFile(path.join(folder, 'manifest.json'), 'utf8'));
      if (manifest.version !== version) throw new Error('Versions du manifeste et de package.json différentes.');
      const name = `preview-link-tab-${version}-${target}.zip`;
      const archive = path.join(temporary, name);
      execFileSync('zip', ['-q', '-r', '-X', archive, '.'], { cwd: folder });
      const data = await fs.readFile(archive);
      await fs.copyFile(archive, path.join(destination, name));
      checksums.push(`${createHash('sha256').update(data).digest('hex')}  ${name}`);
      console.log(path.join(destination, name));
    }
    await fs.writeFile(path.join(destination, 'SHA256SUMS'), `${checksums.join('\n')}\n`);
    await pruneArchives(destination, version);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

async function prepareDistribution(outputRoot = path.join(ROOT, 'dist')) {
  await readVersion();
  for (const target of ['chrome', 'firefox']) await build(target, outputRoot);
  await packageExtensions(path.join(outputRoot, 'packages'));
}

if (require.main === module) {
  prepareDistribution(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { packageExtensions, prepareDistribution, pruneArchives };
