// ----------------------------------------------------------------------

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Iconify, PermissionGate } from '@dwp-frontend/design-system';
import {
  trackEvent,
  PermissionRouteGuard,
  useDetectRunDetailQuery,
  useRunDetectNowMutation,
  useDetectSchedulerStatusQuery,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { BatchRunsTable } from './components/batch-runs-table';
import { useBatchTableState } from './hooks/use-batch-table-state';
import { BatchRunsFilterBar } from './components/batch-runs-filter-bar';
import { SchedulerStatusCard } from './components/scheduler-status-card';
import { RunNowConfirmDialog } from './components/run-now-confirm-dialog';
import { BatchRunDetailDrawer } from './components/batch-run-detail-drawer';

// ----------------------------------------------------------------------

export const BatchPage = () => (
  <PermissionRouteGuard resource="menu.admin.batch-monitoring" permission="VIEW" redirectTo="/403">
    <BatchPageContent />
  </PermissionRouteGuard>
);

const BatchPageContent = () => {
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
    totalPages,
    isLoading,
    error,
    refetch,
  } = useBatchTableState();

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [runNowDialogOpen, setRunNowDialogOpen] = useState(false);

  const { data: runDetail, isLoading: detailLoading, error: detailError } =
    useDetectRunDetailQuery(selectedRunId);
  const { data: schedulerStatus, isLoading: statusLoading, error: statusError } =
    useDetectSchedulerStatusQuery();
  const runNowMutation = useRunDetectNowMutation({ selectedRunId });

  useEffect(() => {
    trackEvent({
      resourceKey: 'menu.admin.batch-monitoring',
      action: 'VIEW',
      label: '배치 모니터링',
      metadata: { page: window.location.pathname },
    });
  }, []);

  const handleRowClick = useCallback((run: { runId: string | number }) => {
    const runId = String(run.runId);
    trackEvent({
      resourceKey: 'btn.admin.batch.view',
      action: 'CLICK',
      label: 'Run 상세',
      metadata: { runId },
    });
    setSelectedRunId(runId);
    setDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedRunId(null);
  }, []);

  const handleRunNowClick = useCallback(() => {
    trackEvent({
      resourceKey: 'btn.admin.batch.runNow',
      action: 'CLICK',
      label: '배치 수동 실행',
    });
    setRunNowDialogOpen(true);
  }, []);

  const handleRunNowConfirm = useCallback(() => {
    runNowMutation.mutate(undefined, {
      onSettled: () => setRunNowDialogOpen(false),
    });
  }, [runNowMutation]);

  return (
    <Box
      data-testid="page-admin-batch-monitoring"
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
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack spacing={1}>
            <Typography variant="h4">{t('batch.title')}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t('batch.subtitle')}
            </Typography>
          </Stack>
          <PermissionGate resource="menu.admin.batch-monitoring" permission="EXECUTE">
            <Button
              variant="contained"
              startIcon={<Iconify icon="solar:play-bold" width={18} />}
              onClick={handleRunNowClick}
            >
              {t('batch.runNow')}
            </Button>
          </PermissionGate>
        </Stack>

        <SchedulerStatusCard
          status={schedulerStatus}
          isLoading={statusLoading}
          error={statusError}
          onViewLastRun={(runId) => {
            setSelectedRunId(runId);
            setDrawerOpen(true);
          }}
          lastRunId={schedulerStatus?.lastRunId ?? (items[0] ? String(items[0].runId) : null)}
        />

        <BatchRunsFilterBar
          filters={filters}
          onUpdateFilter={updateFilter}
          onReset={resetFilters}
        />

        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <BatchRunsTable
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

      <BatchRunDetailDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        runId={selectedRunId}
        runDetail={runDetail}
        isLoading={detailLoading}
        error={detailError}
      />

      <RunNowConfirmDialog
        open={runNowDialogOpen}
        onClose={() => setRunNowDialogOpen(false)}
        onConfirm={handleRunNowConfirm}
        isSubmitting={runNowMutation.isPending}
      />
    </Box>
  );
};
