const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { installHooks } = require('../../scripts/install-hooks');

function repository(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'peek hooks spaces '));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
  execFileSync('git', ['init', '-q', root], { env });
  fs.cpSync(path.resolve(__dirname, '../../.githooks'), path.join(root, '.githooks'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.writeFileSync(path.join(root, 'scripts/package.js'), 'require("node:fs").writeFileSync("generated", JSON.stringify(process.argv.slice(2)));');
  return { root, env, git: args => execFileSync('git', args, { cwd: root, env, encoding: 'utf8' }).trim() };
}
function isolated(t, fn) {
  const previous = { global: process.env.GIT_CONFIG_GLOBAL, system: process.env.GIT_CONFIG_NOSYSTEM };
  process.env.GIT_CONFIG_GLOBAL = '/dev/null'; process.env.GIT_CONFIG_NOSYSTEM = '1';
  try { fn(); } finally {
    for (const [name, value] of [['GIT_CONFIG_GLOBAL', previous.global], ['GIT_CONFIG_NOSYSTEM', previous.system]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
}

test('hooks install twice, run without Node on PATH, ignore Git push arguments and report failures', t => isolated(t, () => {
  const { root, env, git } = repository(t);
  // Treat the real Node as stable to avoid copying a large runtime in this scenario.
  const options = { root, temporaryRoots: [] };
  assert.equal(installHooks(options), process.execPath);
  installHooks(options);
  assert.equal(git(['config', '--local', '--get', 'core.hooksPath']), '.githooks');
  const run = name => spawnSync(path.join(root, '.githooks', name), ['origin', 'remote with spaces'], { cwd: root, env: { ...env, PATH: '/usr/bin:/bin' }, encoding: 'utf8' });
  assert.equal(run('pre-push').status, 0);
  assert.equal(fs.readFileSync(path.join(root, 'generated'), 'utf8'), '[]');
  fs.writeFileSync(path.join(root, 'scripts/package.js'), 'process.exit(1)');
  assert.equal(run('pre-push').status, 1);
  const committed = run('post-commit');
  assert.equal(committed.status, 0);
  assert.match(committed.stderr, /commit existe déjà/);
}));

test('existing hooks configuration and executable default hooks refuse before local writes', t => isolated(t, () => {
  const { root, git } = repository(t);
  git(['config', '--local', 'core.hooksPath', 'other hooks']);
  assert.throws(() => installHooks({ root }), /installation refusée/);
  git(['config', '--local', '--unset', 'core.hooksPath']);
  const active = path.join(root, '.git/hooks/pre-commit');
  fs.writeFileSync(active, '#!/bin/sh\n'); fs.chmodSync(active, 0o755);
  assert.throws(() => installHooks({ root }), /Hook actif existant/);
  assert.equal(fs.existsSync(path.join(root, 'tools/local-runtime')), false);
  assert.equal(fs.existsSync(path.join(root, '.git/preview-node-path')), false);
}));

test('temporary Node is copied to a stable ignored runtime and validated', t => isolated(t, () => {
  const { root } = repository(t);
  const fake = path.join(root, 'scripts', 'temporary node');
  fs.writeFileSync(fake, '#!/bin/sh\necho v24.10.0\n'); fs.chmodSync(fake, 0o755);
  const executable = installHooks({ root, nodeExecutable: fake, temporaryRoots: [path.join(root, 'scripts')] });
  assert.equal(executable, path.join(root, 'tools/local-runtime/node'));
  assert.equal(fs.readFileSync(executable, 'utf8'), fs.readFileSync(fake, 'utf8'));
  assert.equal(fs.readFileSync(path.join(root, '.git/preview-node-path'), 'utf8'), executable + '\n');
}));

test('global hooksPath is preserved without configuration or runtime writes', t => isolated(t, () => {
  const { root, git } = repository(t);
  const globalFile = path.join(root, 'global config');
  fs.writeFileSync(globalFile, '[core]\n\thooksPath = global-hooks\n');
  process.env.GIT_CONFIG_GLOBAL = globalFile;
  assert.throws(() => installHooks({ root }), /installation refusée/);
  assert.equal(fs.existsSync(path.join(root, '.git/preview-node-path')), false);
  assert.equal(fs.existsSync(path.join(root, 'tools/local-runtime')), false);
  assert.match(fs.readFileSync(globalFile, 'utf8'), /global-hooks/);
}));

test('Node under /tmp is temporary even when os.tmpdir points elsewhere', t => isolated(t, () => {
  const { root } = repository(t);
  const folder = fs.mkdtempSync('/tmp/peek-node-');
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  const fake = path.join(folder, 'node');
  fs.writeFileSync(fake, '#!/bin/sh\necho v22.0.0\n'); fs.chmodSync(fake, 0o755);
  assert.equal(installHooks({ root, nodeExecutable: fake }), path.join(root, 'tools/local-runtime/node'));
}));
