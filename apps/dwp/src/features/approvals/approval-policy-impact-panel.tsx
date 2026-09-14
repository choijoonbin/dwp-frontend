import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { GitCompareArrows, RefreshCcw } from 'lucide-react';
import {
  ActionButton,
  ErrorState,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import {
  HttpError,
  productSurfaceServerNow,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils';
import { getApprovalPolicyImpact } from '@dwp-frontend/shared-utils/api/approval-policy-impact-api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { useOptionalAllowedProductSurface } from '../../components/allowed-product-surface-context';
import { useApprovalManagementCommandScope } from './approval-management-command-scope';
import { useApprovalManagementRequestScope } from './use-approval-experience';
import {
  approvalPolicyImpactSourceIdentity,
  resolveApprovalPolicyImpactIdentity,
} from './approval-policy-impact-source';
import { ApprovalPolicyImpactResults } from './approval-policy-impact-results';
import type { ApprovalPolicy } from '@dwp-frontend/shared-utils';
import type { ApprovalManagementScopeBinding } from './approval-management-command-scope';

type Identity = NonNullable<ReturnType<typeof resolveApprovalPolicyImpactIdentity>>;
type Original = ApprovalManagementScopeBinding &
  Readonly<{
    identity: Identity;
    policyId: string;
    version: number;
    source: string;
    sequence: number;
  }>;

export function ApprovalPolicyImpactPanel({
  policy,
  sourceReady,
  isSourceCurrent,
}: {
  policy: ApprovalPolicy;
  sourceReady: boolean;
  isSourceCurrent: (policy: ApprovalPolicy) => boolean;
}) {
  const { t } = useTranslation('approvals');
  const scope = useApprovalManagementRequestScope();
  const commands = useApprovalManagementCommandScope(scope.cacheKey);
  const decision = useOptionalAllowedProductSurface();
  const authority = useProductSurfaceAuthority();
  const identity = resolveApprovalPolicyImpactIdentity(
    decision,
    authority.snapshot,
    scope.cacheKey
  );
  const source = approvalPolicyImpactSourceIdentity(policy);
  const [original, setOriginal] = useState<Original | null>(null);
  const [, tick] = useState(0);
  const sequence = useRef(0);
  const current = useRef({
    policy,
    sourceReady,
    identity,
    source,
    snapshot: authority.snapshot,
    decision,
    cacheKey: scope.cacheKey,
    isSourceCurrent,
  });
  current.current = {
    policy,
    sourceReady,
    identity,
    source,
    snapshot: authority.snapshot,
    decision,
    cacheKey: scope.cacheKey,
    isSourceCurrent,
  };
  useEffect(() => {
    const timer = window.setInterval(() => tick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const isCurrent = (candidate: Original | null) => {
    const latest = current.current;
    const currentIdentity = resolveApprovalPolicyImpactIdentity(
      latest.decision,
      latest.snapshot,
      latest.cacheKey
    );
    return Boolean(
      candidate &&
      latest.sourceReady &&
      currentIdentity &&
      latest.isSourceCurrent(latest.policy) &&
      commands.isCurrent(candidate) &&
      candidate.policyId === latest.policy.policyId &&
      candidate.version === latest.policy.version &&
      candidate.source === latest.source &&
      candidate.identity.fingerprint === currentIdentity.fingerprint
    );
  };
  const requireCurrent = (candidate: Original) => {
    if (!isCurrent(candidate)) throw new HttpError('Approval policy impact source changed.', 409);
  };
  const result = useQuery({
    queryKey: [
      'approvals',
      'admin',
      'policy-impact',
      ...scope.cacheKey,
      commands.binding.scopeEpoch,
      original?.policyId,
      original?.version,
      original?.identity.fingerprint,
      original?.sequence,
    ],
    queryFn: ({ signal }) => {
      if (!original) throw new HttpError('Approval policy impact source is unavailable.', 409);
      requireCurrent(original);
      return getApprovalPolicyImpact(
        original.policyId,
        original.version,
        original.identity.authority,
        {
          signal,
          beforeDispatch: () => requireCurrent(original),
          now: () =>
            current.current.snapshot
              ? productSurfaceServerNow(current.current.snapshot)
              : Date.now(),
        }
      );
    },
    enabled: isCurrent(original),
    retry: false,
    staleTime: 0,
    gcTime: 30000,
    refetchOnWindowFocus: false,
  });
  const ready = sourceReady && Boolean(identity) && isSourceCurrent(policy);
  const active = isCurrent(original);
  const now = authority.snapshot ? productSurfaceServerNow(authority.snapshot) : Date.now();
  const fresh = Boolean(
    active &&
    result.isSuccess &&
    !result.isFetching &&
    result.failureCount === 0 &&
    result.data &&
    Date.parse(result.data.authority.validUntil) > now
  );
  const inspect = () => {
    const latest = current.current;
    if (!latest.sourceReady || !latest.identity || !latest.isSourceCurrent(latest.policy)) return;
    setOriginal({
      ...commands.binding,
      identity: latest.identity,
      policyId: latest.policy.policyId,
      version: latest.policy.version,
      source: latest.source,
      sequence: ++sequence.current,
    });
  };

  return (
    <Box
      component="section"
      aria-label={t('admin.impact.title')}
      sx={{
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
        p: { xs: 2, md: 2.5 },
        minWidth: 0,
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
      >
        <Box>
          <Box component="h2" sx={{ typography: 'subtitle1', m: 0 }}>
            {t('admin.impact.title')}
          </Box>
          <Box sx={{ typography: 'body2', color: 'text.secondary', mt: 0.5 }}>
            {t('admin.impact.description')}
          </Box>
        </Box>
        <ActionButton
          onClick={inspect}
          disabled={!ready}
          loading={active && result.isFetching}
          startIcon={original ? <RefreshCcw size={16} /> : <GitCompareArrows size={16} />}
          sx={{ flexShrink: 0 }}
        >
          {t(original ? 'admin.impact.refresh' : 'admin.impact.inspect')}
        </ActionButton>
      </Stack>
      <Box sx={{ mt: 2 }} aria-live="polite">
        {!ready || (original && !active) ? (
          <InlineFeedback severity="warning">
            {t('admin.impact.authorityUnavailable')}
          </InlineFeedback>
        ) : active && result.isFetching ? (
          <LoadingState label={t('admin.impact.loading')} variant="skeleton" skeletonRows={3} />
        ) : active && result.isError ? (
          <ErrorState
            title={t('admin.impact.loadError')}
            description={t('admin.impact.failedResultHidden')}
            onRetry={inspect}
            retryLabel={t('actions.retry')}
          />
        ) : fresh && result.data ? (
          <ApprovalPolicyImpactResults result={result.data} />
        ) : original ? (
          <InlineFeedback severity="warning">{t('admin.impact.expired')}</InlineFeedback>
        ) : (
          <Box sx={{ typography: 'body2', color: 'text.secondary' }}>
            {t('admin.impact.notObserved')}
          </Box>
        )}
      </Box>
    </Box>
  );
}
