import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/frontend-quality.yml', 'utf8');

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

test('approved Storybook baselines preserve enough heap for the full macOS matrix', () => {
  const source = jobSource('visual-baselines');
  const heap = source.match(/NODE_OPTIONS:\s*--max-old-space-size=(\d+)/u);

  assert.ok(heap, 'the Storybook visual step must declare an explicit Node heap ceiling');
  assert.ok(
    Number(heap[1]) >= 4096,
    'the Storybook visual step must retain at least 4 GiB of heap headroom'
  );
  assert.match(source, /test:storybook --project=chromium --project=mobile/u);
  assert.doesNotMatch(source, /continue-on-error/u);
});

test('the required Storybook interaction gate preserves the same heap protection', () => {
  const source = jobSource('quality');
  const storybookStep = source.match(
    /- name: Run design-system Storybook interaction and accessibility gates[\s\S]*?run: corepack yarn test:storybook --project=chromium --ignore-snapshots/u
  )?.[0];

  assert.ok(storybookStep, 'the required Storybook interaction step must remain present');
  assert.match(storybookStep, /NODE_OPTIONS:\s*--max-old-space-size=(?:[4-9]\d{3}|\d{5,})/u);
});
