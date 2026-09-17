import { BarChart3, CalendarRange, Filter, RefreshCw, Route, TrendingUp } from 'lucide-react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  AdminV2FactGrid,
  AdminV2InspectorPaper,
  AdminV2MetricStrip,
  AdminV2RecordButton,
  AdminV2Section,
  AdminV2StateBoundary,
  AdminV2StatusPill,
  AdminV2WorkspaceFrame,
} from './admin-v2-foundation';
import { ApprovalAdminV2ActionDeck } from './approval-admin-v2-action-deck';

import type { AdminV2WorkspaceActionDeck } from './approval-admin-v2-action-deck';
import type {
  AdminV2Fact,
  AdminV2Metric,
  AdminV2SourceState,
  AdminV2StateCopy,
  AdminV2Status,
  AdminV2Tone,
  AdminV2WorkspaceHeader,
} from './admin-v2-types';

export type ApprovalAnalyticsCohort = {
  id: string;
  label: string;
  sampleLabel: string;
  cycleTimeLabel: string;
  slaLabel: string;
  conformanceLabel: string;
  suppressed: boolean;
  status: AdminV2Status;
  facts: readonly AdminV2Fact[];
};

export type ApprovalAnalyticsStage = {
  id: string;
  label: string;
  sequenceLabel: string;
  p50Label: string;
  p90Label: string;
  sampleLabel: string;
  tone: AdminV2Tone;
};

export type ApprovalAnalyticsRecommendation = {
  id: string;
  title: string;
  detail: string;
  evidence: string;
  status: AdminV2Status;
};

export type AnalyticsInsightsCopy = {
  header: AdminV2WorkspaceHeader;
  state: AdminV2StateCopy;
  coverageTitle: string;
  coverageDescription: string;
  cohortTitle: string;
  cohortDescription: string;
  cohortDetailTitle: string;
  cohortDetailDescription: string;
  bottleneckTitle: string;
  bottleneckDescription: string;
  recommendationsTitle: string;
  recommendationsDescription: string;
  noSelectionLabel: string;
  refreshLabel: string;
  rangeLabel: string;
  filterLabel: string;
  suppressedTitle: string;
  suppressedDescription: string;
  readOnlyTitle: string;
  readOnlyDescription: string;
  stageLabel: string;
  p50Label: string;
  p90Label: string;
  sampleLabel: string;
};

export type AnalyticsInsightsWorkspaceProps = {
  state: AdminV2SourceState;
  copy: AnalyticsInsightsCopy;
  metrics: readonly AdminV2Metric[];
  coverageFacts: readonly AdminV2Fact[];
  cohorts: readonly ApprovalAnalyticsCohort[];
  selectedCohortId: string | null;
  stages: readonly ApprovalAnalyticsStage[];
  recommendations: readonly ApprovalAnalyticsRecommendation[];
  actionDeck?: AdminV2WorkspaceActionDeck;
  onSelectCohort: (cohortId: string) => void;
  onRefresh: () => void;
  onChangeRange: () => void;
  onChangeFilter: () => void;
  onRetry?: () => void;
  onResolveConflict?: () => void;
};

const TONE_COLOR: Record<AdminV2Tone, string> = {
  neutral: 'text.secondary',
  info: 'info.main',
  success: 'success.main',
  warning: 'warning.main',
  danger: 'error.main',
};

