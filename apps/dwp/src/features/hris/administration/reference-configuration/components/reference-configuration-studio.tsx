import { InlineFeedback } from '@dwp-frontend/design-system';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
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

import { referenceConfigurationActions } from '../model/reference-configuration-model';

import type {
  ReferenceConfigurationAction,
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
  onPrepareAction(action: string): void;
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
  onPrepareAction,
}: ReferenceConfigurationStudioProps) {
  if (state === 'LOADING') {
    return (
      <Stack alignItems="center" justifyContent="center" minHeight={280} gap={2} role="status">
        <CircularProgress size={28} />
        <Typography color="text.secondary">Loading reference-configuration evidence…</Typography>
      </Stack>
    );
  }
  if (state === 'DENIED') {
    return (
      <InlineFeedback severity="error" title="Reference configuration is restricted">
        Your current scope cannot read this workbench. Request the configuration-reader duty.
      </InlineFeedback>
    );
  }
  if (state === 'ERROR' || state === 'UNAVAILABLE') {
    return (
      <InlineFeedback severity="error" title="Reference configuration is unavailable">
        No lifecycle command has been submitted. Retry the owner projection when it is available.
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
        <InlineFeedback severity="warning" title="Some configuration evidence is unavailable">
          Available versions remain visible. Refresh before making a lifecycle decision.
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
            Reference configuration
          </Typography>
          <Typography color="text.secondary" variant="body2">
            Compare lifecycle evidence before approving, publishing, retiring, or rolling back.
          </Typography>
        </Stack>
        <Stack direction="row" gap={1} alignItems="center">
          <Chip
            size="small"
            color={workbench?.queryState.freshness === 'CURRENT' ? 'success' : 'warning'}
            label={`Evidence: ${workbench?.queryState.freshness ?? 'UNAVAILABLE'}`}
          />
          <Button variant="outlined" onClick={onRefresh}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      <FormControl size="small" sx={{ width: { xs: '100%', sm: 240 } }}>
        <InputLabel id="reference-configuration-status-label">Lifecycle status</InputLabel>
        <Select
          labelId="reference-configuration-status-label"
          label="Lifecycle status"
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value)}
        >
          <MenuItem value="">All states</MenuItem>
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
            No configuration versions match this scope
          </Typography>
          <Typography color="text.secondary">
            Clear the lifecycle filter or create the first version from an existing owner reference.
          </Typography>
        </Paper>
      ) : (
        <Stack direction={{ xs: 'column', md: 'row' }} gap={2} alignItems="stretch">
          <Paper
            component="section"
            aria-label="Reference configurations"
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
            aria-label="Selected configuration evidence"
            variant="outlined"
            sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0, flex: 1 }}
          >
            {detailLoading ? (
              <Stack direction="row" gap={1.5} alignItems="center" role="status">
                <CircularProgress size={22} />
                <Typography>Loading immutable version evidence…</Typography>
              </Stack>
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
                    label="Version"
                    value={`v${detail.version} · revision ${detail.aggregateVersion}`}
                  />
                  <Evidence label="Effective from" value={formatTime(detail.effectiveFrom)} />
                  <Evidence label="Effective to" value={formatTime(detail.effectiveTo)} />
                </Stack>
                <Divider />
                <Stack gap={0.5}>
                  <Typography variant="overline" color="text.secondary">
                    Owner evidence — content is not copied here
                  </Typography>
                  <Typography sx={{ overflowWrap: 'anywhere' }}>
                    Configuration {detail.configurationId}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ overflowWrap: 'anywhere' }}
                  >
                    SHA-256 {detail.payloadDigest}
                  </Typography>
                </Stack>
                <Divider />
                <Stack gap={1}>
                  <Typography variant="subtitle2">Available lifecycle decisions</Typography>
                  <Stack direction="row" gap={1} flexWrap="wrap">
                    {lifecycleActions.map((action) => (
                      <Button
                        key={action}
                        variant="outlined"
                        onClick={() => onPrepareAction(action)}
                      >
                        {action.replaceAll('_', ' ')}
                      </Button>
                    ))}
                    {lifecycleActions.length === 0 ? (
                      <Typography color="text.secondary" variant="body2">
                        This immutable version has no available transition.
                      </Typography>
                    ) : null}
                  </Stack>
                </Stack>
              </Stack>
            ) : (
              <Typography color="text.secondary">
                Select a configuration to inspect its evidence.
              </Typography>
            )}
          </Paper>
        </Stack>
      )}
      <Typography variant="caption" color="text.secondary">
        Last owner projection: {formatTime(workbench?.asOf)} · {workbench?.projectionVersion}
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

function referenceDataValue(fieldGroups?: Readonly<Record<string, unknown>>) {
  const field = fieldGroups?.REFERENCE_DATA as
    { decision?: unknown; value?: { code?: unknown } } | undefined;
  if (field?.decision !== 'VIEW' || typeof field.value?.code !== 'string') return undefined;
  return { code: field.value.code };
}

function formatTime(value?: string | null) {
  if (!value) return 'Open ended';
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString();
}
