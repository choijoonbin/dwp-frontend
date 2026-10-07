import {
  ActionButton,
  DetailInspector,
  GuidedEmptyState,
  InlineFeedback,
} from '@dwp-frontend/design-system';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import {
  receiptNeedsReconciliation,
  workPlanSimulationBlockers,
} from '../model/hris-time-work-plan-model';

import type {
  PolicyResolutionState,
  ReceiptStatus,
  WorkPlanDisplay,
  WorkPlanSimulationCommand,
  WorkPlanStudioDisplay,
} from '../model/hris-time-work-plan-model';

export type HrisTimeWorkPlanStudioProps = Readonly<{
  workspace: WorkPlanStudioDisplay;
  selectedWorkPlanId: string | null;
  simulationCommand?: WorkPlanSimulationCommand | null;
  simulationBusy?: boolean;
  simulationError?: string | null;
  onSelect: (workPlanId: string | null) => void;
  onSimulate?: (workPlan: WorkPlanDisplay) => void;
  onReconcileReceipt?: (receiptId: string) => void;
}>;

type WorkPlanCodeCategory =
  | 'arrangement'
  | 'assignmentFreshness'
  | 'blocker'
  | 'dstResolution'
  | 'impact'
  | 'lifecycle'
  | 'policyPack'
  | 'receiptStatus'
  | 'resolution'
  | 'simulationStatus'
  | 'traceDisposition';

function workPlanCodeKey(category: WorkPlanCodeCategory, value: string): string {
  return `hrisTime.workPlanStudio.codes.${category}.${value}`;
}

function policyResolutionMessageKey(state: Exclude<PolicyResolutionState, 'RESOLVED'>): string {
  return `hrisTime.workPlanStudio.policy.resolution.${state}`;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Box minWidth={0}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.25, overflowWrap: 'anywhere' }}>
        {value}
      </Typography>
    </Box>
  );
}

function QueryNotice({ workspace }: { workspace: WorkPlanStudioDisplay }) {
  const { t } = useTranslation('hcm');
  if (workspace.queryState === 'PARTIAL') {
    return (
      <InlineFeedback severity="warning" title={t('hrisTime.workPlanStudio.query.partialTitle')}>
        {t('hrisTime.workPlanStudio.query.partialDescription', {
          failures: workspace.partialFailures.join(' · '),
        })}
      </InlineFeedback>
    );
  }
  if (workspace.freshness === 'STALE') {
    return (
      <InlineFeedback severity="warning" title={t('hrisTime.workPlanStudio.query.staleTitle')}>
        {t('hrisTime.workPlanStudio.query.staleDescription')}
      </InlineFeedback>
    );
  }
  if (workspace.queryState === 'UNAVAILABLE' || workspace.freshness === 'UNAVAILABLE') {
    return (
      <InlineFeedback severity="error" title={t('hrisTime.workPlanStudio.query.unavailableTitle')}>
        {t('hrisTime.workPlanStudio.query.unavailableDescription')}
      </InlineFeedback>
    );
  }
  return null;
}