export function AnalyticsInsightsWorkspace({
  state,
  copy,
  metrics,
  coverageFacts,
  cohorts,
  selectedCohortId,
  stages,
  recommendations,
  actionDeck,
  onSelectCohort,
  onRefresh,
  onChangeRange,
  onChangeFilter,
  onRetry,
  onResolveConflict,
}: AnalyticsInsightsWorkspaceProps) {
  const selected = cohorts.find((cohort) => cohort.id === selectedCohortId) ?? null;

  return (
    <AdminV2WorkspaceFrame
      header={copy.header}
      icon={BarChart3}
      primaryAction={
        <ActionButton intent="secondary" startIcon={<RefreshCw size={16} />} onClick={onRefresh}>
          {copy.refreshLabel}
        </ActionButton>
      }
    >
      <AdminV2StateBoundary
        state={state}
        copy={copy.state}
        actions={{ onRetry, onResolveConflict }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="flex-end">
          <ActionButton
            intent="secondary"
            startIcon={<CalendarRange size={16} />}
            onClick={onChangeRange}
          >
            {copy.rangeLabel}
          </ActionButton>
          <ActionButton
            intent="secondary"
            startIcon={<Filter size={16} />}
            onClick={onChangeFilter}
          >
            {copy.filterLabel}
          </ActionButton>
        </Stack>
        <AdminV2MetricStrip metrics={metrics} />
        {actionDeck ? <ApprovalAdminV2ActionDeck state={state} deck={actionDeck} /> : null}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'minmax(280px,.8fr) minmax(0,1.4fr)' },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <Stack gap={2} minWidth={0}>
            <AdminV2InspectorPaper>
              <AdminV2Section
                title={copy.coverageTitle}
                description={copy.coverageDescription}
                labelledBy="approval-analytics-coverage"
              >
                <AdminV2FactGrid facts={coverageFacts} />
                <Box sx={{ px: 1.5, py: 1.25 }}>
                  <InlineFeedback severity="info" title={copy.readOnlyTitle}>
                    {copy.readOnlyDescription}
                  </InlineFeedback>
                </Box>
              </AdminV2Section>
            </AdminV2InspectorPaper>

            <AdminV2InspectorPaper>
              <AdminV2Section
                title={copy.cohortTitle}
                description={copy.cohortDescription}
                labelledBy="approval-analytics-cohorts"
              >
                <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                  {cohorts.map((cohort) => (
                    <Box component="li" key={cohort.id}>
                      <AdminV2RecordButton
                        selected={cohort.id === selectedCohortId}
                        title={cohort.label}
                        description={`${cohort.cycleTimeLabel} · ${cohort.slaLabel}`}
                        meta={`${cohort.sampleLabel} · ${cohort.conformanceLabel}`}
                        status={cohort.status}
                        onClick={() => onSelectCohort(cohort.id)}
                      />
                    </Box>
                  ))}
                </Box>
              </AdminV2Section>
            </AdminV2InspectorPaper>
          </Stack>

          <Stack gap={2} minWidth={0}>
            <AdminV2InspectorPaper>
              <AdminV2Section
                title={selected?.label ?? copy.cohortDetailTitle}
                description={selected ? selected.sampleLabel : copy.cohortDetailDescription}
                labelledBy="approval-analytics-cohort-detail"
                action={selected ? <AdminV2StatusPill status={selected.status} /> : undefined}
              >
                {selected ? (
                  selected.suppressed ? (
                    <Box sx={{ p: 1.5 }}>
                      <InlineFeedback severity="warning" title={copy.suppressedTitle}>
                        {copy.suppressedDescription}
                      </InlineFeedback>
                    </Box>
                  ) : (
                    <AdminV2FactGrid facts={selected.facts} />
                  )
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                    {copy.noSelectionLabel}
                  </Typography>
                )}
              </AdminV2Section>
            </AdminV2InspectorPaper>

            <AdminV2InspectorPaper>
              <AdminV2Section
                title={copy.bottleneckTitle}
                description={copy.bottleneckDescription}
                labelledBy="approval-analytics-bottlenecks"
                action={<Route size={18} aria-hidden="true" />}
              >
                <Box
                  role="region"
                  aria-label={`${copy.bottleneckTitle}: ${copy.stageLabel}`}
                  tabIndex={0}
                  sx={{ overflowX: 'auto' }}
                >
                  <Box
                    component="table"
                    sx={{ width: 1, minWidth: 620, borderCollapse: 'collapse' }}
                  >
                    <Box component="thead" sx={{ bgcolor: 'action.hover' }}>
                      <Box component="tr">
                        {[copy.stageLabel, copy.p50Label, copy.p90Label, copy.sampleLabel].map(
                          (label) => (
                            <Box
                              component="th"
                              key={label}
                              sx={{
                                p: 1.25,
                                textAlign: 'start',
                                borderBlockEnd: 1,
                                borderColor: 'divider',
                              }}
                            >
                              <Typography variant="caption" fontWeight="fontWeightBold">
                                {label}
                              </Typography>
                            </Box>
                          )
                        )}
                      </Box>
                    </Box>
                    <Box component="tbody">
                      {stages.map((stage) => (
                        <Box component="tr" key={stage.id}>
                          <Box
                            component="td"
                            sx={{ p: 1.25, borderBlockEnd: 1, borderColor: 'divider' }}
                          >
                            <Typography variant="body2" fontWeight="fontWeightBold">
                              {stage.sequenceLabel} · {stage.label}
                            </Typography>
                          </Box>
                          {[
                            ['p50', stage.p50Label],
                            ['p90', stage.p90Label],
                            ['sample', stage.sampleLabel],
                          ].map(([key, value]) => (
                            <Box
                              component="td"
                              key={key}
                              sx={{ p: 1.25, borderBlockEnd: 1, borderColor: 'divider' }}
                            >
                              <Typography
                                variant="body2"
                                fontWeight="fontWeightBold"
                                color={TONE_COLOR[stage.tone]}
                                sx={{ fontVariantNumeric: 'tabular-nums' }}
                              >
                                {value}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Box>
              </AdminV2Section>
            </AdminV2InspectorPaper>

            <AdminV2InspectorPaper>
              <AdminV2Section
                title={copy.recommendationsTitle}
                description={copy.recommendationsDescription}
                labelledBy="approval-analytics-recommendations"
                action={<TrendingUp size={18} aria-hidden="true" />}
              >
                <Stack component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
                  {recommendations.map((recommendation) => (
                    <Stack
                      component="li"
                      key={recommendation.id}
                      direction={{ xs: 'column', sm: 'row' }}
                      gap={1}
                      sx={{ px: 1.5, py: 1.25, borderBlockEnd: 1, borderColor: 'divider' }}
                    >
                      <Box flex={1} minWidth={0}>
                        <Typography variant="body2" fontWeight="fontWeightBold">
                          {recommendation.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {recommendation.detail}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mt: 0.4 }}
                        >
                          {recommendation.evidence}
                        </Typography>
                      </Box>
                      <AdminV2StatusPill status={recommendation.status} />
                    </Stack>
                  ))}
                </Stack>
              </AdminV2Section>
            </AdminV2InspectorPaper>
          </Stack>
        </Box>
      </AdminV2StateBoundary>
    </AdminV2WorkspaceFrame>
  );
}
