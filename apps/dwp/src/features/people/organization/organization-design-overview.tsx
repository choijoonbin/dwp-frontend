import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  GitCompareArrows,
  GitPullRequest,
  Network,
  ShieldCheck,
} from 'lucide-react';
import { ActionButton, LiveStatus, OperationalContextBar } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type { OrganizationChart, OrganizationScenario } from '@dwp-frontend/shared-utils';
import type { ChartMode } from './organization-navigation';
import type { OrganizationIntelligenceView } from './organization-intelligence-panel';

type Props = {
  chart: OrganizationChart;
  mode: ChartMode;
  scenario?: OrganizationScenario;
  rootOrganizationId?: string;
  currentDate: string;
  fetching: boolean;
  onRefresh: () => void;
  onOpenInsight: (view: OrganizationIntelligenceView) => void;
};

type PulseState = 'HEALTHY' | 'ATTENTION' | 'CRITICAL';

export function OrganizationDesignOverview({
  chart,
  mode,
  scenario,
  rootOrganizationId,
  currentDate,
  fetching,
  onRefresh,
  onOpenInsight,
}: Props) {
  const { t } = useTranslation('workforce');
  const criticalOrganizations = chart.organizations.filter(
    (organization) => organization.healthStatus === 'CRITICAL'
  ).length;
  const attentionOrganizations = chart.organizations.filter(
    (organization) => organization.healthStatus === 'ATTENTION'
  ).length;
  const dataIssueCount =
    chart.analysis.missingManagerCount +
    chart.analysis.missingGradeCount +
    chart.analysis.orphanOrganizationCount;
  const designExceptionCount = chart.analysis.signals.reduce(
    (total, signal) => total + signal.count,
    0
  );
  const pulseState: PulseState =
    criticalOrganizations > 0 || chart.analysis.dataQualityScore < 80
      ? 'CRITICAL'
      : attentionOrganizations > 0 ||
          designExceptionCount > 0 ||
          dataIssueCount > 0 ||
          chart.analysis.dataQualityScore < 95
        ? 'ATTENTION'
        : 'HEALTHY';
  const pulseTone =
    pulseState === 'CRITICAL' ? 'error' : pulseState === 'ATTENTION' ? 'warning' : 'success';
  const activeScenario = scenario ?? chart.scenario ?? undefined;
  const scenarioChangeCount = scenario?.changes.length ?? chart.scenario?.activeChangeCount ?? 0;
  const scenarioBaselineDate = scenario?.baselineDate ?? chart.scenario?.baseAsOf;
  const scope = rootOrganizationId
    ? (chart.organizations.find(
        (organization) => organization.organizationId === rootOrganizationId
      )?.name ?? chart.company.name)
    : chart.company.name;
  const historical = chart.asOf !== currentDate;
  const liveState = fetching ? 'syncing' : activeScenario || historical ? 'stale' : 'live';
  const insightTarget: OrganizationIntelligenceView = dataIssueCount > 0 ? 'quality' : 'health';

  return (
    <Stack gap={1.5}>
      <OperationalContextBar
        label={t('orgChart.context.label')}
        items={[
          {
            label: t('orgChart.context.scope'),
            value: scope,
            icon: <Building2 size={16} />,
          },
          {
            label: t('orgChart.context.model'),
            value: activeScenario?.name ?? t('orgChart.context.liveModel'),
            icon: activeScenario ? <GitPullRequest size={16} /> : <Network size={16} />,
          },
          {
            label: t('orgChart.context.effectiveDate'),
            value: activeScenario?.effectiveDate ?? chart.asOf,
            icon: <CalendarDays size={16} />,
          },
          {
            label: t('orgChart.context.perspective'),
            value: t(`orgChart.view.${mode}`),
            icon: <GitCompareArrows size={16} />,
          },
        ]}
        status={
          <LiveStatus
            state={liveState}
            label={t(
              `orgChart.context.status.${activeScenario ? 'scenario' : historical ? 'historical' : 'live'}`
            )}
            detail={
              activeScenario
                ? t('orgChart.context.scenarioDetail', { date: scenarioBaselineDate })
                : t('orgChart.context.snapshotDetail', { date: chart.asOf })
            }
            refreshLabel={t('common.actions.refresh')}
            refreshing={fetching}
            onRefresh={onRefresh}
          />
        }
      />

      <Paper
        component="section"
        variant="outlined"
        aria-labelledby="organization-design-pulse-title"
        sx={(theme) => {
          const color = theme.palette[pulseTone].main;
          return {
            position: 'relative',
            overflow: 'hidden',
            px: { xs: 2, md: 2.5 },
            py: { xs: 1.75, md: 2 },
            bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.12 : 0.055),
            borderColor: alpha(color, 0.35),
            '&::before': {
              position: 'absolute',
              inset: '0 auto 0 0',
              width: 4,
              bgcolor: color,
              content: '""',
            },
          };
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          gap={2}
        >
          <Stack direction="row" alignItems="flex-start" gap={1.25} minWidth={0}>
            <Box
              aria-hidden="true"
              sx={{
                width: 38,
                height: 38,
                flex: '0 0 38px',
                display: 'grid',
                placeItems: 'center',
                borderRadius: 1,
                color: `${pulseTone}.main`,
                bgcolor: 'background.paper',
              }}
            >
              {pulseState === 'HEALTHY' ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
            </Box>
            <Box minWidth={0}>
              <Typography id="organization-design-pulse-title" component="h2" variant="h5">
                {t(`orgChart.pulse.title.${pulseState}`)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                {t('orgChart.pulse.detail')}
              </Typography>
              <Stack
                direction="row"
                gap={0.75}
                useFlexGap
                role="region"
                tabIndex={0}
                aria-label={t('orgChart.pulse.signalsLabel')}
                sx={{
                  mt: 1.25,
                  mx: { xs: -0.5, sm: 0 },
                  px: { xs: 0.5, sm: 0 },
                  pb: { xs: 0.5, sm: 0 },
                  flexWrap: { xs: 'nowrap', sm: 'wrap' },
                  overflowX: { xs: 'auto', sm: 'visible' },
                  '& .MuiChip-root': { flexShrink: 0 },
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: 2,
                  },
                }}
              >
                <Chip
                  size="small"
                  variant="outlined"
                  color={criticalOrganizations ? 'error' : 'success'}
                  label={t('orgChart.pulse.critical', { count: criticalOrganizations })}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color={attentionOrganizations ? 'warning' : 'success'}
                  label={t('orgChart.pulse.attention', { count: attentionOrganizations })}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color={
                    chart.analysis.dataQualityScore < 80
                      ? 'error'
                      : chart.analysis.dataQualityScore < 95 || dataIssueCount
                        ? 'warning'
                        : 'success'
                  }
                  label={t('orgChart.pulse.dataTrust', {
                    score: chart.analysis.dataQualityScore,
                    count: dataIssueCount,
                  })}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color={scenarioChangeCount ? 'info' : 'default'}
                  label={
                    activeScenario
                      ? t('orgChart.pulse.scenarioChanges', { count: scenarioChangeCount })
                      : t('orgChart.pulse.designLimits', {
                          span: chart.analysis.averageManagerSpan.toFixed(1),
                          layers: chart.analysis.maximumLayers,
                        })
                  }
                />
              </Stack>
            </Box>
          </Stack>
          <ActionButton
            intent={pulseState === 'CRITICAL' ? 'danger' : 'primary'}
            startIcon={<GitCompareArrows size={17} />}
            onClick={() => onOpenInsight(insightTarget)}
            sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, flexShrink: 0 }}
          >
            {t('orgChart.pulse.reviewInsights')}
          </ActionButton>
        </Stack>
      </Paper>
    </Stack>
  );
}
