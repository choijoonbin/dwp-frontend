import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionButton,
  DatePickerField,
  FormField,
  InlineFeedback,
  LoadingState,
  foundationTokens,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useEmployeeChangeWorkspace } from '../hooks/use-employee-change-workspace';
import {
  employeeChangeItemVersion,
  hasEmployeeChangeAction,
} from '../model/employee-change-contract';

import type { EmployeeChangeDataSource } from '../api/employee-change-api';
import type {
  AuthorizedEmployeeChangeResultLocation,
  HrisCommandReceiptReader,
} from '../../../people/command-receipts/api/command-receipt-api';
import type { CommandReceiptRecoveryPhase } from '../../../people/command-receipts/hooks/use-command-receipt-recovery';
import type {
  EmployeeChangeCommandOwner,
  EmployeeChangeCreateDraft,
} from '../hooks/use-employee-change-workspace';
import type {
  EmployeeChangeCommandReceipt,
  EmployeeChangeCreateRequest,
  EmployeeChangeItem,
  EmployeeChangeProjection,
} from '../model/employee-change-contract';

export const HRIS_EMPLOYEE_CHANGE_RUNTIME_STATE =
  import.meta.env.VITE_HRIS_EMPLOYEE_CHANGE_ENABLED === 'true' ? ('ON' as const) : ('OFF' as const);

type Copy = Readonly<{
  title: string;
  description: string;
  unavailableTitle: string;
  unavailableDescription: string;
}>;

export type EmployeeChangeWorkspaceViewProps = Readonly<{
  copy: Copy;
  projection?: EmployeeChangeProjection;
  selectedItem: EmployeeChangeItem | null;
  receipt: EmployeeChangeCommandReceipt | null;
  receiptResultLocation: AuthorizedEmployeeChangeResultLocation | null;
  receiptRecoveryPhase: CommandReceiptRecoveryPhase;
  receiptRecoveryAttempt: number;
  receiptRecoveryMaximumAttempts: number;
  receiptRecoveryCanRecover: boolean;
  loading: boolean;
  fetching: boolean;
  error: unknown;
  commandError: Error | null;
  commandBusy: boolean;
  commandLockedByReceipt: boolean;
  pageIndex: number;
  canNext: boolean;
  canPrevious: boolean;
  canCreate: boolean;
  applyConnected: boolean;
  onSelect: (itemPublicId: string) => void;
  onRefresh: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onCreate: (draft: EmployeeChangeCreateDraft) => Promise<unknown>;
  onSubmit: () => Promise<unknown>;
  onApply: () => Promise<unknown>;
  onRecoverReceipt: () => void;
}>;

