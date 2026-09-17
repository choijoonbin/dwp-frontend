import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Save, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  createWorkplaceIdempotencyKey,
  resolveIdempotentMutationIntent,
  useProductSurfaceAuthority,
} from '@dwp-frontend/shared-utils';
import {
  getWorkplaceAssistantAuditEvents,
  getWorkplaceAssistantGovernance,
  updateWorkplaceAssistantGovernance,
} from '@dwp-frontend/shared-utils/api/workplace-assistant-api';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  EmptyState,
  FormField,
  InlineFeedback,
  LoadingState,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { RoomsPageHeading } from './rooms-ui';
import { useRoomsCapabilities } from './rooms-capabilities';
import { useWorkplaceAssistantCopy } from './workplace-assistant-copy';
import { useWorkplaceAssistantOnlineState } from './workplace-assistant-online';
import {
  workplaceAssistantCanManageGovernance,
  workplaceAssistantGovernanceAvailability,
} from './workplace-assistant-ui-model';
import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';

import type { IdempotentMutationIntent } from '@dwp-frontend/shared-utils';
import type {
  WorkplaceAssistantCommandReceipt,
  WorkplaceAssistantGovernanceInput,
} from '@dwp-frontend/shared-utils/api/workplace-assistant-contract';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type GovernanceDraft = Omit<WorkplaceAssistantGovernanceInput, 'expectedVersion' | 'reason'> & {
  reason: string;
};

