import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Download, ScrollText, Search } from 'lucide-react';
import {
  ActionButton,
  EnterpriseDataGrid,
  FormField,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  exportDwaionGovernanceAudit,
  listDwaionGovernanceAudit,
  type DwaionGovernanceAuditEvent,
  usePermissions,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';

import { DwaionRetentionPolicy } from './dwaion-admin';
import { DwaionAdminPageHeader } from './dwaion-admin-ui';

import type { GridColDef, GridPaginationModel } from '@mui/x-data-grid';

const CATEGORY_OPTIONS = [
  { value: 'ALL', label: 'ALL' },
  ...(['SOURCE', 'ACTION', 'SAFETY', 'EVALUATION', 'RETENTION'] as const).map((value) => ({
    value,
    label: value,
  })),
] as const;

export function DwaionAdminAudit() {
  const { t } = useTranslation('work');
  const { hasPermission } = usePermissions();
  const canViewRetention =
    hasPermission('ADMIN.DWAION_RETENTION', 'VIEW') ||
    hasPermission('ADMIN.DWAION_RETENTION', 'MANAGE');
  const canViewAudit =
    hasPermission('ADMIN.DWAION_AUDIT', 'VIEW') || hasPermission('ADMIN.DWAION_AUDIT', 'MANAGE');
  const canExport =
    hasPermission('ADMIN.DWAION_AUDIT', 'EXPORT') || hasPermission('ADMIN.DWAION_AUDIT', 'MANAGE');
  const [category, setCategory] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [queryText, setQueryText] = useState('');
  const [pagination, setPagination] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [exporting, setExporting] = useState(false);
  const query = useQuery({
    queryKey: ['dwaion', 'admin', 'audit', category, queryText, pagination],
    queryFn: () =>
      listDwaionGovernanceAudit({
        category: category === 'ALL' ? undefined : category,
        query: queryText,
        page: pagination.page,
        size: pagination.pageSize,
      }),
    enabled: canViewAudit,
    staleTime: 15_000,
  });
  const columns = useMemo<GridColDef<DwaionGovernanceAuditEvent>[]>(
    () => [
      {
        field: 'createdAt',
        headerName: t('dwaionAdmin.audit.columns.time'),
        minWidth: 190,
        flex: 0.8,
        valueGetter: (_, row) =>
          formatDate(row.createdAt, { dateStyle: 'medium', timeStyle: 'medium' }),
      },
      {
        field: 'category',
        headerName: t('dwaionAdmin.audit.columns.category'),
        width: 118,
        renderCell: ({ row }) => <Chip size="small" variant="outlined" label={row.category} />,
      },
      {
        field: 'eventType',
        headerName: t('dwaionAdmin.audit.columns.event'),
        minWidth: 220,
        flex: 1,
      },
      {
        field: 'targetKey',
        headerName: t('dwaionAdmin.audit.columns.target'),
        minWidth: 180,
        flex: 0.9,
      },
      { field: 'actorUserId', headerName: t('dwaionAdmin.audit.columns.actor'), width: 118 },
      {
        field: 'changeReason',
        headerName: t('dwaionAdmin.audit.columns.reason'),
        minWidth: 240,
        flex: 1.2,
        valueGetter: (_, row) => row.changeReason || '—',
      },
      {
        field: 'correlationId',
        headerName: t('dwaionAdmin.audit.columns.correlation'),
        minWidth: 190,
        flex: 0.8,
      },
    ],
    [t]
  );
  const exportAudit = async () => {
    setExporting(true);
    try {
      const blob = await exportDwaionGovernanceAudit({
        category: category === 'ALL' ? undefined : category,
        query: queryText,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'dwaion-governance-audit.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      {canViewRetention && <DwaionRetentionPolicy />}
      {canViewAudit && (
        <PageCanvas>
          <DwaionAdminPageHeader
            eyebrow={t('dwaionAdmin.shared.governance')}
            title={t('dwaionAdmin.audit.title')}
            description={t('dwaionAdmin.audit.description')}
            actions={
              canExport ? (
                <ActionButton
                  intent="secondary"
                  startIcon={<Download size={16} />}
                  loading={exporting}
                  onClick={() => void exportAudit()}
                >
                  {t('dwaionAdmin.audit.export')}
                </ActionButton>
              ) : undefined
            }
          />
          {query.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {t('dwaionAdmin.audit.error')}
            </Alert>
          )}
          <Stack
            component="form"
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.25}
            alignItems={{ xs: 'stretch', md: 'flex-start' }}
            sx={{ mt: 3 }}
            onSubmit={(event) => {
              event.preventDefault();
              setPagination((value) => ({ ...value, page: 0 }));
              setQueryText(search.trim());
            }}
          >
            <FormField
              label={t('dwaionAdmin.audit.searchLabel')}
              placeholder={t('dwaionAdmin.audit.searchPlaceholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={{ minWidth: { md: 320 } }}
            />
            <SelectField
              label={t('dwaionAdmin.audit.categoryLabel')}
              value={category}
              options={CATEGORY_OPTIONS}
              onValueChange={(value) => {
                if (value) {
                  setCategory(String(value));
                  setPagination((current) => ({ ...current, page: 0 }));
                }
              }}
              sx={{ minWidth: { md: 190 } }}
            />
            <ActionButton
              type="submit"
              intent="secondary"
              startIcon={<Search size={16} />}
              sx={{ mt: { md: 3 } }}
            >
              {t('dwaionAdmin.audit.search')}
            </ActionButton>
          </Stack>
          <Box sx={{ mt: 2, borderBlock: 1, borderColor: 'divider' }}>
            <EnterpriseDataGrid
              ariaLabel={t('dwaionAdmin.audit.tableLabel')}
              mode="server"
              rows={query.data?.content ?? []}
              columns={columns}
              getRowId={(row) => row.eventId}
              loading={query.isLoading}
              rowCount={query.data?.totalElements ?? 0}
              paginationModel={pagination}
              onPaginationModelChange={setPagination}
              pageSizeOptions={[25, 50, 100]}
              sx={{ border: 0, borderRadius: 0 }}
            />
          </Box>
          <Alert severity="info" icon={<ScrollText size={19} />} sx={{ mt: 2 }}>
            {t('dwaionAdmin.audit.appendOnly')}
          </Alert>
        </PageCanvas>
      )}
    </>
  );
}