function DisabledWorkspace({ copy }: Readonly<{ copy: Copy }>) {
  return (
    <Stack
      gap={2}
      data-testid="hris-employee-change-workspace"
      data-runtime-state="OFF"
      data-surface-family="employee-change"
      sx={{ minWidth: 0, maxWidth: '100%' }}
    >
      <InlineFeedback severity="info" title={copy.unavailableTitle}>
        {copy.unavailableDescription}
      </InlineFeedback>
      <Paper component="section" variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack gap={1.25} alignItems="flex-start">
          <Chip size="small" variant="outlined" label="Feature state: OFF" />
          <Typography component="h2" variant="subtitle1">
            Dedicated employee-change request family
          </Typography>
          <Typography color="text.secondary">
            People 360 and assignment proposals remain separate owner surfaces. No protected data is
            requested while this feature is disabled.
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}

function fieldText(item: EmployeeChangeItem, key: keyof EmployeeChangeItem['fieldGroups']) {
  const field = item.fieldGroups[key];
  if (!field || field.decision === 'MASK') return 'Restricted';
  if ('itemCount' in field.value) return `${field.value.itemCount} changed field(s)`;
  if ('code' in field.value) return field.value.code.replaceAll('_', ' ');
  return field.value.effectiveTo
    ? `${field.value.effectiveFrom} – ${field.value.effectiveTo}`
    : `Effective ${field.value.effectiveFrom}`;
}

function receiptStatusCopy(
  receipt: EmployeeChangeCommandReceipt | null,
  phase: CommandReceiptRecoveryPhase,
  attempt: number,
  maximumAttempts: number
): Readonly<{
  severity: 'info' | 'success' | 'warning' | 'error';
  title: string;
  description: string;
}> | null {
  if (phase === 'IDLE') return null;
  if (phase === 'DENIED') {
    return {
      severity: 'error',
      title: 'Receipt is no longer available',
      description:
        'The receipt is absent or outside the current tenant, population, purpose, or permission scope. No cached result is shown.',
    };
  }
  if (phase === 'ERROR') {
    return {
      severity: 'error',
      title: 'Receipt recovery is unavailable',
      description:
        'The latest authorized result could not be confirmed. No cached result is shown. Try recovery again.',
    };
  }
  if (phase === 'LOADING' || !receipt) {
    return {
      severity: 'info',
      title: 'Checking command receipt',
      description: `Recovery attempt ${attempt} of ${maximumAttempts} is in progress.`,
    };
  }
  if (phase === 'RECOVERY_REQUIRED') {
    return {
      severity: 'warning',
      title: 'Command still needs recovery',
      description: `The outcome is not terminal after ${maximumAttempts} bounded checks. Recover this receipt before submitting another command.`,
    };
  }
  const statusCopy = {
    ACCEPTED: {
      severity: 'info',
      title: 'Command accepted',
      description: 'The command is queued. Its receipt is being checked automatically.',
    },
    RUNNING: {
      severity: 'info',
      title: 'Command is running',
      description: 'Processing is in progress. Its receipt is being checked automatically.',
    },
    SUCCEEDED: {
      severity: 'success',
      title: 'Command completed',
      description: 'The authorized command result is complete.',
    },
    REJECTED: {
      severity: 'warning',
      title: 'Command rejected',
      description: 'The request was not accepted by the current governed policy.',
    },
    FAILED: {
      severity: 'error',
      title: 'Command failed',
      description:
        'The command reached a terminal failure. Review the request before trying again.',
    },
    RESULT_UNKNOWN: {
      severity: 'warning',
      title: 'Command result is unknown',
      description:
        'Do not resubmit the command. The preserved receipt is being checked for its authoritative outcome.',
    },
  } as const;
  return statusCopy[receipt.status];
}

function CreateRequestForm({
  busy,
  onCancel,
  onCreate,
}: Readonly<{
  busy: boolean;
  onCancel: () => void;
  onCreate: (draft: EmployeeChangeCreateDraft) => Promise<unknown>;
}>) {
  const [targetPersonPublicId, setTargetPersonPublicId] = useState('');
  const [targetAggregateType, setTargetAggregateType] =
    useState<EmployeeChangeCreateRequest['targetAggregateType']>('PERSON');
  const [targetAggregatePublicId, setTargetAggregatePublicId] = useState('');
  const [changeType, setChangeType] = useState('PROFILE_UPDATE');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [schemaKey, setSchemaKey] = useState('employee-change.person.v1');
  const [expectedVersion, setExpectedVersion] = useState('0');
  const [patchText, setPatchText] = useState(
    '[{"op":"replace","path":"/displayName","value":"Updated name"}]'
  );
  const [evidenceText, setEvidenceText] = useState('[]');
  const [validationError, setValidationError] = useState<string | null>(null);

  const submit = async () => {
    try {
      const patch: unknown = JSON.parse(patchText);
      const evidence: unknown = JSON.parse(evidenceText);
      const version = Number(expectedVersion);
      if (
        !targetPersonPublicId ||
        !targetAggregatePublicId ||
        !Array.isArray(patch) ||
        patch.length === 0 ||
        !Array.isArray(evidence) ||
        !Number.isSafeInteger(version) ||
        version < 0
      ) {
        throw new Error('Complete the target, version, patch and evidence fields.');
      }
      setValidationError(null);
      const result = await onCreate({
        expectedTargetVersion: version,
        request: {
          targetPersonPublicId,
          targetAggregateType,
          targetAggregatePublicId,
          changeType,
          effectiveDate,
          patchSchemaKey: schemaKey,
          patchSchemaVersion: 1,
          patch: patch as EmployeeChangeCreateRequest['patch'],
          evidence: evidence as EmployeeChangeCreateRequest['evidence'],
        },
      });
      if (result) onCancel();
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'The request draft is invalid.');
    }
  };

  return (
    <Paper
      component="form"
      variant="outlined"
      sx={{ p: 2 }}
      onSubmit={(event) => event.preventDefault()}
    >
      <Stack gap={1.5}>
        <Typography component="h3" variant="subtitle1">
          Create employee-change request
        </Typography>
        {validationError && (
          <InlineFeedback severity="error" title="Request draft is incomplete">
            {validationError}
          </InlineFeedback>
        )}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.5,
          }}
        >
          <FormField
            required
            label="Target person public ID"
            value={targetPersonPublicId}
            onChange={(event) => setTargetPersonPublicId(event.target.value)}
          />
          <FormField
            select
            label="Target aggregate type"
            value={targetAggregateType}
            onChange={(event) =>
              setTargetAggregateType(
                event.target.value as EmployeeChangeCreateRequest['targetAggregateType']
              )
            }
          >
            {['PERSON', 'WORKER', 'EMPLOYMENT_RELATIONSHIP', 'ASSIGNMENT'].map((value) => (
              <MenuItem key={value} value={value}>
                {value.replaceAll('_', ' ')}
              </MenuItem>
            ))}
          </FormField>
          <FormField
            required
            label="Target aggregate public ID"
            value={targetAggregatePublicId}
            onChange={(event) => setTargetAggregatePublicId(event.target.value)}
          />
          <FormField
            required
            label="Change type"
            value={changeType}
            onChange={(event) => setChangeType(event.target.value)}
          />
          <DatePickerField
            required
            label="Effective date"
            value={effectiveDate || null}
            onValueChange={(value) => setEffectiveDate(value ?? '')}
          />
          <FormField
            required
            type="number"
            label="Expected target version"
            value={expectedVersion}
            slotProps={{ htmlInput: { min: 0, step: 1 } }}
            onChange={(event) => setExpectedVersion(event.target.value)}
          />
          <FormField
            required
            label="Patch schema key"
            value={schemaKey}
            onChange={(event) => setSchemaKey(event.target.value)}
          />
        </Box>
        <FormField
          required
          multiline
          minRows={3}
          label="Patch operations (JSON)"
          value={patchText}
          onChange={(event) => setPatchText(event.target.value)}
        />
        <FormField
          multiline
          minRows={2}
          label="Evidence references (JSON)"
          value={evidenceText}
          onChange={(event) => setEvidenceText(event.target.value)}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="flex-end">
          <ActionButton intent="secondary" disabled={busy} onClick={onCancel}>
            Cancel
          </ActionButton>
          <ActionButton intent="primary" loading={busy} onClick={() => void submit()}>
            Create request
          </ActionButton>
        </Stack>
      </Stack>
    </Paper>
  );
}

