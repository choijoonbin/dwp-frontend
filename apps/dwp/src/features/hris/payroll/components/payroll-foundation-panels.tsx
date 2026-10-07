import { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, History, RefreshCw } from 'lucide-react';
import { ActionButton, EmptyState, InlineFeedback } from '@dwp-frontend/design-system';
import { formatCivilDate, formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { foundationCopyValue } from '../model/payroll-foundation-copy';

import type {
  FoundationCommandFailure,
  FoundationCommandReceipt,
  PayrollFoundationConfiguration,
} from '../model/payroll-foundation-model';
import type { PayrollFoundationCopy } from '../model/payroll-foundation-copy';

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.5} justifyContent="space-between">
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" textAlign={{ sm: 'right' }} sx={{ overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Stack>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper component="section" variant="outlined" sx={{ p: 2, minWidth: 0 }}>
      <Typography component="h3" variant="subtitle1" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      <Stack gap={1}>{children}</Stack>
    </Paper>
  );
}

export function PayrollFoundationDetail({
  configuration,
  versions,
  versionsError,
  copy,
}: {
  configuration: PayrollFoundationConfiguration;
  versions: readonly PayrollFoundationConfiguration[];
  versionsError: unknown;
  copy: PayrollFoundationCopy;
}) {
  const { definition, simulation } = configuration;
  const simulationStale = Boolean(
    simulation && simulation.configurationVersion !== configuration.version
  );
  return (
    <Stack gap={1.5} data-testid="payroll-foundation-detail">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        <DetailSection title={copy.legalEntity}>
          <Fact label={copy.entityName} value={definition.legalEntity.displayName} />
          <Fact label={copy.entityCode} value={definition.legalEntity.code} />
          <Fact
            label={copy.countryPack}
            value={`${definition.legalEntity.countryPack.packId} · ${foundationCopyValue(
              copy.versionLabel,
              { version: definition.legalEntity.countryPack.version }
            )}`}
          />
        </DetailSection>
        <DetailSection title={copy.payrollGroup}>
          <Fact label={copy.groupCode} value={definition.payrollGroup.code} />
          <Fact
            label={copy.supportedCurrencies}
            value={definition.payrollGroup.currencies.join(', ')}
          />
          <Fact
            label={copy.settlementCurrency}
            value={definition.payrollGroup.settlementCurrency}
          />
        </DetailSection>
        <DetailSection title={copy.calendar}>
          <Fact label={copy.cadence} value={definition.payCalendar.cadence} />
          <Fact
            label={copy.effectivePeriod}
            value={`${formatCivilDate(definition.effectivePeriod.startsOn, { dateStyle: 'medium' })} — ${
              definition.effectivePeriod.endsOn
                ? formatCivilDate(definition.effectivePeriod.endsOn, { dateStyle: 'medium' })
                : copy.openEnded
            }`}
          />
          <Divider />
          {definition.payCalendar.periods.map((period) => (
            <Box key={period.code} sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                {period.code}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {formatCivilDate(period.startsOn, { dateStyle: 'medium' })} —{' '}
                {formatCivilDate(period.endsOn, { dateStyle: 'medium' })} · {copy.paymentDate}:{' '}
                {formatCivilDate(period.paymentDate, { dateStyle: 'medium' })}
              </Typography>
            </Box>
          ))}
        </DetailSection>
        <DetailSection title={copy.currency}>
          {Object.entries(definition.roundingPolicies).map(([currency, policy]) => (
            <Fact
              key={currency}
              label={currency}
              value={`${policy.increment} · scale ${policy.scale} · ${policy.mode}`}
            />
          ))}
        </DetailSection>
        <DetailSection title={copy.dependencies}>
          {definition.dependencies.length ? (
            definition.dependencies.map((dependency) => (
              <Box key={`${dependency.owner}:${dependency.resourceId}`} sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                  {dependency.owner}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {`${dependency.resourceId} · ${foundationCopyValue(copy.versionLabel, {
                    version: dependency.version,
                  })}`}
                </Typography>
              </Box>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              {copy.noDependencies}
            </Typography>
          )}
        </DetailSection>
        <DetailSection title={copy.simulation}>
          {!simulation ? (
            <Typography variant="body2" color="text.secondary">
              {copy.simulationNotRun}
            </Typography>
          ) : (
            <>
              <InlineFeedback
                severity={simulation.successful && !simulationStale ? 'success' : 'warning'}
                icon={
                  simulation.successful && !simulationStale ? (
                    <CheckCircle2 size={17} aria-hidden="true" />
                  ) : (
                    <AlertTriangle size={17} aria-hidden="true" />
                  )
                }
              >
                {simulationStale
                  ? copy.simulationStale
                  : simulation.successful
                    ? copy.simulationPassed
                    : copy.simulationFailed}
              </InlineFeedback>
              <Fact
                label={copy.version}
                value={foundationCopyValue(copy.versionLabel, {
                  version: simulation.configurationVersion,
                })}
              />
              <Fact
                label={copy.updated}
                value={formatDate(simulation.simulatedAt, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              />
              {simulation.findings.length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {copy.findings}
                  </Typography>
                  <Stack component="ul" gap={0.5} sx={{ pl: 2.5, mb: 0 }}>
                    {simulation.findings.map((finding) => (
                      <Typography
                        component="li"
                        variant="body2"
                        key={finding}
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {finding}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              )}
            </>
          )}
        </DetailSection>
      </Box>

      <Paper component="section" variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 1.25 }}>
          <History size={18} aria-hidden="true" />
          <Typography component="h3" variant="subtitle1">
            {copy.versions}
          </Typography>
        </Stack>
        {versionsError ? (
          <Typography variant="body2" color="text.secondary">
            {copy.versionsUnavailable}
          </Typography>
        ) : versions.length ? (
          <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap>
            {versions.map((version) => (
              <Chip
                key={`${version.id}:${version.version}`}
                size="small"
                variant={version.version === configuration.version ? 'filled' : 'outlined'}
                label={`${foundationCopyValue(copy.versionLabel, {
                  version: version.version,
                })} · ${version.status}`}
              />
            ))}
          </Stack>
        ) : (
          <Chip
            size="small"
            label={`${foundationCopyValue(copy.versionLabel, {
              version: configuration.version,
            })} · ${configuration.status}`}
          />
        )}
      </Paper>
    </Stack>
  );
}

export function FoundationCommandNotice({
  receipt,
  failure,
  copy,
  busy,
  canReconcile,
  onRefresh,
  onCheck,
  onReconcile,
}: {
  receipt: FoundationCommandReceipt | null;
  failure: FoundationCommandFailure | null;
  copy: PayrollFoundationCopy;
  busy: boolean;
  canReconcile: boolean;
  onRefresh: () => void;
  onCheck: () => void;
  onReconcile: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (receipt || failure) panelRef.current?.focus({ preventScroll: true });
  }, [failure, receipt]);
  if (!receipt && !failure) return null;

  let title: string = copy.commandFailedTitle;
  let description: string = copy.commandFailedDescription;
  let severity: 'success' | 'info' | 'warning' | 'error' = 'error';
  if (receipt?.status === 'SUCCEEDED') {
    title = copy.commandSucceeded;
    description = copy.commandSucceeded;
    severity = 'success';
  } else if (receipt?.status === 'PENDING') {
    title = copy.commandPending;
    description = copy.commandPending;
    severity = 'info';
  } else if (receipt?.status === 'RESULT_UNKNOWN' || failure?.kind === 'RESULT_UNKNOWN') {
    title = copy.resultUnknownTitle;
    description = copy.resultUnknownDescription;
    severity = 'warning';
  } else if (receipt?.status === 'REVERSAL_FAILED') {
    title = copy.reversalFailedTitle;
    description = copy.reversalFailedDescription;
  } else if (failure?.kind === 'CONFLICT') {
    title = copy.conflictTitle;
    description = copy.conflictDescription;
    severity = 'warning';
  } else if (failure?.kind === 'PERMISSION') {
    title = copy.deniedTitle;
    description = copy.deniedDescription;
  }

  const uncertain = receipt?.status === 'PENDING' || receipt?.status === 'RESULT_UNKNOWN';
  return (
    <Box ref={panelRef} tabIndex={-1} data-command-state={receipt?.status ?? failure?.kind}>
      <InlineFeedback
        severity={severity}
        title={title}
        action={
          <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap>
            {failure?.kind === 'CONFLICT' && (
              <ActionButton
                intent="quiet"
                size="small"
                loading={busy}
                startIcon={<RefreshCw size={14} aria-hidden="true" />}
                onClick={onRefresh}
              >
                {copy.refresh}
              </ActionButton>
            )}
            {uncertain && (
              <ActionButton intent="quiet" size="small" loading={busy} onClick={onCheck}>
                {copy.checkReceipt}
              </ActionButton>
            )}
            {uncertain && canReconcile && (
              <ActionButton intent="secondary" size="small" loading={busy} onClick={onReconcile}>
                {copy.reconcile}
              </ActionButton>
            )}
          </Stack>
        }
      >
        <Typography variant="body2">{description}</Typography>
        {receipt && (
          <Stack gap={0.25} sx={{ mt: 1 }}>
            <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
              {copy.receiptId}: {receipt.commandId}
            </Typography>
            <Typography variant="caption">
              {copy.commandStatus}: {receipt.status}
            </Typography>
          </Stack>
        )}
      </InlineFeedback>
    </Box>
  );
}

export function FoundationEmpty({ copy }: { copy: PayrollFoundationCopy }) {
  return <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />;
}
