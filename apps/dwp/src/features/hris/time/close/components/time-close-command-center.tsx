import {
  ActionButton,
  FormField,
  GuidedEmptyState,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { timeCloseCommandAllowed } from '../model/time-close-model';

import type { TimeCloseWorkspaceState } from '../hooks/use-time-close-workspace';
import type {
  PayrollTimeHandoffStatus,
  TimeCloseCommandKind,
  TimeCloseEntryMode,
  TimeClosePeriod,
} from '../model/time-close-model';

export type TimeCloseCommandCenterProps = Readonly<{
  entryMode: TimeCloseEntryMode;
  workspace: TimeCloseWorkspaceState;
  selectedPeriodId: string | null;
  filter: string;
  busy: boolean;
  commandDisabled: boolean;
  handoffId: string;
  handoff: PayrollTimeHandoffStatus | null;
  handoffBusy: boolean;
  canReadHandoff: boolean;
  onFilterChange: (value: string) => void;
  onSelect: (period: TimeClosePeriod) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onOpenCommand: (kind: TimeCloseCommandKind) => void;
  onHandoffIdChange: (value: string) => void;
  onReadHandoff: () => void;
}>;

const titles: Record<TimeCloseEntryMode, readonly [string, string]> = {
  COMMAND_CENTER: [
    'Time close command center',
    'Review periods, blockers, immutable receipts, and owner-authorized actions.',
  ],
  DAILY_CLOSE: [
    'Daily time close',
    'Validate daily periods and inspect the impact before a governed close or reopen.',
  ],
  MONTHLY_CLOSE: [
    'Monthly close and Payroll handoff',
    'Close a monthly period, preserve its result, and follow the typed Payroll handoff.',
  ],
};

function Fact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <Box minWidth={0}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
}