export function EmployeeChangeWorkspaceView({
  copy,
  projection,
  selectedItem,
  receipt,
  receiptResultLocation,
  receiptRecoveryPhase,
  receiptRecoveryAttempt,
  receiptRecoveryMaximumAttempts,
  receiptRecoveryCanRecover,
  loading,
  fetching,
  error,
  commandError,
  commandBusy,
  commandLockedByReceipt,
  pageIndex,
  canNext,
  canPrevious,
  canCreate,
  applyConnected,
  onSelect,
  onRefresh,
  onNext,
  onPrevious,
  onCreate,
  onSubmit,
  onApply,
  onRecoverReceipt,
}: EmployeeChangeWorkspaceViewProps) {
  const { t } = useTranslation('common');
  const [creating, setCreating] = useState(false);
  const receiptStatusRef = useRef<HTMLDivElement | null>(null);
  const receiptAnnouncementKey = `${receiptRecoveryPhase}:${receipt?.receiptId ?? 'none'}:${receipt?.status ?? 'none'}`;
  const previousReceiptAnnouncementKey = useRef(receiptAnnouncementKey);
  const state = projection?.queryState.state;
  const receiptCopy = receiptStatusCopy(
    receipt,
    receiptRecoveryPhase,
    receiptRecoveryAttempt,
    receiptRecoveryMaximumAttempts
  );
  const receiptDeepLink = receipt?.status === 'SUCCEEDED' ? receiptResultLocation : null;

  useEffect(() => {
    if (
      receiptRecoveryPhase !== 'IDLE' &&
      previousReceiptAnnouncementKey.current !== receiptAnnouncementKey
    ) {
      receiptStatusRef.current?.focus();
    }
    previousReceiptAnnouncementKey.current = receiptAnnouncementKey;
  }, [receiptAnnouncementKey, receiptRecoveryPhase]);
  return (
    <Stack
      gap={2}
      data-testid="hris-employee-change-workspace"
      data-runtime-state="ON"
      data-surface-family="employee-change"
    >
      <Paper component="header" variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} alignItems={{ sm: 'center' }}>
          <Box flex={1} minWidth={0}>
            <Typography component="h2" variant="h6">
              {copy.title}
            </Typography>
            <Typography color="text.secondary">{copy.description}</Typography>
          </Box>
          <Stack direction="row" gap={1} flexWrap="wrap">
            <ActionButton intent="secondary" disabled={commandBusy} onClick={onRefresh}>
              Refresh
            </ActionButton>
            {canCreate && (
              <ActionButton
                intent="primary"
                disabled={commandBusy || commandLockedByReceipt}
                onClick={() => setCreating(true)}
              >
                New request
              </ActionButton>
            )}
          </Stack>
        </Stack>
      </Paper>

      {creating && canCreate && (
        <CreateRequestForm
          busy={commandBusy || commandLockedByReceipt}
          onCancel={() => setCreating(false)}
          onCreate={onCreate}
        />
      )}
      {loading && (
        <LoadingState label="Loading employee-change requests…" embedded spinnerSize={20} />
      )}
      {Boolean(error) && (
        <InlineFeedback severity="error" title="Employee-change requests are unavailable">
          The governed workbench could not be loaded. No cached protected data is shown.
        </InlineFeedback>
      )}
      {state === 'PARTIAL' && (
        <InlineFeedback severity="warning" title="Some request evidence is unavailable">
          Review the available items carefully and refresh before running a command.
        </InlineFeedback>
      )}
      {state === 'UNAVAILABLE' && (
        <InlineFeedback severity="error" title="Authority is unavailable">
          The employee-change workbench is closed until governed authority is restored.
        </InlineFeedback>
      )}
      {projection?.queryState.freshness === 'STALE' && (
        <InlineFeedback severity="warning" title="Workbench evidence is stale">
          Refresh before submitting or applying a request.
        </InlineFeedback>
      )}
      {commandError && (
        <InlineFeedback severity="error" title="Employee-change command failed">
          {commandError.message}
        </InlineFeedback>
      )}
      {receiptCopy && (
        <Box
          ref={receiptStatusRef}
          role={
            receiptRecoveryPhase === 'DENIED' || receiptRecoveryPhase === 'ERROR'
              ? 'alert'
              : 'status'
          }
          aria-live={
            receiptRecoveryPhase === 'DENIED' || receiptRecoveryPhase === 'ERROR'
              ? 'assertive'
              : 'polite'
          }
          aria-atomic="true"
          tabIndex={-1}
          data-testid="employee-change-receipt-status"
        >
          <InlineFeedback severity={receiptCopy.severity} title={receiptCopy.title}>
            <Stack gap={1} alignItems="flex-start">
              <Typography component="span" variant="body2">
                {receiptCopy.description}
              </Typography>
              {receipt && (
                <Typography component="span" variant="caption">
                  Receipt {receipt.receiptId} · correlation {receipt.correlationId}
                </Typography>
              )}
              {receiptDeepLink && <Link href={receiptDeepLink}>Open employee-change requests</Link>}
              {receiptRecoveryCanRecover && (
                <ActionButton intent="secondary" onClick={onRecoverReceipt}>
                  Recover receipt
                </ActionButton>
              )}
            </Stack>
          </InlineFeedback>
        </Box>
      )}

      {!loading && !error && projection && projection.items.length === 0 && (
        <Paper component="section" variant="outlined" sx={{ p: 2 }}>
          <Typography component="h3" variant="subtitle1">
            No employee-change requests
          </Typography>
          <Typography color="text.secondary">
            No requests are visible in the governed population scope.
          </Typography>
        </Paper>
      )}

      {projection && projection.items.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(240px, 0.8fr) minmax(0, 1.4fr)' },
            gap: 2,
          }}
        >
          <Paper component="section" variant="outlined" sx={{ p: 1.5 }}>
            <Typography component="h3" variant="subtitle1" sx={{ px: 0.5, mb: 1 }}>
              Requests
            </Typography>
            <Stack component="ul" gap={0.75} sx={{ p: 0, m: 0, listStyle: 'none' }}>
              {projection.items.map((item) => (
                <Box component="li" key={item.itemPublicId}>
                  <ActionButton
                    intent="quiet"
                    type="button"
                    aria-pressed={selectedItem?.itemPublicId === item.itemPublicId}
                    onClick={() => onSelect(item.itemPublicId)}
                    sx={{
                      width: '100%',
                      p: 1.25,
                      border: 1,
                      borderColor:
                        selectedItem?.itemPublicId === item.itemPublicId
                          ? 'primary.main'
                          : 'divider',
                      borderRadius: foundationTokens.radius.control + 'px',
                      bgcolor:
                        selectedItem?.itemPublicId === item.itemPublicId
                          ? 'action.selected'
                          : 'background.paper',
                      color: 'text.primary',
                      display: 'block',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <Typography
                      component="span"
                      variant="body2"
                      fontWeight="fontWeightBold"
                      display="block"
                    >
                      {item.title}
                    </Typography>
                    <Typography component="span" variant="caption" color="text.secondary">
                      {item.statusCode.replaceAll('_', ' ')}
                    </Typography>
                  </ActionButton>
                </Box>
              ))}
            </Stack>
          </Paper>

          {selectedItem && (
            <Paper component="section" variant="outlined" sx={{ p: 2 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}>
                <Box flex={1} minWidth={0}>
                  <Typography component="h3" variant="subtitle1">
                    {selectedItem.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Request version {employeeChangeItemVersion(selectedItem) ?? 'restricted'}
                  </Typography>
                </Box>
                <Chip size="small" label={selectedItem.statusCode.replaceAll('_', ' ')} />
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Stack gap={1}>
                <Typography variant="body2">
                  Change summary: {fieldText(selectedItem, 'CHANGE_REQUEST_SUMMARY')}
                </Typography>
                <Typography variant="body2">
                  Approval status: {fieldText(selectedItem, 'APPROVAL_STATUS')}
                </Typography>
                <Typography variant="body2">
                  Employment: {fieldText(selectedItem, 'EMPLOYMENT')}
                </Typography>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 2 }}>
                {hasEmployeeChangeAction(
                  selectedItem,
                  'hris.action.hrm.submit-employee-change-request'
                ) && (
                  <ActionButton
                    intent="primary"
                    loading={commandBusy}
                    disabled={commandLockedByReceipt}
                    onClick={() => void onSubmit()}
                  >
                    Submit for approval
                  </ActionButton>
                )}
                {hasEmployeeChangeAction(
                  selectedItem,
                  'hris.action.hrm.apply-employee-change-request'
                ) && (
                  <ActionButton
                    intent="primary"
                    loading={commandBusy}
                    disabled={!applyConnected || commandLockedByReceipt}
                    onClick={() => void onApply()}
                  >
                    Apply approved change
                  </ActionButton>
                )}
              </Stack>
              {hasEmployeeChangeAction(
                selectedItem,
                'hris.action.hrm.apply-employee-change-request'
              ) &&
                !applyConnected && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    sx={{ mt: 1 }}
                  >
                    Apply remains closed until the shared step-up command coordinator is connected.
                  </Typography>
                )}
            </Paper>
          )}
        </Box>
      )}

      <Stack direction="row" gap={1} alignItems="center" justifyContent="flex-end">
        {fetching && !loading && (
          <LoadingState label={t('labels.loading')} embedded spinnerSize={18} />
        )}
        <ActionButton
          intent="secondary"
          disabled={!canPrevious || commandBusy}
          onClick={onPrevious}
        >
          Previous
        </ActionButton>
        <Typography variant="caption">Page {pageIndex + 1}</Typography>
        <ActionButton intent="secondary" disabled={!canNext || commandBusy} onClick={onNext}>
          Next
        </ActionButton>
      </Stack>
    </Stack>
  );
}

