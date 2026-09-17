import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, KeyRound, RotateCcw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  createWorkplaceIdempotencyKey,
  getProductSurfaceStepUpContinuation,
  getWorkplaceServiceInspection,
  issueProductSurfaceStepUpChallenge,
  issueWorkplaceServiceAccessCredential,
  recordWorkplaceServiceInspectionAttempt,
  revokeWorkplaceServiceAccessCredential,
} from '@dwp-frontend/shared-utils';
import { ActionButton, FormField, InlineFeedback, SelectField } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useOptionalAllowedProductSurface } from '../../components/allowed-product-surface-context';
import { workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { requireWorkplaceServiceWrite } from './workplace-services-ui-model';

import type {
  WorkplaceServiceAccessCredentialGrant,
  WorkplaceServiceInspection,
  WorkplaceServiceOrder,
  WorkplaceServiceOrderLine,
} from '@dwp-frontend/shared-utils';

function credentialCommandPath(orderId: string, lineId: string) {
  return `/api/platform/v1/workplace/service-orders/${encodeURIComponent(
    orderId
  )}/lines/${encodeURIComponent(lineId)}/access-credentials:issue`;
}

export function WorkplaceServiceCredentialReveal({
  order,
  line,
  canWrite,
}: {
  order: WorkplaceServiceOrder;
  line: WorkplaceServiceOrderLine;
  canWrite: boolean;
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const authority = useOptionalAllowedProductSurface();
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [grant, setGrant] = useState<WorkplaceServiceAccessCredentialGrant | null>(null);
  const [continuationUrl, setContinuationUrl] = useState<string | null>(null);
  const grantRef = useRef<WorkplaceServiceAccessCredentialGrant | null>(null);
  grantRef.current = grant;
  const revoke = useCallback(
    async (candidate: WorkplaceServiceAccessCredentialGrant | null) => {
      if (!candidate) return;
      setGrant(null);
      try {
        await revokeWorkplaceServiceAccessCredential(
          order.serviceOrderId,
          line.serviceOrderLineId,
          candidate.grantId,
          {
            expectedOrderVersion: order.version,
            reason: t('workplace.services.extensions.pinDismissReason'),
            explicitConfirmation: true,
          },
          {
            idempotencyKey: createWorkplaceIdempotencyKey('service-pin-revoke'),
            activeAccessMode: 'ELEVATED',
          }
        );
      } catch {
        // The credential is still removed from browser memory. Server TTL remains the backstop.
      }
    },
    [line.serviceOrderLineId, order.serviceOrderId, order.version, t]
  );
  useEffect(() => {
    if (!grant) return undefined;
    const remaining = Math.max(0, Date.parse(grant.expiresAt) - Date.now());
    const timeout = window.setTimeout(() => void revoke(grant), remaining);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void revoke(grantRef.current);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [grant, revoke]);
  useEffect(
    () => () => {
      const candidate = grantRef.current;
      if (candidate) void revoke(candidate);
    },
    [revoke]
  );

  const mutation = useMutation({
    mutationFn: async () => {
      requireWorkplaceServiceWrite(
        canWrite &&
          Boolean(authority) &&
          !authority?.effectiveReadOnly &&
          Boolean(reason.trim()) &&
          confirmed
      );
      const idempotencyKey = createWorkplaceIdempotencyKey('service-pin-issue');
      const commandPath = credentialCommandPath(order.serviceOrderId, line.serviceOrderLineId);
      const challengeInput = {
        commandMethod: 'POST' as const,
        commandPath,
        targetType: 'WORKPLACE_SERVICE_ORDER_LINE',
        targetId: line.serviceOrderLineId,
        expectedObjectVersion: order.version,
        idempotencyKey,
        payload: {
          reason: reason.trim(),
          explicitConfirmation: true,
          expectedOrderVersion: order.version,
        },
        contextKey: authority!.context.contextKey,
        contextScopeKey: authority!.scope.key,
        returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}`,
      };
      try {
        const challenge = await issueProductSurfaceStepUpChallenge(
          challengeInput,
          authority!.decisionRevision
        );
        const issued = await issueWorkplaceServiceAccessCredential(
          order.serviceOrderId,
          line.serviceOrderLineId,
          {
            stepUpReceipt: challenge.challenge,
            reason: reason.trim(),
            explicitConfirmation: true,
            expectedOrderVersion: order.version,
          },
          { idempotencyKey, activeAccessMode: 'ELEVATED' }
        );
        setGrant(issued);
      } catch (error) {
        const continuation = getProductSurfaceStepUpContinuation(error);
        if (continuation?.continuation.type === 'OIDC') {
          setContinuationUrl(continuation.continuation.authorizationUrl);
        }
        throw error;
      }
    },
    retry: false,
    onSuccess: () => {
      setContinuationUrl(null);
      setConfirmed(false);
      setReason('');
    },
  });

  if (line.category !== 'AV') return null;
  return (
    <Box sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25, mt: 1 })}>
      <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
        <Stack direction="row" gap={0.75} alignItems="center">
          <KeyRound size={17} aria-hidden="true" />
          <Typography component="h4" variant="subtitle2" fontWeight="fontWeightBold">
            {t('workplace.services.extensions.pinTitle')}
          </Typography>
        </Stack>
        <Chip
          size="small"
          variant="outlined"
          label={t('workplace.services.extensions.memoryOnly')}
        />
      </Stack>
      <Typography variant="body2" color="text.secondary" mt={0.75}>
        {t('workplace.services.extensions.pinDescription')}
      </Typography>
      {grant ? (
        <Stack spacing={1} mt={1} role="status" aria-live="polite">
          {grant.oneTimeCredential ? (
            <Typography
              component="code"
              variant="h6"
              sx={{ letterSpacing: '0.16em', overflowWrap: 'anywhere' }}
            >
              {grant.oneTimeCredential}
            </Typography>
          ) : (
            <InlineFeedback severity="warning">
              {t('workplace.services.extensions.pinReplayUnavailable')}
            </InlineFeedback>
          )}
          <Typography variant="caption" color="text.secondary">
            {t('workplace.services.extensions.pinExpires', {
              time: formatDate(grant.expiresAt, { timeStyle: 'medium' }, locale),
            })}
          </Typography>
          <ActionButton intent="quiet" size="small" onClick={() => void revoke(grant)}>
            {t('workplace.services.extensions.hideAndRevoke')}
          </ActionButton>
        </Stack>
      ) : (
        <Stack spacing={1} mt={1}>
          <FormField
            label={t('workplace.services.extensions.pinReason')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            inputProps={{ maxLength: 500 }}
            disabled={!canWrite || mutation.isPending}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                disabled={!canWrite || mutation.isPending}
              />
            }
            label={t('workplace.services.extensions.pinConfirmation')}
          />
          {!authority || authority.effectiveReadOnly ? (
            <InlineFeedback severity="warning">
              {t('workplace.services.extensions.reauthenticationUnavailable')}
            </InlineFeedback>
          ) : null}
          {mutation.isError ? (
            <InlineFeedback severity="warning">
              {continuationUrl
                ? t('workplace.services.extensions.reauthenticationContinue')
                : t('workplace.services.extensions.pinError')}
            </InlineFeedback>
          ) : null}
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            {continuationUrl ? (
              <ActionButton
                component="a"
                href={continuationUrl}
                target="workplace-service-step-up"
                rel="opener"
                intent="secondary"
                startIcon={<ShieldCheck size={16} />}
              >
                {t('workplace.services.extensions.reauthenticate')}
              </ActionButton>
            ) : null}
            <ActionButton
              intent="primary"
              loading={mutation.isPending}
              disabled={
                !canWrite ||
                !authority ||
                authority.effectiveReadOnly ||
                !reason.trim() ||
                !confirmed
              }
              onClick={() => mutation.mutate()}
            >
              {t('workplace.services.extensions.revealPin')}
            </ActionButton>
          </Stack>
        </Stack>
      )}
    </Box>
  );
}

function schemaText(field: Readonly<Record<string, unknown>>, key: string) {
  return typeof field[key] === 'string' ? field[key] : '';
}

function initialChecklist(
  inspection: WorkplaceServiceInspection | undefined,
  schema: readonly Readonly<Record<string, unknown>>[]
) {
  if (inspection?.latestAttempt) return { ...inspection.latestAttempt.checklistResponses };
  return Object.fromEntries(
    schema.map((field) => [schemaText(field, 'key'), field.defaultValue ?? null])
  );
}

function checklistValid(
  schema: readonly Readonly<Record<string, unknown>>[],
  responses: Readonly<Record<string, unknown>>
) {
  return schema.every((field) => {
    const key = schemaText(field, 'key');
    const type = schemaText(field, 'type');
    const value = responses[key];
    if (value === null || value === undefined || value === '') return field.required !== true;
    if (type === 'BOOLEAN') return typeof value === 'boolean';
    if (type === 'NUMBER') return typeof value === 'number' && Number.isFinite(value);
    if (type === 'TEXT') return typeof value === 'string' && value.length <= 1000;
    if (type === 'SINGLE_SELECT') {
      return (
        typeof value === 'string' && Array.isArray(field.values) && field.values.includes(value)
      );
    }
    if (type === 'MULTI_SELECT') {
      const values = Array.isArray(field.values) ? field.values : [];
      return (
        Array.isArray(value) &&
        value.every((item) => typeof item === 'string' && values.includes(item))
      );
    }
    return false;
  });
}

export function WorkplaceServiceInspectionPanel({
  order,
  line,
  canWrite,
  administrator = false,
  elevated = false,
}: {
  order: WorkplaceServiceOrder;
  line: WorkplaceServiceOrderLine;
  canWrite: boolean;
  administrator?: boolean;
  elevated?: boolean;
}) {
  const { t, i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const queryClient = useQueryClient();
  const task = order.tasks.find(
    (candidate) => candidate.serviceOrderLineId === line.serviceOrderLineId
  );
  const roleMatches = administrator
    ? line.inspectionMode === 'OPERATOR'
    : line.inspectionMode === 'REQUESTER';
  const enabled = line.inspectionMode !== 'NONE' && Boolean(task);
  const queryKey = [
    'workplace',
    'services',
    'inspection',
    administrator ? 'admin' : 'requester',
    order.serviceOrderId,
    line.serviceOrderLineId,
  ];
  const query = useQuery({
    queryKey,
    queryFn: () =>
      getWorkplaceServiceInspection(order.serviceOrderId, line.serviceOrderLineId, administrator),
    enabled,
    retry: false,
  });
  const [decision, setDecision] = useState<'PASSED' | 'FAILED'>('PASSED');
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  useEffect(
    () => setResponses(initialChecklist(query.data, line.inspectionChecklistSchema)),
    [line.inspectionChecklistSchema, query.data]
  );
  const isChecklistValid = useMemo(
    () => checklistValid(line.inspectionChecklistSchema, responses),
    [line.inspectionChecklistSchema, responses]
  );
  const writable = canWrite && (!administrator || elevated);
  const mutation = useMutation({
    mutationFn: () => {
      requireWorkplaceServiceWrite(
        writable &&
          Boolean(query.data?.fulfilledQuantityReady) &&
          roleMatches &&
          isChecklistValid &&
          confirmed &&
          Boolean(reason.trim())
      );
      return recordWorkplaceServiceInspectionAttempt(
        order.serviceOrderId,
        line.serviceOrderLineId,
        {
          decision,
          checklistResponses: responses,
          attachmentIds: query.data!.latestAttempt?.evidenceAttachmentIds ?? [],
          reason: reason.trim(),
          expectedOrderVersion: order.version,
          expectedTaskVersion: task!.version,
          explicitConfirmation: true,
        },
        {
          idempotencyKey: createWorkplaceIdempotencyKey('service-inspection'),
          ...(administrator ? { activeAccessMode: 'ELEVATED' as const } : {}),
        },
        administrator
      );
    },
    retry: false,
    onSuccess: (result) => {
      queryClient.setQueryData(queryKey, result.inspection);
      setConfirmed(false);
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['workplace', 'services', 'orders'] });
    },
  });

  if (!enabled) return null;
  return (
    <Box
      data-testid="workplace-service-inspection-panel"
      sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25, mt: 1 })}
    >
      <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
        <Typography component="h4" variant="subtitle2" fontWeight="fontWeightBold">
          {t('workplace.services.extensions.inspectionTitle')}
        </Typography>
        {query.data ? (
          <Chip
            size="small"
            variant="outlined"
            color={
              query.data.accepted ? 'success' : query.data.remediationRequired ? 'error' : 'default'
            }
            label={t(
              `workplace.services.extensions.inspectionStates.${
                query.data.accepted
                  ? 'PASSED'
                  : query.data.remediationRequired
                    ? 'REMEDIATION_REQUIRED'
                    : query.data.latestAttempt?.decision === 'FAILED'
                      ? 'FAILED'
                      : 'NOT_STARTED'
              }`
            )}
          />
        ) : null}
      </Stack>
      {query.isLoading ? (
        <Typography variant="body2" color="text.secondary" mt={1}>
          {t('workplace.services.loading')}
        </Typography>
      ) : query.isError || !query.data ? (
        <InlineFeedback
          severity="warning"
          action={
            <ActionButton intent="quiet" size="small" onClick={() => void query.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('workplace.services.extensions.inspectionUnavailable')}
        </InlineFeedback>
      ) : (
        <Stack spacing={1} mt={1}>
          {query.data.remediationRequired ? (
            <InlineFeedback severity="error" icon={<TriangleAlert size={17} />}>
              {t('workplace.services.extensions.remediationRequired')}
            </InlineFeedback>
          ) : null}
          {query.data.latestAttempt ? (
            <Typography variant="caption" color="text.secondary">
              {t('workplace.services.extensions.lastInspected', {
                time: formatDate(
                  query.data.latestAttempt.createdAt,
                  { dateStyle: 'medium', timeStyle: 'short' },
                  locale
                ),
                name: t(
                  `workplace.services.extensions.inspectionActors.${query.data.latestAttempt.actorRole}`
                ),
              })}
            </Typography>
          ) : null}
          {!roleMatches ? (
            <InlineFeedback severity="info">
              {t('workplace.services.extensions.inspectionOwnedByOtherRole')}
            </InlineFeedback>
          ) : null}
          {!query.data.fulfilledQuantityReady ? (
            <InlineFeedback severity="warning">
              {t('workplace.services.extensions.inspectionAwaitingFulfillment')}
            </InlineFeedback>
          ) : null}
          {line.inspectionChecklistSchema.map((field) => {
            const key = schemaText(field, 'key');
            const type = schemaText(field, 'type');
            const label = schemaText(field, locale === 'ko' ? 'labelKo' : 'labelEn') || key;
            const disabled =
              !writable || mutation.isPending || !query.data.fulfilledQuantityReady || !roleMatches;
            if (type === 'BOOLEAN') {
              return (
                <FormControlLabel
                  key={key}
                  control={
                    <Checkbox
                      checked={responses[key] === true}
                      onChange={(event) =>
                        setResponses((current) => ({ ...current, [key]: event.target.checked }))
                      }
                      disabled={disabled}
                    />
                  }
                  label={label}
                />
              );
            }
            if (type === 'SINGLE_SELECT') {
              const values = Array.isArray(field.values)
                ? field.values.filter((value): value is string => typeof value === 'string')
                : [];
              return (
                <SelectField
                  key={key}
                  label={label}
                  value={typeof responses[key] === 'string' ? String(responses[key]) : ''}
                  options={values.map((value) => ({ value, label: value }))}
                  onValueChange={(value) =>
                    setResponses((current) => ({ ...current, [key]: value ?? null }))
                  }
                  disabled={disabled}
                />
              );
            }
            return (
              <FormField
                key={key}
                label={label}
                type={type === 'NUMBER' ? 'number' : 'text'}
                value={
                  type === 'MULTI_SELECT' && Array.isArray(responses[key])
                    ? (responses[key] as string[]).join(', ')
                    : typeof responses[key] === 'string' || typeof responses[key] === 'number'
                      ? String(responses[key])
                      : ''
                }
                inputProps={{ maxLength: type === 'TEXT' ? 1000 : undefined }}
                onChange={(event) => {
                  const value = event.target.value;
                  setResponses((current) => ({
                    ...current,
                    [key]:
                      type === 'NUMBER'
                        ? value === ''
                          ? null
                          : Number(value)
                        : type === 'MULTI_SELECT'
                          ? value
                              .split(',')
                              .map((item) => item.trim())
                              .filter(Boolean)
                          : value,
                  }));
                }}
                disabled={disabled}
              />
            );
          })}
          <SelectField
            label={t('workplace.services.extensions.inspectionDecision')}
            value={decision}
            options={[
              { value: 'PASSED', label: t('workplace.services.extensions.inspectionPassed') },
              { value: 'FAILED', label: t('workplace.services.extensions.inspectionFailed') },
            ]}
            onValueChange={(value) => {
              if (value === 'PASSED' || value === 'FAILED') setDecision(value);
            }}
            disabled={
              !writable || mutation.isPending || !query.data.fulfilledQuantityReady || !roleMatches
            }
          />
          <FormField
            label={
              decision === 'PASSED'
                ? t('workplace.services.extensions.acceptanceReason')
                : t('workplace.services.extensions.remediationReason')
            }
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            inputProps={{ maxLength: 500 }}
            disabled={
              !writable || mutation.isPending || !query.data.fulfilledQuantityReady || !roleMatches
            }
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                disabled={
                  !writable ||
                  mutation.isPending ||
                  !query.data.fulfilledQuantityReady ||
                  !roleMatches
                }
              />
            }
            label={t('workplace.services.extensions.inspectionConfirmation')}
          />
          {administrator && canWrite && !elevated ? (
            <InlineFeedback severity="warning" icon={<ShieldCheck size={17} />}>
              {t('workplace.services.stepUpRequired')}
            </InlineFeedback>
          ) : null}
          {mutation.isError ? (
            <InlineFeedback severity="error">{t('workplace.services.commandError')}</InlineFeedback>
          ) : null}
          <ActionButton
            intent={decision === 'PASSED' ? 'primary' : 'danger'}
            startIcon={decision === 'PASSED' ? <CheckCircle2 size={16} /> : <RotateCcw size={16} />}
            loading={mutation.isPending}
            disabled={
              !writable ||
              !query.data.fulfilledQuantityReady ||
              !roleMatches ||
              !isChecklistValid ||
              !confirmed ||
              !reason.trim()
            }
            onClick={() => mutation.mutate()}
          >
            {decision === 'PASSED'
              ? t('workplace.services.extensions.acceptService')
              : t('workplace.services.extensions.requestRemediation')}
          </ActionButton>
        </Stack>
      )}
    </Box>
  );
}
