import { useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Plus, Save, X } from 'lucide-react';
import {
  ActionButton,
  EmptyState,
  FormField,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workHubReferenceKey, type WorkHubItem } from './work-hub-contracts';
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
  loading?: boolean;
  pending?: boolean;
  disabled?: boolean;
  error?: string | null;
  onDraftChange: (draft: WorkSourceReference[]) => void;
  onSave: (draft: WorkSourceReference[], context: WorkTodayPlanSaveContext) => void | Promise<void>;
  onSelect?: (item: WorkHubItem) => void;
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
  const byKey = new Map(items.map((item) => [item.key, item]));
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
  return items.filter((item) => !selected.has(item.key) && !terminal.has(item.lifecycle));
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
  loading = false,
  pending = false,
  disabled = false,
  error,
  onDraftChange,
  onSave,
  onSelect,
}: WorkTodayPlanPanelProps) {
  const { t } = useTranslation('work');
  const selectedHeadingId = useId();
  const candidatesHeadingId = useId();
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const intent = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);
  const rows = useMemo(() => workTodayPlanRows(items, draft, plan), [draft, items, plan]);
  const candidates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return workTodayPlanCandidates(items, draft, plan).filter(
      (item) =>
        !normalized ||
        [
          item.title,
          t(`workHub.sources.${item.reference.sourceSystem}`, {
            defaultValue: t('workHub.sources.OTHER'),
          }),
        ].some((value) => value.toLocaleLowerCase().includes(normalized))
    );
  }, [draft, items, plan, query, t]);
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
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 'shape.borderRadius' }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography component="h2" variant="h6">
            {t('workHub.todayPlan.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('workHub.todayPlan.description', { date })}
          </Typography>
        </Box>

        <InlineFeedback severity="info">{t('workHub.todayPlan.independenceNotice')}</InlineFeedback>
        {(error || saveFailed) && (
          <InlineFeedback severity="error">
            {error || t('workHub.todayPlan.saveFailed')}
          </InlineFeedback>
        )}
        {full && (
          <InlineFeedback severity="warning">{t('workHub.todayPlan.limitReached')}</InlineFeedback>
        )}

        <Box component="section" aria-labelledby={selectedHeadingId}>
          <Typography id={selectedHeadingId} component="h3" variant="subtitle1">
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
                    sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}
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
                        {row.item && onSelect ? (
                          <ActionButton
                            intent="quiet"
                            sx={{ minHeight: 44, maxWidth: 1, justifyContent: 'flex-start' }}
                            onClick={() => onSelect(row.item!)}
                          >
                            <Typography component="span" variant="body2" sx={{ textAlign: 'left' }}>
                              {title}
                            </Typography>
                          </ActionButton>
                        ) : (
                          <Typography variant="body2" fontWeight="fontWeightBold">
                            {title}
                          </Typography>
                        )}
                        <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 0.75 }}>
                          {row.item ? (
                            <>
                              <Chip
                                size="small"
                                variant="outlined"
                                label={t(`workHub.lifecycle.${row.item.lifecycle}`)}
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
                      <Stack
                        direction="row"
                        gap={0.5}
                        justifyContent={{ xs: 'flex-end', sm: 'start' }}
                      >
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
                          sx={{ minWidth: 44, minHeight: 44, p: 1 }}
                          onClick={() =>
                            replace(
                              draft.filter(
                                (reference) =>
                                  workHubReferenceKey(reference) !==
                                  workHubReferenceKey(row.reference)
                              )
                            )
                          }
                        >
                          <X size={18} aria-hidden="true" />
                        </ActionButton>
                      </Stack>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        <Divider />
        <Box component="section" aria-labelledby={candidatesHeadingId}>
          <Typography id={candidatesHeadingId} component="h3" variant="subtitle1">
            {t('workHub.todayPlan.candidateHeading')}
          </Typography>
          <FormField
            label={t('workHub.todayPlan.searchLabel')}
            value={query}
            disabled={busy}
            sx={{ mt: 1.5 }}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Stack component="ul" spacing={1} sx={{ p: 0, m: 0, mt: 1.5, listStyle: 'none' }}>
            {candidates.map((item) => (
              <Box
                component="li"
                key={item.key}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  minWidth: 0,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight="fontWeightBold">
                    {item.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(`workHub.lifecycle.${item.lifecycle}`)} ·{' '}
                    {item.dueAt
                      ? formatDate(item.dueAt, { dateStyle: 'medium', timeStyle: 'short' })
                      : t('workHub.todayPlan.noDueDate')}{' '}
                    ·{' '}
                    {t(`workHub.sources.${item.reference.sourceSystem}`, {
                      defaultValue: t('workHub.sources.OTHER'),
                    })}
                  </Typography>
                </Box>
                <ActionButton
                  intent="secondary"
                  startIcon={<Plus size={17} aria-hidden="true" />}
                  disabled={controlsDisabled || full}
                  sx={{ minHeight: 44, flexShrink: 0 }}
                  onClick={() => replace(addDayPlanReference(draft, item.reference))}
                >
                  {t('workHub.todayPlan.add')}
                </ActionButton>
              </Box>
            ))}
          </Stack>
          {candidates.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {t(query ? 'workHub.todayPlan.noSearchResults' : 'workHub.todayPlan.noCandidates')}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
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
    </Paper>
  );
}
