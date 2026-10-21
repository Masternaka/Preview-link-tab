const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

function installHooks({ root = path.resolve(__dirname, '..'), nodeExecutable = process.execPath, temporaryRoots = [os.tmpdir(), '/tmp', '/private/tmp'] } = {}) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const config = args => { try { return git(['config', ...args]); } catch (error) { if (error.status === 1) return ''; throw error; } };
  const effective = config(['--get', 'core.hooksPath']);
  const local = config(['--local', '--get', 'core.hooksPath']);
  const global = config(['--global', '--get', 'core.hooksPath']);
  if (global || (effective && (effective !== '.githooks' || local !== '.githooks'))) {
    throw new Error('Un autre core.hooksPath est configuré; installation refusée pour préserver les hooks existants.');
  }
  if (!effective) {
    const defaultHooks = path.resolve(root, git(['rev-parse', '--git-path', 'hooks']));
    if (fs.existsSync(defaultHooks)) {
      for (const entry of fs.readdirSync(defaultHooks)) {
        if (entry.endsWith('.sample')) continue;
        try { fs.accessSync(path.join(defaultHooks, entry), fs.constants.X_OK); }
        catch { continue; }
        if (fs.statSync(path.join(defaultHooks, entry)).isFile()) throw new Error(`Hook actif existant : ${entry}; installation refusée.`);
      }
    }
  }
  let executable = path.resolve(nodeExecutable);
  const isTemporary = temporaryRoots.filter(folder => fs.existsSync(folder)).some(folder => {
    const relative = path.relative(fs.realpathSync(folder), fs.realpathSync(executable));
    return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
  });
  if (isTemporary) {
    const destination = path.join(root, 'tools', 'local-runtime', 'node');
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (executable !== destination) fs.copyFileSync(executable, destination);
    fs.chmodSync(destination, 0o755);
    executable = destination;
  }
  if (/[\r\n]/.test(executable)) throw new Error('Le chemin Node ne doit pas contenir de retour à la ligne.');
  const version = execFileSync(executable, ['--version'], { encoding: 'utf8' }).trim();
  if (!/^v(?:22|24)\./.test(version)) throw new Error(`Node.js 22 ou 24 requis (${version}).`);
  for (const name of ['post-commit', 'pre-push', 'prepare-distribution']) fs.chmodSync(path.join(root, '.githooks', name), 0o755);
  const nodePathFile = path.resolve(root, git(['rev-parse', '--git-path', 'preview-node-path']));
  fs.writeFileSync(nodePathFile, `${executable}\n`, { mode: 0o600 });
  git(['config', '--local', 'core.hooksPath', '.githooks']);
  console.log(`Hooks locaux installés avec ${version} (${executable}).`);
  return executable;
}
if (require.main === module) {
  try { installHooks(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { installHooks };
