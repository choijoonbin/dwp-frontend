import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/frontend-quality.yml', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

const requiredMailSpecs = [
  'mail-address-book.spec.ts',
  'mail-admin.spec.ts',
  'mail-bulk-idempotency.spec.ts',
  'mail-identity-isolation.spec.ts',
  'mail-lifecycle.spec.ts',
  'mail-mobile-navigation.spec.ts',
  'mail-no-account.spec.ts',
  'mail-proposals.spec.ts',
  'mail-responsive.spec.ts',
  'mail-safety-boundaries.spec.ts',
  'mail-secondary-surfaces.spec.ts',
  'mail.spec.ts',
];

test('Mail CI gate runs every behavior spec on Chromium desktop and mobile', () => {
  const command = String(packageJson.scripts?.['test:e2e:mail'] ?? '');
  for (const spec of requiredMailSpecs) {
    assert.match(command, new RegExp(`e2e/${spec.replaceAll('.', '\\.')}(?:\\s|$)`, 'u'));
  }
  assert.match(command, /--project=chromium/u);
  assert.match(command, /--project=mobile/u);
  assert.match(command, /--workers=1/u);
  assert.match(workflow, /^ {2}mail-quality:/mu);
  assert.match(workflow, /run: corepack yarn test:e2e:mail/u);
});

test('Mail has a required Darwin pixel-baseline step', () => {
  assert.equal(
    packageJson.scripts?.['test:e2e:mail:visual'],
    'playwright test e2e/mail-visual-baseline.spec.ts --project=chromium --project=mobile --workers=1'
  );
  assert.match(workflow, /Run approved Darwin Mail visual baselines/u);
  assert.match(workflow, /run: corepack yarn test:e2e:mail:visual/u);
});
