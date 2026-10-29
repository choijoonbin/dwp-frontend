import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflowPath = new URL('../.github/workflows/frontend-quality.yml', import.meta.url);
const workflow = readFileSync(workflowPath, 'utf8');

function jobSource(jobId) {
  const marker = `  ${jobId}:\n`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `${jobId} must remain a required Frontend quality job`);
  const remaining = workflow.slice(start + marker.length);
  const nextJob = remaining.search(/^ {2}[a-z0-9-]+:\n/mu);
  return nextJob === -1
    ? workflow.slice(start)
    : workflow.slice(start, start + marker.length + nextJob);
}

const calendarSpecs = [
  'e2e/calendar-advanced-scheduling.spec.ts',
  'e2e/calendar-enterprise.spec.ts',
  'e2e/calendar-home-enterprise.spec.ts',
  'e2e/calendar-home-flow.spec.ts',
  'e2e/calendar-home-rail-design.spec.ts',
  'e2e/calendar-insights-and-settings.spec.ts',
  'e2e/calendar-precision-design.spec.ts',
  'e2e/calendar-visual-quality.spec.ts',
  'e2e/calendar-work-handoff.spec.ts',
  'e2e/flow-home-calendar-insights.spec.ts',
];

test('Frontend quality keeps every Calendar behavior and accessibility spec mandatory', () => {
  const source = jobSource('calendar-quality');
  assert.match(source, /playwright install --with-deps chromium webkit/u);
  for (const spec of calendarSpecs) {
    assert.match(source, new RegExp(spec.replaceAll('.', '\\.'), 'u'), `${spec} must run in CI`);
  }
  assert.match(source, /--project=chromium\b/u);
  assert.match(source, /--project=mobile\b/u);
  assert.match(source, /--workers=1\b/u);
  assert.doesNotMatch(source, /continue-on-error/u);
  assert.match(
    source,
    /--ignore-snapshots\b/u,
    'Linux behavior and accessibility gates must not depend on Darwin pixel baselines'
  );
});

test('approved Darwin Calendar pixel baselines remain mandatory and immutable in CI', () => {
  const source = jobSource('calendar-visual-baselines');
  assert.match(source, /playwright install chromium webkit/u);
  assert.match(source, /e2e\/calendar-home-flow\.spec\.ts/u);
  assert.match(source, /e2e\/calendar-visual-quality\.spec\.ts/u);
  assert.match(source, /--project=chromium\b/u);
  assert.match(source, /--project=mobile\b/u);
  assert.doesNotMatch(
    source,
    /calendar-(?:home-flow|visual-quality)\.spec\.ts[\s\S]{0,180}--ignore-snapshots/u,
    'Calendar visual baselines must compare approved pixels instead of ignoring snapshots'
  );
  assert.doesNotMatch(
    source,
    /--update-snapshots/u,
    'required visual CI must never rewrite approved baselines'
  );
});

test('Calendar Safari compatibility remains a required desktop and mobile WebKit gate', () => {
  const source = jobSource('calendar-webkit-quality');
  assert.match(source, /playwright install --with-deps webkit/u);
  assert.match(source, /test:e2e:calendar:webkit/u);
  assert.match(source, /calendar-webkit-e2e-report/u);
  assert.doesNotMatch(source, /continue-on-error/u);

  const packageSource = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  assert.match(packageSource, /e2e\/calendar-webkit-smoke\.spec\.ts/u);
  assert.match(packageSource, /playwright\.calendar-webkit\.config\.ts/u);
  assert.match(packageSource, /--project=webkit\b/u);
  assert.match(packageSource, /--project=webkit-mobile\b/u);
});
