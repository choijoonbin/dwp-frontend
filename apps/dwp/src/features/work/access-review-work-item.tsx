import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, ShieldCheck, X } from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  FormDialog,
  FormField,
  LoadingState,
  LocalErrorState,
  InlineFeedback,
} from '@dwp-frontend/design-system';
import {
  decideAccessReviewWork,
  getAccessReviewWorkDetail,
  HttpError,
  isAccessReviewDecisionSource,
  isExactAccessReviewDecisionReceipt,
  useProductSurfaceAuthority,
  useToast,
} from '@dwp-frontend/shared-utils';

import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import {
  GovernedRouteAccessGuard,
  mapGovernedRouteEvaluation,
  useGovernedRouteAccessDecision,
} from '../../routes/governed-route-access-guard';
import { useWorkHubOperationOwner } from '../../components/use-work-hub-operation-owner';
import { useShellAuxiliaryAvoidance } from '../../components/shell-auxiliary-avoidance/use-shell-auxiliary-avoidance';

import type {
  AccessReviewWorkDecision,
  AccessReviewDecisionReceiptSource,
  DecideAccessReviewWorkRequest,
} from '@dwp-frontend/shared-utils';
import type { GovernedRouteEvaluationRequest } from '@dwp-frontend/shared-utils/api/auth-api';
import type { GovernedRouteAccessDecision } from '../../routes/governed-route-access-guard';

const DETAIL_ROUTE_CONTRACT = 'route.context.work__work.review-detail.data';
const DECISION_ROUTE_CONTRACT = 'route.context.work__work.review-decision.action';
const NAVIGATION_CONTEXT = 'work.work';

type DecisionPreview = DecideAccessReviewWorkRequest & {
  workItemRef: string;
  subjectDisplayName: string;
  roleName: string;
  assignment: AccessReviewDecisionReceiptSource;
};

type DecisionRun = {
  confirmed: DecisionPreview;
  owner: string;
  accessScope: string;
  commandsEnabled: true;
  preflight: () => Promise<boolean>;
  controller: AbortController;
};

export type AccessReviewWorkErrorState = 'not-found' | 'stale' | 'unavailable';

export function classifyAccessReviewWorkError(error: unknown): AccessReviewWorkErrorState {
  if (!(error instanceof HttpError)) return 'unavailable';
  if (error.status === 403 || error.status === 404) return 'not-found';
  if (error.status === 409) return 'stale';
  return 'unavailable';
}

