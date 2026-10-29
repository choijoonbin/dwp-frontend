import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const frontendWorkflow = readFileSync('.github/workflows/frontend-quality.yml', 'utf8');
const fullWorkflow = readFileSync('.github/workflows/workplace-quality.yml', 'utf8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

function workflowJob(workflow, jobName) {
  const lines = workflow.split(/\r?\n/u);
  const start = lines.findIndex((line) => line === `  ${jobName}:`);
  assert.notEqual(start, -1, `workflow job ${jobName} must exist`);
  let end = start + 1;
  while (end < lines.length && !/^ {2}[A-Za-z0-9_-]+:\s*$/u.test(lines[end])) end += 1;
  return lines.slice(start, end).join('\n');
}

const workplaceFullJob = workflowJob(fullWorkflow, 'workplace-full');

test('pull-request Workplace smoke covers member and operator journeys on desktop and mobile', () => {
  const command = String(packageJson.scripts?.['test:e2e:workplace:smoke'] ?? '');
  for (const spec of [
    'rooms.spec.ts',
    'workplace-app-entry.spec.ts',
    'workplace-unified-search-reservation.spec.ts',
    'workplace-weekly-planner.spec.ts',
    'workplace-exception-console.spec.ts',
    'workplace-visit-access.spec.ts',
  ]) {
    assert.match(command, new RegExp(`e2e/${spec.replaceAll('.', '\\.')}(?:\\s|$)`, 'u'));
  }
  assert.match(command, /--project=chromium\b/u);
  assert.match(command, /--project=mobile\b/u);
  assert.match(command, /--workers=1\b/u);
  assert.match(frontendWorkflow, /run: corepack yarn test:e2e:workplace:smoke/u);
  assert.doesNotMatch(frontendWorkflow, /test:e2e:workplace:smoke[\s\S]{0,80}continue-on-error/u);
});

test('nightly and manual Workplace gate runs the complete hermetic suite', () => {
  assert.match(fullWorkflow, /^ {2}schedule:/mu);
  assert.match(fullWorkflow, /^ {2}workflow_dispatch:/mu);
  assert.match(
    workplaceFullJob,
    /run: corepack yarn playwright install --with-deps chromium webkit\b/u
  );
  assert.match(workplaceFullJob, /run: corepack yarn test:e2e:workplace/u);
  assert.match(workplaceFullJob, /PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report-workplace/u);
  assert.match(fullWorkflow, /shard: 1\/3/u);
  assert.match(fullWorkflow, /shard: 2\/3/u);
  assert.match(fullWorkflow, /shard: 3\/3/u);
  assert.match(fullWorkflow, /--shard=\$\{\{ matrix\.shard \}\}/u);
  assert.match(fullWorkflow, /fail-fast: false/u);
  assert.doesNotMatch(fullWorkflow, /continue-on-error/u);

  assert.equal(
    packageJson.scripts?.['test:e2e:workplace'],
    'playwright test --config playwright.workplace.config.ts'
  );
  assert.match(packageJson.scripts?.['test:e2e:workplace:live'] ?? '', /member-read-live/u);
});