function EnabledWorkspace({
  copy,
  dataSource,
  commandOwner,
  receiptReader,
}: Readonly<{
  copy: Copy;
  dataSource?: EmployeeChangeDataSource;
  commandOwner?: EmployeeChangeCommandOwner;
  receiptReader?: HrisCommandReceiptReader;
}>) {
  const { i18n } = useTranslation('hcm');
  const locale = i18n.resolvedLanguage || i18n.language || 'en-US';
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  const runtime = useEmployeeChangeWorkspace({
    enabled: true,
    locale,
    timeZone,
    dataSource,
    commandOwner,
    receiptReader,
  });
  return (
    <EmployeeChangeWorkspaceView
      copy={copy}
      projection={runtime.projection}
      selectedItem={runtime.selectedItem}
      receipt={runtime.receipt}
      receiptResultLocation={runtime.receiptRecovery.resultLocation}
      receiptRecoveryPhase={runtime.receiptRecovery.phase}
      receiptRecoveryAttempt={runtime.receiptRecovery.attempt}
      receiptRecoveryMaximumAttempts={runtime.receiptRecovery.maximumAttempts}
      receiptRecoveryCanRecover={runtime.receiptRecovery.canRecover}
      loading={runtime.query.isLoading}
      fetching={runtime.query.isFetching}
      error={runtime.query.error}
      commandError={runtime.commandError}
      commandBusy={runtime.commandBusy}
      commandLockedByReceipt={runtime.commandLockedByReceipt}
      pageIndex={runtime.pageIndex}
      canNext={runtime.canNext}
      canPrevious={runtime.canPrevious}
      canCreate={runtime.canCreate}
      applyConnected={runtime.applyConnected}
      onSelect={runtime.select}
      onRefresh={runtime.refresh}
      onNext={runtime.next}
      onPrevious={runtime.previous}
      onCreate={runtime.create}
      onSubmit={runtime.submit}
      onApply={runtime.apply}
      onRecoverReceipt={runtime.receiptRecovery.recover}
    />
  );
}

