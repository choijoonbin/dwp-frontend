import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Check, ShieldCheck, X } from 'lucide-react';
import {
  ActionButton,
  FormDialog,
  FormField,
  LoadingState,
  LocalErrorState,
} from '@dwp-frontend/design-system';
import {
  decideAccessReviewWork,
  getAccessReviewWorkDetail,
  HttpError,
  useProductSurfaceAuthority,
  useToast,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  GovernedRouteAccessGuard,
  useGovernedRouteAccessDecision,
} from '../../routes/governed-route-access-guard';

import type { AccessReviewWorkDecision } from '@dwp-frontend/shared-utils';
import type { GovernedRouteEvaluationRequest } from '@dwp-frontend/shared-utils/api/auth-api';
import type { GovernedRouteAccessDecision } from '../../routes/governed-route-access-guard';

const DETAIL_ROUTE_CONTRACT = 'route.context.work__work.review-detail.data';
const DECISION_ROUTE_CONTRACT = 'route.context.work__work.review-decision.action';
const NAVIGATION_CONTEXT = 'work.work';

export type AccessReviewWorkErrorState = 'not-found' | 'stale' | 'unavailable';

export function classifyAccessReviewWorkError(error: unknown): AccessReviewWorkErrorState {
  if (!(error instanceof HttpError)) return 'unavailable';
  if (error.status === 403 || error.status === 404) return 'not-found';
  if (error.status === 409) return 'stale';
  return 'unavailable';
}

function governedRequest(
  routeContractKey: string,
  workItemRef: string,
  expectedObjectVersion?: string
): GovernedRouteEvaluationRequest {
  return {
    subject: { type: 'GOVERNED_CONTEXT' },
    navigationContextId: NAVIGATION_CONTEXT,
    routeContractKey,
    target: {
      opaqueTargetRef: workItemRef,
      ...(expectedObjectVersion ? { expectedObjectVersion } : {}),
    },
  };
}

function GuardFallback({
  decision,
  onRetry,
}: {
  decision: Exclude<GovernedRouteAccessDecision, { state: 'allowed' }>;
  onRetry: () => void;
}) {
  const { t } = useTranslation('work');
  if (decision.state === 'loading') {
    return <LoadingState label={t('workPage.accessReview.authorizing')} size="page" />;
  }
  const unavailable = decision.state === 'authority-unavailable';
  return (
    <LocalErrorState
      title={t(
        unavailable
          ? 'workPage.accessReview.authorityUnavailableTitle'
          : 'workPage.accessReview.notAvailableTitle'
      )}
      description={t(
        unavailable
          ? 'workPage.accessReview.authorityUnavailableDescription'
          : 'workPage.accessReview.notAvailableDescription'
      )}
      retryLabel={unavailable ? t('workPage.retry') : undefined}
      onRetry={unavailable ? onRetry : undefined}
      size="page"
    />
  );
}

export function AccessReviewWorkItem({ workItemRef }: { workItemRef: string }) {
  const authority = useProductSurfaceAuthority();
  return (
    <GovernedRouteAccessGuard
      request={governedRequest(DETAIL_ROUTE_CONTRACT, workItemRef)}
      fallback={(decision) => (
        <GuardFallback decision={decision} onRetry={() => void authority.revalidate()} />
      )}
    >
      <AuthorizedAccessReviewWorkItem workItemRef={workItemRef} />
    </GovernedRouteAccessGuard>
  );
}

