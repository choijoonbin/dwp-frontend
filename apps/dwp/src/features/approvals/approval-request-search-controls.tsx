import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { ActionIconButton, FormField, SelectField } from '@dwp-frontend/design-system';
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
  const statuses =
    view === 'archive'
      ? ['APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELLED']
      : view === 'needs-info'
        ? ['NEEDS_INFO']
        : ['SUBMITTED', 'IN_REVIEW', 'NEEDS_INFO'];
  const data = !search.result.isFetching && !search.result.isError ? search.result.data : undefined;
  return (
    <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'minmax(0,1fr) 150px 150px 130px' },
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
        <SelectField
          label={t('requests.search.status')}
          value={search.status}
          disabled={locked}
          options={[
            { value: '', label: t('requests.search.allStatus') },
            ...statuses.map((value) => ({ value, label: t(`status.${value}`) })),
          ]}
          onValueChange={(value) => {
            if (!locked && !isLocked?.()) search.setStatus(value ?? '');
          }}
        />
        <SelectField
          label={t('requests.search.priority')}
          value={search.priority ?? ''}
          disabled={locked}
          options={[
            { value: '', label: t('requests.search.allPriority') },
            ...(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map((value) => ({
              value,
              label: t(`priority.${value}`),
            })),
          ]}
          onValueChange={(value) => {
            if (!locked && !isLocked?.())
              search.setPriority((value || undefined) as ApprovalSearchFilters['priority']);
          }}
        />
        <SelectField
          label={t('requests.search.sort')}
          value={search.sort}
          disabled={locked}
          options={(['NEWEST', 'OLDEST'] as const).map((value) => ({
            value,
            label: t(value === 'NEWEST' ? 'requests.search.newest' : 'requests.search.oldest'),
          }))}
          onValueChange={(value) => {
            if (!locked && !isLocked?.() && (value === 'NEWEST' || value === 'OLDEST'))
              search.setSort(value);
          }}
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
    </Box>
  );
}
