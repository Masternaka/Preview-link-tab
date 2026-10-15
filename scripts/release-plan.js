const fs = require('node:fs');
const { execFileSync, spawnSync } = require('node:child_process');

function releasePlan({ version, manifestVersion, event, ref, beforeVersion, existingRelease }) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || version !== manifestVersion) {
    throw new Error('package.json et manifest.json doivent porter la même version X.Y.Z.');
  }
  const tag = `v${version}`;
  const tagged = ref.startsWith('refs/tags/');
  if (!tagged && ref !== 'refs/heads/main') throw new Error('Publication autorisée uniquement depuis main ou un tag de version.');
  if (tagged && ref !== `refs/tags/${tag}`) throw new Error('Le tag ne correspond pas à la version des manifestes.');
  if (!tagged && event === 'push' && beforeVersion && version !== beforeVersion) {
    const previous = beforeVersion.split('.').map(Number);
    const current = version.split('.').map(Number);
    const firstChange = current.findIndex((part, index) => part !== previous[index]);
    if (firstChange < 0 || current[firstChange] < previous[firstChange]) throw new Error('Le numéro de version doit augmenter.');
  }
  const changed = tagged || event === 'workflow_dispatch' || beforeVersion !== version;
  return { tag, publish: changed && (!existingRelease || existingRelease.draft === true) };
}

async function main() {
  const version = require('../package.json').version;
  const manifestVersion = require('../manifest.json').version;
  const event = process.env.EVENT_NAME;
  const ref = process.env.RELEASE_REF;
  let beforeVersion = null;
  if (event === 'push' && ref === 'refs/heads/main' && !/^0+$/.test(process.env.BEFORE_SHA || '0')) {
    beforeVersion = JSON.parse(execFileSync('git', ['show', `${process.env.BEFORE_SHA}:package.json`], { encoding: 'utf8' })).version;
  }
  const initial = releasePlan({ version, manifestVersion, event, ref, beforeVersion });
  // Skip unchanged versions without an API call; auth/network errors must never
  // be mistaken for a missing release.
  let existingRelease;
  if (initial.publish) {
    const tagStatus = spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/tags/${initial.tag}`]);
    if (tagStatus.status === 0) {
      const target = execFileSync('git', ['rev-parse', `${initial.tag}^{commit}`], { encoding: 'utf8' }).trim();
      const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
      if (target !== head) throw new Error('Ce tag désigne un autre commit ; il ne sera pas déplacé.');
    } else if (tagStatus.status !== 1) throw new Error('Impossible de vérifier le tag existant.');
    const response = await fetch(`https://api.github.com/repos/${process.env.GH_REPO}/releases/tags/${initial.tag}`, {
      headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(30000)
    });
    if (response.ok) existingRelease = await response.json();
    else if (response.status !== 404) throw new Error(`Lecture de la release impossible : HTTP ${response.status}.`);
  }
  const plan = releasePlan({ version, manifestVersion, event, ref, beforeVersion, existingRelease });
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `tag=${plan.tag}\npublish=${plan.publish}\n`);
  console.log(plan.publish ? `Publication prévue : ${plan.tag}` : `Aucune nouvelle release pour ${plan.tag}.`);
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { releasePlan };