export function TimeCloseCommandCenter({
  entryMode,
  workspace,
  selectedPeriodId,
  filter,
  busy,
  commandDisabled,
  handoffId,
  handoff,
  handoffBusy,
  canReadHandoff,
  onFilterChange,
  onSelect,
  onRefresh,
  onLoadMore,
  onOpenCommand,
  onHandoffIdChange,
  onReadHandoff,
}: TimeCloseCommandCenterProps) {
  const [title, description] = titles[entryMode];
  const normalizedFilter = filter.trim().toLocaleLowerCase();
  const periods = workspace.periods.filter(
    (period) =>
      normalizedFilter.length === 0 ||
      `${period.title} ${period.statusCode} ${period.closeStatus ?? ''}`
        .toLocaleLowerCase()
        .includes(normalizedFilter)
  );
  const selected = workspace.periods.find((period) => period.periodId === selectedPeriodId) ?? null;

  return (
    <Stack
      gap={2.5}
      data-testid="time-close-command-center"
      data-responsive-breakpoints="1440 1280 390 320 200-percent"
      sx={{
        minWidth: 0,
        '@media (forced-colors: active)': {
          '& button:focus-visible, & input:focus-visible': { outline: '3px solid Highlight' },
        },
        '@media (prefers-reduced-motion: reduce)': {
          '&, & *': { scrollBehavior: 'auto', transition: 'none' },
        },
      }}
    >
      <Stack
        component="header"
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ md: 'flex-start' }}
        gap={2}
      >
        <Box minWidth={0}>
          <Typography component="h1" variant="h4">
            {title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            gap={0.75}
            sx={{ mt: 1.5 }}
            role="status"
            aria-live="polite"
          >
            <Chip size="small" label={`Freshness: ${workspace.freshness}`} />
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
              Snapshot: {workspace.asOf ?? 'not loaded'}
            </Typography>
          </Stack>
        </Box>
        <ActionButton intent="secondary" disabled={busy} onClick={onRefresh}>
          Refresh evidence
        </ActionButton>
      </Stack>

      {workspace.refreshFailure && workspace.kind !== 'ERROR' && (
        <InlineFeedback severity="warning" title="Latest refresh could not be verified">
          The last authorized snapshot remains visible as stale evidence. Commands stay bound to its
          version and may be disabled until a successful refresh.
        </InlineFeedback>
      )}
      {workspace.kind === 'PARTIAL' && (
        <InlineFeedback severity="warning" title="Some close evidence is unavailable">
          {workspace.failures.length > 0
            ? workspace.failures.map((failure) => failure.errorCode).join(' · ')
            : 'A refresh component failed. The verified period snapshot is preserved.'}
        </InlineFeedback>
      )}
      {workspace.kind === 'ERROR' && (
        <InlineFeedback severity="error" title="Time close evidence is unavailable">
          No prior period facts or actions are exposed for the current authority scope.
        </InlineFeedback>
      )}
      {workspace.kind === 'LOADING' && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <LoadingState label="Loading authorized time close evidence…" embedded />
        </Paper>
      )}
      {workspace.kind === 'EMPTY' && (
        <GuidedEmptyState
          kind="empty"
          size="compact"
          title="No close periods match this scope"
          description="The owner returned an explicit empty result. Adjust the authority scope or effective date outside this workbench."
        />
      )}

      {(workspace.kind === 'READY' || workspace.kind === 'PARTIAL') && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: 'minmax(0, 1.6fr) minmax(20rem, 1fr)',
            },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <Paper component="section" variant="outlined" sx={{ minWidth: 0, overflow: 'hidden' }}>
            <Stack gap={1.5} sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Typography component="h2" variant="h6">
                Periods
              </Typography>
              <FormField
                fullWidth
                size="small"
                label="Filter periods"
                value={filter}
                onChange={(event) => onFilterChange(event.target.value)}
                inputProps={{ maxLength: 120 }}
              />
            </Stack>
            <Divider />
            <Stack component="ul" gap={1} sx={{ listStyle: 'none', p: 1.5, m: 0 }}>
              {periods.map((period) => (
                <Box component="li" key={period.periodId} minWidth={0}>
                  <ActionButton
                    fullWidth
                    intent={period.periodId === selectedPeriodId ? 'primary' : 'secondary'}
                    aria-pressed={period.periodId === selectedPeriodId}
                    onClick={() => onSelect(period)}
                    sx={{
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      minHeight: 64,
                      gap: 1,
                      whiteSpace: 'normal',
                    }}
                  >
                    <Box minWidth={0}>
                      <Typography fontWeight="fontWeightBold" sx={{ overflowWrap: 'anywhere' }}>
                        {period.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {period.periodStart ?? 'masked'} — {period.periodEnd ?? 'open ended'} · v
                        {period.version ?? 'masked'}
                      </Typography>
                    </Box>
                    <Chip size="small" label={period.closeStatus ?? period.statusCode} />
                  </ActionButton>
                </Box>
              ))}
            </Stack>
            {workspace.nextCursor && (
              <Box sx={{ p: 1.5, pt: 0 }}>
                <ActionButton intent="secondary" disabled={busy} onClick={onLoadMore}>
                  Load more periods
                </ActionButton>
              </Box>
            )}
          </Paper>

          <Paper component="aside" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}>
            {selected ? (
              <Stack gap={2}>
                <Box>
                  <Typography component="h2" variant="h6">
                    {selected.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Owner facts are read-only. Commands create new immutable attempts and results.
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.5,
                  }}
                >
                  <Fact label="Period ID" value={selected.periodId} />
                  <Fact label="Aggregate version" value={String(selected.version ?? 'masked')} />
                  <Fact label="Close status" value={selected.closeStatus ?? selected.statusCode} />
                  <Fact label="Blockers" value={String(selected.blockerCount ?? 'masked')} />
                  <Fact label="Impact" value={String(selected.impactCount ?? 'masked')} />
                  <Fact
                    label="Command receipt"
                    value={selected.commandReceipt?.receiptId ?? 'none exposed'}
                  />
                </Box>
                {selected.blockerCount !== null && selected.blockerCount > 0 && (
                  <InlineFeedback severity="warning" title="Close is blocked">
                    Resolve {selected.blockerCount} blocker(s), then validate a fresh aggregate
                    version.
                  </InlineFeedback>
                )}
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} flexWrap="wrap">
                  {selected.actions.map((action) => {
                    const kind = {
                      'hris.action.tim.close.validate': 'VALIDATE',
                      'hris.action.tim.close.close': 'CLOSE',
                      'hris.action.tim.close.reopen': 'REOPEN',
                      'hris.action.tim.handoff.create': 'HANDOFF',
                    }[action.actionKey] as TimeCloseCommandKind;
                    return (
                      <ActionButton
                        key={kind}
                        intent={kind === 'CLOSE' ? 'primary' : 'secondary'}
                        disabled={
                          busy || commandDisabled || !timeCloseCommandAllowed(selected, kind)
                        }
                        onClick={() => onOpenCommand(kind)}
                      >
                        {
                          {
                            VALIDATE: 'Validate',
                            CLOSE: 'Close period',
                            REOPEN: 'Reopen',
                            HANDOFF: 'Create handoff',
                          }[kind]
                        }
                      </ActionButton>
                    );
                  })}
                </Stack>
                <Divider />
                <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
                  Payroll handoff status
                </Typography>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  gap={1}
                  alignItems={{ sm: 'flex-start' }}
                >
                  <FormField
                    fullWidth
                    size="small"
                    label="Handoff ID"
                    value={handoffId}
                    onChange={(event) => onHandoffIdChange(event.target.value.trim())}
                    inputProps={{ maxLength: 36 }}
                  />
                  <ActionButton
                    intent="secondary"
                    disabled={!canReadHandoff || handoffBusy || handoffId.length !== 36}
                    onClick={onReadHandoff}
                  >
                    Check status
                  </ActionButton>
                </Stack>
                {handoff && (
                  <Stack gap={1} role="status" aria-live="polite">
                    <Chip
                      label={handoff.status}
                      color={handoff.status === 'ACKNOWLEDGED' ? 'success' : 'default'}
                    />
                    <Fact label="Immutable result" value={handoff.closedTimeResultId} />
                    <Fact label="Close revision" value={String(handoff.closeRevision)} />
                    <Fact label="Payload digest" value={handoff.payloadDigest} />
                    <Fact label="Receiver receipt" value={handoff.receiverReceiptId ?? 'pending'} />
                    <Fact label="Outcome" value={handoff.outcomeAt ?? 'pending'} />
                  </Stack>
                )}
              </Stack>
            ) : (
              <GuidedEmptyState
                kind="no-results"
                size="compact"
                title="Select a period"
                description="Choose a period to inspect blockers, immutable receipt evidence, and allowed actions."
              />
            )}
          </Paper>
        </Box>
      )}
    </Stack>
  );
}
