import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { getNotificationNoiseQuality } from '@dwp-frontend/shared-utils/api/notification-attention-api';
import { NOTIFICATION_API_CAPABILITIES } from '@dwp-frontend/shared-utils/api/notification-api';

import { toNoiseQualityView } from './notification-attention-adapters';
import { notificationQueryKeys } from './integration-contract';
import { DEFAULT_NOTIFICATION_NOISE_FILTERS } from './notification-noise-quality-model';
import { NotificationNoiseQualityPanel } from './notification-noise-quality-panel';
import { useOnlineStatus } from './use-notification-runtime';

import type {
  NotificationNoiseFilters,
  NotificationNoiseFinding,
  NotificationNoisyType,
} from './notification-noise-quality-model';

function investigationPath(item: NotificationNoisyType, finding: NotificationNoiseFinding) {
  const params = new URLSearchParams({
    appKey: item.appKey,
    typeKey: item.typeKey,
  });
  if (finding.target === 'POLICY') {
    params.set('policyId', finding.targetKey);
    return `/notifications/admin/policies?${params.toString()}`;
  }
  if (finding.target === 'TEMPLATE') {
    params.set('revisionId', finding.targetKey);
    return `/notifications/admin/templates?${params.toString()}`;
  }
  if (finding.target === 'DELIVERY_CONTROL') {
    params.set('controlId', finding.targetKey);
    return `/notifications/admin/suppressions?${params.toString()}`;
  }
  params.set('contractId', finding.targetKey);
  params.set('query', item.typeKey);
  return `/notifications/admin/contracts?${params.toString()}`;
}

export function NotificationAdminNoiseQualityRuntime() {
  const { t, i18n } = useTranslation('notifications');
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const [filters, setFilters] = useState<NotificationNoiseFilters>(
    DEFAULT_NOTIFICATION_NOISE_FILTERS
  );
  const deferredSearch = useDeferredValue(filters.search.trim());
  const request = useMemo(
    () => ({
      range: filters.range === 'LAST_30_DAYS' ? undefined : filters.range,
      query: deferredSearch || undefined,
      severity: filters.severity ?? undefined,
      risk: filters.risk ?? undefined,
    }),
    [deferredSearch, filters.range, filters.risk, filters.severity]
  );
  const query = useQuery({
    queryKey: [...notificationQueryKeys.adminNoiseQuality(), request],
    queryFn: ({ signal }) => getNotificationNoiseQuality(request, signal),
    staleTime: 30_000,
    retry: 1,
    enabled: NOTIFICATION_API_CAPABILITIES.tenantAdmin,
  });
  const view = useMemo(
    () => (query.data ? toNoiseQualityView(query.data, t) : null),
    [query.data, t]
  );

  if (!NOTIFICATION_API_CAPABILITIES.tenantAdmin) return null;

  return (
    <NotificationNoiseQualityPanel
      metrics={view?.metrics}
      noisyTypes={view?.noisyTypes ?? []}
      trend={view?.trend ?? []}
      filters={filters}
      onFiltersChange={setFilters}
      state={
        query.isLoading
          ? { kind: 'LOADING' }
          : query.isError || !view
            ? {
                kind: 'ERROR',
                message: t(online ? 'noiseQuality.loadFailed' : 'noiseQuality.offline'),
              }
            : view.state
      }
      privacyPolicy={view?.privacyPolicy ?? null}
      fourEyesPolicy={
        view?.fourEyesPolicy ?? {
          state: 'UNAVAILABLE',
          summary: t('noiseQuality.fourEyes.unavailableSummary'),
          draftLabel: t('noiseQuality.fourEyes.draft'),
          reviewLabel: t('noiseQuality.fourEyes.review'),
          reviewerSeparationRequired: false,
          canOpenPolicy: false,
        }
      }
      generatedAt={query.data?.generatedAt}
      locale={i18n.resolvedLanguage ?? i18n.language}
      onRetry={() => void query.refetch()}
      onInspectType={(item) => {
        const params = new URLSearchParams({
          contractId: item.contractId,
          query: item.typeKey,
          appKey: item.appKey,
        });
        navigate(`/notifications/admin/contracts?${params.toString()}`);
      }}
      onOpenFinding={(item, finding) => navigate(investigationPath(item, finding))}
      onOpenPolicy={() => navigate('/notifications/admin/policies')}
    />
  );
}
