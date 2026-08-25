import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  FileLock2,
  GitCompareArrows,
  Layers3,
  MoveRight,
  SearchCheck,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { formatNumber, useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import { ActionButton } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import type {
  OrganizationChangeInsight,
  OrganizationDataQualityIssue,
  OrganizationHealthInsight,
  OrganizationIntelligence,
} from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';
import type { OrgChartSelection } from './org-chart-inspector';

export type OrganizationIntelligenceView = 'health' | 'changes' | 'quality';

type Props = {
  intelligence?: OrganizationIntelligence;
  loading: boolean;
  error?: string;
  view: OrganizationIntelligenceView;
  onViewChange: (view: OrganizationIntelligenceView) => void;
  onSelect: (selection: OrgChartSelection) => void;
  onRequestExport?: () => void;
};

type MetricProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: string;
};

const riskTone = {
  HEALTHY: '#16815F',
  ATTENTION: '#B7791F',
  CRITICAL: '#C2412D',
} as const;

function IntelligenceMetric({ icon: Icon, label, value, tone }: MetricProps) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={1}
      sx={{ minWidth: 150, px: 2, py: 1.25, borderRight: 1, borderColor: 'divider' }}
    >
      <Icon size={17} color={tone} strokeWidth={1.8} aria-hidden />
      <Box>
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
        <Typography variant="subtitle2" fontWeight={750}>
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}

function riskColor(state: string): 'success' | 'warning' | 'error' | 'default' {
  if (state === 'HEALTHY') return 'success';
  if (state === 'ATTENTION' || state === 'MEDIUM') return 'warning';
  if (state === 'CRITICAL' || state === 'HIGH') return 'error';
  return 'default';
}