function validateAccessReviewDetail(
  detail: Awaited<ReturnType<typeof getAccessReviewWorkDetail>>,
  expectedWorkItemRef: string
) {
  if (
    detail.workItemRef !== expectedWorkItemRef ||
    !Number.isSafeInteger(detail.version) ||
    detail.version < 0
  ) {
    throw new HttpError('Access review detail response is invalid', 502);
  }
  return detail;
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

export function AccessReviewWorkItem({
  workItemRef,
  commandsEnabled,
  commandScope,
  preflight,
}: {
  workItemRef: string;
  commandsEnabled: boolean;
  commandScope: string;
  preflight: () => Promise<boolean>;
}) {
  const { t } = useTranslation('work');
  const authority = useProductSurfaceAuthority();
  const operationOwner = useWorkHubOperationOwner();
  return (
    <GovernedRouteAccessGuard
      request={governedRequest(DETAIL_ROUTE_CONTRACT, workItemRef)}
      fallback={(decision) => (
        <GuardFallback decision={decision} onRetry={() => void authority.revalidate()} />
      )}
    >
      {operationOwner ? (
        <AuthorizedAccessReviewWorkItem
          key={JSON.stringify([operationOwner, workItemRef])}
          workItemRef={workItemRef}
          operationOwner={operationOwner}
          commandsEnabled={commandsEnabled}
          commandScope={commandScope}
          preflight={preflight}
        />
      ) : (
        <LoadingState label={t('workPage.accessReview.authorizing')} size="page" />
      )}
    </GovernedRouteAccessGuard>
  );
}

function AuthorizedAccessReviewWorkItem({
  workItemRef,
  operationOwner,
  commandsEnabled,
  commandScope,
  preflight,
}: {
  workItemRef: string;
  operationOwner: string;
  commandsEnabled: boolean;
  commandScope: string;
  preflight: () => Promise<boolean>;
}) {
  const { t } = useTranslation('work');
  const toast = useToast();
  const queryClient = useQueryClient();
  const authority = useProductSurfaceAuthority();
  const theme = useTheme();
  const actionBoundary = useRef<HTMLDivElement>(null);
  useShellAuxiliaryAvoidance({ boundaryRef: actionBoundary });
  const compact = useMediaQuery(theme.breakpoints.down('sm'));
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const [decision, setDecision] = useState<Exclude<AccessReviewWorkDecision, 'PENDING'>>();
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<DecisionPreview | null>(null);
  const [conflict, setConflict] = useState(false);
  const [submissionError, setSubmissionError] = useState(false);
  const mounted = useRef(false);
  const ownerRef = useRef(operationOwner);
  ownerRef.current = operationOwner;
  const activeDecision = useRef<DecisionRun | null>(null);
  const decisionOutcome = useRef<HTMLHeadingElement | null>(null);
  const focusDecisionOutcome = useRef(false);
  const detailQueryKey = ['work', 'access-review-item', operationOwner, workItemRef] as const;
  const detail = useQuery({
    queryKey: detailQueryKey,
    queryFn: async ({ signal }) => {
      const loaded = validateAccessReviewDetail(
        await getAccessReviewWorkDetail(workItemRef, signal),
        workItemRef
      );
      if (ownerRef.current !== operationOwner || signal.aborted) {
        throw new DOMException('Work owner changed', 'AbortError');
      }
      return loaded;
    },
    retry: false,
    staleTime: 0,
    meta: { accessSensitive: true },
  });
  const actionAccess = useGovernedRouteAccessDecision(
    detail.data
      ? governedRequest(DECISION_ROUTE_CONTRACT, workItemRef, String(detail.data.version))
      : null
  );
  const authorityRevision =
    authority.status === 'ready'
      ? `${authority.snapshot?.envelope.activeAccessMode ?? ''}:${authority.snapshot?.envelope.decisionRevision ?? ''}`
      : authority.status;
  const actionAccessRevision =
    actionAccess.state === 'allowed'
      ? `${actionAccess.decisionRevision}:${String(actionAccess.effectiveReadOnly)}`
      : actionAccess.state;
  const accessScope = JSON.stringify([
    operationOwner,
    authorityRevision,
    actionAccessRevision,
    commandsEnabled,
    commandScope,
  ]);
  const accessScopeRef = useRef(accessScope);
  accessScopeRef.current = accessScope;
  const commandsEnabledRef = useRef(commandsEnabled);
  commandsEnabledRef.current = commandsEnabled;
  const isCurrent = (run: DecisionRun) =>
    mounted.current &&
    run.commandsEnabled &&
    commandsEnabledRef.current &&
    ownerRef.current === run.owner &&
    accessScopeRef.current === run.accessScope &&
    activeDecision.current === run &&
    !run.controller.signal.aborted;
  useEffect(() => {
    mounted.current = true;
    activeDecision.current?.controller.abort();
    activeDecision.current = null;
    return () => {
      mounted.current = false;
      activeDecision.current?.controller.abort();
      activeDecision.current = null;
    };
  }, [accessScope]);
  useEffect(() => {
    if (!focusDecisionOutcome.current || detail.data?.decision === 'PENDING') return;
    focusDecisionOutcome.current = false;
    const frame = requestAnimationFrame(() => decisionOutcome.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [detail.data?.decision]);
  const decide = useMutation({
    mutationFn: async (run: DecisionRun) => {
      const { confirmed } = run;
      if (!isCurrent(run)) throw new DOMException('Work owner changed', 'AbortError');
      const latest = validateAccessReviewDetail(
        await getAccessReviewWorkDetail(confirmed.workItemRef, run.controller.signal),
        confirmed.workItemRef
      );
      if (!isCurrent(run)) throw new DOMException('Work owner changed', 'AbortError');
      queryClient.setQueryData(detailQueryKey, latest);
      if (
        !isAccessReviewDecisionSource(latest) ||
        latest.version !== confirmed.version ||
        latest.subjectUserId !== confirmed.assignment.subjectUserId ||
        latest.roleId !== confirmed.assignment.roleId ||
        latest.accessSourceType !== confirmed.assignment.accessSourceType ||
        (latest.sourceKey ?? null) !== (confirmed.assignment.sourceKey ?? null)
      ) {
        throw new HttpError('Access review changed after preview', 409);
      }
      const request = governedRequest(
        DECISION_ROUTE_CONTRACT,
        confirmed.workItemRef,
        String(confirmed.version)
      );
      const evaluation = await authority.evaluateGoverned(request, {
        signal: run.controller.signal,
      });
      if (!isCurrent(run)) throw new DOMException('Work owner changed', 'AbortError');
      const access = mapGovernedRouteEvaluation(
        evaluation,
        request,
        authority.status === 'ready' ? authority.snapshot?.envelope.activeAccessMode : undefined,
        authority.status === 'ready' && authority.snapshot
          ? Date.now() + authority.snapshot.clockOffsetMs
          : undefined
      );
      if (access.state !== 'allowed' || access.effectiveReadOnly) {
        throw new HttpError('Access review decision is unavailable', 403);
      }
      if (!isCurrent(run)) throw new DOMException('Work owner changed', 'AbortError');
      const aggregateAuthorized = await run.preflight();
      if (!isCurrent(run)) throw new DOMException('Work owner changed', 'AbortError');
      if (!aggregateAuthorized) throw new HttpError('Access review changed after preview', 409);
      const updated = await decideAccessReviewWork(
        confirmed.workItemRef,
        {
          decision: confirmed.decision,
          reason: confirmed.reason,
          version: confirmed.version,
        },
        run.controller.signal
      );
      if (!isCurrent(run)) throw new DOMException('Work owner changed', 'AbortError');
      if (
        !isExactAccessReviewDecisionReceipt(updated, latest, {
          decision: confirmed.decision,
          reason: confirmed.reason,
          version: confirmed.version,
        })
      ) {
        throw new HttpError('Access review decision receipt is invalid', 502);
      }
      return updated;
    },
    onSuccess: async (updated, run) => {
      if (!isCurrent(run)) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workspace', 'work-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace', 'work-hub'] }),
      ]);
      if (!isCurrent(run)) return;
      focusDecisionOutcome.current = true;
      queryClient.setQueryData(detailQueryKey, updated);
      setDecision(undefined);
      setPreview(null);
      setConflict(false);
      setSubmissionError(false);
      setReason('');
      toast.success(t('workPage.accessReview.decisionSaved'));
    },
    onError: (error, run) => {
      if (!isCurrent(run)) return;
      const state = classifyAccessReviewWorkError(error);
      if (state === 'stale') {
        setPreview(null);
        setConflict(true);
        setSubmissionError(false);
        toast.error(t('workPage.accessReview.staleDescription'));
        void detail.refetch();
        return;
      }
      setSubmissionError(true);
      toast.error(
        t(
          state === 'not-found'
            ? 'workPage.accessReview.notAvailableDescription'
            : 'workPage.accessReview.decisionError'
        )
      );
    },
    onSettled: (_data, _error, run) => {
      if (activeDecision.current === run) activeDecision.current = null;
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
  const canDecide =
    commandsEnabled &&
    actionAccess.state === 'allowed' &&
    !actionAccess.effectiveReadOnly &&
    record.decision === 'PENDING';
  return (
    <Box ref={actionBoundary}>
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

      <Box
        component="dl"
        sx={{
          m: 0,
          mt: 1.5,
          p: 1.5,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)',
          gap: 1,
          bgcolor: 'action.hover',
          borderRadius: (theme) => `${theme.shape.borderRadius}px`,
          '& dd': { m: 0, overflowWrap: 'anywhere' },
        }}
      >
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workPage.accessReview.subject')}
        </Typography>
        <Box component="dd">
          <Typography variant="body2">{record.subjectDisplayName}</Typography>
          {record.subjectEmail && (
            <Typography variant="caption" color="text.secondary">
              {record.subjectEmail}
            </Typography>
          )}
        </Box>
        <Typography component="dt" variant="caption" color="text.secondary">
          {t('workPage.accessReview.role')}
        </Typography>
        <Box component="dd">
          <Typography variant="body2">
            {record.roleName} · {record.roleCode}
          </Typography>
          {record.privileged && (
            <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
              {t('workHub.accessEvidence.privilegedYes')}
            </Typography>
          )}
        </Box>
      </Box>
      <Accordion
        expanded={!compact || evidenceExpanded}
        onChange={(_, expanded) => setEvidenceExpanded(expanded)}
        disableGutters
        elevation={0}
        sx={{
          mt: 1.25,
          bgcolor: 'transparent',
          '&:before': { display: 'none' },
          '& .MuiAccordionSummary-root': { minHeight: 44, px: 0 },
          '& .MuiAccordionSummary-content': { my: 1 },
        }}
      >
        <AccordionSummary
          expandIcon={<ChevronDown size={18} />}
          aria-controls="access-review-evidence"
          id="access-review-evidence-toggle"
          sx={{ display: { xs: 'flex', sm: 'none' } }}
        >
          <Typography component="span" variant="subtitle2">
            {t('workHub.accessEvidence.contextTitle')}
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))' },
              gap: 1.25,
              '& > div': {
                p: 1.5,
                bgcolor: 'action.hover',
                overflowWrap: 'anywhere',
                borderRadius: (theme) => `${theme.shape.borderRadius}px`,
              },
            }}
          >
            {[
              [
                'grantedAt',
                record.assignmentCreatedAt
                  ? formatDate(record.assignmentCreatedAt, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : t('workHub.accessEvidence.unavailable'),
              ],
              [
                'lastSignIn',
                record.subjectLastSignInAt
                  ? formatDate(record.subjectLastSignInAt, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : t('workHub.accessEvidence.noSignIn'),
              ],
              [
                'privileged',
                t(
                  record.privileged
                    ? 'workHub.accessEvidence.privilegedYes'
                    : 'workHub.accessEvidence.privilegedNo'
                ),
              ],
            ].map(([label, value]) => (
              <Box key={label}>
                <Typography variant="caption" color="text.secondary">
                  {t(`workHub.accessEvidence.${label}`)}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.25 }}>
                  {value}
                </Typography>
                {label === 'lastSignIn' && (
                  <Typography variant="caption" color="text.secondary">
                    {t('workHub.accessEvidence.signInMeaning')}
                  </Typography>
                )}
              </Box>
            ))}
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('workPage.accessReview.source')}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.25 }}>
                {t(`workPage.accessReview.sourceTypes.${record.accessSourceType}`)}
                {record.sourceDisplayName ? ` · ${record.sourceDisplayName}` : ''}
              </Typography>
            </Box>
          </Box>
          <InlineFeedback
            sx={{ mt: 1.25 }}
            severity={record.recommendation === 'REVIEW' ? 'warning' : 'info'}
          >
            <Typography variant="subtitle2">
              {t(`workPage.accessReview.recommendations.${record.recommendation}`)}
            </Typography>
            <Typography variant="body2">
              {t(`workPage.accessReview.reasons.${record.recommendationReason}`)}
            </Typography>
          </InlineFeedback>
        </AccordionDetails>
      </Accordion>
      <InlineFeedback severity="info" sx={{ mt: 1.25, py: 0.5 }}>
        <Box component="span" sx={{ display: { xs: 'block', sm: 'none' } }}>
          {t('workHub.accessEvidence.sourceEffect')}
        </Box>
        <Box component="span" sx={{ display: { xs: 'none', sm: 'block' } }}>
          {t('workHub.accessEvidence.remediationNotice')}
        </Box>
      </InlineFeedback>

      <Divider sx={{ my: { xs: 1.5, sm: 2.5 } }} />
      {actionAccess.state !== 'allowed' && record.decision === 'PENDING' && (
        <InlineFeedback
          severity={actionAccess.state === 'loading' ? 'info' : 'warning'}
          sx={{ mb: 2 }}
        >
          {t(
            actionAccess.state === 'loading'
              ? 'workPage.accessReview.authorizingDecision'
              : 'workPage.accessReview.decisionUnavailable'
          )}
        </InlineFeedback>
      )}
      {record.decision === 'PENDING' ? (
        <>
          <Typography component="h4" variant="subtitle1" sx={{ mb: 1 }}>
            {t('workHub.accessEvidence.decisionSection')}
          </Typography>
          <Stack
            data-shell-auxiliary-avoidance="inline-end"
            direction="row"
            gap={1}
            role="group"
            aria-label={t('workHub.accessEvidence.chooseDecision')}
          >
            <ActionButton
              intent={decision === 'APPROVE' ? 'primary' : 'secondary'}
              startIcon={<Check size={16} />}
              disabled={!canDecide || decide.isPending}
              onClick={() => setDecision('APPROVE')}
              aria-pressed={decision === 'APPROVE'}
              sx={{ flex: 1, minWidth: 0, minHeight: 48 }}
            >
              {t('workPage.accessReview.keep')}
            </ActionButton>
            <ActionButton
              intent={decision === 'REVOKE' ? 'danger' : 'secondary'}
              startIcon={<X size={16} />}
              disabled={!canDecide || decide.isPending}
              onClick={() => setDecision('REVOKE')}
              aria-pressed={decision === 'REVOKE'}
              sx={{ flex: 1, minWidth: 0, minHeight: 48 }}
            >
              {t('workPage.accessReview.revoke')}
            </ActionButton>
          </Stack>
          <FormField
            multiline
            minRows={3}
            label={t('workPage.accessReview.decisionReason')}
            supportingText={t('workHub.accessEvidence.reasonHelp', { count: reason.length })}
            value={reason}
            inputProps={{ maxLength: 1000 }}
            onChange={(event) => setReason(event.target.value)}
            required
            disabled={!canDecide || decide.isPending}
            sx={{ mt: 1.5, '& textarea': { scrollMarginBottom: '160px' } }}
          />
          {conflict && (
            <InlineFeedback severity="warning" sx={{ mt: 1.5 }}>
              {t('workPage.accessReview.staleDescription')}{' '}
              {t('workHub.accessEvidence.draftPreserved')}
            </InlineFeedback>
          )}
          <Box
            data-shell-auxiliary-avoidance="inline-end"
            sx={{
              position: 'sticky',
              bottom: { xs: 'calc(72px + env(safe-area-inset-bottom, 0px))', md: 12 },
              mt: 2,
              p: 1.25,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: (theme) => `${theme.shape.borderRadius}px`,
              zIndex: 1,
            }}
          >
            <ActionButton
              fullWidth
              intent={decision === 'REVOKE' ? 'danger' : 'primary'}
              disabled={
                !decision ||
                reason.trim().length < 10 ||
                reason.length > 1000 ||
                !canDecide ||
                decide.isPending ||
                detail.isFetching
              }
              onClick={() =>
                decision &&
                setPreview({
                  workItemRef,
                  version: record.version,
                  decision,
                  reason: reason.trim(),
                  subjectDisplayName: record.subjectDisplayName,
                  roleName: record.roleName,
                  assignment: {
                    workItemRef,
                    subjectUserId: record.subjectUserId,
                    roleId: record.roleId,
                    accessSourceType: record.accessSourceType,
                    sourceKey: record.sourceKey,
                    decision: record.decision,
                    version: record.version,
                  },
                })
              }
            >
              {t('workHub.accessEvidence.preview')}
            </ActionButton>
          </Box>
        </>
      ) : (
        <InlineFeedback
          severity={record.remediationState === 'MANUAL_REQUIRED' ? 'warning' : 'success'}
        >
          <Typography
            ref={decisionOutcome}
            component="h4"
            variant="subtitle2"
            tabIndex={-1}
            sx={{
              '&:focus-visible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: 2,
                borderRadius: (theme) => `${theme.shape.borderRadius}px`,
              },
            }}
          >
            {t('workPage.accessReview.decisionSaved')}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
            {record.decisionReason}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
            {record.decidedAt
              ? formatDate(record.decidedAt, { dateStyle: 'medium', timeStyle: 'short' })
              : ''}{' '}
            · {t(`workHub.accessEvidence.remediation.${record.remediationState}`)}
          </Typography>
        </InlineFeedback>
      )}

      <FormDialog
        open={Boolean(preview)}
        title={t(
          preview?.decision === 'REVOKE'
            ? 'workPage.accessReview.revokeTitle'
            : 'workPage.accessReview.keepTitle'
        )}
        description={t('workPage.accessReview.decisionDescription')}
        cancelLabel={t('workPage.accessReview.cancel')}
        submitLabel={t(
          preview?.decision === 'REVOKE'
            ? 'workPage.accessReview.revoke'
            : 'workPage.accessReview.keep'
        )}
        submitIntent={preview?.decision === 'REVOKE' ? 'danger' : 'primary'}
        busy={decide.isPending}
        submitDisabled={
          !preview || preview.version !== record.version || detail.isFetching || !canDecide
        }
        onClose={() => {
          setPreview(null);
          setSubmissionError(false);
        }}
        onSubmit={() => {
          if (!preview || !canDecide || activeDecision.current || !mounted.current) return;
          setSubmissionError(false);
          const run: DecisionRun = {
            confirmed: preview,
            owner: operationOwner,
            accessScope,
            commandsEnabled: true,
            preflight,
            controller: new AbortController(),
          };
          activeDecision.current = run;
          decide.mutate(run);
        }}
      >
        <Stack gap={1.5}>
          {submissionError && (
            <InlineFeedback severity="error">
              {t('workPage.accessReview.decisionError')}
            </InlineFeedback>
          )}
          {preview && preview.version !== record.version && (
            <InlineFeedback severity="warning">
              {t('workPage.accessReview.staleDescription')}
            </InlineFeedback>
          )}
          <Typography variant="subtitle2">
            {preview?.subjectDisplayName} · {preview?.roleName}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              whiteSpace: 'pre-wrap',
              p: 2,
              bgcolor: 'action.hover',
              borderRadius: (theme) => `${theme.shape.borderRadius}px`,
            }}
          >
            {preview?.reason}
          </Typography>
          <InlineFeedback severity={decision === 'REVOKE' ? 'warning' : 'info'}>
            {t('workHub.accessEvidence.remediationNotice')}
          </InlineFeedback>
        </Stack>
      </FormDialog>
    </Box>
  );
}