function CatalogTable({
  workPlans,
  selectedWorkPlanId,
  onSelect,
}: {
  workPlans: readonly WorkPlanDisplay[];
  selectedWorkPlanId: string | null;
  onSelect: (workPlanId: string) => void;
}) {
  const { t } = useTranslation('hcm');
  return (
    <TableContainer sx={{ display: { xs: 'none', md: 'block' }, maxHeight: 560 }}>
      <Table stickyHeader size="small" aria-label={t('hrisTime.workPlanStudio.catalog.ariaLabel')}>
        <TableHead>
          <TableRow>
            <TableCell>{t('hrisTime.workPlanStudio.catalog.workPlan')}</TableCell>
            <TableCell>{t('hrisTime.workPlanStudio.catalog.arrangement')}</TableCell>
            <TableCell>{t('hrisTime.workPlanStudio.catalog.effective')}</TableCell>
            <TableCell align="right">{t('hrisTime.workPlanStudio.catalog.review')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {workPlans.map((plan) => (
            <TableRow key={plan.workPlanId} selected={plan.workPlanId === selectedWorkPlanId}>
              <TableCell sx={{ minWidth: 180, maxWidth: 320 }}>
                <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                  {plan.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t(workPlanCodeKey('lifecycle', plan.lifecycle))}
                </Typography>
              </TableCell>
              <TableCell>{t(workPlanCodeKey('arrangement', plan.arrangement.kind))}</TableCell>
              <TableCell>
                {t('hrisTime.workPlanStudio.catalog.effectiveRange', {
                  start: plan.effectiveStart,
                  end: plan.effectiveEnd ?? t('hrisTime.workPlanStudio.catalog.openEnded'),
                })}
              </TableCell>
              <TableCell align="right">
                <ActionButton
                  intent="quiet"
                  size="small"
                  aria-label={t('hrisTime.workPlanStudio.catalog.reviewAriaLabel', {
                    title: plan.title,
                  })}
                  onClick={() => onSelect(plan.workPlanId)}
                >
                  {t('hrisTime.workPlanStudio.catalog.review')}
                </ActionButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function CatalogList({
  workPlans,
  selectedWorkPlanId,
  onSelect,
}: {
  workPlans: readonly WorkPlanDisplay[];
  selectedWorkPlanId: string | null;
  onSelect: (workPlanId: string) => void;
}) {
  const { t } = useTranslation('hcm');
  return (
    <Stack
      component="ul"
      gap={1}
      sx={{ display: { xs: 'flex', md: 'none' }, p: 1.5, m: 0, listStyle: 'none' }}
      aria-label={t('hrisTime.workPlanStudio.catalog.agendaAriaLabel')}
    >
      {workPlans.map((plan) => (
        <Paper component="li" variant="outlined" key={plan.workPlanId} sx={{ p: 1.5, minWidth: 0 }}>
          <Stack gap={1}>
            <Box minWidth={0}>
              <Typography component="h3" variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                {plan.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t(workPlanCodeKey('arrangement', plan.arrangement.kind))} · {plan.effectiveStart}
              </Typography>
            </Box>
            <ActionButton
              intent={plan.workPlanId === selectedWorkPlanId ? 'primary' : 'secondary'}
              size="small"
              aria-label={t('hrisTime.workPlanStudio.catalog.mobileReviewAriaLabel', {
                title: plan.title,
              })}
              onClick={() => onSelect(plan.workPlanId)}
            >
              {plan.workPlanId === selectedWorkPlanId
                ? t('hrisTime.workPlanStudio.catalog.selected')
                : t('hrisTime.workPlanStudio.catalog.review')}
            </ActionButton>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

function PolicyResolution({ plan }: { plan: WorkPlanDisplay }) {
  const { t } = useTranslation('hcm');
  const failed = plan.resolution.state !== 'RESOLVED' || plan.policyPack.state !== 'CURRENT';
  return (
    <Stack component="section" gap={1} aria-labelledby="work-plan-policy-title">
      <Typography component="h3" variant="subtitle2" id="work-plan-policy-title">
        {t('hrisTime.workPlanStudio.policy.title')}
      </Typography>
      {failed ? (
        <InlineFeedback
          severity="error"
          title={t('hrisTime.workPlanStudio.policy.cannotResolveTitle')}
        >
          {plan.resolution.state === 'RESOLVED'
            ? t('hrisTime.workPlanStudio.policy.packState', {
                state: t(workPlanCodeKey('policyPack', plan.policyPack.state)),
              })
            : t(policyResolutionMessageKey(plan.resolution.state))}
        </InlineFeedback>
      ) : (
        <InlineFeedback
          severity="success"
          title={t('hrisTime.workPlanStudio.policy.resolvedTitle')}
        >
          {t('hrisTime.workPlanStudio.policy.resolvedDescription', {
            jurisdiction: plan.policyPack.jurisdiction,
            revision: plan.policyPack.revision ?? t('hrisTime.workPlanStudio.policy.unavailable'),
            effectiveOn: plan.policyPack.effectiveOn,
          })}
        </InlineFeedback>
      )}
      <Stack component="ol" gap={0.75} sx={{ m: 0, pl: 2.5 }}>
        {plan.resolution.trace.map((step, index) => (
          <Box component="li" key={`${step.level}-${index}`} sx={{ pl: 0.5 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={0.5} alignItems={{ sm: 'center' }}>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                {step.label}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                color={step.disposition === 'APPLIED' ? 'success' : 'default'}
                label={t(workPlanCodeKey('traceDisposition', step.disposition))}
              />
            </Stack>
            {step.policyCode && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {t('hrisTime.workPlanStudio.policy.traceDescription', {
                  policyCode: step.policyCode,
                  revision: step.policyRevision ?? t('hrisTime.workPlanStudio.policy.unavailable'),
                })}
              </Typography>
            )}
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}

function ScheduleSegments({ plan }: { plan: WorkPlanDisplay }) {
  const { t } = useTranslation('hcm');
  return (
    <Stack component="section" gap={1} aria-labelledby="work-plan-schedule-title">
      <Box>
        <Typography component="h3" variant="subtitle2" id="work-plan-schedule-title">
          {t('hrisTime.workPlanStudio.schedule.title', { timeZone: plan.timeZone })}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('hrisTime.workPlanStudio.schedule.description')}
        </Typography>
      </Box>
      {plan.segments.length === 0 ? (
        <GuidedEmptyState
          kind="empty"
          size="compact"
          title={t('hrisTime.workPlanStudio.schedule.emptyTitle')}
          description={t('hrisTime.workPlanStudio.schedule.emptyDescription')}
        />
      ) : (
        <TableContainer>
          <Table size="small" aria-label={t('hrisTime.workPlanStudio.schedule.ariaLabel')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('hrisTime.workPlanStudio.schedule.segment')}</TableCell>
                <TableCell>{t('hrisTime.workPlanStudio.schedule.localStart')}</TableCell>
                <TableCell>{t('hrisTime.workPlanStudio.schedule.localEnd')}</TableCell>
                <TableCell>{t('hrisTime.workPlanStudio.schedule.dstOvernight')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {plan.segments.map((segment) => (
                <TableRow key={segment.segmentId}>
                  <TableCell sx={{ minWidth: 140, overflowWrap: 'anywhere' }}>
                    {segment.label}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {segment.localStart} ({segment.startOffset})
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {segment.localEnd} ({segment.endOffset})
                  </TableCell>
                  <TableCell>
                    {t(workPlanCodeKey('dstResolution', segment.dstResolution))}
                    {segment.overnight
                      ? ` · ${t('hrisTime.workPlanStudio.schedule.overnight')}`
                      : ''}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}

function ReceiptNotice({
  command,
  busy,
  onReconcile,
}: {
  command: WorkPlanSimulationCommand;
  busy: boolean;
  onReconcile?: (receiptId: string) => void;
}) {
  const { t } = useTranslation('hcm');
  const status: ReceiptStatus = command.receipt.status;
  const unsettled = receiptNeedsReconciliation(command.receipt);
  const severity =
    status === 'SUCCEEDED'
      ? 'success'
      : status === 'FAILED' || status === 'REJECTED'
        ? 'error'
        : status === 'RESULT_UNKNOWN'
          ? 'warning'
          : 'info';
  return (
    <InlineFeedback
      severity={severity}
      title={t('hrisTime.workPlanStudio.receipt.title', {
        status: t(workPlanCodeKey('receiptStatus', status)),
      })}
      action={
        unsettled && onReconcile ? (
          <ActionButton
            intent="quiet"
            size="small"
            loading={busy}
            onClick={() => onReconcile(command.receipt.receiptId)}
          >
            {t('hrisTime.workPlanStudio.receipt.reconcile')}
          </ActionButton>
        ) : undefined
      }
    >
      {status === 'RESULT_UNKNOWN'
        ? t('hrisTime.workPlanStudio.receipt.unknownOutcome')
        : t('hrisTime.workPlanStudio.receipt.lastUpdated', {
            updatedAt: command.receipt.updatedAt,
          })}
    </InlineFeedback>
  );
}

function SimulationImpact({ command }: { command: WorkPlanSimulationCommand }) {
  const { t } = useTranslation('hcm');
  const result = command.simulation;
  if (!result) return null;
  const incomplete = result.status !== 'COMPLETE';
  return (
    <Stack component="section" gap={1} aria-labelledby="simulation-impact-title">
      <Typography component="h3" variant="subtitle2" id="simulation-impact-title">
        {t('hrisTime.workPlanStudio.simulation.title')}
      </Typography>
      {incomplete && (
        <InlineFeedback
          severity="warning"
          title={t('hrisTime.workPlanStudio.simulation.statusTitle', {
            status: t(workPlanCodeKey('simulationStatus', result.status)),
          })}
        >
          {result.partialFailures.join(' · ') ||
            t('hrisTime.workPlanStudio.simulation.incompleteDescription')}
        </InlineFeedback>
      )}
      <TableContainer>
        <Table
          size="small"
          aria-label={t('hrisTime.workPlanStudio.simulation.differencesAriaLabel')}
        >
          <TableHead>
            <TableRow>
              <TableCell>{t('hrisTime.workPlanStudio.simulation.impact')}</TableCell>
              <TableCell>{t('hrisTime.workPlanStudio.simulation.current')}</TableCell>
              <TableCell>{t('hrisTime.workPlanStudio.simulation.draft')}</TableCell>
              <TableCell>{t('hrisTime.workPlanStudio.simulation.finding')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {result.rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell sx={{ minWidth: 140, overflowWrap: 'anywhere' }}>{row.label}</TableCell>
                <TableCell sx={{ overflowWrap: 'anywhere' }}>{row.currentValue}</TableCell>
                <TableCell sx={{ overflowWrap: 'anywhere' }}>{row.draftValue}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={
                      row.impact === 'BLOCKING'
                        ? 'error'
                        : row.impact === 'WARNING'
                          ? 'warning'
                          : 'default'
                    }
                    label={t(workPlanCodeKey('impact', row.impact))}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {result.findings.length > 0 && (
        <Stack component="ul" gap={0.5} sx={{ m: 0, pl: 2.5 }}>
          {result.findings.map((finding) => (
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
      )}
    </Stack>
  );
}

function WorkPlanDetail({
  workspace,
  plan,
  command,
  busy,
  error,
  onClose,
  onSimulate,
  onReconcileReceipt,
}: {
  workspace: WorkPlanStudioDisplay;
  plan: WorkPlanDisplay;
  command?: WorkPlanSimulationCommand | null;
  busy: boolean;
  error?: string | null;
  onClose: () => void;
  onSimulate?: (workPlan: WorkPlanDisplay) => void;
  onReconcileReceipt?: (receiptId: string) => void;
}) {
  const { t } = useTranslation('hcm');
  const blockers = workPlanSimulationBlockers(workspace, plan);
  const receiptPending = command ? receiptNeedsReconciliation(command.receipt) : false;
  const simulationDisabled = blockers.length > 0 || receiptPending || !onSimulate;
  return (
    <DetailInspector
      open
      variant="inline"
      title={plan.title}
      subtitle={t('hrisTime.workPlanStudio.detail.subtitle', {
        arrangement: t(workPlanCodeKey('arrangement', plan.arrangement.kind)),
        version: plan.version,
      })}
      closeLabel={t('hrisTime.workPlanStudio.detail.close')}
      onClose={onClose}
      status={
        <Chip
          size="small"
          variant="outlined"
          label={t(workPlanCodeKey('lifecycle', plan.lifecycle))}
        />
      }
      footer={
        <Stack gap={1}>
          <ActionButton
            intent="primary"
            loading={busy}
            disabled={simulationDisabled}
            onClick={() => onSimulate?.(plan)}
          >
            {t('hrisTime.workPlanStudio.detail.runSimulation')}
          </ActionButton>
          <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {t('hrisTime.workPlanStudio.detail.publishingNote')}
          </Typography>
        </Stack>
      }
    >
      <Stack gap={2} divider={<Divider flexItem />}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.5,
          }}
        >
          <Fact
            label={t('hrisTime.workPlanStudio.detail.effectivePeriod')}
            value={t('hrisTime.workPlanStudio.catalog.effectiveRange', {
              start: plan.effectiveStart,
              end: plan.effectiveEnd ?? t('hrisTime.workPlanStudio.catalog.openEnded'),
            })}
          />
          <Fact
            label={t('hrisTime.workPlanStudio.detail.assignment')}
            value={plan.assignment.label}
          />
          <Fact
            label={t('hrisTime.workPlanStudio.detail.assignmentSnapshot')}
            value={t('hrisTime.workPlanStudio.detail.assignmentSnapshotValue', {
              revision: plan.assignment.snapshotRevision,
              freshness: t(workPlanCodeKey('assignmentFreshness', plan.assignment.freshness)),
            })}
          />
          <Fact
            label={t('hrisTime.workPlanStudio.detail.scheduleTimeZone')}
            value={plan.timeZone}
          />
        </Box>
        <PolicyResolution plan={plan} />
        <ScheduleSegments plan={plan} />
        {blockers.length > 0 && (
          <InlineFeedback
            severity="warning"
            title={t('hrisTime.workPlanStudio.detail.blockedTitle')}
          >
            {blockers.map((blocker) => t(workPlanCodeKey('blocker', blocker))).join(' · ')}
          </InlineFeedback>
        )}
        {error && (
          <InlineFeedback
            severity="error"
            title={t('hrisTime.workPlanStudio.detail.commandNotAccepted')}
          >
            {error}
          </InlineFeedback>
        )}
        {command && (
          <ReceiptNotice command={command} busy={busy} onReconcile={onReconcileReceipt} />
        )}
        {command && command.simulation?.workPlanId === plan.workPlanId && (
          <SimulationImpact command={command} />
        )}
      </Stack>
    </DetailInspector>
  );
}

export function HrisTimeWorkPlanStudio({
  workspace,
  selectedWorkPlanId,
  simulationCommand,
  simulationBusy = false,
  simulationError,
  onSelect,
  onSimulate,
  onReconcileReceipt,
}: HrisTimeWorkPlanStudioProps) {
  const { t } = useTranslation('hcm');
  const selected = workspace.workPlans.find((plan) => plan.workPlanId === selectedWorkPlanId);
  if (workspace.queryState === 'EMPTY') {
    return (
      <GuidedEmptyState
        kind="empty"
        title={t('hrisTime.workPlanStudio.empty.noEffectiveTitle')}
        description={t('hrisTime.workPlanStudio.empty.noEffectiveDescription')}
      />
    );
  }
  return (
    <Stack gap={1.5}>
      <QueryNotice workspace={workspace} />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            md: 'minmax(320px, 0.9fr) minmax(0, 1.1fr)',
          },
          gap: 1.5,
          alignItems: 'start',
        }}
      >
        <Paper variant="outlined" sx={{ minWidth: 0, overflow: 'hidden' }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            gap={1}
            justifyContent="space-between"
            sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}
          >
            <Box minWidth={0}>
              <Typography component="h2" variant="subtitle1">
                {t('hrisTime.workPlanStudio.catalog.title')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('hrisTime.workPlanStudio.catalog.effectiveAsOf', { asOf: workspace.asOf })}
              </Typography>
            </Box>
            <Chip
              size="small"
              variant="outlined"
              label={t('hrisTime.workPlanStudio.catalog.planCount', {
                count: workspace.workPlans.length,
              })}
            />
          </Stack>
          <CatalogTable
            workPlans={workspace.workPlans}
            selectedWorkPlanId={selectedWorkPlanId}
            onSelect={onSelect}
          />
          <CatalogList
            workPlans={workspace.workPlans}
            selectedWorkPlanId={selectedWorkPlanId}
            onSelect={onSelect}
          />
        </Paper>
        {selected ? (
          <Paper variant="outlined" sx={{ minWidth: 0, overflow: 'hidden' }}>
            <WorkPlanDetail
              workspace={workspace}
              plan={selected}
              command={simulationCommand}
              busy={simulationBusy}
              error={simulationError}
              onClose={() => onSelect(null)}
              onSimulate={onSimulate}
              onReconcileReceipt={onReconcileReceipt}
            />
          </Paper>
        ) : (
          <GuidedEmptyState
            kind="first-use"
            title={t('hrisTime.workPlanStudio.empty.chooseTitle')}
            description={t('hrisTime.workPlanStudio.empty.chooseDescription')}
          />
        )}
      </Box>
    </Stack>
  );
}
