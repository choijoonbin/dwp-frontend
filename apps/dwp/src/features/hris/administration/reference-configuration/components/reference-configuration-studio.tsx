import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineFeedback, ActionButton, LoadingState } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  assertReferenceConfigurationReceipt,
  referenceConfigurationActions,
  referenceConfigurationCommandType,
  referenceConfigurationOriginatingAction,
} from '../model/reference-configuration-model';

import type {
  ReferenceConfigurationAction,
  ReferenceConfigurationCommandOwner,
  ReferenceConfigurationCommandReceipt,
  ReferenceConfigurationCommandState,
  ReferenceConfigurationLifecycleAction,
  ReferenceConfigurationVersion,
  ReferenceConfigurationViewState,
  ReferenceConfigurationWorkbench,
} from '../model/reference-configuration-model';

export type ReferenceConfigurationStudioProps = Readonly<{
  state: ReferenceConfigurationViewState;
  workbench?: ReferenceConfigurationWorkbench;
  detail?: ReferenceConfigurationVersion;
  detailLoading: boolean;
  selectedId?: string;
  statusFilter: string;
  onStatusFilterChange(value: string): void;
  onSelect(configurationId: string, version: number): void;
  onRefresh(): void;
  commandOwner?: ReferenceConfigurationCommandOwner;
  onCommandCommitted?(receipt: ReferenceConfigurationCommandReceipt): void | Promise<void>;
}>;

const STATES = [
  'DRAFT',
  'VALIDATED',
  'SIMULATED',
  'PENDING_APPROVAL',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
  'RETIRED',
] as const;

