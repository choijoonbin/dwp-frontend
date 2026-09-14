import { describe, expect, it } from 'vitest';

import {
  localizeNotificationOperationalFindings,
  notificationOperationalFindingRoute,
  selectNotificationOperationalFinding,
} from './notification-operations-model';

import type { NotificationOperationalFinding } from '@dwp-frontend/shared-utils/api/notification-api';

const finding = (
  findingId: string,
  category: NotificationOperationalFinding['category'],
  href?: string | null
): NotificationOperationalFinding => ({
  findingId,
  category,
  severity: 'WARNING',
  title: findingId,
  detail: 'detail',
  count: 1,
  detectedAt: '2026-09-08T10:00:00Z',
  href,
});

describe('notification operations model', () => {
  it('selects a requested finding and falls back to the first current finding', () => {
    const findings = [finding('delivery-1', 'DELIVERY'), finding('policy-1', 'POLICY')];

    expect(selectNotificationOperationalFinding(findings, 'policy-1')?.findingId).toBe('policy-1');
    expect(selectNotificationOperationalFinding(findings, 'missing')?.findingId).toBe('delivery-1');
    expect(selectNotificationOperationalFinding([], 'missing')).toBeNull();
  });

  it('uses safe first-party investigation targets and ignores external href values', () => {
    expect(notificationOperationalFindingRoute(finding('contract-1', 'CONTRACT'))).toBe(
      '/notifications/admin/contracts'
    );
    expect(
      notificationOperationalFindingRoute(
        finding('template-1', 'TEMPLATE', '/notifications/admin/templates?draft=1')
      )
    ).toBe('/notifications/admin/templates?draft=1');
    expect(
      notificationOperationalFindingRoute(finding('delivery-1', 'DELIVERY', 'https://invalid.test'))
    ).toBeNull();
  });

  it('localizes stable platform findings and preserves unknown backend copy', () => {
    const known = finding('external-delivery-disabled', 'DELIVERY');
    const unknown = finding('provider-added-later', 'DELIVERY');
    const localized = localizeNotificationOperationalFindings(
      [known, unknown],
      (key, { defaultValue }) => (key.endsWith('.title') ? '현지화 제목' : defaultValue)
    );

    expect(localized[0]).toMatchObject({ title: '현지화 제목', detail: 'detail' });
    expect(localized[1]).toBe(unknown);
  });
});
