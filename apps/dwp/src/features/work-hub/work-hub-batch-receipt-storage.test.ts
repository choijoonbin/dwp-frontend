// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearWorkHubBatchReport,
  finalizeWorkHubBatchReport,
  persistWorkHubBatchReport,
  restoreWorkHubBatchReport,
  WORK_HUB_BATCH_REPORT_UPDATED_EVENT,
} from './work-hub-batch-receipt-storage';
import { workHubBatchReviewedCommand, type WorkHubBatchReceipt } from './work-hub-batch-execution';
import { hubItem } from './work-hub.test-support';

const owner = JSON.stringify({
  identity: ['TENANT', 'tenant-secret', 'user-secret'],
  permissions: ['APP.WORK:UPDATE:ALLOW'],
});
const runId = 'f89b0121-d278-4bb8-b70d-8d626e83236b';
const newerRunId = 'ce756cdc-fd8e-4508-a0df-ec8b634dd76a';
const item = hubItem({
  key: 'PERSONAL_TASK:private-source-reference:',
  title: 'Confidential acquisition review',
  summary: 'Do not persist this source payload',
  sourceRoute: '/work/private-source-route',
});
const receipt: WorkHubBatchReceipt = {
  idempotencyKey: 'ba967aec-a6b2-4f42-a4cd-42504d48ddf8',
  item,
  reviewedCommand: workHubBatchReviewedCommand(item, 'COMPLETED'),
  state: 'UNKNOWN',
};

