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
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('hcm');
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
            <Chip
              size="small"
              label={t('hrisTime.i18nClosure.close.center.freshness', {
                value: workspace.freshness,
              })}
            />
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
              {t('hrisTime.i18nClosure.close.center.snapshot', {
                value: workspace.asOf ?? t('hrisTime.i18nClosure.common.notLoaded'),
              })}
            </Typography>
          </Stack>
        </Box>
        <ActionButton intent="secondary" disabled={busy} onClick={onRefresh}>
          {t('hrisTime.i18nClosure.close.center.refreshEvidence')}
        </ActionButton>
      </Stack>

      {workspace.refreshFailure && workspace.kind !== 'ERROR' && (
        <InlineFeedback
          severity="warning"
          title={t('hrisTime.i18nClosure.close.center.refreshFailedTitle')}
        >
          {t('hrisTime.i18nClosure.close.center.refreshFailedDescription')}
        </InlineFeedback>
      )}
      {workspace.kind === 'PARTIAL' && (
        <InlineFeedback
          severity="warning"
          title={t('hrisTime.i18nClosure.close.center.partialTitle')}
        >
          {workspace.failures.length > 0
            ? workspace.failures.map((failure) => failure.errorCode).join(' · ')
            : t('hrisTime.i18nClosure.close.center.partialDescription')}
        </InlineFeedback>
      )}
      {workspace.kind === 'ERROR' && (
        <InlineFeedback
          severity="error"
          title={t('hrisTime.i18nClosure.close.center.unavailableTitle')}
        >
          {t('hrisTime.i18nClosure.close.center.unavailableDescription')}
        </InlineFeedback>
      )}
      {workspace.kind === 'LOADING' && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <LoadingState label={t('hrisTime.i18nClosure.close.center.loading')} embedded />
        </Paper>
      )}
      {workspace.kind === 'EMPTY' && (
        <GuidedEmptyState
          kind="empty"
          size="compact"
          title={t('hrisTime.i18nClosure.close.center.emptyTitle')}
          description={t('hrisTime.i18nClosure.close.center.emptyDescription')}
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
                {t('hrisTime.i18nClosure.close.center.periods')}
              </Typography>
              <FormField
                fullWidth
                size="small"
                label={t('hrisTime.i18nClosure.close.center.filterPeriods')}
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
                        {t('hrisTime.i18nClosure.close.center.periodMeta', {
                          start: period.periodStart ?? t('hrisTime.i18nClosure.common.masked'),
                          end: period.periodEnd ?? t('hrisTime.i18nClosure.common.openEnded'),
                          version: period.version ?? t('hrisTime.i18nClosure.common.masked'),
                        })}
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
                  {t('hrisTime.i18nClosure.close.center.loadMore')}
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
                    {t('hrisTime.i18nClosure.close.center.ownerFacts')}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.5,
                  }}
                >
                  <Fact
                    label={t('hrisTime.i18nClosure.close.center.periodId')}
                    value={selected.periodId}
                  />
                  <Fact
                    label={t('hrisTime.i18nClosure.close.center.aggregateVersion')}
                    value={String(selected.version ?? t('hrisTime.i18nClosure.common.masked'))}
                  />
                  <Fact
                    label={t('hrisTime.i18nClosure.close.center.closeStatus')}
                    value={selected.closeStatus ?? selected.statusCode}
                  />
                  <Fact
                    label={t('hrisTime.i18nClosure.close.center.blockers')}
                    value={String(selected.blockerCount ?? t('hrisTime.i18nClosure.common.masked'))}
                  />
                  <Fact
                    label={t('hrisTime.i18nClosure.close.center.impact')}
                    value={String(selected.impactCount ?? t('hrisTime.i18nClosure.common.masked'))}
                  />
                  <Fact
                    label={t('hrisTime.i18nClosure.close.center.commandReceipt')}
                    value={
                      selected.commandReceipt?.receiptId ??
                      t('hrisTime.i18nClosure.common.noneExposed')
                    }
                  />
                </Box>
                {selected.blockerCount !== null && selected.blockerCount > 0 && (
                  <InlineFeedback
                    severity="warning"
                    title={t('hrisTime.i18nClosure.close.center.blockedTitle')}
                  >
                    {t('hrisTime.i18nClosure.close.center.blockedDescription', {
                      count: selected.blockerCount,
                    })}
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
                            VALIDATE: t('hrisTime.i18nClosure.close.center.validate'),
                            CLOSE: t('hrisTime.i18nClosure.close.center.closePeriod'),
                            REOPEN: t('hrisTime.i18nClosure.close.center.reopen'),
                            HANDOFF: t('hrisTime.i18nClosure.close.center.createHandoff'),
                          }[kind]
                        }
                      </ActionButton>
                    );
                  })}
                </Stack>
                <Divider />
                <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
                  {t('hrisTime.i18nClosure.close.center.payrollHandoffStatus')}
                </Typography>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  gap={1}
                  alignItems={{ sm: 'flex-start' }}
                >
                  <FormField
                    fullWidth
                    size="small"
                    label={t('hrisTime.i18nClosure.close.center.handoffId')}
                    value={handoffId}
                    onChange={(event) => onHandoffIdChange(event.target.value.trim())}
                    inputProps={{ maxLength: 36 }}
                  />
                  <ActionButton
                    intent="secondary"
                    disabled={!canReadHandoff || handoffBusy || handoffId.length !== 36}
                    onClick={onReadHandoff}
                  >
                    {t('hrisTime.i18nClosure.close.center.checkStatus')}
                  </ActionButton>
                </Stack>
                {handoff && (
                  <Stack gap={1} role="status" aria-live="polite">
                    <Chip
                      label={handoff.status}
                      color={handoff.status === 'ACKNOWLEDGED' ? 'success' : 'default'}
                    />
                    <Fact
                      label={t('hrisTime.i18nClosure.close.center.immutableResult')}
                      value={handoff.closedTimeResultId}
                    />
                    <Fact
                      label={t('hrisTime.i18nClosure.close.center.closeRevision')}
                      value={String(handoff.closeRevision)}
                    />
                    <Fact
                      label={t('hrisTime.i18nClosure.close.center.payloadDigest')}
                      value={handoff.payloadDigest}
                    />
                    <Fact
                      label={t('hrisTime.i18nClosure.close.center.receiverReceipt')}
                      value={handoff.receiverReceiptId ?? t('hrisTime.i18nClosure.common.pending')}
                    />
                    <Fact
                      label={t('hrisTime.i18nClosure.close.center.outcome')}
                      value={handoff.outcomeAt ?? t('hrisTime.i18nClosure.common.pending')}
                    />
                  </Stack>
                )}
              </Stack>
            ) : (
              <GuidedEmptyState
                kind="no-results"
                size="compact"
                title={t('hrisTime.i18nClosure.close.center.selectPeriodTitle')}
                description={t('hrisTime.i18nClosure.close.center.selectPeriodDescription')}
              />
            )}
          </Paper>
        </Box>
      )}
    </Stack>
  );
}
