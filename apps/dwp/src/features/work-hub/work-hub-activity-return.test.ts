import { describe, expect, it, vi } from 'vitest';

import {
  consumeWorkHubActivityReturnIntent,
  recordWorkHubActivityReturnIntent,
  workHubActivityCurrentLocation,
  workHubActivityHandoffRoute,
  workHubActivityOwnerFingerprint,
  workHubItemActivityRoute,
} from './work-hub-activity-return';
import { hubItem } from './work-hub.test-support';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    removeItem: vi.fn((key: string) => void values.delete(key)),
    setItem: vi.fn((key: string, value: string) => void values.set(key, value)),
  };
}

const activityRoute =
  '/activity/timeline?objectType=WORK_ITEM&objectId=10420000-0000-0000-0000-000000000001';
const itemKey = 'WORKSPACE:10420000-0000-0000-0000-000000000001:';
const itemVersion = 7;
const ownerFingerprint = `sha256:${'a'.repeat(64)}`;
const returnTo = `/work/queue?q=verified&work=${encodeURIComponent(itemKey)}#detail`;

describe('Work Activity return focus intent', () => {
  it('compacts a 20KB+ owner scope into a stable collision-resistant fingerprint', async () => {
    const ownerKey = `tenant:1:user:7:${'role-and-permission-scope,'.repeat(1_000)}`;
    const first = await workHubActivityOwnerFingerprint(ownerKey);
    const second = await workHubActivityOwnerFingerprint(ownerKey);
    const changed = await workHubActivityOwnerFingerprint(`${ownerKey}:changed`);

    expect(ownerKey.length).toBeGreaterThan(20_000);
    expect(first).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(second).toBe(first);
    expect(changed).not.toBe(first);
  });

  it('accepts the exact internal Work and PostgreSQL UUID Activity routes', () => {
    expect(workHubActivityHandoffRoute(activityRoute)).toBe(activityRoute);
    expect(
      workHubActivityCurrentLocation({ pathname: '/work/queue', search: '?q=verified', hash: '#x' })
    ).toBe('/work/queue?q=verified#x');
  });

  it.each([
    'https://evil.test/activity/timeline?objectType=WORK_ITEM&objectId=10420000-0000-0000-0000-000000000001',
    '//evil.test/activity/timeline?objectType=WORK_ITEM&objectId=10420000-0000-0000-0000-000000000001',
    '/activity/timeline?objectType=WORK_ITEM&objectId=unsafe',
    '/activity/timeline?objectType=WORK_ITEM&objectType=WORK_ITEM&objectId=10420000-0000-0000-0000-000000000001',
    '/activity/timeline?objectType=WORK_ITEM&objectId=10420000-0000-0000-0000-000000000001#foreign',
    `${activityRoute}&source=PERSONAL_TASK&source=PERSONAL_TASK`,
    `${activityRoute}&source=SERVICE_REQUEST`,
    `${activityRoute}&event=foreign-event`,
    '/activity/home?objectType=WORK_ITEM&objectId=10420000-0000-0000-0000-000000000001',
  ])('rejects a mismatched or unsafe Activity target: %s', (route) => {
    expect(workHubActivityHandoffRoute(route)).toBeNull();
  });

  it('routes the exact personal task to its own Activity projection and restores it once', () => {
    const item = hubItem();
    const personalRoute = `/activity/timeline?objectType=WORK_ITEM&objectId=${item.reference.sourceReference}&source=PERSONAL_TASK`;
    expect(workHubItemActivityRoute(item)).toBe(personalRoute);
    const storage = memoryStorage();
    const target = `/work/queue?work=${encodeURIComponent(item.key)}`;
    expect(
      recordWorkHubActivityReturnIntent(
        {
          activityRoute: personalRoute,
          itemKey: item.key,
          itemVersion: item.version,
          ownerFingerprint,
          returnTo: target,
        },
        storage,
        1000
      )
    ).toBe(true);
    expect(
      consumeWorkHubActivityReturnIntent(
        {
          canUseActivity: true,
          itemKey: item.key,
          itemVersion: item.version,
          ownerFingerprint,
          returnTo: target,
        },
        storage,
        1500
      )
    ).toBe(true);
    expect(
      consumeWorkHubActivityReturnIntent(
        {
          canUseActivity: true,
          itemKey: item.key,
          itemVersion: item.version,
          ownerFingerprint,
          returnTo: target,
        },
        storage,
        1500
      )
    ).toBe(false);
    expect(
      recordWorkHubActivityReturnIntent(
        {
          activityRoute: personalRoute,
          itemKey: `WORKSPACE:${item.reference.sourceReference}:`,
          itemVersion: item.version,
          ownerFingerprint,
          returnTo: target,
        },
        storage,
        1000
      )
    ).toBe(false);
    expect(
      recordWorkHubActivityReturnIntent(
        {
          activityRoute: personalRoute.replace('&source=PERSONAL_TASK', ''),
          itemKey: item.key,
          itemVersion: item.version,
          ownerFingerprint,
          returnTo: target,
        },
        storage,
        1000
      )
    ).toBe(false);
  });

  it.each([
    { key: 'PERSONAL_TASK:other:' },
    { reference: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'not-a-uuid' } },
    { reference: { ...hubItem().reference, obligationKey: 'foreign-obligation' } },
    { sourceId: 'services' as const },
  ])('does not route a mismatched personal task identity to Activity: %s', (changes) => {
    expect(workHubItemActivityRoute(hubItem(changes))).toBeNull();
  });

  it('records and consumes an exact intent once', () => {
    const storage = memoryStorage();
    expect(
      recordWorkHubActivityReturnIntent(
        { activityRoute, itemKey, itemVersion, ownerFingerprint, returnTo },
        storage,
        1_000
      )
    ).toBe(true);
    expect(
      consumeWorkHubActivityReturnIntent(
        { canUseActivity: true, itemKey, itemVersion, ownerFingerprint, returnTo },
        storage,
        1_500
      )
    ).toBe(true);
    expect(
      consumeWorkHubActivityReturnIntent(
        { canUseActivity: true, itemKey, itemVersion, ownerFingerprint, returnTo },
        storage,
        1_500
      )
    ).toBe(false);
  });

  it('refuses to bind an Activity object to a different Work selection', () => {
    expect(
      recordWorkHubActivityReturnIntent(
        {
          activityRoute,
          itemKey: 'WORKSPACE:20420000-0000-0000-0000-000000000002:',
          itemVersion,
          ownerFingerprint,
          returnTo,
        },
        memoryStorage()
      )
    ).toBe(false);
  });

  it.each([
    {
      label: 'permission revoke',
      canUseActivity: false,
      itemKey,
      itemVersion,
      ownerFingerprint,
      returnTo,
      now: 1_500,
    },
    {
      label: 'item mismatch',
      canUseActivity: true,
      itemKey: `${itemKey}other`,
      itemVersion,
      ownerFingerprint,
      returnTo,
      now: 1_500,
    },
    {
      label: 'owner mismatch',
      canUseActivity: true,
      itemKey,
      itemVersion,
      ownerFingerprint: `sha256:${'b'.repeat(64)}`,
      returnTo,
      now: 1_500,
    },
    {
      label: 'item version changed',
      canUseActivity: true,
      itemKey,
      itemVersion: itemVersion + 1,
      ownerFingerprint,
      returnTo,
      now: 1_500,
    },
    {
      label: 'return target mismatch',
      canUseActivity: true,
      itemKey,
      itemVersion,
      ownerFingerprint,
      returnTo: '/work/queue?q=other',
      now: 1_500,
    },
    {
      label: 'stale intent',
      canUseActivity: true,
      itemKey,
      itemVersion,
      ownerFingerprint,
      returnTo,
      now: 1_000_000,
    },
  ])('consumes and discards a $label without restoring focus', (candidate) => {
    const storage = memoryStorage();
    expect(
      recordWorkHubActivityReturnIntent(
        { activityRoute, itemKey, itemVersion, ownerFingerprint, returnTo },
        storage,
        1_000
      )
    ).toBe(true);
    expect(consumeWorkHubActivityReturnIntent(candidate, storage, candidate.now)).toBe(false);
    expect(storage.removeItem).toHaveBeenCalledTimes(1);
    expect(
      consumeWorkHubActivityReturnIntent(
        { canUseActivity: true, itemKey, itemVersion, ownerFingerprint, returnTo },
        storage,
        1_500
      )
    ).toBe(false);
  });

  it('fails closed when storage cannot persist the intent', () => {
    const storage = memoryStorage();
    storage.setItem.mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    expect(
      recordWorkHubActivityReturnIntent(
        { activityRoute, itemKey, itemVersion, ownerFingerprint, returnTo },
        storage,
        1_000
      )
    ).toBe(false);
  });

  it('consumes a forged intent with a malformed owner fingerprint without restoring focus', () => {
    const storage = memoryStorage();
    storage.setItem(
      'dwp.work.activity-return.v1',
      JSON.stringify({
        activityRoute,
        focus: 'ACTIVITY',
        itemKey,
        itemVersion,
        ownerFingerprint: null,
        recordedAt: 1_000,
        returnTo,
      })
    );

    expect(
      consumeWorkHubActivityReturnIntent(
        { canUseActivity: true, itemKey, itemVersion, ownerFingerprint: null, returnTo },
        storage,
        1_500
      )
    ).toBe(false);
    expect(storage.removeItem).toHaveBeenCalledTimes(1);
  });
});
