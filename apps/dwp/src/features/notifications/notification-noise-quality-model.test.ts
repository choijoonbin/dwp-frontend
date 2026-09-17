import { describe, expect, it } from 'vitest';

import {
  formatNotificationNoiseDatum,
  notificationNoiseHasVisibleData,
  resolveNotificationNoiseDatum,
  sortNotificationNoisyTypes,
  validNotificationNoisePrivacyPolicy,
} from './notification-noise-quality-model';

import type {
  NotificationNoiseMetric,
  NotificationNoisePrivacyPolicy,
  NotificationNoisyType,
} from './notification-noise-quality-model';

const privacyPolicy: NotificationNoisePrivacyPolicy = {
  minimumCohortSize: 20,
  explanation: 'Small cohorts are withheld.',
};

function typeItem(
  typeId: string,
  severity?: 'INFO' | 'WARNING' | 'CRITICAL'
): NotificationNoisyType {
  const available = { state: 'AVAILABLE' as const, value: 0.2, cohortSize: 30 };
  return {
    typeId,
    contractId: typeId,
    appKey: typeId,
    typeKey: `${typeId}.NOTIFICATION`,
    appLabel: typeId,
    typeLabel: `${typeId} notification`,
    sent: { ...available, value: 30 },
    mutedRate: available,
    deduplicationRate: available,
    actionConversion: available,
    finding: severity
      ? {
          findingId: `${typeId}-finding`,
          severity,
          label: `${severity} finding`,
          summary: 'Review the governed source.',
          target: 'CONTRACT',
          targetKey: typeId,
          targetLabel: 'Notification contract',
        }
      : null,
  };
}

describe('notification noise quality model', () => {
  it('shows only finite available values with a cohort at or above the privacy threshold', () => {
    expect(
      resolveNotificationNoiseDatum(
        { state: 'AVAILABLE', value: 0.125, cohortSize: 20 },
        privacyPolicy
      )
    ).toEqual({ visible: true, value: 0.125 });
    expect(
      resolveNotificationNoiseDatum(
        { state: 'AVAILABLE', value: 0.125, cohortSize: 19 },
        privacyPolicy
      )
    ).toEqual({ visible: false, reason: 'PRIVACY' });
  });

  it('fails closed when cohort metadata is absent or the configured threshold is invalid', () => {
    expect(validNotificationNoisePrivacyPolicy(privacyPolicy)).toBe(true);
    expect(validNotificationNoisePrivacyPolicy({ ...privacyPolicy, minimumCohortSize: 0 })).toBe(
      false
    );
    expect(
      resolveNotificationNoiseDatum({ state: 'AVAILABLE', value: 0.2 }, privacyPolicy)
    ).toEqual({ visible: false, reason: 'PRIVACY' });
    expect(
      resolveNotificationNoiseDatum(
        { state: 'AVAILABLE', value: 0.2, cohortSize: 50 },
        { ...privacyPolicy, minimumCohortSize: 0 }
      )
    ).toEqual({ visible: false, reason: 'PRIVACY' });
  });

  it('never formats missing, errored, withheld, or invalid values as zero', () => {
    expect(
      formatNotificationNoiseDatum(
        { state: 'MISSING', value: null, cohortSize: 40 },
        'COUNT',
        privacyPolicy
      )
    ).toBeNull();
    expect(
      formatNotificationNoiseDatum(
        { state: 'AVAILABLE', value: Number.NaN, cohortSize: 40 },
        'COUNT',
        privacyPolicy
      )
    ).toBeNull();
    expect(
      formatNotificationNoiseDatum(
        { state: 'PRIVACY_WITHHELD', value: null, cohortSize: 10 },
        'PERCENT',
        privacyPolicy
      )
    ).toBeNull();
  });

  it('formats rate values only after the privacy guard succeeds', () => {
    expect(
      formatNotificationNoiseDatum(
        { state: 'AVAILABLE', value: 0.125, cohortSize: 40 },
        'PERCENT',
        privacyPolicy,
        'en-US'
      )
    ).toBe('12.5%');
    expect(
      formatNotificationNoiseDatum(
        { state: 'AVAILABLE', value: 1.25, cohortSize: 40 },
        'PERCENT',
        privacyPolicy,
        'en-US'
      )
    ).toBeNull();
  });

  it('narrows regional language tags to a supported product locale before formatting', () => {
    expect(
      formatNotificationNoiseDatum(
        { state: 'AVAILABLE', value: 0.125, cohortSize: 40 },
        'PERCENT',
        privacyPolicy,
        'ko-KR'
      )
    ).toBe('12.5%');
    expect(
      formatNotificationNoiseDatum(
        { state: 'AVAILABLE', value: 0.125, cohortSize: 40 },
        'PERCENT',
        privacyPolicy,
        'de-DE'
      )
    ).toBe('12.5%');
  });

  it('reports visible data without treating a protected metric as available', () => {
    const metric = (cohortSize: number): NotificationNoiseMetric => ({
      key: 'MUTED_RATE',
      label: 'Muted rate',
      description: 'Muted notifications',
      unit: 'PERCENT',
      datum: { state: 'AVAILABLE', value: 0.1, cohortSize },
    });
    expect(notificationNoiseHasVisibleData([metric(10)], privacyPolicy)).toBe(false);
    expect(notificationNoiseHasVisibleData([metric(30)], privacyPolicy)).toBe(true);
  });

  it('orders critical findings before warnings, informational findings, and rows without findings', () => {
    expect(
      sortNotificationNoisyTypes([
        typeItem('none'),
        typeItem('info', 'INFO'),
        typeItem('critical', 'CRITICAL'),
        typeItem('warning', 'WARNING'),
      ]).map((item) => item.typeId)
    ).toEqual(['critical', 'warning', 'info', 'none']);
  });
});