function signed(value: number, fractionDigits = 0): string {
  return formatNumber(value, {
    signDisplay: 'always',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatCost(value: number, currency?: string | null): string {
  return formatNumber(value, {
    style: currency && currency !== 'MIXED' ? 'currency' : 'decimal',
    currency: currency && currency !== 'MIXED' ? currency : undefined,
    notation: 'compact',
    maximumFractionDigits: 1,
    signDisplay: 'always',
  });
}

export function OrganizationIntelligencePanel({
  intelligence,
  loading,
  error,
  view,
  onViewChange,
  onSelect,
  onRequestExport,
}: Props) {
  const { t } = useTranslation('workforce');

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 360 }} gap={1}>
        <LinearProgress sx={{ width: 220 }} />
        <Typography variant="body2" color="text.secondary">
          {t('orgChart.intelligence.loading')}
        </Typography>
      </Stack>
    );
  }

  if (error || !intelligence) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error || t('common.operationError')}</Alert>
      </Box>
    );
  }

  const delta = intelligence.comparison;
  const health = intelligence.health;

  return (
    <Box sx={{ height: 1, overflow: 'auto', bgcolor: 'background.paper' }}>
      <Box
        role="region"
        tabIndex={0}
        aria-label={t('orgChart.metrics.summaryLabel')}
        sx={{ overflowX: 'auto', borderBottom: 1, borderColor: 'divider' }}
      >
        <Stack direction="row" sx={{ minWidth: 'max-content' }}>
          <IntelligenceMetric
            icon={ShieldCheck}
            label={t('orgChart.intelligence.metrics.health')}
            value={`${health.organizationHealthScore}%`}
            tone={health.organizationHealthScore >= 80 ? '#16815F' : '#B7791F'}
          />
          <IntelligenceMetric
            icon={SearchCheck}
            label={t('orgChart.intelligence.metrics.quality')}
            value={`${health.dataQualityScore}%`}
            tone={health.dataQualityScore >= 90 ? '#16815F' : '#C2412D'}
          />
          <IntelligenceMetric
            icon={AlertTriangle}
            label={t('orgChart.intelligence.metrics.critical')}
            value={formatNumber(health.criticalOrganizations)}
            tone="#C2412D"
          />
          <IntelligenceMetric
            icon={Layers3}
            label={t('orgChart.intelligence.metrics.layers')}
            value={formatNumber(health.maximumLayers)}
            tone="#6D5BD0"
          />
          <IntelligenceMetric
            icon={UsersRound}
            label={t('orgChart.intelligence.metrics.managerSpan')}
            value={formatNumber(health.averageManagerSpan, { maximumFractionDigits: 1 })}
            tone="#2563EB"
          />
          <IntelligenceMetric
            icon={Building2}
            label={t('orgChart.intelligence.metrics.headcountDelta')}
            value={signed(delta.headcountDelta)}
            tone="#0F8A7B"
          />
          <IntelligenceMetric
            icon={GitCompareArrows}
            label={t('orgChart.intelligence.metrics.fteDelta')}
            value={signed(delta.plannedFteDelta, 1)}
            tone="#B7791F"
          />
          <IntelligenceMetric
            icon={GitCompareArrows}
            label={t('orgChart.intelligence.metrics.costDelta')}
            value={formatCost(delta.workforceCostDelta, delta.costCurrency)}
            tone="#8B5E34"
          />
        </Stack>
      </Box>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        gap={1}
        sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={view}
          aria-label={t('orgChart.intelligence.tabs.label')}
          onChange={(_event, next: OrganizationIntelligenceView | null) =>
            onViewChange(next ?? view)
          }
          sx={{
            width: { xs: 1, sm: 'auto' },
            '& .MuiToggleButton-root': {
              flex: { xs: 1, sm: 'initial' },
              minWidth: 0,
              px: { xs: 0.75, sm: 1.25 },
              whiteSpace: 'normal',
              lineHeight: 1.25,
            },
          }}
        >
          <ToggleButton value="health">{t('orgChart.intelligence.tabs.health')}</ToggleButton>
          <ToggleButton value="changes">{t('orgChart.intelligence.tabs.changes')}</ToggleButton>
          <ToggleButton value="quality">{t('orgChart.intelligence.tabs.quality')}</ToggleButton>
        </ToggleButtonGroup>
        {onRequestExport && (
          <ActionButton
            size="small"
            intent="secondary"
            startIcon={<FileLock2 size={15} />}
            onClick={onRequestExport}
          >
            {t('orgChart.intelligence.export')}
          </ActionButton>
        )}
      </Stack>

      {view === 'health' && (
        <HealthDecisionView rows={intelligence.organizations} health={health} onSelect={onSelect} />
      )}
      {view === 'changes' && (
        <ChangeImpactView rows={intelligence.changes} comparison={delta} onSelect={onSelect} />
      )}
      {view === 'quality' && (
        <QualityTriageView
          rows={intelligence.dataQualityIssues}
          score={health.dataQualityScore}
          onSelect={onSelect}
        />
      )}
    </Box>
  );
}

