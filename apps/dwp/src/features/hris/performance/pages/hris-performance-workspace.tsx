import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, RefreshCw, Target } from 'lucide-react';
import {
  ActionButton,
  EmptyState,
  FormDialog,
  GlyphSurface,
  InlineFeedback,
  ProgressMeter,
} from '@dwp-frontend/design-system';
import { formatCivilDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { HcmQueryState } from '../../../../components/hcm-query-state';
import { useHrisPerformanceWorkspace } from '../hooks/use-hris-performance-workspace';
import {
  HRIS_PERFORMANCE_PHASE_ONE_ROUTE,
  isPerformanceGoalEditable,
  setPerformanceGoalDraftProgress,
} from '../model/performance-goal-model';
import {
  PerformanceGoalSection,
  PerformanceGoalStatus,
  PerformanceReferenceNotice,
} from '../components/performance-goal-components';
import {
  getPerformancePhaseOneCopy,
  performanceGoalFailureMessage,
  performanceGoalValidationMessage,
} from '../model/performance-phase-one-copy';

import type { PerformanceDataProvenance } from '../model/performance-goal-model';

export type HrisPerformanceWorkspaceProps = Readonly<{
  dataProvenance?: PerformanceDataProvenance;
}>;

export function HrisPerformanceWorkspace({ dataProvenance }: HrisPerformanceWorkspaceProps) {
  const { t, i18n } = useTranslation('hcm');
  const copy = getPerformancePhaseOneCopy(i18n.resolvedLanguage, i18n.language);
  const progressLabelId = useId();
  const {
    ready,
    requestLoading,
    blockingError,
    personalGoals,
    error,
    isFetching,
    refetch,
    draft,
    setDraft,
    isSaving,
    validation,
    mayLoadLatest,
    openGoal,
    saveDraft,
    loadLatest,
  } = useHrisPerformanceWorkspace(dataProvenance);
  if (requestLoading || blockingError) {
    return (
      <HcmQueryState
        loading={requestLoading}
        error={blockingError}
        retrying={isFetching}
        onRetry={ready ? () => void refetch() : undefined}
      />
    );
  }

  if (!personalGoals) return null;

  return (
    <Stack
      gap={2}
      data-route={HRIS_PERFORMANCE_PHASE_ONE_ROUTE}
      data-scope="personal-goal-progress"
    >
      <Paper component="header" variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} alignItems={{ sm: 'center' }}>
          <GlyphSurface size={42} variant="soft">
            <Target size={21} aria-hidden="true" />
          </GlyphSurface>
          <Box minWidth={0} flex={1}>
            <Typography variant="overline" color="text.secondary">
              {copy.scopeEyebrow}
            </Typography>
            <Typography component="h2" variant="h5">
              {copy.scopeTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {copy.scopeDescription}
            </Typography>
          </Box>
          <Box sx={{ minWidth: { sm: 180 } }}>
            <Typography variant="caption" color="text.secondary" display="block">
              {copy.employeeContext}
            </Typography>
            <Typography component="p" variant="subtitle2">
              {personalGoals.employee.displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {personalGoals.employee.organizationName || copy.organizationFallback}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {personalGoals.provenance === 'REFERENCE' && <PerformanceReferenceNotice />}
      {personalGoals.provenance === 'UNKNOWN' && (
        <InlineFeedback severity="warning" title={copy.sourceUnknownTitle}>
          {copy.sourceUnknownDescription}
        </InlineFeedback>
      )}
      {error && !blockingError && (
        <InlineFeedback
          severity="warning"
          title={copy.staleDataTitle}
          action={
            <ActionButton
              intent="quiet"
              size="small"
              loading={isFetching}
              startIcon={<RefreshCw size={14} aria-hidden="true" />}
              onClick={() => void refetch()}
            >
              {copy.retryRead}
            </ActionButton>
          }
        >
          {copy.staleDataDescription}
        </InlineFeedback>
      )}

      <PerformanceGoalSection
        title={t('domains.talent.goalsTitle')}
        description={t('domains.talent.goalsDescription')}
      >
        {personalGoals.goals.length ? (
          personalGoals.goals.map((goal, index) => {
            const editable = isPerformanceGoalEditable(goal);
            return (
              <Box key={goal.goalId} data-goal-id={goal.goalId}>
                {index > 0 && <Divider />}
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  gap={1.25}
                  sx={{ px: 2, py: 1.5 }}
                >
                  <Box minWidth={0} flex={1}>
                    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                      <Typography component="h3" variant="subtitle2">
                        {goal.title}
                      </Typography>
                      <PerformanceGoalStatus status={goal.status} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {goal.dueDate
                        ? formatCivilDate(goal.dueDate, { dateStyle: 'medium' })
                        : t('domains.talent.noDueDate')}
                    </Typography>
                    <ProgressMeter
                      label={t('domains.talent.progress')}
                      value={goal.progressPercent}
                      valueLabel={`${goal.progressPercent}%`}
                      size="compact"
                      sx={{ mt: 1.25 }}
                    />
                  </Box>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                    <Typography component="span" variant="subtitle2">
                      {goal.progressPercent}%
                    </Typography>
                    <ActionButton
                      intent="quiet"
                      size="small"
                      disabled={!editable}
                      aria-label={`${copy.editProgress}: ${goal.title}`}
                      startIcon={<Pencil size={14} aria-hidden="true" />}
                      onClick={() => openGoal(goal.goalId)}
                    >
                      {editable ? t('domains.actions.update') : copy.readOnlyGoal}
                    </ActionButton>
                  </Stack>
                </Stack>
              </Box>
            );
          })
        ) : (
          <EmptyState
            size="compact"
            title={t('domains.talent.noGoalsTitle')}
            description={t('domains.talent.noGoalsDescription')}
          />
        )}
      </PerformanceGoalSection>

      <FormDialog
        open={Boolean(draft)}
        title={t('domains.talent.updateGoalTitle')}
        description={draft?.title}
        cancelLabel={t('domains.actions.cancel')}
        submitLabel={t('domains.actions.save')}
        submittingLabel={t('domains.actions.save')}
        busy={isSaving}
        submitDisabled={validation !== 'READY'}
        secondaryActions={
          mayLoadLatest ? (
            <ActionButton
              intent="secondary"
              size="small"
              loading={isFetching}
              startIcon={<RefreshCw size={14} aria-hidden="true" />}
              onClick={() => void loadLatest()}
            >
              {copy.loadLatest}
            </ActionButton>
          ) : undefined
        }
        onClose={() => setDraft(null)}
        onSubmit={saveDraft}
        mobileFullScreen
      >
        {draft && (
          <Stack gap={2}>
            {draft.saveFailure && (
              <Box data-save-failure={draft.saveFailure}>
                <InlineFeedback
                  severity="error"
                  title={performanceGoalFailureMessage(copy, draft.saveFailure)}
                >
                  <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                    {copy.draftPreserved}
                  </Typography>
                </InlineFeedback>
              </Box>
            )}
            <Box>
              <Typography id={progressLabelId} variant="caption" color="text.secondary">
                {t('domains.talent.progress')}
              </Typography>
              <Slider
                aria-labelledby={progressLabelId}
                value={draft.progressPercent}
                onChange={(_, value) =>
                  setDraft((current) =>
                    current ? setPerformanceGoalDraftProgress(current, value as number) : current
                  )
                }
                step={5}
                min={0}
                max={100}
                valueLabelDisplay="on"
                sx={{ mt: 3 }}
              />
            </Box>
            {!draft.saveFailure && validation !== 'READY' && validation !== 'UNCHANGED' && (
              <InlineFeedback severity="info">
                {performanceGoalValidationMessage(copy, validation)}
              </InlineFeedback>
            )}
          </Stack>
        )}
      </FormDialog>
    </Stack>
  );
}

export default HrisPerformanceWorkspace;
