import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Plus, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import {
  ActionButton,
  ContentDialog,
  FormField,
  foundationTokens,
  InlineFeedback,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import { workHubDisplayId, workHubStatusLabelKey } from './work-hub-presentation';
import {
  filterWorkTodayPlanCandidates,
  type WorkTodayPlanCandidateFilters,
  type WorkTodayPlanDateContext,
} from './work-today-plan-candidate-model';
import type { WorkHubItem } from './work-hub-contracts';

export function WorkTodayPlanCandidatePicker({
  candidates,
  context,
  planCount,
  availablePlanCount,
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
  planCount: number;
  availablePlanCount: number;
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
  const [advanced, setAdvanced] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<WorkTodayPlanCandidateFilters>({
    query: '',
    due: 'all',
    status: 'all',
  });
  const lastAdded = useRef<string | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const planAvailabilityPercent =
    planCount === 0 ? 0 : Math.round((availablePlanCount / planCount) * 100);
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
  const quickScope =
    filters.status === 'actionable' && filters.due === 'all'
      ? 'actionable'
      : filters.due === 'has' && filters.status === 'all'
        ? 'due'
        : 'all';
  const setQuickScope = (scope: 'all' | 'due' | 'actionable') => {
    setFilters((current) => ({
      ...current,
      due: scope === 'due' ? 'has' : 'all',
      status: scope === 'actionable' ? 'actionable' : 'all',
    }));
  };
  const close = () => {
    setOpen(false);
    setSelected(new Set());
  };
  const controls = (
    <Stack gap={1.25} sx={{ mt: 1.25 }}>
      <Typography variant="caption" color="text.secondary">
        {t('workHub.todayPlan.candidateDateContext', context)}
      </Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={quickScope}
        onChange={(_event, value: 'all' | 'due' | 'actionable' | null) =>
          value && setQuickScope(value)
        }
        aria-label={t('workHub.todayPlan.candidateFilter')}
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
          p: 0.5,
          bgcolor: 'var(--dwp-product-soft)',
          borderRadius: (theme) => `${theme.shape.borderRadius}px`,
          '& .MuiToggleButton-root': {
            border: 0,
            borderRadius: (theme) => `${theme.shape.borderRadius}px !important`,
            minHeight: 36,
            px: 0.75,
            whiteSpace: 'nowrap',
          },
        }}
      >
        {(['all', 'due', 'actionable'] as const).map((scope) => (
          <ToggleButton key={scope} value={scope}>
            {t(`workHub.todayPlan.candidateScopes.${scope}`)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Stack direction="row" gap={0.75} alignItems="center">
        <FormField
          inputRef={searchInput}
          size="small"
          label={t('workHub.todayPlan.searchLabel')}
          placeholder={t('workHub.todayPlan.searchLabel')}
          slotProps={{ inputLabel: { shrink: true } }}
          value={filters.query}
          onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
          sx={{
            flex: 1,
            minWidth: 0,
            '& .MuiInputBase-input': {
              backgroundColor: 'background.paper',
              color: 'text.primary',
            },
            '& .MuiInputBase-input::placeholder': {
              color: 'text.secondary',
              opacity: 1,
            },
          }}
        />
        <ActionButton
          intent="quiet"
          aria-expanded={advanced}
          aria-label={t('workHub.filters.refine')}
          onClick={() => setAdvanced((value) => !value)}
          sx={{ minWidth: 44, minHeight: 44, p: 1 }}
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
        </ActionButton>
      </Stack>
      {advanced && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
          <SelectField
            label={t('workHub.todayPlan.dueFilter')}
            value={filters.due === 'has' ? 'all' : filters.due}
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
      )}
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
              border: 1,
              borderColor: 'transparent',
              '&:hover': { borderColor: 'divider' },
              '@media (forced-colors: active)': { borderColor: 'CanvasText' },
            }}
          >
            <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
              <Typography
                variant="caption"
                sx={{
                  px: 0.75,
                  py: 0.25,
                  bgcolor: 'background.paper',
                  borderRadius:
                    foundationTokens.radius.surface - foundationTokens.radius.compact + 'px',
                  fontWeight: 'fontWeightBold',
                }}
              >
                {workHubDisplayId(item) ??
                  t(`workHub.sources.${item.reference.sourceSystem}`, {
                    defaultValue: t('workHub.sources.OTHER'),
                  })}
              </Typography>
              <Chip size="small" label={t(workHubStatusLabelKey(item))} />
            </Stack>
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
                  <Typography
                    variant="body2"
                    fontWeight="fontWeightBold"
                    sx={{ py: 1, overflowWrap: 'anywhere' }}
                  >
                    {item.title}
                  </Typography>
                }
              />
            ) : (
              <Typography
                variant="subtitle2"
                fontWeight="fontWeightBold"
                sx={{ mt: 1, overflowWrap: 'anywhere' }}
              >
                {item.title}
              </Typography>
            )}
            <Stack
              direction="row"
              gap={1}
              alignItems="center"
              justifyContent="space-between"
              sx={{ mt: 1 }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
              >
                <CalendarClock size={14} aria-hidden="true" />
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
                <ActionButton
                  ref={registerCandidate(item.key)}
                  intent="primary"
                  startIcon={<Plus size={17} aria-hidden="true" />}
                  disabled={disabled || remaining <= 0}
                  sx={{ minHeight: 44 }}
                  onClick={(event) => onAdd([item], event.detail)}
                >
                  {t('workHub.todayPlan.add')}
                </ActionButton>
              )}
            </Stack>
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
      <Stack
        component="aside"
        data-testid="work-today-plan-candidates"
        gap={1.5}
        sx={{
          minWidth: 0,
          alignSelf: 'start',
          position: 'sticky',
          top: 16,
        }}
      >
        <Paper
          data-testid="work-today-plan-candidate-rail"
          component="section"
          variant="outlined"
          aria-labelledby={headingId}
          sx={{
            p: 1.5,
            borderRadius: (theme) => `${theme.shape.borderRadius}px`,
            minWidth: 0,
            '@media (forced-colors: active)': { borderColor: 'CanvasText' },
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Typography
              ref={registerEntry}
              id={headingId}
              component="h3"
              variant="subtitle1"
              tabIndex={-1}
            >
              {t('workHub.todayPlan.candidateHeading')}
            </Typography>
            <Chip
              size="small"
              label={t('workHub.todayPlan.candidateCount', { count: candidates.length })}
            />
          </Stack>
          {controls}
          <Stack direction="row" gap={0.75} alignItems="flex-start" sx={{ mt: 1.5 }}>
            <ShieldCheck size={16} aria-hidden="true" />
            <Typography variant="caption" color="text.secondary">
              {t('workHub.todayPlan.candidatePrivacyNotice')}
            </Typography>
          </Stack>
        </Paper>
        <Paper
          data-testid="work-today-plan-readiness"
          component="section"
          variant="outlined"
          sx={{
            p: 1.5,
            bgcolor: 'var(--dwp-product-soft)',
            borderColor: 'transparent',
            '@media (forced-colors: active)': { borderColor: 'CanvasText' },
          }}
        >
          <Stack direction="row" alignItems="baseline" justifyContent="space-between" gap={1}>
            <Typography variant="subtitle2">{t('workHub.todayPlan.readinessTitle')}</Typography>
            <Typography variant="subtitle2" color="success.dark">
              {t('workHub.todayPlan.readinessValue', { percent: planAvailabilityPercent })}
            </Typography>
          </Stack>
          <Box
            role="progressbar"
            aria-label={t('workHub.todayPlan.readinessTitle')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={planAvailabilityPercent}
            sx={{
              mt: 1,
              height: 8,
              overflow: 'hidden',
              bgcolor: 'action.disabledBackground',
              borderRadius: foundationTokens.radius.control + 'px',
            }}
          >
            <Box
              sx={{
                width: `${planAvailabilityPercent}%`,
                height: 1,
                bgcolor: 'success.dark',
                transition: (theme) => theme.transitions.create('width'),
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                '@media (forced-colors: active)': { bgcolor: 'Highlight' },
              }}
            />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {planCount === 0
              ? t('workHub.todayPlan.readinessEmpty')
              : t('workHub.todayPlan.readinessDetail', {
                  available: availablePlanCount,
                  count: planCount,
                })}
          </Typography>
        </Paper>
      </Stack>
    );
  }
  return (
    <Box data-testid="work-today-plan-candidates">
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
