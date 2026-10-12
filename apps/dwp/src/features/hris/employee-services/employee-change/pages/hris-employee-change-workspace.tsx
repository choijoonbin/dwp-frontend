import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { useEmployeeChangeWorkspace } from '../hooks/use-employee-change-workspace';
import {
  employeeChangeItemVersion,
  hasEmployeeChangeAction,
} from '../model/employee-change-contract';

import type { EmployeeChangeDataSource } from '../api/employee-change-api';
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
  loading: boolean;
  fetching: boolean;
  error: unknown;
  commandError: Error | null;
  commandBusy: boolean;
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
          <TextField
            required
            label="Target person public ID"
            value={targetPersonPublicId}
            onChange={(event) => setTargetPersonPublicId(event.target.value)}
          />
          <TextField
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
          </TextField>
          <TextField
            required
            label="Target aggregate public ID"
            value={targetAggregatePublicId}
            onChange={(event) => setTargetAggregatePublicId(event.target.value)}
          />
          <TextField
            required
            label="Change type"
            value={changeType}
            onChange={(event) => setChangeType(event.target.value)}
          />
          <TextField
            required
            type="date"
            label="Effective date"
            value={effectiveDate}
            slotProps={{ inputLabel: { shrink: true } }}
            onChange={(event) => setEffectiveDate(event.target.value)}
          />
          <TextField
            required
            type="number"
            label="Expected target version"
            value={expectedVersion}
            slotProps={{ htmlInput: { min: 0, step: 1 } }}
            onChange={(event) => setExpectedVersion(event.target.value)}
          />
          <TextField
            required
            label="Patch schema key"
            value={schemaKey}
            onChange={(event) => setSchemaKey(event.target.value)}
          />
        </Box>
        <TextField
          required
          multiline
          minRows={3}
          label="Patch operations (JSON)"
          value={patchText}
          onChange={(event) => setPatchText(event.target.value)}
        />
        <TextField
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
  loading,
  fetching,
  error,
  commandError,
  commandBusy,
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
}: EmployeeChangeWorkspaceViewProps) {
  const [creating, setCreating] = useState(false);
  const state = projection?.queryState.state;
  const receiptSeverity =
    receipt?.status === 'SUCCEEDED'
      ? ('success' as const)
      : receipt && ['ACCEPTED', 'RUNNING', 'RESULT_UNKNOWN'].includes(receipt.status)
        ? ('warning' as const)
        : ('error' as const);
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
                disabled={commandBusy}
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
          busy={commandBusy}
          onCancel={() => setCreating(false)}
          onCreate={onCreate}
        />
      )}
      {loading && (
        <Stack direction="row" gap={1} alignItems="center" role="status">
          <CircularProgress size={20} />
          <Typography>Loading employee-change requests…</Typography>
        </Stack>
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
      {receipt && (
        <InlineFeedback
          severity={receiptSeverity}
          title={`Command ${receipt.status.toLowerCase().replaceAll('_', ' ')}`}
        >
          Receipt {receipt.receiptId} is bound to correlation {receipt.correlationId}.
        </InlineFeedback>
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
                  <Box
                    component="button"
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
                      borderRadius: 1.5,
                      bgcolor:
                        selectedItem?.itemPublicId === item.itemPublicId
                          ? 'action.selected'
                          : 'background.paper',
                      color: 'text.primary',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <Typography component="span" variant="body2" fontWeight={700} display="block">
                      {item.title}
                    </Typography>
                    <Typography component="span" variant="caption" color="text.secondary">
                      {item.statusCode.replaceAll('_', ' ')}
                    </Typography>
                  </Box>
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
                    disabled={!applyConnected}
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
        {fetching && !loading && <CircularProgress size={18} aria-label="Refreshing" />}
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
}: Readonly<{
  copy: Copy;
  dataSource?: EmployeeChangeDataSource;
  commandOwner?: EmployeeChangeCommandOwner;
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
  });
  return (
    <EmployeeChangeWorkspaceView
      copy={copy}
      projection={runtime.projection}
      selectedItem={runtime.selectedItem}
      receipt={runtime.receipt}
      loading={runtime.query.isLoading}
      fetching={runtime.query.isFetching}
      error={runtime.query.error}
      commandError={runtime.commandError}
      commandBusy={runtime.commandBusy}
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
    />
  );
}

export type HrisEmployeeChangeWorkspaceProps = Readonly<{
  enabled?: boolean;
  dataSource?: EmployeeChangeDataSource;
  commandOwner?: EmployeeChangeCommandOwner;
}>;

/** Default-off owner workspace for IAQ-009 and the HRM-010 lifecycle. */
export function HrisEmployeeChangeWorkspace({
  enabled = HRIS_EMPLOYEE_CHANGE_RUNTIME_STATE === 'ON',
  dataSource,
  commandOwner,
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
    <EnabledWorkspace copy={copy} dataSource={dataSource} commandOwner={commandOwner} />
  ) : (
    <DisabledWorkspace copy={copy} />
  );
}
