import { useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarClock,
  CirclePlay,
  ClipboardPlus,
  GripVertical,
  Save,
  Target,
  X,
} from 'lucide-react';
import {
  ActionButton,
  EmptyState,
  InlineFeedback,
  LoadingState,
  useDateTimePolicy,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workHubReferenceKey, type WorkHubItem } from './work-hub-contracts';
import { workHubDisplayId, workHubStatusLabelKey } from './work-hub-presentation';
import { useWorkTodayPlanFocus } from './use-work-today-plan-focus';
import { WorkTodayPlanCandidatePicker } from './work-today-plan-candidate-picker';
import { isWorkDueOnPlanDate } from './work-today-plan-candidate-model';
import { canUseWorkHubGenericAdjunct } from './work-hub-command-authority';
import {
  addDayPlanReference,
  moveDayPlanReference,
  resolveDayPlanReference,
  resolveDayPlanReferences,
} from './work-hub-model';

import type {
  PersonalDayPlan,
  WorkSourceReference,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';

export type WorkTodayPlanSaveContext = { idempotencyKey: string };

export type WorkTodayPlanPanelProps = {
  items: readonly WorkHubItem[];
  draft: readonly WorkSourceReference[];
  plan?: PersonalDayPlan | null;
  intentVersion?: string | number;
  date: string;
  now?: number;
  loading?: boolean;
  pending?: boolean;
  disabled?: boolean;
  error?: string | null;
  onDraftChange: (draft: WorkSourceReference[]) => void;
  onSave: (draft: WorkSourceReference[], context: WorkTodayPlanSaveContext) => void | Promise<void>;
  onSelect?: (item: WorkHubItem) => void;
  onSchedule?: (item: WorkHubItem) => void;
};

export type WorkTodayPlanRow = {
  reference: WorkSourceReference;
  item: WorkHubItem | null;
};

const MAX_PLAN_ITEMS = 100;
const terminal = new Set(['COMPLETED', 'CANCELLED', 'ARCHIVED']);

export function workTodayPlanRows(
  items: readonly WorkHubItem[],
  draft: readonly WorkSourceReference[],
  plan: PersonalDayPlan | null = null
): WorkTodayPlanRow[] {
  const byKey = new Map(
    items
      .filter((item) => canUseWorkHubGenericAdjunct(item, 'DAY_PLAN'))
      .map((item) => [item.key, item])
  );
  return draft.map((reference) => ({
    reference,
    item: (() => {
      const resolved = resolveDayPlanReference(plan, reference);
      return resolved ? (byKey.get(workHubReferenceKey(resolved)) ?? null) : null;
    })(),
  }));
}

export function workTodayPlanCandidates(
  items: readonly WorkHubItem[],
  draft: readonly WorkSourceReference[],
  plan: PersonalDayPlan | null = null
): WorkHubItem[] {
  const selected = new Set(resolveDayPlanReferences(plan, draft).map(workHubReferenceKey));
  return items.filter(
    (item) =>
      canUseWorkHubGenericAdjunct(item, 'DAY_PLAN') &&
      !selected.has(item.key) &&
      !terminal.has(item.lifecycle)
  );
}

function saveKey() {
  return crypto.randomUUID();
}

export function WorkTodayPlanPanel({
  items,
  draft,
  plan = null,
  intentVersion = 0,
  date,
  now = Date.now(),
  loading = false,
  pending = false,
  disabled = false,
  error,
  onDraftChange,
  onSave,
  onSelect,
  onSchedule,
}: WorkTodayPlanPanelProps) {
  const { t } = useTranslation('work');
  const { timeZone } = useDateTimePolicy();
  const selectedHeadingId = useId();
  const candidatesHeadingId = useId();
  const dateContext = useMemo(() => ({ date, timeZone, now }), [date, timeZone, now]);
  const dragIndex = useRef<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const intent = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);
  const focus = useWorkTodayPlanFocus(draft);
  const rows = useMemo(() => workTodayPlanRows(items, draft, plan), [draft, items, plan]);
  const candidates = useMemo(
    () => workTodayPlanCandidates(items, draft, plan),
    [items, draft, plan]
  );
  const busy = pending || saving;
  const controlsDisabled = busy || disabled;
  const full = draft.length >= MAX_PLAN_ITEMS;

  const replace = (next: WorkSourceReference[]) => {
    setSaveFailed(false);
    onDraftChange(next);
  };
  const save = async () => {
    if (busy || disabled) return;
    const next = [...draft];
    const fingerprint = JSON.stringify([intentVersion, next.map(workHubReferenceKey)]);
    if (intent.current?.fingerprint !== fingerprint) {
      intent.current = { fingerprint, idempotencyKey: saveKey() };
    }
    setSaving(true);
    setSaveFailed(false);
    try {
      await onSave(next, { idempotencyKey: intent.current.idempotencyKey });
      intent.current = null;
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState label={t('workHub.todayPlan.loading')} variant="skeleton" size="page" />;
  }

  return (
    <Box data-testid="work-today-plan-page">
      <Stack spacing={{ xs: 1.5, md: 2.5 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          gap={2}
          justifyContent="space-between"
          alignItems={{ sm: 'center' }}
        >
          <Box>
            <Typography component="h2" variant="h6" sx={{ display: { xs: 'none', md: 'block' } }}>
              {t('workHub.todayPlan.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('workHub.todayPlan.description', { date })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('workHub.schedule.timeZone', { zone: timeZone })}
            </Typography>
          </Box>
          <ActionButton
            intent="primary"
            startIcon={<Save size={17} />}
            loading={busy}
            loadingLabel={t('workHub.todayPlan.saving')}
            disabled={disabled}
            onClick={() => void save()}
            sx={{ '@media (max-width:899.95px)': { minHeight: 44 } }}
          >
            {t('workHub.todayPlan.save')}
          </ActionButton>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: 'repeat(4,minmax(0,1fr))' },
            gap: 1.5,
          }}
        >
          {[
            { key: 'selectedMetric', value: rows.length, color: 'primary.main', Icon: Target },
            {
              key: 'dueMetric',
              value: rows.filter((row) => row.item && isWorkDueOnPlanDate(row.item, dateContext))
                .length,
              color: 'error.main',
              Icon: CalendarClock,
            },
            {
              key: 'progressMetric',
              value: rows.filter((row) => row.item?.lifecycle === 'IN_PROGRESS').length,
              color: 'info.main',
              Icon: CirclePlay,
            },
            {
              key: 'candidateMetric',
              value: workTodayPlanCandidates(items, draft, plan).length,
              color: 'success.main',
              Icon: ClipboardPlus,
            },
          ].map(({ key, value, color, Icon }) => (
            <Paper
              key={key}
              variant="outlined"
              sx={{
                p: { xs: 1.25, sm: 2 },
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: (theme) => `${theme.shape.borderRadius}px`,
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t(`workHub.todayPlan.${key}`)}
                </Typography>
                <Typography variant="h4" sx={{ mt: { xs: 0.25, sm: 0.75 }, color }}>
                  {value}
                </Typography>
              </Box>
              <Box
                sx={{
                  display: { xs: 'none', sm: 'grid' },
                  placeItems: 'center',
                  p: 1.25,
                  color,
                  bgcolor: 'var(--dwp-product-soft)',
                  borderRadius: (theme) => `${theme.shape.borderRadius}px`,
                }}
              >
                <Icon size={21} aria-hidden="true" />
              </Box>
            </Paper>
          ))}
        </Box>

        {(error || saveFailed) && (
          <InlineFeedback severity="error">
            {error || t('workHub.todayPlan.saveFailed')}
          </InlineFeedback>
        )}
        {full && (
          <InlineFeedback severity="warning">{t('workHub.todayPlan.limitReached')}</InlineFeedback>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'minmax(0,1.75fr) minmax(260px,1fr)' },
            gap: 2,
          }}
        >
          <Box component="section" aria-labelledby={selectedHeadingId} sx={{ minWidth: 0 }}>
            <Typography
              ref={focus.selectedHeading}
              id={selectedHeadingId}
              component="h3"
              variant="subtitle1"
              tabIndex={-1}
            >
              {t('workHub.todayPlan.selectedHeading', { count: rows.length })}
            </Typography>
            {rows.length === 0 ? (
              <EmptyState
                title={t('workHub.todayPlan.emptyTitle')}
                description={t('workHub.todayPlan.emptyDescription')}
                size="compact"
              />
            ) : (
              <Box component="ol" sx={{ p: 0, m: 0, mt: 1.5, listStyle: 'none' }}>
                {rows.map((row, index) => {
                  const title = row.item?.title ?? t('workHub.todayPlan.unavailableTitle');
                  return (
                    <Box
                      component="li"
                      key={workHubReferenceKey(row.reference)}
                      draggable={!controlsDisabled}
                      onDragStart={() => {
                        dragIndex.current = index;
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (
                          !controlsDisabled &&
                          dragIndex.current !== null &&
                          dragIndex.current !== index
                        )
                          replace(moveDayPlanReference(draft, dragIndex.current, index));
                        dragIndex.current = null;
                      }}
                      onDragEnd={() => {
                        dragIndex.current = null;
                      }}
                      sx={{
                        p: 1.75,
                        mb: 1.25,
                        border: 1,
                        borderInlineStart: 4,
                        borderColor: 'divider',
                        borderInlineStartColor:
                          row.item?.waitingFor === 'ME' ? 'primary.main' : 'divider',
                        bgcolor: 'background.paper',
                        borderRadius: (theme) => `${theme.shape.borderRadius}px`,
                      }}
                    >
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
                          alignItems: 'center',
                          gap: 1.5,
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                            <GripVertical size={14} aria-hidden="true" />
                            <Typography variant="caption" color="text.secondary">
                              {String(index + 1).padStart(2, '0')} ·{' '}
                              {row.item
                                ? workHubDisplayId(row.item)
                                : t('workHub.todayPlan.unavailableStatus')}
                            </Typography>
                            {row.item && (
                              <Chip
                                size="small"
                                label={t(`workHub.sources.${row.item.reference.sourceSystem}`, {
                                  defaultValue: t('workHub.sources.OTHER'),
                                })}
                                sx={{ bgcolor: 'var(--dwp-product-soft)' }}
                              />
                            )}
                          </Stack>
                          {row.item && onSelect ? (
                            <ActionButton
                              ref={focus.register('selected', workHubReferenceKey(row.reference))}
                              intent="quiet"
                              sx={{ minHeight: 44, maxWidth: 1, justifyContent: 'flex-start' }}
                              onClick={() => onSelect(row.item!)}
                            >
                              <Typography
                                component="span"
                                variant="body2"
                                sx={{ textAlign: 'left' }}
                              >
                                {title}
                              </Typography>
                            </ActionButton>
                          ) : (
                            <Typography
                              ref={focus.register('selected', workHubReferenceKey(row.reference))}
                              tabIndex={-1}
                              variant="body2"
                              fontWeight="fontWeightBold"
                            >
                              {title}
                            </Typography>
                          )}
                          <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 0.75 }}>
                            {row.item ? (
                              <>
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={t(workHubStatusLabelKey(row.item))}
                                />
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={
                                    row.item.dueAt
                                      ? formatDate(row.item.dueAt, {
                                          dateStyle: 'medium',
                                          timeStyle: 'short',
                                        })
                                      : t('workHub.todayPlan.noDueDate')
                                  }
                                />
                              </>
                            ) : (
                              <Chip
                                size="small"
                                variant="outlined"
                                label={t('workHub.todayPlan.unavailableStatus')}
                              />
                            )}
                          </Stack>
                        </Box>
                        <Stack gap={0.5} alignItems={{ xs: 'stretch', sm: 'flex-end' }}>
                          {row.item && onSelect && (
                            <ActionButton
                              intent="secondary"
                              endIcon={<ArrowRight size={16} aria-hidden="true" />}
                              onClick={() => onSelect(row.item!)}
                              sx={{ minHeight: 44 }}
                            >
                              {t('workHub.todayPlan.openWork')}
                            </ActionButton>
                          )}
                          <Stack
                            direction="row"
                            gap={0.5}
                            flexWrap="wrap"
                            justifyContent="flex-end"
                          >
                            {row.item && onSchedule && (
                              <ActionButton
                                intent="quiet"
                                aria-label={t('workHub.actions.scheduleNamed', { title })}
                                onClick={() => onSchedule(row.item!)}
                                disabled={controlsDisabled}
                                sx={{ minWidth: 44, minHeight: 44, p: 1 }}
                              >
                                <CalendarClock size={18} />
                              </ActionButton>
                            )}
                            <ActionButton
                              intent="quiet"
                              aria-label={t('workHub.todayPlan.moveUp', { title })}
                              disabled={controlsDisabled || index === 0}
                              sx={{ minWidth: 44, minHeight: 44, p: 1 }}
                              onClick={() => replace(moveDayPlanReference(draft, index, index - 1))}
                            >
                              <ArrowUp size={18} aria-hidden="true" />
                            </ActionButton>
                            <ActionButton
                              intent="quiet"
                              aria-label={t('workHub.todayPlan.moveDown', { title })}
                              disabled={controlsDisabled || index === rows.length - 1}
                              sx={{ minWidth: 44, minHeight: 44, p: 1 }}
                              onClick={() => replace(moveDayPlanReference(draft, index, index + 1))}
                            >
                              <ArrowDown size={18} aria-hidden="true" />
                            </ActionButton>
                            <ActionButton
                              intent="quiet"
                              aria-label={t('workHub.todayPlan.remove', { title })}
                              disabled={controlsDisabled}
                              sx={{ minWidth: 44, minHeight: 44, p: 1, color: 'error.main' }}
                              onClick={(event) => {
                                focus.request(
                                  'candidate',
                                  row.item?.key ?? workHubReferenceKey(row.reference),
                                  event.detail
                                );
                                replace(
                                  draft.filter(
                                    (reference) =>
                                      workHubReferenceKey(reference) !==
                                      workHubReferenceKey(row.reference)
                                  )
                                );
                              }}
                            >
                              <X size={18} aria-hidden="true" />
                              <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>
                                {t('workHub.todayPlan.removeLabel')}
                              </Typography>
                            </ActionButton>
                          </Stack>
                        </Stack>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>

          <WorkTodayPlanCandidatePicker
            candidates={candidates}
            context={dateContext}
            remaining={MAX_PLAN_ITEMS - draft.length}
            disabled={controlsDisabled}
            headingId={candidatesHeadingId}
            registerEntry={(element) => {
              focus.candidatesHeading.current = element;
            }}
            registerCandidate={(key) => focus.register('candidate', key)}
            onAdd={(additions, clickDetail) => {
              if (controlsDisabled || draft.length + additions.length > MAX_PLAN_ITEMS) return;
              focus.request('selected', additions[0]!.key, clickDetail);
              replace(
                additions.reduce(
                  (next, item) => addDayPlanReference(next, item.reference),
                  [...draft]
                )
              );
            }}
            onAddedFocus={(key) => focus.moveTo('selected', key)}
          />
        </Box>

        <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'flex-end' }}>
          <ActionButton
            intent="primary"
            startIcon={<Save size={17} aria-hidden="true" />}
            loading={busy}
            loadingLabel={t('workHub.todayPlan.saving')}
            disabled={disabled}
            sx={{ minHeight: 44, width: { xs: 1, sm: 'auto' } }}
            onClick={() => void save()}
          >
            {t('workHub.todayPlan.save')}
          </ActionButton>
        </Box>
      </Stack>
    </Box>
  );
}