export type HrisEmployeeChangeWorkspaceProps = Readonly<{
  enabled?: boolean;
  dataSource?: EmployeeChangeDataSource;
  commandOwner?: EmployeeChangeCommandOwner;
  receiptReader?: HrisCommandReceiptReader;
}>;

/** Default-off owner workspace for IAQ-009 and the HRM-010 lifecycle. */
export function HrisEmployeeChangeWorkspace({
  enabled = HRIS_EMPLOYEE_CHANGE_RUNTIME_STATE === 'ON',
  dataSource,
  commandOwner,
  receiptReader,
}: HrisEmployeeChangeWorkspaceProps = {}) {
  const { t } = useTranslation('hcm');
  const copy = useMemo<Copy>(
    () => ({
      title: t('pages.hcm.employee-change-requests.title', {
        defaultValue: 'Employee-change requests',
      }),
      description: t('pages.hcm.employee-change-requests.description', {
        defaultValue: 'Create, submit and independently apply governed employee changes.',
      }),
      unavailableTitle: t('pages.hcm.employee-change-requests.availabilityTitle', {
        defaultValue: 'Employee-change lifecycle is unavailable',
      }),
      unavailableDescription: t('pages.hcm.employee-change-requests.availabilityDescription', {
        defaultValue:
          'The owner lifecycle is feature-off. No employee-change data is loaded and no request command is available.',
      }),
    }),
    [t]
  );
  return enabled ? (
    <EnabledWorkspace
      copy={copy}
      dataSource={dataSource}
      commandOwner={commandOwner}
      receiptReader={receiptReader}
    />
  ) : (
    <DisabledWorkspace copy={copy} />
  );
}
