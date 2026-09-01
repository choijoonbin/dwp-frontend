import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Pencil, Send } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  EmptyState,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { getHrTime, saveHrTimeEntry, submitHrTimeCard, useToast } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  DomainSection,
  ProgressSignal,
  QueryBoundary,
  ReferenceNotice,
  StatusChip,
} from './hr-domain-components';

import type { HrTimeEntry } from '@dwp-frontend/shared-utils';
import { useProductActionMutation } from '../../components/use-product-action-mutation';

function weekDates(start?: string): string[] {
  if (!start) return [];
  const first = new Date(`${start}T00:00:00`);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function minutesLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function HrTimeWorkspace() {
  const { t } = useTranslation('hcm');
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['hcm', 'time'],
    queryFn: getHrTime,
    staleTime: 20_000,
  });
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(480);
  const [workMode, setWorkMode] = useState('HYBRID');
  const [note, setNote] = useState('');
  const updateEntry = useProductActionMutation('route.hcm.personal.time-entry-update.action');
  const submitCard = useProductActionMutation('route.hcm.personal.time-submit.action');
  const card = query.data?.card;
  const entriesByDate = useMemo(
    () => new Map((query.data?.entries ?? []).map((entry) => [entry.workDate, entry])),
    [query.data?.entries]
  );
  const dates = weekDates(card?.periodStart);
  const saveMutation = useMutation({
    mutationFn: () =>
      updateEntry((authority) =>
        saveHrTimeEntry(
          card!.timeCardId,
          editingDate!,
          {
            minutes,
            workMode,
            note: note.trim() || undefined,
            cardVersion: card!.version,
          },
          authority
        )
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(['hcm', 'time'], data);
      void queryClient.invalidateQueries({ queryKey: ['hcm', 'home-overview'] });
      setEditingDate(null);
      toast.success(t('domains.time.saved'));
    },
    onError: () => toast.error(t('domains.time.saveError')),
  });
  const submitMutation = useMutation({
    mutationFn: () =>
      submitCard((authority) => submitHrTimeCard(card!.timeCardId, card!.version, authority)),
    onSuccess: (data) => {
      queryClient.setQueryData(['hcm', 'time'], data);
      void queryClient.invalidateQueries({ queryKey: ['hcm', 'home-overview'] });
      toast.success(t('domains.time.submitted'));
    },
    onError: () => toast.error(t('domains.time.submitError')),
  });

  const openEditor = (date: string, entry?: HrTimeEntry) => {
    setEditingDate(date);
    setMinutes(entry?.minutes ?? 480);
    setWorkMode(entry?.workMode ?? 'HYBRID');
    setNote(entry?.note ?? '');
  };

  return (
    <QueryBoundary
      loading={query.isLoading}
      error={query.error}
      retrying={query.isFetching}
      onRetry={() => void query.refetch()}
    >
      {!card ? (
        <EmptyState
          title={t('domains.time.noCardTitle')}
          description={t('domains.time.noCardDescription')}
        />
      ) : (
        <Stack gap={2}>
          {card.dataOrigin === 'REFERENCE' && <ReferenceNotice />}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
              gap: 1,
            }}
          >
            <ProgressSignal
              label={t('domains.time.recorded')}
              value={minutesLabel(card.recordedMinutes)}
              detail={t('domains.time.target', { value: minutesLabel(card.scheduledMinutes) })}
              progress={
                card.scheduledMinutes ? (card.recordedMinutes / card.scheduledMinutes) * 100 : 0
              }
            />
            <ProgressSignal
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
                    <StatusChip status={card.status} />
                  </Box>
                </Box>
                {card.status === 'OPEN' && (
                  <ActionButton
                    intent="primary"
                    size="small"
                    startIcon={<Send size={15} />}
                    disabled={
                      !card.recordedMinutes || card.exceptionCount > 0 || submitMutation.isPending
                    }
                    onClick={() => submitMutation.mutate()}
                  >
                    {t('domains.time.submit')}
                  </ActionButton>
                )}
              </Stack>
            </Paper>
          </Box>

          {(query.data?.exceptions.length ?? 0) > 0 && (
            <DomainSection
              title={t('domains.time.exceptionTitle')}
              description={t('domains.time.exceptionDescription')}
            >
              <Box>
                {(query.data?.exceptions ?? []).map((exception, index) => {
                  const canCorrect =
                    exception.lifecycleState === 'OPEN' &&
                    card.status === 'OPEN' &&
                    dates.includes(exception.occurredOn);
                  const severityColor =
                    exception.severity === 'BLOCKING'
                      ? 'error'
                      : exception.severity === 'WARNING'
                        ? 'warning'
                        : 'info';
                  return (
                    <Box key={exception.exceptionId}>
                      {index > 0 && <Divider />}
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        alignItems={{ xs: 'stretch', md: 'center' }}
                        gap={1.25}
                        sx={{ px: 2, py: 1.5 }}
                      >
                        <Stack
                          direction="row"
                          alignItems="flex-start"
                          gap={1.25}
                          minWidth={0}
                          flex={1}
                        >
                          <AlertTriangle size={18} aria-hidden="true" />
                          <Box minWidth={0}>
                            <Typography variant="body2" fontWeight={750}>
                              {exception.message}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {exception.exceptionCode} ·{' '}
                              {formatDate(exception.occurredOn, { dateStyle: 'medium' })}
                            </Typography>
                            {exception.resolutionNote && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                {exception.resolutionNote}
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                        <Stack direction="row" alignItems="center" gap={0.75}>
                          <Chip
                            size="small"
                            variant="outlined"
                            color={severityColor}
                            label={t(`domains.time.severity.${exception.severity}`)}
                          />
                          <StatusChip status={exception.lifecycleState} />
                          {canCorrect && (
                            <ActionButton
                              intent="secondary"
                              size="small"
                              startIcon={<Pencil size={14} />}
                              onClick={() =>
                                openEditor(
                                  exception.occurredOn,
                                  entriesByDate.get(exception.occurredOn)
                                )
                              }
                            >
                              {t('domains.time.correctEntry')}
                            </ActionButton>
                          )}
                        </Stack>
                      </Stack>
                    </Box>
                  );
                })}
              </Box>
            </DomainSection>
          )}

          <DomainSection
            title={t('domains.time.weekTitle')}
            description={t('domains.time.weekDescription', {
              start: formatDate(card.periodStart, { dateStyle: 'medium' }),
              end: formatDate(card.periodEnd, { dateStyle: 'medium' }),
            })}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  xl: 'repeat(7, minmax(0, 1fr))',
                },
              }}
            >
              {dates.map((date, index) => {
                const entry = entriesByDate.get(date);
                const editable = card.status === 'OPEN' && index < 5;
                return (
                  <Box
                    key={date}
                    sx={{
                      minHeight: 132,
                      p: 1.5,
                      borderTop: { xs: index ? 1 : 0, sm: index > 1 ? 1 : 0, xl: 0 },
                      borderLeft: {
                        xs: 0,
                        sm: index % 2 ? 1 : 0,
                        xl: index ? 1 : 0,
                      },
                      borderColor: 'divider',
                      bgcolor: index > 4 ? 'action.hover' : 'background.paper',
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(date, { weekday: 'short' })}
                        </Typography>
                        <Typography variant="body2" fontWeight={750}>
                          {formatDate(date, { month: 'short', day: 'numeric' })}
                        </Typography>
                      </Box>
                      {entry ? (
                        <CheckCircle2 size={17} color="#1F7A55" aria-hidden="true" />
                      ) : index < 5 ? (
                        <AlertTriangle size={17} color="#B26A00" aria-hidden="true" />
                      ) : null}
                    </Stack>
                    <Typography variant="h6" fontWeight={780} sx={{ mt: 1.5 }}>
                      {entry ? minutesLabel(entry.minutes) : '-'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {entry?.workMode
                        ? t(`domains.time.workModes.${entry.workMode}`)
                        : t('domains.time.notRecorded')}
                    </Typography>
                    {editable && (
                      <ActionButton
                        intent="quiet"
                        size="small"
                        startIcon={<Pencil size={14} />}
                        onClick={() => openEditor(date, entry)}
                        sx={{ mt: 1 }}
                      >
                        {entry ? t('domains.actions.edit') : t('domains.actions.add')}
                      </ActionButton>
                    )}
                  </Box>
                );
              })}
            </Box>
          </DomainSection>
        </Stack>
      )}

      <FormDialog
        open={Boolean(editingDate)}
        title={t('domains.time.editTitle')}
        description={editingDate ? formatDate(editingDate, { dateStyle: 'full' }) : undefined}
        cancelLabel={t('domains.actions.cancel')}
        submitLabel={t('domains.actions.save')}
        busy={saveMutation.isPending}
        submitDisabled={minutes < 1 || minutes > 1440}
        onClose={() => setEditingDate(null)}
        onSubmit={() => saveMutation.mutate()}
      >
        <Stack gap={2}>
          <FormField
            type="number"
            label={t('domains.time.minutes')}
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value))}
            slotProps={{ htmlInput: { min: 1, max: 1440, step: 30 } }}
          />
          <SelectField
            label={t('domains.time.workMode')}
            value={workMode}
            onValueChange={(value) => setWorkMode(String(value))}
            options={['OFFICE', 'REMOTE', 'FIELD', 'HYBRID'].map((modeOption) => ({
              value: modeOption,
              label: t(`domains.time.workModes.${modeOption}`),
            }))}
          />
          <FormField
            multiline
            minRows={2}
            label={t('domains.time.note')}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
        </Stack>
      </FormDialog>
    </QueryBoundary>
  );
}
