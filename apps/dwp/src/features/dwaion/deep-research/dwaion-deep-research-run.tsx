import {
  ArrowLeft,
  Ban,
  Clock3,
  FileOutput,
  Pause,
  Play,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react';
import {
  ActionButton,
  EmptyState,
  InlineFeedback,
  foundationTokens,
} from '@dwp-frontend/design-system';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { deepResearchCopy } from './dwaion-deep-research-copy';
import {
  dwaionResearchProgressPercent,
  dwaionResearchRunCanDeliver,
} from './dwaion-deep-research-model';

import type {
  DwaionResearchCommand,
  DwaionResearchDelivery,
  DwaionResearchDeliveryType,
  DwaionResearchPlan,
  DwaionResearchRun,
} from '@dwp-frontend/shared-utils';

const DELIVERY_TYPES: readonly DwaionResearchDeliveryType[] = [
  'ARTIFACT',
  'PROPOSAL',
  'EXPORT',
  'HANDOFF',
  'SHARE',
  'ROUTINE',
];

export function DwaionDeepResearchRun({
  locale,
  plan,
  run,
  deliveries,
  busy,
  operationError,
  onRefresh,
  onCommand,
  onDeliver,
  onExit,
}: {
  locale: 'ko' | 'en';
  plan: DwaionResearchPlan | null;
  run: DwaionResearchRun;
  deliveries: readonly DwaionResearchDelivery[];
  busy: string | null;
  operationError: boolean;
  onRefresh: () => void;
  onCommand: (command: DwaionResearchCommand, sourceKey?: string) => void;
  onDeliver: (type: DwaionResearchDeliveryType) => void;
  onExit: () => void;
}) {
  const copy = deepResearchCopy(locale);
  const percent = dwaionResearchProgressPercent(
    run.progress.completedSteps,
    run.progress.totalSteps
  );
  const failedSource = run.progress.failedSources[0];
  const active = ['QUEUED', 'RUNNING', 'CANCELLING'].includes(run.state);
  const warning = ['PARTIAL', 'CONFLICT', 'FAILED'].includes(run.state);

  return (
    <Stack gap={2} data-testid="dwaion-deep-research-run">
      <Box
        sx={{
          p: { xs: 1.5, sm: 2.5 },
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: foundationTokens.radius.surface + 'px',
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.5}>
          <Box sx={{ minWidth: 0 }}>
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<ArrowLeft size={16} />}
              onClick={onExit}
            >
              {copy.back}
            </ActionButton>
            <Stack direction="row" gap={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
              <Chip
                size="small"
                color={run.state === 'COMPLETED' ? 'success' : warning ? 'warning' : 'primary'}
                label={copy.states[run.state]}
              />
              <Chip size="small" variant="outlined" label={`${copy.runId} · ${run.runId}`} />
            </Stack>
            <Typography component="h1" variant="h4" sx={{ mt: 1, overflowWrap: 'anywhere' }}>
              {plan?.definition.goal ?? copy.runTitle}
            </Typography>
            {plan ? (
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {plan.definition.question}
              </Typography>
            ) : null}
          </Box>
          <ActionButton
            intent="secondary"
            startIcon={<RefreshCcw size={16} />}
            disabled={Boolean(busy)}
            onClick={onRefresh}
          >
            {copy.retry}
          </ActionButton>
        </Stack>
      </Box>

      {operationError ? (
        <InlineFeedback severity="error">{copy.operationFailed}</InlineFeedback>
      ) : null}
      {warning ? (
        <InlineFeedback
          severity={run.state === 'FAILED' ? 'error' : 'warning'}
          title={copy.states[run.state]}
        >
          {run.safeErrorCode ? `${run.safeErrorCode}. ` : ''}
          {run.progress.recoveryHint ?? copy.operationFailed}
        </InlineFeedback>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: 'minmax(230px, 0.65fr) minmax(0, 1.45fr) minmax(260px, 0.75fr)',
          },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Stack gap={2}>
          <Panel title={copy.runTitle}>
            <Stack direction="row" justifyContent="space-between" gap={1}>
              <Typography variant="body2" color="text.secondary">
                {copy.steps}
              </Typography>
              <Typography variant="subtitle2">
                {run.progress.completedSteps}/{run.progress.totalSteps} · {percent}%
              </Typography>
            </Stack>
            <LinearProgress
              variant={active ? undefined : 'determinate'}
              value={percent}
              sx={{ mt: 1, height: 8, borderRadius: 999 }}
            />
            <Metric
              label={copy.discovered}
              value={formatNumber(run.progress.discoveredSources, undefined, locale)}
            />
            <Metric
              label={copy.verified}
              value={formatNumber(run.progress.verifiedCitations, undefined, locale)}
            />
            {run.startedAt ? (
              <Metric
                label="Started"
                value={formatDate(
                  run.startedAt,
                  { dateStyle: 'medium', timeStyle: 'short' },
                  locale
                )}
              />
            ) : null}
          </Panel>
          {run.progress.failedSources.length ? (
            <Panel title={copy.failedSources}>
              <Stack gap={0.75}>
                {run.progress.failedSources.map((source) => (
                  <Chip key={source} color="warning" variant="outlined" label={source} />
                ))}
              </Stack>
              {run.progress.recoveryHint ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {copy.recovery}: {run.progress.recoveryHint}
                </Typography>
              ) : null}
            </Panel>
          ) : null}
        </Stack>

        <Stack gap={2}>
          <Panel title={run.state === 'COMPLETED' ? copy.report : copy.runTitle}>
            {run.result ? (
              <Typography
                component="div"
                variant="body2"
                sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, overflowWrap: 'anywhere' }}
              >
                {run.result.reportMarkdown}
              </Typography>
            ) : (
              <Box sx={{ py: 3, textAlign: 'center' }}>
                <Clock3 size={28} aria-hidden="true" />
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  {copy.loading}
                </Typography>
              </Box>
            )}
          </Panel>
          <Panel title={copy.evidence}>
            {run.result?.citations.length ? (
              <Stack gap={1}>
                {run.result.citations.map((citation) => (
                  <Box
                    key={citation.citationId}
                    sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: 1 }}
                  >
                    <Typography variant="subtitle2">{citation.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {citation.locator} · SHA-256 {citation.contentSha256.slice(0, 12)}…
                    </Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <EmptyState title={copy.noEvidence} />
            )}
          </Panel>
        </Stack>

        <Stack gap={2} sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
          <Panel title={copy.recovery}>
            <Stack gap={0.75}>
              {run.state === 'RUNNING' ? (
                <ActionButton
                  intent="secondary"
                  startIcon={<Pause size={16} />}
                  loading={busy === 'PAUSE'}
                  onClick={() => onCommand('PAUSE')}
                >
                  {copy.pause}
                </ActionButton>
              ) : null}
              {run.state === 'PAUSED' ? (
                <ActionButton
                  intent="primary"
                  startIcon={<Play size={16} />}
                  loading={busy === 'RESUME'}
                  onClick={() => onCommand('RESUME')}
                >
                  {copy.resume}
                </ActionButton>
              ) : null}
              {failedSource && ['PARTIAL', 'CONFLICT', 'PAUSED'].includes(run.state) ? (
                <>
                  <ActionButton
                    intent="primary"
                    startIcon={<ShieldCheck size={16} />}
                    loading={busy === 'EXCLUDE_SOURCE_AND_CONTINUE'}
                    onClick={() => onCommand('EXCLUDE_SOURCE_AND_CONTINUE', failedSource)}
                  >
                    {copy.exclude}
                  </ActionButton>
                  <ActionButton
                    intent="secondary"
                    startIcon={<RefreshCcw size={16} />}
                    loading={busy === 'REPROBE_SOURCE'}
                    onClick={() => onCommand('REPROBE_SOURCE', failedSource)}
                  >
                    {copy.reprobe}
                  </ActionButton>
                </>
              ) : null}
              {['RUNNING', 'PAUSED', 'PARTIAL', 'CONFLICT'].includes(run.state) ? (
                <ActionButton
                  intent="secondary"
                  loading={busy === 'EXTEND'}
                  onClick={() => onCommand('EXTEND')}
                >
                  {copy.extend}
                </ActionButton>
              ) : null}
              {['QUEUED', 'RUNNING', 'PAUSED', 'PARTIAL', 'CONFLICT'].includes(run.state) ? (
                <ActionButton
                  intent="danger"
                  startIcon={<Ban size={16} />}
                  loading={busy === 'SAFE_CANCEL'}
                  onClick={() => onCommand('SAFE_CANCEL')}
                >
                  {copy.cancel}
                </ActionButton>
              ) : null}
            </Stack>
          </Panel>
          <Panel title={copy.outputs}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {copy.outputHint}
            </Typography>
            <Stack gap={0.75}>
              {DELIVERY_TYPES.map((type) => (
                <ActionButton
                  key={type}
                  intent={type === 'ARTIFACT' ? 'primary' : 'secondary'}
                  startIcon={<FileOutput size={16} />}
                  disabled={!dwaionResearchRunCanDeliver(run.state)}
                  loading={busy === `DELIVER_${type}`}
                  onClick={() => onDeliver(type)}
                >
                  {copy.deliveryLabels[type]}
                </ActionButton>
              ))}
            </Stack>
          </Panel>
          {run.receiptId ? (
            <Receipt title={copy.receipt} receiptId={run.receiptId} />
          ) : (
            <InlineFeedback severity="info">{copy.noReceipt}</InlineFeedback>
          )}
          {deliveries.map((delivery) => (
            <Receipt
              key={delivery.deliveryId}
              title={`${copy.deliveryLabels[delivery.deliveryType]} · ${delivery.state}`}
              receiptId={delivery.receiptId}
            />
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box
      component="section"
      sx={{
        p: { xs: 1.5, sm: 2 },
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.surface + 'px',
      }}
    >
      <Typography component="h2" variant="h6" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" gap={1} sx={{ mt: 1.25 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight="fontWeightBold">
        {value}
      </Typography>
    </Stack>
  );
}

function Receipt({ title, receiptId }: { title: string; receiptId: string | null }) {
  return (
    <Box
      sx={{
        p: 1.5,
        bgcolor: 'success.50',
        border: 1,
        borderColor: receiptId ? 'success.light' : 'divider',
        borderRadius: 1,
      }}
    >
      <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <ShieldCheck size={16} aria-hidden="true" />
        {title}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mt: 0.5, overflowWrap: 'anywhere' }}
      >
        {receiptId ?? '—'}
      </Typography>
    </Box>
  );
}
