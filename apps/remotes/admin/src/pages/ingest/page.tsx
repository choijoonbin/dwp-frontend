// ----------------------------------------------------------------------

import { useState, useCallback } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { trackEvent , useIngestRunDetailQuery } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { IngestRunsTable } from './components/ingest-runs-table';
import { useIngestTableState } from './hooks/use-ingest-table-state';
import { IngestRunsFilterBar } from './components/ingest-runs-filter-bar';
import { IngestRunDetailDrawer } from './components/ingest-run-detail-drawer';

// ----------------------------------------------------------------------

export const IngestPage = () => {
  const { t } = useTranslation('admin');
  const {
    page,
    rowsPerPage,
    filters,
    setPage,
    setRowsPerPage,
    updateFilter,
    resetFilters,
    items,
    total,
    isLoading,
    error,
  } = useIngestTableState();

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: runDetail, isLoading: detailLoading, error: detailError } =
    useIngestRunDetailQuery(selectedRunId);

  const handleRowClick = useCallback((run: { runId: string | number }) => {
    const runId = String(run.runId);
    trackEvent({
      resourceKey: 'btn.admin.ingest.view',
      action: 'CLICK',
      label: 'Ingest Run 상세',
      metadata: { runId },
    });
    setSelectedRunId(runId);
    setDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedRunId(null);
  }, []);

  return (
    <Box
      data-testid="page-admin-ingest-monitoring"
      sx={{
        p: 3,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Stack spacing={3} sx={{ flex: 1, minHeight: 0 }}>
        <Stack spacing={1}>
          <Typography variant="h4">{t('ingest.title')}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('ingest.subtitle')}
          </Typography>
        </Stack>

        <IngestRunsFilterBar
          filters={filters}
          onUpdateFilter={updateFilter}
          onReset={resetFilters}
        />

        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <IngestRunsTable
            items={items}
            isLoading={isLoading}
            error={error}
            page={page}
            rowsPerPage={rowsPerPage}
            totalCount={total}
            onPageChange={setPage}
            onRowsPerPageChange={setRowsPerPage}
            onRowClick={handleRowClick}
          />
        </Box>
      </Stack>

      <IngestRunDetailDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        runId={selectedRunId}
        runDetail={runDetail}
        isLoading={detailLoading}
        error={detailError}
      />
    </Box>
  );
};
