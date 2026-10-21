const assert = require('node:assert/strict');
const test = require('node:test');
const { releasePlan } = require('../../scripts/release-plan');
const base = { version: '0.2.2', manifestVersion: '0.2.2', event: 'push', ref: 'refs/heads/main', beforeVersion: '0.2.1' };

test('un push de version publie, mais pas un push sans changement de version', () => {
  assert.deepEqual(releasePlan(base), { tag: 'v0.2.2', publish: true });
  assert.equal(releasePlan({ ...base, beforeVersion: '0.2.2' }).publish, false);
});
test('une release publiée est préservée et un brouillon peut être terminé', () => {
  assert.equal(releasePlan({ ...base, existingRelease: { draft: false } }).publish, false);
  assert.equal(releasePlan({ ...base, existingRelease: { draft: true } }).publish, true);
});
test('une relance manuelle ou un tag permet de reprendre une publication échouée', () => {
  assert.equal(releasePlan({ ...base, event: 'workflow_dispatch', beforeVersion: '0.2.2' }).publish, true);
  assert.equal(releasePlan({ ...base, ref: 'refs/tags/v0.2.2', beforeVersion: '0.2.2' }).publish, true);
});
test('les versions et les tags incohérents empêchent la publication', () => {
  assert.throws(() => releasePlan({ ...base, ref: 'refs/heads/feature' }));
  assert.throws(() => releasePlan({ ...base, beforeVersion: '0.3.0' }));
  assert.throws(() => releasePlan({ ...base, manifestVersion: '0.2.1' }));
  assert.throws(() => releasePlan({ ...base, ref: 'refs/tags/v0.2.1' }));
  assert.throws(() => releasePlan({ ...base, version: 'invalid', manifestVersion: 'invalid' }));
});
