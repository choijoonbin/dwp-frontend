import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import {
  ActionButton,
  ContentDialog,
  FormField,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import { workHubStatusLabelKey } from './work-hub-presentation';
import {
  filterWorkTodayPlanCandidates,
  type WorkTodayPlanCandidateFilters,
  type WorkTodayPlanDateContext,
} from './work-today-plan-candidate-model';
import type { WorkHubItem } from './work-hub-contracts';

export function WorkTodayPlanCandidatePicker({
  candidates,
  context,
  remaining,
  disabled,
  headingId,
  registerEntry,
  registerCandidate,
  onAdd,
  onAddedFocus,
}: {
  candidates: readonly WorkHubItem[];
  context: WorkTodayPlanDateContext;
  remaining: number;
  disabled: boolean;
  headingId: string;
  registerEntry: (element: HTMLElement | null) => void;
  registerCandidate: (key: string) => (element: HTMLElement | null) => void;
  onAdd: (items: WorkHubItem[], clickDetail: number) => void;
  onAddedFocus: (key: string) => void;
}) {
  const { t } = useTranslation('work');
  const mobile = useMediaQuery('(max-width:899.95px)');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<WorkTodayPlanCandidateFilters>({
    query: '',
    due: 'all',
    status: 'all',
  });
  const lastAdded = useRef<string | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const filtered = useMemo(
    () =>
      filterWorkTodayPlanCandidates(candidates, filters, context, (item) =>
        t(`workHub.sources.${item.reference.sourceSystem}`, {
          defaultValue: t('workHub.sources.OTHER'),
        })
      ),
    [candidates, context, filters, t]
  );
  // Selection is revalidated against the latest candidate receipt before draft insertion.
  const additions = candidates.filter((item) => selected.has(item.key));
  const close = () => {
    setOpen(false);
    setSelected(new Set());
  };
  const controls = (
    <Stack gap={1.5} sx={{ mt: 1.5 }}>
      <Typography variant="caption" color="text.secondary">
        {t('workHub.todayPlan.candidateDateContext', context)}
      </Typography>
      <FormField
        inputRef={searchInput}
        label={t('workHub.todayPlan.searchLabel')}
        value={filters.query}
        onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
        <SelectField
          label={t('workHub.todayPlan.dueFilter')}
          value={filters.due}
          options={(['all', 'today', 'overdue', 'scheduled', 'none'] as const).map((value) => ({
            value,
            label: t(`workHub.todayPlan.dueFilters.${value}`),
          }))}
          onValueChange={(value) =>
            setFilters((current) => ({
              ...current,
              due: value as WorkTodayPlanCandidateFilters['due'],
            }))
          }
          sx={{ flex: 1, minWidth: 0 }}
        />
        <SelectField
          label={t('workHub.todayPlan.statusFilter')}
          value={filters.status}
          options={(['all', 'actionable', 'OPEN', 'IN_PROGRESS', 'WAITING'] as const).map(
            (value) => ({
              value,
              label: t(`workHub.todayPlan.statusFilters.${value}`),
            })
          )}
          onValueChange={(value) =>
            setFilters((current) => ({
              ...current,
              status: value as WorkTodayPlanCandidateFilters['status'],
            }))
          }
          sx={{ flex: 1, minWidth: 0 }}
        />
      </Stack>
      <Typography variant="caption" color="text.secondary" role="status">
        {t('workHub.todayPlan.candidateResultCount', { count: filtered.length })}
      </Typography>
      <Stack component="ul" gap={1} sx={{ p: 0, m: 0, listStyle: 'none' }}>
        {filtered.map((item) => (
          <Box
            component="li"
            key={item.key}
            sx={{
              minWidth: 0,
              p: 1.5,
              bgcolor: 'var(--dwp-product-soft)',
              borderRadius: (theme) => `${theme.shape.borderRadius}px`,
            }}
          >
            {mobile ? (
              <FormControlLabel
                sx={{ m: 0, alignItems: 'flex-start', width: 1 }}
                control={
                  <Checkbox
                    checked={selected.has(item.key)}
                    disabled={
                      disabled || (!selected.has(item.key) && additions.length >= remaining)
                    }
                    onChange={(_, checked) => {
                      setSelected((previous) => {
                        const next = new Set(previous);
                        if (checked) next.add(item.key);
                        else next.delete(item.key);
                        return next;
                      });
                    }}
                    sx={{ minWidth: 44, minHeight: 44 }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ py: 1, overflowWrap: 'anywhere' }}>
                    {item.title}
                  </Typography>
                }
              />
            ) : (
              <Typography
                variant="body2"
                fontWeight="fontWeightBold"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {item.title}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              {t(workHubStatusLabelKey(item))} ·{' '}
              {item.dueAt
                ? formatDate(item.dueAt, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: context.timeZone,
                  })
                : t('workHub.todayPlan.noDueDate')}{' '}
              ·{' '}
              {t(`workHub.sources.${item.reference.sourceSystem}`, {
                defaultValue: t('workHub.sources.OTHER'),
              })}
            </Typography>
            {!mobile && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <ActionButton
                  ref={registerCandidate(item.key)}
                  intent="secondary"
                  startIcon={<Plus size={17} aria-hidden="true" />}
                  disabled={disabled || remaining <= 0}
                  sx={{ minHeight: 44 }}
                  onClick={(event) => onAdd([item], event.detail)}
                >
                  {t('workHub.todayPlan.add')}
                </ActionButton>
              </Box>
            )}
          </Box>
        ))}
      </Stack>
      {filtered.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {t(
            candidates.length > 0
              ? 'workHub.todayPlan.noSearchResults'
              : 'workHub.todayPlan.noCandidates'
          )}
        </Typography>
      )}
    </Stack>
  );

  if (!mobile) {
    return (
      <Paper
        component="section"
        variant="outlined"
        aria-labelledby={headingId}
        sx={{
          p: 2,
          borderRadius: (theme) => `${theme.shape.borderRadius}px`,
          minWidth: 0,
          alignSelf: 'start',
        }}
      >
        <Typography
          ref={registerEntry}
          id={headingId}
          component="h3"
          variant="subtitle1"
          tabIndex={-1}
        >
          {t('workHub.todayPlan.candidateHeading')}
        </Typography>
        {controls}
      </Paper>
    );
  }
  return (
    <Box>
      <ActionButton
        ref={registerEntry}
        intent="secondary"
        startIcon={<Plus size={18} />}
        aria-haspopup="dialog"
        onClick={() => {
          lastAdded.current = null;
          setSelected(new Set());
          setOpen(true);
        }}
        sx={{ minHeight: 44, width: 1 }}
      >
        {t('workHub.todayPlan.openCandidatePicker')}
      </ActionButton>
      <ContentDialog
        open={open}
        fullScreen
        title={t('workHub.todayPlan.candidateHeading')}
        description={t('workHub.todayPlan.candidatePickerDescription')}
        closeLabel={t('workHub.todayPlan.cancelCandidatePicker')}
        onClose={close}
        closeButtonSx={{ minWidth: 44, minHeight: 44 }}
        slotProps={{
          transition: {
            onEntered: () => searchInput.current?.focus({ preventScroll: true }),
            onExited: () => {
              const key = lastAdded.current;
              lastAdded.current = null;
              if (key) onAddedFocus(key);
            },
          },
        }}
        footerSx={{ pb: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
        footerContent={
          <ActionButton
            intent="primary"
            disabled={disabled || additions.length === 0 || additions.length > remaining}
            onClick={() => {
              if (disabled || additions.length === 0 || additions.length > remaining) return;
              lastAdded.current = additions[0]!.key;
              onAdd(additions, 1);
              close();
            }}
            sx={{ minHeight: 44, width: 1 }}
          >
            {t('workHub.todayPlan.addSelectedCandidates', { count: additions.length })}
          </ActionButton>
        }
      >
        {remaining <= 0 && (
          <InlineFeedback severity="warning">{t('workHub.todayPlan.limitReached')}</InlineFeedback>
        )}
        {controls}
      </ContentDialog>
    </Box>
  );
}