function HealthDecisionView({
  rows,
  health,
  onSelect,
}: {
  rows: OrganizationHealthInsight[];
  health: OrganizationIntelligence['health'];
  onSelect: Props['onSelect'];
}) {
  const { t } = useTranslation('workforce');
  const prioritized = [...rows]
    .sort((a, b) => a.healthScore - b.healthScore || b.totalHeadcount - a.totalHeadcount)
    .slice(0, 6);
  const maxSpan = Math.max(8, ...rows.map((row) => row.averageManagerSpan));
  const maxHeadcount = Math.max(1, ...rows.map((row) => row.totalHeadcount));

  return (
    <Box sx={{ p: { xs: 1.5, lg: 2 } }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.55fr) minmax(280px, 0.8fr)' },
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ minWidth: 0, bgcolor: '#0E1823', color: '#F8FAFC', p: 2 }}>
          <Typography variant="subtitle1" fontWeight={760}>
            {t('orgChart.intelligence.decision.healthMapTitle')}
          </Typography>
          <Typography variant="caption" sx={{ color: '#AEBCCB' }}>
            {t('orgChart.intelligence.decision.healthMapHelp')}
          </Typography>
          <Box sx={{ position: 'relative', height: 300, mt: 1.5, ml: 3.5, mb: 2.5 }}>
            <Typography
              variant="caption"
              sx={{
                position: 'absolute',
                left: -34,
                top: 0,
                color: '#93A6B8',
                writingMode: 'vertical-rl',
              }}
            >
              {t('orgChart.intelligence.decision.higherRisk')}
            </Typography>
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                borderLeft: '1px solid #405366',
                borderBottom: '1px solid #405366',
                backgroundImage:
                  'linear-gradient(to right, rgba(148,163,184,.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,.12) 1px, transparent 1px)',
                backgroundSize: '25% 25%',
              }}
            >
              {rows.map((row, index) => {
                const left = 8 + (Math.min(row.averageManagerSpan, maxSpan) / maxSpan) * 84;
                const top = 7 + (Math.max(0, Math.min(row.healthScore, 100)) / 100) * 82;
                const size = 18 + Math.sqrt(row.totalHeadcount / maxHeadcount) * 24;
                return (
                  <Tooltip
                    key={row.organizationId}
                    arrow
                    title={t('orgChart.intelligence.decision.mapTooltip', {
                      organization: row.organizationName,
                      score: row.healthScore,
                      span: formatNumber(row.averageManagerSpan, { maximumFractionDigits: 1 }),
                      headcount: formatNumber(row.totalHeadcount),
                    })}
                  >
                    <Box
                      component="button"
                      type="button"
                      aria-label={row.organizationName}
                      onClick={() => onSelect({ kind: 'organization', id: row.organizationId })}
                      sx={{
                        position: 'absolute',
                        left: `calc(${left}% + ${(index % 3) - 1}px)`,
                        top: `calc(${top}% + ${(index % 2) * 2}px)`,
                        width: size,
                        height: size,
                        minWidth: size,
                        p: 0,
                        borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,.82)',
                        bgcolor: riskTone[row.riskState],
                        boxShadow: `0 0 0 3px ${riskTone[row.riskState]}38`,
                        cursor: 'pointer',
                        transform: 'translate(-50%, -50%)',
                        transition: 'transform 140ms ease, box-shadow 140ms ease',
                        '&:hover, &:focus-visible': {
                          transform: 'translate(-50%, -50%) scale(1.16)',
                          boxShadow: `0 0 0 5px ${riskTone[row.riskState]}52`,
                          outline: 'none',
                        },
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Box>
            <Typography
              variant="caption"
              sx={{ position: 'absolute', right: 0, bottom: -24, color: '#93A6B8' }}
            >
              {t('orgChart.intelligence.decision.largerSpan')}
            </Typography>
          </Box>
          <Stack direction="row" gap={2} flexWrap="wrap">
            {(['HEALTHY', 'ATTENTION', 'CRITICAL'] as const).map((state) => (
              <Stack key={state} direction="row" alignItems="center" gap={0.65}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: riskTone[state] }} />
                <Typography variant="caption" sx={{ color: '#CBD5E1' }}>
                  {t(`orgChart.intelligence.risks.${state}`)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Box sx={{ borderLeft: { lg: 1 }, borderTop: { xs: 1, lg: 0 }, borderColor: 'divider' }}>
          <Box sx={{ px: 1.75, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle1" fontWeight={760}>
              {t('orgChart.intelligence.decision.priorityTitle')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('orgChart.intelligence.decision.priorityHelp')}
            </Typography>
          </Box>
          {prioritized.map((row, index) => {
            const signal = row.signals[0] ?? 'NO_SIGNAL';
            return (
              <Box
                component="button"
                type="button"
                key={row.organizationId}
                onClick={() => onSelect({ kind: 'organization', id: row.organizationId })}
                sx={{
                  width: 1,
                  minHeight: 64,
                  px: 1.75,
                  py: 1,
                  border: 0,
                  borderBottom: 1,
                  borderColor: 'divider',
                  bgcolor:
                    index === 0 && row.riskState !== 'HEALTHY' ? 'action.hover' : 'transparent',
                  color: 'text.primary',
                  textAlign: 'left',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Stack direction="row" alignItems="center" gap={1}>
                  <Typography variant="caption" color="text.secondary" sx={{ width: 20 }}>
                    {String(index + 1).padStart(2, '0')}
                  </Typography>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {row.organizationName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                      {t(`orgChart.intelligence.recommendations.${signal}`, {
                        defaultValue: t('orgChart.intelligence.recommendations.NO_SIGNAL'),
                      })}
                    </Typography>
                  </Box>
                  <Typography variant="subtitle2" fontWeight={800} color={riskTone[row.riskState]}>
                    {row.healthScore}
                  </Typography>
                  <ArrowRight size={15} aria-hidden />
                </Stack>
              </Box>
            );
          })}
          {!prioritized.length && <EmptyState />}
        </Box>
      </Box>

      <Box sx={{ mt: 2, borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }}>
          <Box sx={{ minWidth: 220, px: 1.5, py: 1.25 }}>
            <Typography variant="subtitle2">
              {t('orgChart.intelligence.decision.portfolioDistribution')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('orgChart.intelligence.decision.portfolioHelp', { count: rows.length })}
            </Typography>
          </Box>
          {[
            ['HEALTHY', rows.length - health.criticalOrganizations - health.attentionOrganizations],
            ['ATTENTION', health.attentionOrganizations],
            ['CRITICAL', health.criticalOrganizations],
          ].map(([state, count]) => (
            <Stack
              key={state}
              direction="row"
              alignItems="center"
              gap={1}
              sx={{
                minWidth: 150,
                px: 1.5,
                py: 1.25,
                borderLeft: { md: 1 },
                borderColor: 'divider',
              }}
            >
              <Box
                sx={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  bgcolor: riskTone[state as keyof typeof riskTone],
                }}
              />
              <Typography variant="body2" sx={{ flex: 1 }}>
                {t(`orgChart.intelligence.risks.${state}`)}
              </Typography>
              <Typography variant="subtitle2" fontWeight={800}>
                {formatNumber(Number(count))}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle1" fontWeight={760}>
          {t('orgChart.intelligence.decision.precisionTitle')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('orgChart.intelligence.decision.precisionHelp')}
        </Typography>
        <Box sx={{ mt: 1, borderTop: 1, borderColor: 'divider' }}>
          {rows.map((row) => (
            <Box
              component="button"
              type="button"
              key={row.organizationId}
              onClick={() => onSelect({ kind: 'organization', id: row.organizationId })}
              sx={{
                width: 1,
                minHeight: 58,
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr) 64px',
                  md: 'minmax(200px, 1.4fr) repeat(5, minmax(72px, .55fr)) 90px',
                },
                alignItems: 'center',
                gap: 1,
                px: 1,
                py: 0.75,
                border: 0,
                borderBottom: 1,
                borderColor: 'divider',
                bgcolor: 'transparent',
                color: 'text.primary',
                textAlign: 'left',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={700} noWrap>
                  {row.organizationName}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap display="block">
                  {row.signals
                    .map((signal) =>
                      t(`orgChart.intelligence.signals.${signal}`, { defaultValue: signal })
                    )
                    .join(' · ') || t('orgChart.intelligence.noSignals')}
                </Typography>
              </Box>
              <PrecisionValue
                label={t('orgChart.intelligence.columns.headcount')}
                value={formatNumber(row.totalHeadcount)}
              />
              <PrecisionValue
                label={t('orgChart.intelligence.columns.managerSpan')}
                value={formatNumber(row.averageManagerSpan, { maximumFractionDigits: 1 })}
              />
              <PrecisionValue
                label={t('orgChart.intelligence.columns.openPositions')}
                value={formatNumber(row.openPositionCount)}
              />
              <PrecisionValue
                label={t('orgChart.intelligence.columns.contingentRatio')}
                value={`${formatNumber(row.contingentRatioPct, { maximumFractionDigits: 1 })}%`}
              />
              <PrecisionValue
                label={t('orgChart.intelligence.columns.layer')}
                value={formatNumber(row.layer)}
              />
              <Stack direction="row" alignItems="center" justifyContent="flex-end" gap={0.75}>
                <Typography variant="subtitle2" fontWeight={800} color={riskTone[row.riskState]}>
                  {row.healthScore}
                </Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  color={riskColor(row.riskState)}
                  label={t(`orgChart.intelligence.risks.${row.riskState}`)}
                />
              </Stack>
            </Box>
          ))}
          {!rows.length && <EmptyState />}
        </Box>
      </Box>
    </Box>
  );
}

function PrecisionValue({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: { xs: 'none', md: 'block' } }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={650}>
        {value}
      </Typography>
    </Box>
  );
}

function ChangeImpactView({
  rows,
  comparison,
  onSelect,
}: {
  rows: OrganizationChangeInsight[];
  comparison: OrganizationIntelligence['comparison'];
  onSelect: Props['onSelect'];
}) {
  const { t } = useTranslation('workforce');
  const impacts = [
    [t('orgChart.intelligence.metrics.headcountDelta'), signed(comparison.headcountDelta)],
    [t('orgChart.intelligence.metrics.fteDelta'), signed(comparison.plannedFteDelta, 1)],
    [
      t('orgChart.intelligence.metrics.costDelta'),
      formatCost(comparison.workforceCostDelta, comparison.costCurrency),
    ],
    [t('orgChart.intelligence.metrics.layersDelta'), signed(comparison.maximumLayersDelta)],
    [
      t('orgChart.intelligence.metrics.healthDelta'),
      signed(comparison.organizationHealthScoreDelta),
    ],
  ];
  return (
    <Box sx={{ p: { xs: 1.5, lg: 2 } }}>
      <Typography variant="subtitle1" fontWeight={760}>
        {t('orgChart.intelligence.decision.changesTitle')}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {t('orgChart.intelligence.decision.changesHelp')}
      </Typography>
      <Box
        sx={{
          mt: 1.25,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, 1fr)' },
          border: 1,
          borderColor: 'divider',
        }}
      >
        {impacts.map(([label, value]) => (
          <Box
            key={label}
            sx={{ px: 1.5, py: 1.25, borderRight: 1, borderBottom: 1, borderColor: 'divider' }}
          >
            <Typography variant="caption" color="text.secondary" display="block">
              {label}
            </Typography>
            <Typography variant="subtitle1" fontWeight={780}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ mt: 2, borderTop: 1, borderColor: 'divider' }}>
        {rows.map((row, index) => (
          <Box
            component="button"
            type="button"
            key={`${row.changeType}-${row.entityType}-${row.entityId}-${index}`}
            onClick={() => onSelect(selectionFor(row.entityType, row.entityId))}
            sx={{
              width: 1,
              minHeight: 64,
              display: 'grid',
              gridTemplateColumns: {
                xs: '34px minmax(0, 1fr)',
                md: '34px minmax(150px, .8fr) minmax(0, 1.5fr) 90px',
              },
              alignItems: 'center',
              gap: 1,
              px: 1,
              py: 0.75,
              border: 0,
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'transparent',
              color: 'text.primary',
              textAlign: 'left',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Box
              sx={{
                width: 28,
                height: 28,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'action.hover',
                borderRadius: 1,
              }}
            >
              <MoveRight size={15} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {row.entityName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t(`orgChart.intelligence.changeTypes.${row.changeType}`, {
                  defaultValue: row.changeType,
                })}
              </Typography>
            </Box>
            <Stack
              direction="row"
              alignItems="center"
              gap={1}
              sx={{ minWidth: 0, display: { xs: 'none', md: 'flex' } }}
            >
              <Typography
                variant="body2"
                color="text.secondary"
                noWrap
                sx={{ minWidth: 0, flex: 1 }}
              >
                {row.fromValue || '-'}
              </Typography>
              <ArrowRight size={14} />
              <Typography variant="body2" fontWeight={650} noWrap sx={{ minWidth: 0, flex: 1 }}>
                {row.toValue || '-'}
              </Typography>
            </Stack>
            <Chip
              size="small"
              variant="outlined"
              color={riskColor(row.riskState)}
              label={t(`orgChart.intelligence.risks.${row.riskState}`, {
                defaultValue: row.riskState,
              })}
              sx={{ justifySelf: 'end', display: { xs: 'none', md: 'inline-flex' } }}
            />
          </Box>
        ))}
        {!rows.length && <EmptyState />}
      </Box>
    </Box>
  );
}

function QualityTriageView({
  rows,
  score,
  onSelect,
}: {
  rows: OrganizationDataQualityIssue[];
  score: number;
  onSelect: Props['onSelect'];
}) {
  const { t } = useTranslation('workforce');
  const display = useDisplayDictionary();
  const severityCount = (severity: OrganizationDataQualityIssue['severity']) =>
    rows.filter((row) => row.severity === severity).length;
  return (
    <Box sx={{ p: { xs: 1.5, lg: 2 } }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ md: 'center' }}
        justifyContent="space-between"
        gap={1.5}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={760}>
            {t('orgChart.intelligence.decision.qualityTitle')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('orgChart.intelligence.decision.qualityHelp')}
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Box sx={{ minWidth: 180 }}>
            <LinearProgress
              variant="determinate"
              value={score}
              color={score >= 90 ? 'success' : 'warning'}
              sx={{ height: 7 }}
            />
          </Box>
          <Typography variant="h6" fontSize={20} fontWeight={800}>
            {score}%
          </Typography>
        </Stack>
      </Stack>
      <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
        {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((severity) => (
          <Chip
            key={severity}
            variant="outlined"
            color={riskColor(severity)}
            label={`${t(`orgChart.intelligence.severity.${severity}`)} ${formatNumber(severityCount(severity))}`}
          />
        ))}
      </Stack>
      <Box sx={{ mt: 2, borderTop: 1, borderColor: 'divider' }}>
        {rows.map((row, index) => (
          <Box
            component="button"
            type="button"
            key={`${row.issueCode}-${row.entityType}-${row.entityId}-${index}`}
            onClick={() => onSelect(selectionFor(row.entityType, row.entityId))}
            sx={{
              width: 1,
              minHeight: 72,
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                md: '100px minmax(170px, .8fr) minmax(0, 1.5fr) minmax(180px, .9fr)',
              },
              alignItems: 'center',
              gap: 1.25,
              px: 1,
              py: 0.9,
              border: 0,
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'transparent',
              color: 'text.primary',
              textAlign: 'left',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Chip
              size="small"
              variant="outlined"
              color={riskColor(row.severity)}
              label={display('severities', row.severity)}
              sx={{ justifySelf: 'start' }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700}>
                {t(`orgChart.intelligence.issueCodes.${row.issueCode}`, {
                  defaultValue: row.issueCode,
                })}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {row.entityName}
              </Typography>
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: 'none', md: 'block' } }}
            >
              {row.message}
            </Typography>
            <Stack
              direction="row"
              alignItems="center"
              gap={0.75}
              sx={{ display: { xs: 'none', md: 'flex' } }}
            >
              <ArrowRight size={14} color="#64748B" />
              <Typography variant="caption" fontWeight={650}>
                {t(`orgChart.intelligence.qualityActions.${row.issueCode}`, {
                  defaultValue: t('orgChart.intelligence.qualityActions.DEFAULT'),
                })}
              </Typography>
            </Stack>
          </Box>
        ))}
        {!rows.length && <EmptyState />}
      </Box>
    </Box>
  );
}

function EmptyState() {
  const { t } = useTranslation('workforce');
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      gap={0.75}
      sx={{ minHeight: 150, py: 3, color: 'text.secondary' }}
    >
      <SearchCheck size={24} strokeWidth={1.6} />
      <Typography variant="body2">{t('orgChart.intelligence.empty')}</Typography>
    </Stack>
  );
}

function selectionFor(entityType: string, id: string): OrgChartSelection {
  if (entityType === 'PERSON') return { kind: 'person', id };
  if (entityType === 'POSITION') return { kind: 'position', id };
  return { kind: 'organization', id };
}