describe('Work batch receipt storage', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('persists opaque receipt context and rehydrates it only from the current snapshot', async () => {
    const secondItem = hubItem({ key: 'second-authorized-item', title: 'Second stored title' });
    const secondReceipt: WorkHubBatchReceipt = {
      ...receipt,
      idempotencyKey: 'aa967aec-a6b2-4f42-a4cd-42504d48ddf8',
      item: secondItem,
      state: 'CONFLICT',
    };
    const thirdItem = hubItem({ key: 'third-authorized-item', title: 'Third stored title' });
    const thirdReceipt: WorkHubBatchReceipt = {
      ...receipt,
      idempotencyKey: 'da967aec-a6b2-4f42-a4cd-42504d48ddf8',
      item: thirdItem,
      state: 'CONFIRMED',
      version: 7,
    };
    await expect(
      persistWorkHubBatchReport(owner, 'COMPLETED', runId, [
        receipt,
        secondReceipt,
        thirdReceipt,
        {
          ...receipt,
          idempotencyKey: 'ca967aec-a6b2-4f42-a4cd-42504d48ddf8',
          item: hubItem({ key: 'no-longer-authorized', title: 'Revoked item title' }),
          state: 'EXCLUDED',
        },
      ])
    ).resolves.toBe(true);

    const serialized = window.sessionStorage.getItem('dwp.work.batch-report.v3') ?? '';
    expect(serialized).not.toContain(owner);
    expect(serialized).not.toContain('tenant-secret');
    expect(serialized).not.toContain(item.key);
    expect(serialized).not.toContain(item.title);
    expect(serialized).not.toContain(item.summary!);
    expect(serialized).not.toContain(item.sourceRoute!);

    const currentItem = { ...item, title: 'Current authorized title', version: 9 };
    const currentSecond = { ...secondItem, title: 'Second current title', version: 10 };
    const currentThird = { ...thirdItem, title: 'Third current title', version: 11 };
    const restored = await restoreWorkHubBatchReport(owner, [
      currentItem,
      currentSecond,
      currentThird,
    ]);
    expect(restored).toEqual({
      target: 'COMPLETED',
      receipts: [
        { ...receipt, item: currentItem },
        { ...secondReceipt, item: currentSecond },
        { ...thirdReceipt, item: currentThird },
      ],
    });
    expect(restored?.receipts[0]).toMatchObject({
      item: { lifecycle: currentItem.lifecycle, version: 9 },
      reviewedCommand: { kind: 'PERSONAL_COMPLETE', lifecycle: 'OPEN', version: item.version },
    });
  });

  it('drops a stored report when tenant, user, role, or permission scope changes', async () => {
    expect(await persistWorkHubBatchReport(owner, 'COMPLETED', runId, [receipt])).toBe(true);

    await expect(
      restoreWorkHubBatchReport(`${owner}:permission-revoked`, [item])
    ).resolves.toBeNull();
    expect(window.sessionStorage.getItem('dwp.work.batch-report.v3')).toBeNull();
  });

  it('does not let a stale owner cleanup delete a newer report written during hashing', async () => {
    expect(await persistWorkHubBatchReport(owner, 'COMPLETED', runId, [receipt])).toBe(true);
    const restoring = restoreWorkHubBatchReport(`${owner}:old-owner`, [item]);
    window.sessionStorage.setItem('dwp.work.batch-report.v3', 'newer-owner-report');

    await expect(restoring).resolves.toBeNull();
    expect(window.sessionStorage.getItem('dwp.work.batch-report.v3')).toBe('newer-owner-report');
  });

  it('atomically finalizes the exact preflight run and publishes an update event', async () => {
    expect(await persistWorkHubBatchReport(owner, 'COMPLETED', runId, [receipt])).toBe(true);
    const updated = new Promise<void>((resolve) =>
      globalThis.addEventListener(WORK_HUB_BATCH_REPORT_UPDATED_EVENT, () => resolve(), {
        once: true,
      })
    );
    const confirmed: WorkHubBatchReceipt = { ...receipt, state: 'CONFIRMED', version: 3 };

    await expect(
      finalizeWorkHubBatchReport(owner, 'COMPLETED', runId, [receipt], [confirmed])
    ).resolves.toBe(true);
    await updated;
    await expect(restoreWorkHubBatchReport(owner, [item])).resolves.toEqual({
      target: 'COMPLETED',
      receipts: [confirmed],
    });
  });

  it('never lets a late finalizer overwrite a newer stored batch', async () => {
    expect(await persistWorkHubBatchReport(owner, 'COMPLETED', runId, [receipt])).toBe(true);
    const finalizing = finalizeWorkHubBatchReport(
      owner,
      'COMPLETED',
      runId,
      [receipt],
      [{ ...receipt, state: 'CONFIRMED', version: 3 }]
    );
    window.sessionStorage.setItem('dwp.work.batch-report.v3', 'newer-owner-report');

    await expect(finalizing).resolves.toBe(false);
    expect(window.sessionStorage.getItem('dwp.work.batch-report.v3')).toBe('newer-owner-report');
  });

  it('never lets a repeated finalizer downgrade its terminal report', async () => {
    const confirmed: WorkHubBatchReceipt = { ...receipt, state: 'CONFIRMED', version: 3 };
    expect(await persistWorkHubBatchReport(owner, 'COMPLETED', runId, [receipt])).toBe(true);
    expect(
      await finalizeWorkHubBatchReport(owner, 'COMPLETED', runId, [receipt], [confirmed])
    ).toBe(true);

    await expect(
      finalizeWorkHubBatchReport(
        owner,
        'COMPLETED',
        runId,
        [receipt],
        [{ ...receipt, reason: 'CANCELLED' }]
      )
    ).resolves.toBe(false);
    await expect(restoreWorkHubBatchReport(owner, [item])).resolves.toEqual({
      target: 'COMPLETED',
      receipts: [confirmed],
    });
  });

  it('never lets an older identical run finalize over a newer retry revision', async () => {
    expect(await persistWorkHubBatchReport(owner, 'COMPLETED', runId, [receipt])).toBe(true);
    expect(await persistWorkHubBatchReport(owner, 'COMPLETED', newerRunId, [receipt])).toBe(true);
    const confirmed: WorkHubBatchReceipt = { ...receipt, state: 'CONFIRMED', version: 3 };
    expect(
      await finalizeWorkHubBatchReport(owner, 'COMPLETED', newerRunId, [receipt], [confirmed])
    ).toBe(true);

    await expect(
      finalizeWorkHubBatchReport(
        owner,
        'COMPLETED',
        runId,
        [receipt],
        [{ ...receipt, reason: 'CANCELLED' }]
      )
    ).resolves.toBe(false);
    await expect(restoreWorkHubBatchReport(owner, [item])).resolves.toEqual({
      target: 'COMPLETED',
      receipts: [confirmed],
    });
  });

  it('does not finalize when a terminal result changes the reviewed command identity', async () => {
    expect(await persistWorkHubBatchReport(owner, 'COMPLETED', runId, [receipt])).toBe(true);
    const stored = window.sessionStorage.getItem('dwp.work.batch-report.v3');
    const changed: WorkHubBatchReceipt = {
      ...receipt,
      reviewedCommand: { ...receipt.reviewedCommand, version: receipt.reviewedCommand.version + 1 },
      state: 'CONFIRMED',
      version: 4,
    };

    await expect(
      finalizeWorkHubBatchReport(owner, 'COMPLETED', runId, [receipt], [changed])
    ).resolves.toBe(false);
    expect(window.sessionStorage.getItem('dwp.work.batch-report.v3')).toBe(stored);
  });

  it('defers an incomplete PARTIAL/503 restore without deleting or truncating stored receipts', async () => {
    const secondItem = hubItem({ key: 'temporarily-unavailable-source' });
    const secondReceipt: WorkHubBatchReceipt = {
      ...receipt,
      item: secondItem,
      idempotencyKey: 'aa967aec-a6b2-4f42-a4cd-42504d48ddf8',
    };
    expect(
      await persistWorkHubBatchReport(owner, 'COMPLETED', runId, [receipt, secondReceipt])
    ).toBe(true);
    const stored = window.sessionStorage.getItem('dwp.work.batch-report.v3');

    await expect(
      restoreWorkHubBatchReport(owner, [item], undefined, Date.now(), false)
    ).resolves.toBeNull();
    expect(window.sessionStorage.getItem('dwp.work.batch-report.v3')).toBe(stored);
    await expect(
      restoreWorkHubBatchReport(owner, [], undefined, Date.now(), false)
    ).resolves.toBeNull();
    expect(window.sessionStorage.getItem('dwp.work.batch-report.v3')).toBe(stored);
    await expect(
      restoreWorkHubBatchReport(owner, [item, secondItem], undefined, Date.now(), false)
    ).resolves.toEqual({ target: 'COMPLETED', receipts: [receipt, secondReceipt] });
  });

  it('rejects expired, future, malformed, oversized, and forged reports fail closed', async () => {
    const now = Date.parse('2026-09-08T00:00:00Z');
    expect(
      await persistWorkHubBatchReport(owner, 'COMPLETED', runId, [receipt], undefined, now)
    ).toBe(true);
    await expect(
      restoreWorkHubBatchReport(owner, [item], undefined, now + 30 * 60 * 1000 + 1)
    ).resolves.toBeNull();

    for (const invalid of [
      '{',
      JSON.stringify({ schema: 2 }),
      JSON.stringify({
        schema: 2,
        ownerFingerprint: `sha256:${'a'.repeat(64)}`,
        target: 'COMPLETED',
        recordedAt: now + 1,
        receipts: [],
      }),
      'x'.repeat(64 * 1024 + 1),
    ]) {
      window.sessionStorage.setItem('dwp.work.batch-report.v3', invalid);
      await expect(restoreWorkHubBatchReport(owner, [item], undefined, now)).resolves.toBeNull();
      expect(window.sessionStorage.getItem('dwp.work.batch-report.v3')).toBeNull();
    }

    expect(
      await persistWorkHubBatchReport(owner, 'COMPLETED', runId, [receipt], undefined, now)
    ).toBe(true);
    const forged = JSON.parse(
      window.sessionStorage.getItem('dwp.work.batch-report.v3') ?? '{}'
    ) as { receipts: Array<{ state: string; version?: number }> };
    forged.receipts[0] = { ...forged.receipts[0], state: 'CONFLICT', version: 999 };
    window.sessionStorage.setItem('dwp.work.batch-report.v3', JSON.stringify(forged));
    await expect(restoreWorkHubBatchReport(owner, [item], undefined, now)).resolves.toBeNull();
  });

  it('rejects noncanonical idempotency context instead of weakening retry semantics', async () => {
    await expect(
      persistWorkHubBatchReport(owner, 'COMPLETED', runId, [
        { ...receipt, idempotencyKey: 'attacker-controlled' },
      ])
    ).resolves.toBe(false);
    expect(window.sessionStorage.getItem('dwp.work.batch-report.v3')).toBeNull();
  });

  it.each([
    ['reviewed version', { reviewedVersion: -1 }],
    ['reviewed lifecycle', { reviewedLifecycle: 'ROOT' }],
    ['command target', { commandKind: 'PERSONAL_START' }],
  ])('rejects a forged %s from durable retry context', async (_label, mutation) => {
    const now = Date.parse('2026-09-08T00:00:00Z');
    expect(
      await persistWorkHubBatchReport(owner, 'COMPLETED', runId, [receipt], undefined, now)
    ).toBe(true);
    const forged = JSON.parse(
      window.sessionStorage.getItem('dwp.work.batch-report.v3') ?? '{}'
    ) as { receipts: Array<Record<string, unknown>> };
    forged.receipts[0] = { ...forged.receipts[0], ...mutation };
    window.sessionStorage.setItem('dwp.work.batch-report.v3', JSON.stringify(forged));

    await expect(restoreWorkHubBatchReport(owner, [item], undefined, now)).resolves.toBeNull();
    expect(window.sessionStorage.getItem('dwp.work.batch-report.v3')).toBeNull();
  });

  it('invalidates legacy reports that cannot prove their original retry payload', async () => {
    window.sessionStorage.setItem('dwp.work.batch-report.v2', '{"schema":2}');
    window.sessionStorage.setItem('dwp.work.batch-report.v1', '{"schema":1}');

    await expect(restoreWorkHubBatchReport(owner, [item])).resolves.toBeNull();
    expect(window.sessionStorage.getItem('dwp.work.batch-report.v2')).toBeNull();
    expect(window.sessionStorage.getItem('dwp.work.batch-report.v1')).toBeNull();
  });

  it('allows an explicit clear without depending on storage availability', async () => {
    expect(await persistWorkHubBatchReport(owner, 'COMPLETED', runId, [receipt])).toBe(true);
    clearWorkHubBatchReport();
    expect(window.sessionStorage.getItem('dwp.work.batch-report.v3')).toBeNull();
    expect(() =>
      clearWorkHubBatchReport({
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => {
          throw new Error('blocked');
        },
      })
    ).not.toThrow();
  });
});