export function WorkplaceAssistantAdmin() {
  const copy = useWorkplaceAssistantCopy();
  const { i18n } = useTranslation('rooms');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const capabilities = useRoomsCapabilities();
  const authority = useProductSurfaceAuthority();
  const online = useWorkplaceAssistantOnlineState();
  const queryClient = useQueryClient();
  const intentRef = useRef<IdempotentMutationIntent | null>(null);
  const [lastReceipt, setLastReceipt] = useState<WorkplaceAssistantCommandReceipt | null>(null);
  const [requestFilterDraft, setRequestFilterDraft] = useState('');
  const [requestFilter, setRequestFilter] = useState('');
  const [auditLimit, setAuditLimit] = useState('100');
  const [draft, setDraft] = useState<GovernanceDraft | null>(null);
  const elevated = authority.snapshot?.envelope.activeAccessMode === 'ELEVATED';
  const governanceQuery = useQuery({
    queryKey: ['workplace', 'assistant', 'admin', 'governance'],
    queryFn: getWorkplaceAssistantGovernance,
    enabled: capabilities.isLoaded && capabilities.canViewWorkplaceAdmin,
    retry: false,
  });
  const filterValid = !requestFilter || UUID.test(requestFilter);
  const limitValid =
    Number.isInteger(Number(auditLimit)) && Number(auditLimit) >= 1 && Number(auditLimit) <= 500;
  const auditQuery = useQuery({
    queryKey: ['workplace', 'assistant', 'admin', 'audit', requestFilter, auditLimit],
    queryFn: () =>
      getWorkplaceAssistantAuditEvents({
        requestId: requestFilter || undefined,
        limit: Number(auditLimit),
      }),
    enabled:
      capabilities.isLoaded && capabilities.canViewWorkplaceAdmin && filterValid && limitValid,
    retry: false,
  });
  useEffect(() => {
    const value = governanceQuery.data;
    if (!value) return;
    setDraft({
      tenantOptIn: value.tenantOptIn,
      killSwitch: value.killSwitch,
      modelProviderReference: value.modelProviderReference ?? '',
      modelVersion: value.modelVersion ?? '',
      promptVersion: value.promptVersion ?? '',
      toolVersion: value.toolVersion ?? '',
      retentionDays: value.retentionDays,
      feedbackUseEnabled: value.feedbackUseEnabled,
      redactionState: value.redactionState,
      explicitConfirmation: false,
      reason: '',
    });
  }, [governanceQuery.data]);
  const canManage = workplaceAssistantCanManageGovernance({
    permission: capabilities.canManageWorkplaceAdmin,
    elevated,
    online,
    receipt: lastReceipt,
  });
  const updateMutation = useMutation({
    mutationFn: (input: WorkplaceAssistantGovernanceInput) => {
      if (!canManage) throw new Error('ASSISTANT_GOVERNANCE_BLOCKED');
      const intent = resolveIdempotentMutationIntent(intentRef.current, input, () =>
        createWorkplaceIdempotencyKey('assistant-governance')
      );
      intentRef.current = intent;
      return updateWorkplaceAssistantGovernance(input, {
        idempotencyKey: intent.key,
        correlationId: crypto.randomUUID(),
        activeAccessMode: 'ELEVATED',
      });
    },
    onSuccess: (result) => {
      intentRef.current = null;
      setLastReceipt(result.receipt);
      queryClient.setQueryData(
        ['workplace', 'assistant', 'admin', 'governance'],
        result.governance
      );
      void auditQuery.refetch();
    },
  });
  const submit = () => {
    if (!draft || !governanceQuery.data || !draft.reason.trim()) return;
    const enabledEvidenceValid =
      !draft.tenantOptIn ||
      draft.killSwitch ||
      (draft.redactionState === 'READY' &&
        [
          draft.modelProviderReference,
          draft.modelVersion,
          draft.promptVersion,
          draft.toolVersion,
        ].every((value) => Boolean(value.trim())));
    if (!enabledEvidenceValid || !draft.explicitConfirmation) return;
    updateMutation.mutate({
      ...draft,
      expectedVersion: governanceQuery.data.version,
      reason: draft.reason.trim(),
    });
  };
  const recheck = async () => {
    await governanceQuery.refetch();
    setLastReceipt(null);
  };
  const availability = governanceQuery.data
    ? workplaceAssistantGovernanceAvailability(governanceQuery.data)
    : null;
  const availabilityLabel =
    availability === 'AVAILABLE'
      ? copy.available
      : availability === 'PAUSED'
        ? copy.paused
        : copy.blocked;
  const availabilityColor =
    availability === 'AVAILABLE' ? 'success' : availability === 'PAUSED' ? 'warning' : 'error';
  const receiptEvidence = lastReceipt
    ? [
        copy.text(copy.receipt, { state: lastReceipt.state, id: lastReceipt.commandId }),
        lastReceipt.resultCode
          ? copy.text(copy.receiptResult, {
              code: lastReceipt.resultCode,
              date: lastReceipt.completedAt
                ? formatDate(
                    lastReceipt.completedAt,
                    {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    },
                    locale
                  )
                : copy.unknown,
            })
          : null,
        lastReceipt.replayed ? copy.receiptReplayed : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  if (!capabilities.isLoaded || governanceQuery.isLoading)
    return <LoadingState label={copy.loading} />;

  return (
    <PageCanvas topInset="compact" data-testid="workplace-assistant-admin">
      <RoomsPageHeading
        eyebrow={copy.adminEyebrow}
        title={copy.adminTitle}
        description={copy.adminDescription}
      />
      <Stack spacing={2}>
        {!online && <InlineFeedback severity="warning">{copy.offline}</InlineFeedback>}
        {!capabilities.canManageWorkplaceAdmin && lastReceipt?.state !== 'RESULT_UNKNOWN' && (
          <InlineFeedback severity="warning">{copy.managePermissionRequired}</InlineFeedback>
        )}
        {capabilities.canManageWorkplaceAdmin &&
          !elevated &&
          lastReceipt?.state !== 'RESULT_UNKNOWN' && (
            <InlineFeedback severity="warning">{copy.elevationRequired}</InlineFeedback>
          )}
        {lastReceipt?.state === 'RESULT_UNKNOWN' && (
          <InlineFeedback severity="warning" icon={<ShieldAlert size={18} />}>
            {copy.unknownGovernance}
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<RefreshCw size={15} />}
              disabled={!online}
              onClick={() => void recheck()}
            >
              {copy.refreshGovernance}
            </ActionButton>
          </InlineFeedback>
        )}
        {(governanceQuery.isError || auditQuery.isError) && (
          <InlineFeedback severity="error">{copy.loadError}</InlineFeedback>
        )}
        {updateMutation.isError && (
          <InlineFeedback severity="error">{copy.commandError}</InlineFeedback>
        )}

        {governanceQuery.data && draft && (
          <Box sx={(theme) => ({ ...workplaceMemberCard(theme), p: { xs: 1.5, md: 2 } })}>
            <Stack spacing={1.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
                <Box>
                  <Typography component="h2" variant="h6" fontWeight="fontWeightBold">
                    {copy.governanceEvidence}
                  </Typography>
                  {governanceQuery.data.updatedAt && (
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(
                        governanceQuery.data.updatedAt,
                        {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        },
                        locale
                      )}
                    </Typography>
                  )}
                </Box>
                <Chip
                  color={availabilityColor}
                  label={`${copy.governanceStatus}: ${availabilityLabel}`}
                />
              </Stack>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                  gap: 1.5,
                }}
              >
                <FormField
                  label={copy.providerReference}
                  value={draft.modelProviderReference}
                  disabled={!canManage}
                  inputProps={{ maxLength: 160 }}
                  onChange={(event) =>
                    setDraft(
                      (value) => value && { ...value, modelProviderReference: event.target.value }
                    )
                  }
                />
                <FormField
                  label={copy.modelVersion}
                  value={draft.modelVersion}
                  disabled={!canManage}
                  inputProps={{ maxLength: 120 }}
                  onChange={(event) =>
                    setDraft((value) => value && { ...value, modelVersion: event.target.value })
                  }
                />
                <FormField
                  label={copy.promptVersion}
                  value={draft.promptVersion}
                  disabled={!canManage}
                  inputProps={{ maxLength: 120 }}
                  onChange={(event) =>
                    setDraft((value) => value && { ...value, promptVersion: event.target.value })
                  }
                />
                <FormField
                  label={copy.toolVersion}
                  value={draft.toolVersion}
                  disabled={!canManage}
                  inputProps={{ maxLength: 120 }}
                  onChange={(event) =>
                    setDraft((value) => value && { ...value, toolVersion: event.target.value })
                  }
                />
                <FormField
                  type="number"
                  label={copy.retentionDays}
                  value={draft.retentionDays}
                  disabled={!canManage}
                  inputProps={{ min: 1, max: 365 }}
                  onChange={(event) =>
                    setDraft(
                      (value) => value && { ...value, retentionDays: Number(event.target.value) }
                    )
                  }
                />
                <SelectField
                  label={copy.redactionState}
                  value={draft.redactionState}
                  disabled={!canManage}
                  options={[
                    { value: 'READY', label: 'READY' },
                    { value: 'BLOCKED', label: 'BLOCKED' },
                  ]}
                  onValueChange={(value) =>
                    value && setDraft((current) => current && { ...current, redactionState: value })
                  }
                />
              </Box>
              <Box sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25 })}>
                <Stack>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={draft.tenantOptIn}
                        disabled={!canManage}
                        onChange={(event) =>
                          setDraft(
                            (value) => value && { ...value, tenantOptIn: event.target.checked }
                          )
                        }
                      />
                    }
                    label={copy.tenantOptIn}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={draft.killSwitch}
                        disabled={!canManage}
                        onChange={(event) =>
                          setDraft(
                            (value) => value && { ...value, killSwitch: event.target.checked }
                          )
                        }
                      />
                    }
                    label={copy.killSwitch}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={draft.feedbackUseEnabled}
                        disabled={!canManage}
                        onChange={(event) =>
                          setDraft(
                            (value) =>
                              value && { ...value, feedbackUseEnabled: event.target.checked }
                          )
                        }
                      />
                    }
                    label={copy.feedbackUseEnabled}
                  />
                </Stack>
              </Box>
              <FormField
                label={copy.reason}
                value={draft.reason}
                disabled={!canManage}
                inputProps={{ maxLength: 500 }}
                onChange={(event) =>
                  setDraft((value) => value && { ...value, reason: event.target.value })
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={draft.explicitConfirmation}
                    disabled={!canManage}
                    onChange={(event) =>
                      setDraft(
                        (value) => value && { ...value, explicitConfirmation: event.target.checked }
                      )
                    }
                  />
                }
                label={copy.adminConfirmation}
              />
              <ActionButton
                intent={draft.killSwitch ? 'danger' : 'primary'}
                startIcon={<Save size={16} />}
                disabled={!canManage || !draft.explicitConfirmation || !draft.reason.trim()}
                loading={updateMutation.isPending}
                onClick={submit}
              >
                {copy.updateGovernance}
              </ActionButton>
              {lastReceipt && (
                <InlineFeedback severity={lastReceipt.state === 'FAILED' ? 'error' : 'info'}>
                  {receiptEvidence}
                </InlineFeedback>
              )}
            </Stack>
          </Box>
        )}

        <Box sx={(theme) => ({ ...workplaceMemberCard(theme), p: { xs: 1.5, md: 2 } })}>
          <Stack spacing={1.5}>
            <Box>
              <Typography component="h2" variant="h6" fontWeight="fontWeightBold">
                {copy.auditTitle}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {copy.auditDescription}
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '2fr 1fr auto' },
                gap: 1,
              }}
            >
              <FormField
                label={copy.requestFilter}
                value={requestFilterDraft}
                errorMessage={
                  requestFilterDraft && !UUID.test(requestFilterDraft)
                    ? copy.commandError
                    : undefined
                }
                onChange={(event) => setRequestFilterDraft(event.target.value)}
              />
              <FormField
                type="number"
                label={copy.auditLimit}
                value={auditLimit}
                inputProps={{ min: 1, max: 500 }}
                onChange={(event) => setAuditLimit(event.target.value)}
              />
              <ActionButton
                intent="secondary"
                disabled={
                  (Boolean(requestFilterDraft) && !UUID.test(requestFilterDraft)) || !limitValid
                }
                onClick={() => setRequestFilter(requestFilterDraft.trim())}
              >
                {copy.applyFilter}
              </ActionButton>
            </Box>
            {auditQuery.data && (
              <Typography variant="caption" color="text.secondary">
                {copy.text(copy.generatedAt, {
                  date: formatDate(
                    auditQuery.data.generatedAt,
                    {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    },
                    locale
                  ),
                })}
              </Typography>
            )}
            {auditQuery.data?.items.length === 0 ? (
              <EmptyState title={copy.noAudit} />
            ) : (
              <>
                <TableContainer
                  tabIndex={0}
                  aria-label={copy.auditTitle}
                  sx={{ display: { xs: 'none', md: 'block' }, overflowX: 'auto' }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{copy.event}</TableCell>
                        <TableCell>{copy.actor}</TableCell>
                        <TableCell>{copy.correlation}</TableCell>
                        <TableCell>{copy.timestamp}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(auditQuery.data?.items ?? []).map((event) => (
                        <TableRow key={event.auditEventId}>
                          <TableCell>{event.eventType}</TableCell>
                          <TableCell>{event.actorUserId}</TableCell>
                          <TableCell>{event.correlationId ?? copy.unknown}</TableCell>
                          <TableCell>
                            {formatDate(
                              event.createdAt,
                              {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              },
                              locale
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Stack spacing={1} sx={{ display: { xs: 'flex', md: 'none' } }}>
                  {(auditQuery.data?.items ?? []).map((event) => (
                    <Box
                      key={event.auditEventId}
                      sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25 })}
                    >
                      <Typography fontWeight="fontWeightBold">{event.eventType}</Typography>
                      <Typography variant="body2">
                        {copy.actor} {event.actorUserId} · {event.correlationId ?? copy.unknown}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(
                          event.createdAt,
                          {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          },
                          locale
                        )}
                      </Typography>
                      <Typography
                        variant="caption"
                        display="block"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {copy.metadata}: {JSON.stringify(event.metadata)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </>
            )}
          </Stack>
        </Box>
      </Stack>
    </PageCanvas>
  );
}
