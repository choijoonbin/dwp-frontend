import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { notificationSourceSizeReport } from './check-notification-source-size.mjs';

function lines(count) {
  return `${Array.from({ length: count }, (_, index) => `export const line${index} = ${index};`).join('\n')}\n`;
}

test('Notification screen size ratchet accepts 899 lines and reports every larger production screen', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'notification-source-size-'));
  try {
    mkdirSync(path.join(root, 'nested'));
    writeFileSync(path.join(root, 'accepted.tsx'), lines(899));
    writeFileSync(path.join(root, 'oversized.tsx'), lines(900));
    writeFileSync(path.join(root, 'nested/oversized-too.tsx'), lines(901));
    writeFileSync(path.join(root, 'ignored.test.tsx'), lines(1_200));

    const report = await notificationSourceSizeReport(root, 899);

    assert.deepEqual(
      report.violations.map(({ file, lines: count }) => [file, count]),
      [
        ['nested/oversized-too.tsx', 901],
        ['oversized.tsx', 900],
      ]
    );
    assert.equal(
      report.measured.some(({ file }) => file === 'ignored.test.tsx'),
      false
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
