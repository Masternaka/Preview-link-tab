const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { build } = require('./build');
const { version } = require('../package.json');

async function packageExtensions(output = path.join(__dirname, '..', 'dist', 'packages')) {
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
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

if (require.main === module) {
  packageExtensions(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { packageExtensions };