export function ReferenceConfigurationStudio({
  state,
  workbench,
  detail,
  detailLoading,
  selectedId,
  statusFilter,
  onStatusFilterChange,
  onSelect,
  onRefresh,
  commandOwner,
  onCommandCommitted,
}: ReferenceConfigurationStudioProps) {
  const { t } = useTranslation('hcm');
  const [commandState, setCommandState] = useState<ReferenceConfigurationCommandState>('IDLE');
  const [commandAction, setCommandAction] = useState<ReferenceConfigurationLifecycleAction>();
  const [receipt, setReceipt] = useState<ReferenceConfigurationCommandReceipt>();
  const [commandError, setCommandError] = useState<string>();

  useEffect(() => {
    setCommandState('IDLE');
    setCommandAction(undefined);
    setReceipt(undefined);
    setCommandError(undefined);
  }, [detail?.configurationId, detail?.version]);

  async function executeAction(action: ReferenceConfigurationLifecycleAction) {
    if (!commandOwner || !detail || commandState === 'RUNNING') return;
    setCommandState('RUNNING');
    setCommandAction(action);
    setReceipt(undefined);
    setCommandError(undefined);
    try {
      const candidate = await commandOwner.execute({
        action,
        configurationId: detail.configurationId,
        version: detail.version,
        aggregateVersion: detail.aggregateVersion,
      });
      const verified = assertReferenceConfigurationReceipt(candidate, {
        commandType: referenceConfigurationCommandType(action),
        originatingAction: referenceConfigurationOriginatingAction(action),
        resultRefPrefix:
          action === 'ROLLBACK'
            ? `${detail.configurationId}/`
            : `${detail.configurationId}/${detail.version}`,
      });
      const immutable = Object.freeze({ ...verified });
      await onCommandCommitted?.(immutable);
      setReceipt(immutable);
      setCommandState('SUCCEEDED');
    } catch (error) {
      setCommandError(commandErrorMessage(error));
      setCommandState(isStaleCommandError(error) ? 'STALE' : 'ERROR');
    }
  }

  if (state === 'LOADING') {
    return (
      <Stack alignItems="center" justifyContent="center" minHeight={280} gap={2} role="status">
        <LoadingState
          embedded
          spinnerSize={28}
          label={t('administration.reference.loadingWorkspace')}
        />
      </Stack>
    );
  }
  if (state === 'DENIED') {
    return (
      <InlineFeedback severity="error" title={t('administration.reference.restrictedTitle')}>
        {t('administration.reference.restrictedDescription')}
      </InlineFeedback>
    );
  }
  if (state === 'ERROR' || state === 'UNAVAILABLE') {
    return (
      <InlineFeedback severity="error" title={t('administration.reference.unavailableTitle')}>
        {t('administration.reference.unavailableDescription')}
      </InlineFeedback>
    );
  }

  const items = workbench?.items ?? [];
  const selectedItem = items.find((item) => item.itemPublicId === selectedId);
  const lifecycleActions = detail
    ? permittedLifecycleActions(detail.state, selectedItem?.availableActions ?? [])
    : [];
  const referenceData = referenceDataValue(selectedItem?.fieldGroups);
  return (
    <Stack gap={2} minWidth={0} data-testid="reference-configuration-studio">
      {state === 'PARTIAL' ? (
        <InlineFeedback severity="warning" title={t('administration.reference.partialTitle')}>
          {t('administration.reference.partialDescription')}
        </InlineFeedback>
      ) : null}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        gap={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
      >
        <Stack gap={0.25}>
          <Typography component="h1" variant="h5">
            {t('administration.reference.title')}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {t('administration.reference.description')}
          </Typography>
        </Stack>
        <Stack direction="row" gap={1} alignItems="center">
          <Chip
            size="small"
            color={workbench?.queryState.freshness === 'CURRENT' ? 'success' : 'warning'}
            label={t('administration.reference.evidenceState', {
              state: workbench?.queryState.freshness ?? 'UNAVAILABLE',
            })}
          />
          <ActionButton intent="secondary" onClick={onRefresh}>
            {t('administration.reference.refresh')}
          </ActionButton>
        </Stack>
      </Stack>

      <FormControl size="small" sx={{ width: { xs: '100%', sm: 240 } }}>
        <InputLabel id="reference-configuration-status-label">
          {t('administration.reference.lifecycleStatus')}
        </InputLabel>
        <Select
          labelId="reference-configuration-status-label"
          label={t('administration.reference.lifecycleStatus')}
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value)}
        >
          <MenuItem value="">{t('administration.reference.allStates')}</MenuItem>
          {STATES.map((value) => (
            <MenuItem key={value} value={value}>
              {value.replaceAll('_', ' ')}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {state === 'EMPTY' ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography component="h2" variant="subtitle1">
            {t('administration.reference.emptyTitle')}
          </Typography>
          <Typography color="text.secondary">
            {t('administration.reference.emptyDescription')}
          </Typography>
        </Paper>
      ) : (
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2} alignItems="stretch">
          <Paper
            component="section"
            aria-label={t('administration.reference.listAriaLabel')}
            variant="outlined"
            sx={{ width: { xs: '100%', md: 360 }, flex: '0 0 auto', overflow: 'hidden' }}
          >
            <List disablePadding>
              {items.map((item) => {
                const revision = policyRevision(item.fieldGroups);
                return (
                  <ListItemButton
                    key={item.itemPublicId}
                    selected={selectedId === item.itemPublicId}
                    onClick={() => onSelect(item.itemPublicId, revision)}
                    divider
                  >
                    <ListItemText
                      primary={item.title}
                      secondary={`${item.statusCode.replaceAll('_', ' ')} · v${revision}`}
                      primaryTypographyProps={{ sx: { overflowWrap: 'anywhere' } }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Paper>

          <Paper
            component="section"
            aria-label={t('administration.reference.detailAriaLabel')}
            variant="outlined"
            sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0, flex: 1 }}
          >
            {detailLoading ? (
              <LoadingState
                embedded
                spinnerSize={22}
                label={t('administration.reference.loadingDetail')}
              />
            ) : detail ? (
              <Stack gap={2}>
                <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                  <Typography component="h2" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
                    {detail.schemaKey}
                  </Typography>
                  {referenceData?.code ? <Chip size="small" label={referenceData.code} /> : null}
                  <Chip size="small" color="primary" label={detail.state.replaceAll('_', ' ')} />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
                  <Evidence
                    label={t('administration.reference.version')}
                    value={t('administration.reference.versionValue', {
                      version: detail.version,
                      revision: detail.aggregateVersion,
                    })}
                  />
                  <Evidence
                    label={t('administration.reference.effectiveFrom')}
                    value={formatTime(
                      detail.effectiveFrom,
                      t('administration.reference.openEnded')
                    )}
                  />
                  <Evidence
                    label={t('administration.reference.effectiveTo')}
                    value={formatTime(detail.effectiveTo, t('administration.reference.openEnded'))}
                  />
                </Stack>
                <Divider />
                <Stack gap={0.5}>
                  <Typography variant="overline" color="text.secondary">
                    {t('administration.reference.ownerEvidence')}
                  </Typography>
                  <Typography sx={{ overflowWrap: 'anywhere' }}>
                    {t('administration.reference.configurationId', {
                      configurationId: detail.configurationId,
                    })}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    {t('administration.reference.digest', { digest: detail.payloadDigest })}
                  </Typography>
                </Stack>
                <Divider />
                <Stack gap={1}>
                  <Typography variant="subtitle2">
                    {t('administration.reference.availableDecisions')}
                  </Typography>
                  {!commandOwner && lifecycleActions.length > 0 ? (
                    <InlineFeedback
                      severity="warning"
                      title={t('administration.reference.commandAuthorityUnavailableTitle')}
                    >
                      {t('administration.reference.commandAuthorityUnavailableDescription')}
                    </InlineFeedback>
                  ) : null}
                  {commandState === 'RUNNING' ? (
                    <InlineFeedback severity="info" title={`${commandAction} is running`}>
                      {t('administration.reference.commandRunningDescription')}
                    </InlineFeedback>
                  ) : null}
                  {commandState === 'SUCCEEDED' && receipt ? (
                    <InlineFeedback severity="success" title={`${commandAction} completed`}>
                      {t('administration.reference.commandSucceededDescription', {
                        receiptId: receipt.receiptId,
                        revision: receipt.aggregateVersion,
                      })}
                    </InlineFeedback>
                  ) : null}
                  {commandState === 'STALE' ? (
                    <InlineFeedback
                      severity="warning"
                      title={t('administration.reference.staleTitle')}
                    >
                      {commandError} {t('administration.reference.staleDescription')}
                    </InlineFeedback>
                  ) : null}
                  {commandState === 'ERROR' ? (
                    <InlineFeedback severity="error" title={`${commandAction} failed`}>
                      {commandError} {t('administration.reference.commandFailedDescription')}
                    </InlineFeedback>
                  ) : null}
                  <Stack direction="row" gap={1} flexWrap="wrap">
                    {lifecycleActions.map((action) => (
                      <ActionButton
                        key={action}
                        intent="secondary"
                        aria-label={`${action} reference configuration`}
                        disabled={!commandOwner || commandState === 'RUNNING'}
                        onClick={() => void executeAction(action)}
                      >
                        {action.replaceAll('_', ' ')}
                      </ActionButton>
                    ))}
                    {lifecycleActions.length === 0 ? (
                      <Typography color="text.secondary" variant="body2">
                        {t('administration.reference.noTransition')}
                      </Typography>
                    ) : null}
                  </Stack>
                </Stack>
              </Stack>
            ) : (
              <Typography color="text.secondary">
                {t('administration.reference.selectConfiguration')}
              </Typography>
            )}
          </Paper>
        </Stack>
      )}
      <Typography variant="caption" color="text.secondary">
        {t('administration.reference.lastProjection', {
          asOf: formatTime(workbench?.asOf, t('administration.reference.openEnded')),
          version: workbench?.projectionVersion,
        })}
      </Typography>
    </Stack>
  );
}

function Evidence({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={0.25} minWidth={0} flex={1}>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ overflowWrap: 'anywhere' }}>{value}</Typography>
    </Stack>
  );
}

function policyRevision(fieldGroups: Readonly<Record<string, unknown>>) {
  const policy = fieldGroups.POLICY_VERSION as { value?: { revision?: unknown } } | undefined;
  return typeof policy?.value?.revision === 'number' ? policy.value.revision : 1;
}

function permittedLifecycleActions(
  lifecycle: ReferenceConfigurationVersion['state'],
  availableActions: readonly ReferenceConfigurationAction[]
) {
  const authorized = new Set(
    availableActions.map((action) => action.hrefTemplate.split('/').at(-1)?.toUpperCase())
  );
  return referenceConfigurationActions(lifecycle).filter((action) => authorized.has(action));
}

function isStaleCommandError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    status?: unknown;
    code?: unknown;
    message?: unknown;
    response?: { status?: unknown; data?: { code?: unknown; message?: unknown } };
  };
  const status = candidate.status ?? candidate.response?.status;
  const identity = [
    candidate.code,
    candidate.message,
    candidate.response?.data?.code,
    candidate.response?.data?.message,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toUpperCase();
  return (
    status === 409 || /STALE|OBJECT_VERSION|DECISION_REVISION|VERSION_CONFLICT/u.test(identity)
  );
}

function commandErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return `${error.message.trim()}.`;
  return 'The governed command owner rejected the operation.';
}

function referenceDataValue(fieldGroups?: Readonly<Record<string, unknown>>) {
  const field = fieldGroups?.REFERENCE_DATA as
    { decision?: unknown; value?: { code?: unknown } } | undefined;
  if (field?.decision !== 'VIEW' || typeof field.value?.code !== 'string') return undefined;
  return { code: field.value.code };
}

function formatTime(value: string | null | undefined, openEnded: string) {
  if (!value) return openEnded;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? value
    : formatDate(parsed, { dateStyle: 'medium', timeStyle: 'short' });
}