function AuthorizedAccessReviewWorkItem({ workItemRef }: { workItemRef: string }) {
  const { t } = useTranslation('work');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<Exclude<AccessReviewWorkDecision, 'PENDING'>>();
  const [reason, setReason] = useState('');
  const detailQueryKey = ['work', 'access-review-item', workItemRef] as const;
  const detail = useQuery({
    queryKey: detailQueryKey,
    queryFn: () => getAccessReviewWorkDetail(workItemRef),
    retry: false,
    staleTime: 0,
    meta: { accessSensitive: true },
  });
  const actionAccess = useGovernedRouteAccessDecision(
    detail.data
      ? governedRequest(DECISION_ROUTE_CONTRACT, workItemRef, String(detail.data.version))
      : null
  );
  const decide = useMutation({
    mutationFn: (nextDecision: Exclude<AccessReviewWorkDecision, 'PENDING'>) =>
      decideAccessReviewWork(workItemRef, {
        decision: nextDecision,
        reason: reason.trim(),
        version: detail.data!.version,
      }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(detailQueryKey, updated);
      setDecision(undefined);
      setReason('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workspace', 'work-queue'] }),
        queryClient.invalidateQueries({ queryKey: detailQueryKey }),
      ]);
      toast.success(t('workPage.accessReview.decisionSaved'));
    },
    onError: (error) => {
      const state = classifyAccessReviewWorkError(error);
      if (state === 'stale') {
        toast.error(t('workPage.accessReview.staleDescription'));
        void detail.refetch();
        return;
      }
      toast.error(
        t(
          state === 'not-found'
            ? 'workPage.accessReview.notAvailableDescription'
            : 'workPage.accessReview.decisionError'
        )
      );
    },
  });

  if (detail.isPending) {
    return <LoadingState label={t('workPage.accessReview.loading')} size="page" />;
  }
  if (detail.error || !detail.data) {
    const state = classifyAccessReviewWorkError(detail.error);
    return (
      <LocalErrorState
        title={t(
          state === 'stale'
            ? 'workPage.accessReview.staleTitle'
            : state === 'not-found'
              ? 'workPage.accessReview.notAvailableTitle'
              : 'workPage.accessReview.loadErrorTitle'
        )}
        description={t(
          state === 'stale'
            ? 'workPage.accessReview.staleDescription'
            : state === 'not-found'
              ? 'workPage.accessReview.notAvailableDescription'
              : 'workPage.accessReview.loadErrorDescription'
        )}
        retryLabel={state === 'not-found' ? undefined : t('workPage.retry')}
        onRetry={state === 'not-found' ? undefined : () => void detail.refetch()}
        retrying={detail.isFetching}
        size="page"
      />
    );
  }

  const record = detail.data;
  const canDecide = actionAccess.state === 'allowed' && record.decision === 'PENDING';
  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Box>
          <Typography component="h3" variant="h6">
            {t('workPage.accessReview.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {record.campaignName}
          </Typography>
        </Box>
        <Chip
          icon={<ShieldCheck size={14} />}
          label={t(`workPage.accessReview.decisions.${record.decision}`)}
          color={record.decision === 'PENDING' ? 'warning' : 'success'}
          size="small"
        />
      </Stack>

      <Divider sx={{ my: 2.5 }} />
      <Stack gap={2}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t('workPage.accessReview.subject')}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.25 }}>
            {record.subjectDisplayName}
            {record.subjectEmail ? ` · ${record.subjectEmail}` : ''}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t('workPage.accessReview.role')}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.25 }}>
            {record.roleName} · {record.roleCode}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {t('workPage.accessReview.source')}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.25 }}>
            {t(`workPage.accessReview.sourceTypes.${record.accessSourceType}`)}
            {record.sourceDisplayName ? ` · ${record.sourceDisplayName}` : ''}
          </Typography>
        </Box>
        <Alert severity={record.recommendation === 'REVIEW' ? 'warning' : 'info'}>
          <Typography variant="subtitle2">
            {t(`workPage.accessReview.recommendations.${record.recommendation}`)}
          </Typography>
          <Typography variant="body2">
            {t(`workPage.accessReview.reasons.${record.recommendationReason}`)}
          </Typography>
        </Alert>
      </Stack>

      <Divider sx={{ my: 2.5 }} />
      {actionAccess.state !== 'allowed' && record.decision === 'PENDING' && (
        <Alert severity={actionAccess.state === 'loading' ? 'info' : 'warning'} sx={{ mb: 2 }}>
          {t(
            actionAccess.state === 'loading'
              ? 'workPage.accessReview.authorizingDecision'
              : 'workPage.accessReview.decisionUnavailable'
          )}
        </Alert>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
        <ActionButton
          intent="primary"
          startIcon={<Check size={16} />}
          disabled={!canDecide || decide.isPending}
          onClick={() => setDecision('APPROVE')}
        >
          {t('workPage.accessReview.keep')}
        </ActionButton>
        <ActionButton
          intent="danger"
          startIcon={<X size={16} />}
          disabled={!canDecide || decide.isPending}
          onClick={() => setDecision('REVOKE')}
        >
          {t('workPage.accessReview.revoke')}
        </ActionButton>
      </Stack>

      <FormDialog
        open={Boolean(decision)}
        title={t(
          decision === 'REVOKE'
            ? 'workPage.accessReview.revokeTitle'
            : 'workPage.accessReview.keepTitle'
        )}
        description={t('workPage.accessReview.decisionDescription')}
        cancelLabel={t('workPage.accessReview.cancel')}
        submitLabel={t(
          decision === 'REVOKE' ? 'workPage.accessReview.revoke' : 'workPage.accessReview.keep'
        )}
        submitIntent={decision === 'REVOKE' ? 'danger' : 'primary'}
        busy={decide.isPending}
        submitDisabled={reason.trim().length < 10 || !canDecide}
        onClose={() => {
          setDecision(undefined);
          setReason('');
        }}
        onSubmit={() => decision && decide.mutate(decision)}
      >
        <FormField
          autoFocus
          multiline
          minRows={3}
          label={t('workPage.accessReview.decisionReason')}
          supportingText={t('workPage.accessReview.decisionReasonHelp')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required
        />
      </FormDialog>
    </Box>
  );
}
