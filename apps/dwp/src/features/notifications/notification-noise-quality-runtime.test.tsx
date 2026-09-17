import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificationNoiseQualityPanelProps } from './notification-noise-quality-panel';
import type {
  NotificationNoiseFinding,
  NotificationNoisyType,
} from './notification-noise-quality-model';

type OpenFinding = NonNullable<NotificationNoiseQualityPanelProps['onOpenFinding']>;
type InspectType = NonNullable<NotificationNoiseQualityPanelProps['onInspectType']>;
type OpenPolicy = NonNullable<NotificationNoiseQualityPanelProps['onOpenPolicy']>;

const runtimeMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  onInspectType: undefined as InspectType | undefined,
  onOpenFinding: undefined as OpenFinding | undefined,
  onOpenPolicy: undefined as OpenPolicy | undefined,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'en', language: 'en' },
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => runtimeMocks.navigate,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: { generatedAt: '2026-09-16T09:00:00Z' },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@dwp-frontend/shared-utils/api/notification-attention-api', () => ({
  getNotificationNoiseQuality: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils/api/notification-admin-api', () => ({
  getNotificationTenantPolicies: vi.fn(),
}));

vi.mock('@dwp-frontend/shared-utils/api/notification-api', () => ({
  NOTIFICATION_API_CAPABILITIES: { tenantAdmin: true },
}));

vi.mock('./notification-attention-adapters', () => ({
  toNoiseQualityView: () => ({
    metrics: {},
    noisyTypes: [],
    trend: [],
    state: { kind: 'READY' },
    privacyPolicy: { minimumCohortSize: 20, explanation: 'Protected.' },
    fourEyesPolicy: {
      state: 'ENFORCED',
      summary: 'Independent review required.',
      draftLabel: 'Draft',
      reviewLabel: 'Review',
      reviewerSeparationRequired: true,
      canOpenPolicy: true,
    },
  }),
}));

vi.mock('./notification-noise-quality-panel', () => ({
  NotificationNoiseQualityPanel: (props: NotificationNoiseQualityPanelProps) => {
    runtimeMocks.onInspectType = props.onInspectType;
    runtimeMocks.onOpenFinding = props.onOpenFinding;
    runtimeMocks.onOpenPolicy = props.onOpenPolicy;
    return null;
  },
}));

vi.mock('./use-notification-runtime', () => ({
  useOnlineStatus: () => true,
}));

import { NotificationAdminNoiseQualityRuntime } from './notification-noise-quality-runtime';

const finding: NotificationNoiseFinding = {
  findingId: 'finding/critical',
  severity: 'CRITICAL',
  label: 'Critical finding',
  summary: 'Review the governed contract.',
  target: 'CONTRACT',
  targetKey: '10000000-0000-0000-0000-000000000001',
  targetLabel: 'Deployment update',
};

const noisyType: NotificationNoisyType = {
  typeId: '10000000-0000-0000-0000-000000000001',
  contractId: '10000000-0000-0000-0000-000000000001',
  appKey: 'it-service',
  typeKey: 'DEPLOYMENT.UPDATE',
  appLabel: 'IT Service',
  typeLabel: 'Deployment update',
  sent: { state: 'AVAILABLE', value: 40, cohortSize: 40 },
  mutedRate: { state: 'AVAILABLE', value: 0.2, cohortSize: 40 },
  deduplicationRate: { state: 'AVAILABLE', value: 0.1, cohortSize: 40 },
  actionConversion: { state: 'AVAILABLE', value: 0.3, cohortSize: 40 },
  finding,
};

describe('NotificationAdminNoiseQualityRuntime', () => {
  beforeEach(() => {
    runtimeMocks.navigate.mockReset();
    runtimeMocks.onInspectType = undefined;
    runtimeMocks.onOpenFinding = undefined;
    runtimeMocks.onOpenPolicy = undefined;
  });

  it('routes type inspection and finding actions with their distinct canonical identifiers', () => {
    renderToStaticMarkup(createElement(NotificationAdminNoiseQualityRuntime));

    runtimeMocks.onInspectType?.(noisyType);
    runtimeMocks.onOpenFinding?.(noisyType, finding);
    runtimeMocks.onOpenFinding?.(noisyType, {
      ...finding,
      target: 'POLICY',
      targetKey: '20000000-0000-0000-0000-000000000001',
    });
    runtimeMocks.onOpenFinding?.(noisyType, {
      ...finding,
      target: 'TEMPLATE',
      targetKey: '30000000-0000-0000-0000-000000000001',
    });
    runtimeMocks.onOpenFinding?.(noisyType, {
      ...finding,
      target: 'DELIVERY_CONTROL',
      targetKey: '40000000-0000-0000-0000-000000000001',
    });
    runtimeMocks.onOpenPolicy?.();

    expect(runtimeMocks.navigate).toHaveBeenNthCalledWith(
      1,
      '/notifications/admin/contracts?contractId=10000000-0000-0000-0000-000000000001&query=DEPLOYMENT.UPDATE&appKey=it-service'
    );
    expect(runtimeMocks.navigate).toHaveBeenNthCalledWith(
      2,
      '/notifications/admin/contracts?appKey=it-service&typeKey=DEPLOYMENT.UPDATE&contractId=10000000-0000-0000-0000-000000000001&query=DEPLOYMENT.UPDATE'
    );
    expect(runtimeMocks.navigate).toHaveBeenNthCalledWith(
      3,
      '/notifications/admin/policies?appKey=it-service&typeKey=DEPLOYMENT.UPDATE&policyId=20000000-0000-0000-0000-000000000001'
    );
    expect(runtimeMocks.navigate).toHaveBeenNthCalledWith(
      4,
      '/notifications/admin/templates?appKey=it-service&typeKey=DEPLOYMENT.UPDATE&revisionId=30000000-0000-0000-0000-000000000001'
    );
    expect(runtimeMocks.navigate).toHaveBeenNthCalledWith(
      5,
      '/notifications/admin/suppressions?appKey=it-service&typeKey=DEPLOYMENT.UPDATE&controlId=40000000-0000-0000-0000-000000000001'
    );
    expect(runtimeMocks.navigate).toHaveBeenNthCalledWith(6, '/notifications/admin/policies');
  });
});
