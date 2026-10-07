import { useTranslation } from 'react-i18next';
import { CheckCircle2, Send } from 'lucide-react';
import {
  ActionButton,
  EmptyState,
  FormDialog,
  FormField,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  HrisProgressSignal,
  HrisQueryBoundary,
  HrisReferenceNotice,
  HrisStatusChip,
} from '../../shared';
import { HrisTimeCalendar } from '../components/hris-time-calendar';
import { HrisTimeCommandNotice } from '../components/hris-time-command-notice';
import { HrisTimeExceptions, HrisTimeSourceBoundary } from '../components/hris-time-sections';
import { useHrisTimeRequestScope, useHrisTimeRuntime } from '../hooks/use-hris-time-workspace';
import { isTimeWorkMode, minutesLabel, timeCardCanSubmit } from '../model/hris-time-model';

import type { HrisTimeRuntimeOptions } from '../hooks/use-hris-time-workspace';

export type HrisTimeRuntimeProps = HrisTimeRuntimeOptions;

export function HrisTimeRuntime({
  requestScope,
  dataSource,
  connectedScheduleDateValues,
}: HrisTimeRuntimeProps) {
  const { t } = useTranslation('hcm');
  const {
    ready,
    loading,
    error,
    isFetching,
    retry,
    card,
    entries,
    exceptions,
    period,
    connectedScheduleDates,
    feedback,
    draft,
    saveFailure,
    submitFailure,
    saveRefreshed,
    submitRefreshed,
    isSaving,
    isSubmitting,
    saveBlocked,
    submitBlocked,
    openEditor,
    setDraft,
    closeEditor,
    save,
    submit,
    refreshSave,
    refreshSubmit,
    reviewLatestDraft,
    reviewLatestSubmit,
  } = useHrisTimeRuntime({ requestScope, dataSource, connectedScheduleDateValues });

  return (
    <HrisQueryBoundary
      loading={loading}
      error={error}
      retrying={isFetching}
      onRetry={ready ? () => void retry() : undefined}
    >
      {!card ? (
        <EmptyState
          title={t('domains.time.noCardTitle')}
          description={t('domains.time.noCardDescription')}
        />
      ) : (
        <Stack gap={1.5}>
          {feedback && (
            <InlineFeedback severity="success" icon={<CheckCircle2 size={18} aria-hidden="true" />}>
              {t(`domains.time.${feedback}`)}
            </InlineFeedback>
          )}
          {card.dataOrigin === 'REFERENCE' && <HrisReferenceNotice />}
          <HrisTimeSourceBoundary
            dataOrigin={card.dataOrigin}
            scheduleConnected={Boolean(connectedScheduleDates)}
            nonStandardPeriod={period.state === 'NON_STANDARD'}
          />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
              gap: 1,
            }}
          >
            <HrisProgressSignal
              label={t('domains.time.recorded')}
              value={minutesLabel(card.recordedMinutes)}
              detail={t('domains.time.target', { value: minutesLabel(card.scheduledMinutes) })}
              progress={
                card.scheduledMinutes ? (card.recordedMinutes / card.scheduledMinutes) * 100 : 0
              }
            />
            <HrisProgressSignal
              label={t('domains.time.exceptions')}
              value={String(card.exceptionCount)}
              detail={
                card.exceptionCount
                  ? t('domains.time.exceptionsOpen')
                  : t('domains.time.exceptionsClear')
              }
              progress={card.exceptionCount ? 100 : 0}
              tone={card.exceptionCount ? 'warning' : 'success'}
            />
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('domains.time.cardStatus')}
                  </Typography>
                  <Box sx={{ mt: 0.75 }}>
                    <HrisStatusChip status={card.status} />
                  </Box>
                </Box>
                {card.status === 'OPEN' && (
                  <ActionButton
                    intent="primary"
                    size="small"
                    startIcon={<Send size={15} aria-hidden="true" />}
                    disabled={
                      !timeCardCanSubmit(card) ||
                      isSubmitting ||
                      Boolean(submitFailure?.requiresRefresh) ||
                      submitBlocked
                    }
                    onClick={submit}
                  >
                    {t('domains.time.submit')}
                  </ActionButton>
                )}
              </Stack>
            </Paper>
          </Box>

          {submitFailure && (
            <HrisTimeCommandNotice
              failure={submitFailure}
              refreshing={isFetching}
              refreshed={submitRefreshed}
              onRefresh={() => void refreshSubmit()}
              onReviewLatest={reviewLatestSubmit}
              onRetry={submit}
            />
          )}

          <HrisTimeExceptions
            card={card}
            entries={entries}
            exceptions={exceptions}
            period={period}
            connectedScheduleDates={connectedScheduleDates}
            onEdit={openEditor}
          />

          <HrisTimeCalendar
            card={card}
            entries={entries}
            period={period}
            connectedScheduleDates={connectedScheduleDates}
            onEdit={openEditor}
          />
        </Stack>
      )}

      <FormDialog
        open={Boolean(draft)}
        title={t('domains.time.editTitle')}
        description={draft?.date}
        cancelLabel={t('domains.actions.cancel')}
        submitLabel={t('domains.actions.save')}
        busy={isSaving}
        submitDisabled={
          !draft ||
          !Number.isSafeInteger(draft.minutes) ||
          draft.minutes < 1 ||
          draft.minutes > 1_440 ||
          draft.baseVersion !== card?.version ||
          Boolean(saveFailure?.requiresRefresh) ||
          saveBlocked
        }
        onClose={closeEditor}
        onSubmit={save}
      >
        <Stack gap={2}>
          {saveFailure && (
            <HrisTimeCommandNotice
              failure={saveFailure}
              refreshing={isFetching}
              refreshed={saveRefreshed}
              onRefresh={() => void refreshSave()}
              onReviewLatest={reviewLatestDraft}
              onRetry={save}
            />
          )}
          <FormField
            type="number"
            label={t('domains.time.minutes')}
            value={draft?.minutes ?? 480}
            onChange={(event) =>
              setDraft((current) =>
                current ? { ...current, minutes: Number(event.target.value) } : current
              )
            }
            slotProps={{ htmlInput: { min: 1, max: 1_440, step: 30 } }}
          />
          <SelectField
            label={t('domains.time.workMode')}
            value={draft?.workMode ?? 'HYBRID'}
            onValueChange={(value) => {
              const workMode = String(value);
              if (!isTimeWorkMode(workMode)) return;
              setDraft((current) => (current ? { ...current, workMode } : current));
            }}
            options={['OFFICE', 'REMOTE', 'FIELD', 'HYBRID'].map((mode) => ({
              value: mode,
              label: t(`domains.time.workModes.${mode}`),
            }))}
          />
          <FormField
            multiline
            minRows={2}
            label={t('domains.time.note')}
            value={draft?.note ?? ''}
            onChange={(event) =>
              setDraft((current) => (current ? { ...current, note: event.target.value } : current))
            }
            slotProps={{ htmlInput: { maxLength: 1_000 } }}
          />
        </Stack>
      </FormDialog>
    </HrisQueryBoundary>
  );
}

export function HrisTimeWorkspace() {
  const requestScope = useHrisTimeRequestScope();
  return <HrisTimeRuntime requestScope={requestScope} />;
}
