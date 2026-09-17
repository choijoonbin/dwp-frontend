import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, RotateCcw, SlidersHorizontal } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ApprovalSearchFilters } from '@dwp-frontend/shared-utils';
import type { ApprovalRequestView } from './approval-request-model';
import type { useApprovalRequestSearch } from './use-approval-request-search';

export function ApprovalRequestSearchControls({
  search,
  view,
  locked,
  isLocked,
}: {
  search: ReturnType<typeof useApprovalRequestSearch>;
  view: ApprovalRequestView;
  locked: boolean;
  isLocked?: () => boolean;
}) {
  const { t } = useTranslation('approvals');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileFilters, setMobileFilters] = useState<{
    status: string;
    priority: ApprovalSearchFilters['priority'];
    sort: 'NEWEST' | 'OLDEST';
  }>({ status: search.status, priority: search.priority, sort: search.sort });
  const statuses =
    view === 'archive'
      ? ['APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELLED']
      : view === 'needs-info'
        ? ['NEEDS_INFO']
        : ['SUBMITTED', 'IN_REVIEW', 'NEEDS_INFO'];
  const data = !search.result.isFetching && !search.result.isError ? search.result.data : undefined;
  const statusOptions = [
    { value: '', label: t('requests.search.allStatus') },
    ...statuses.map((value) => ({ value, label: t(`status.${value}`) })),
  ];
  const priorityOptions = [
    { value: '', label: t('requests.search.allPriority') },
    ...(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map((value) => ({
      value,
      label: t(`priority.${value}`),
    })),
  ];
  const sortOptions = (['NEWEST', 'OLDEST'] as const).map((value) => ({
    value,
    label: t(value === 'NEWEST' ? 'requests.search.newest' : 'requests.search.oldest'),
  }));
  const openFilters = () => {
    if (locked || isLocked?.()) return;
    setMobileFilters({ status: search.status, priority: search.priority, sort: search.sort });
    setFiltersOpen(true);
  };
  const applyFilters = () => {
    if (locked || isLocked?.()) return;
    search.setStatus(mobileFilters.status);
    search.setPriority(mobileFilters.priority);
    search.setSort(mobileFilters.sort);
    setFiltersOpen(false);
  };
  return (
    <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0,1fr) auto',
            md: 'minmax(0,1fr) 150px 150px 130px',
          },
          gap: 1.5,
        }}
      >
        <FormField
          label={t('requests.search.label')}
          value={search.text}
          disabled={locked}
          onChange={(event) => {
            if (!locked && !isLocked?.()) search.setText(event.target.value);
          }}
          inputProps={{ maxLength: 200 }}
          sx={{ minWidth: 0 }}
        />
        <ActionButton
          type="button"
          intent="secondary"
          startIcon={<SlidersHorizontal size={17} />}
          disabled={locked}
          onClick={openFilters}
          sx={{ display: { xs: 'flex', md: 'none' }, minWidth: 44, minHeight: 44 }}
        >
          {t('requests.search.filters')}
        </ActionButton>
        <SelectField
          label={t('requests.search.status')}
          value={search.status}
          disabled={locked}
          options={statusOptions}
          onValueChange={(value) => {
            if (!locked && !isLocked?.()) search.setStatus(value ?? '');
          }}
          sx={{ display: { xs: 'none', md: 'flex' } }}
        />
        <SelectField
          label={t('requests.search.priority')}
          value={search.priority ?? ''}
          disabled={locked}
          options={priorityOptions}
          onValueChange={(value) => {
            if (!locked && !isLocked?.())
              search.setPriority((value || undefined) as ApprovalSearchFilters['priority']);
          }}
          sx={{ display: { xs: 'none', md: 'flex' } }}
        />
        <SelectField
          label={t('requests.search.sort')}
          value={search.sort}
          disabled={locked}
          options={sortOptions}
          onValueChange={(value) => {
            if (!locked && !isLocked?.() && (value === 'NEWEST' || value === 'OLDEST'))
              search.setSort(value);
          }}
          sx={{ display: { xs: 'none', md: 'flex' } }}
        />
      </Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        useFlexGap
        flexWrap="wrap"
        sx={{ pt: 1 }}
      >
        <Typography variant="caption" color="text.secondary">
          {data &&
            t('requests.search.evaluated', {
              at: formatDate(data.evaluatedAt, { dateStyle: 'short', timeStyle: 'short' }),
            })}
        </Typography>
        <Stack direction="row" alignItems="center" gap={1}>
          <ActionIconButton
            label={t('requests.search.reset')}
            disabled={locked || !search.filtered}
            onClick={() => {
              if (!locked && !isLocked?.()) search.reset();
            }}
          >
            <RotateCcw size={16} />
          </ActionIconButton>
          <Typography variant="caption">
            {t('requests.drafts.page', {
              page: search.page + 1,
              total: Math.max(1, data?.totalPages ?? 1),
            })}
          </Typography>
          <ActionIconButton
            label={t('common:actions.previous')}
            disabled={locked || search.result.isFetching || search.page === 0}
            onClick={() => {
              if (!locked && !isLocked?.()) search.setPage(search.page - 1);
            }}
          >
            <ArrowLeft size={16} />
          </ActionIconButton>
          <ActionIconButton
            label={t('common:actions.next')}
            disabled={locked || search.result.isFetching || !data?.hasNext}
            onClick={() => {
              if (!locked && !isLocked?.()) search.setPage(search.page + 1);
            }}
          >
            <ArrowRight size={16} />
          </ActionIconButton>
        </Stack>
      </Stack>
      <FormDialog
        open={filtersOpen}
        title={t('requests.search.filters')}
        cancelLabel={t('common:actions.cancel')}
        submitLabel={t('requests.search.applyFilters')}
        submitDisabled={locked}
        mobileFullScreen
        onClose={() => setFiltersOpen(false)}
        onSubmit={applyFilters}
        secondaryActions={
          <ActionButton
            type="button"
            intent="quiet"
            startIcon={<RotateCcw size={16} />}
            disabled={locked}
            onClick={() => setMobileFilters({ status: '', priority: undefined, sort: 'NEWEST' })}
          >
            {t('requests.search.reset')}
          </ActionButton>
        }
      >
        <Stack gap={2}>
          <SelectField
            label={t('requests.search.status')}
            value={mobileFilters.status}
            disabled={locked}
            options={statusOptions}
            onValueChange={(value) =>
              setMobileFilters((current) => ({ ...current, status: value ?? '' }))
            }
          />
          <SelectField
            label={t('requests.search.priority')}
            value={mobileFilters.priority ?? ''}
            disabled={locked}
            options={priorityOptions}
            onValueChange={(value) =>
              setMobileFilters((current) => ({
                ...current,
                priority: (value || undefined) as ApprovalSearchFilters['priority'],
              }))
            }
          />
          <SelectField
            label={t('requests.search.sort')}
            value={mobileFilters.sort}
            disabled={locked}
            options={sortOptions}
            onValueChange={(value) => {
              if (value === 'NEWEST' || value === 'OLDEST')
                setMobileFilters((current) => ({ ...current, sort: value }));
            }}
          />
        </Stack>
      </FormDialog>
    </Box>
  );
}
