// ----------------------------------------------------------------------

import type { AuditLogSummary } from '@dwp-frontend/shared-utils';

import { useState, useEffect, useCallback } from 'react';
import { trackEvent, PermissionRouteGuard , useAdminAuditLogDetailQuery, useExportAdminAuditLogsMutation } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';

import { AuditLogsTable } from './components/audit-logs-table';
import { AuditLogsFilterBar } from './components/audit-logs-filter-bar';
import { AuditLogDetailDrawer } from './components/audit-log-detail-drawer';
import { useAuditLogsTableState } from './hooks/use-audit-logs-table-state';

// ----------------------------------------------------------------------

export const AuditPage = () => (
  <PermissionRouteGuard resource="menu.admin.audit" permission="VIEW" redirectTo="/403">
    <AuditPageContent />
  </PermissionRouteGuard>
);

const AuditPageContent = () => {
  const {
    page,
    rowsPerPage,
    filters,
    setPage,
    setRowsPerPage,
    updateFilter,
    resetFilters,
    data,
    isLoading,
    error,
    params,
  } = useAuditLogsTableState();

  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const { data: logDetail, isLoading: detailLoading, error: detailError } = useAdminAuditLogDetailQuery(
    selectedLogId || ''
  );
  const exportMutation = useExportAdminAuditLogsMutation();

  // Track page view
  useEffect(() => {
    trackEvent({
      resourceKey: 'menu.admin.audit',
      action: 'VIEW',
      label: '감사 로그',
      metadata: {
        page: window.location.pathname,
      },
    });
  }, []);

  const handleRowClick = useCallback((log: AuditLogSummary) => {
    trackEvent({
      resourceKey: 'btn.admin.audit.view',
      action: 'CLICK',
      label: '감사 로그 상세',
      metadata: {
        logId: log.id,
        actor: log.actor,
        action: log.action,
      },
    });
    setSelectedLogId(log.id);
    setDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    setSelectedLogId(null);
  }, []);

  const showSnackbar = useCallback((message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleExport = useCallback(async () => {
    try {
      trackEvent({
        resourceKey: 'btn.admin.audit.export',
        action: 'CLICK',
        label: 'Excel 다운로드',
        metadata: {
          from: params.from,
          to: params.to,
          actor: params.actor,
          action: params.action,
        },
      });

      const blob = await exportMutation.mutateAsync(params);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showSnackbar('Excel 파일이 다운로드되었습니다.');
      trackEvent({
        resourceKey: 'menu.admin.audit',
        action: 'EXPORT',
        label: 'Excel 다운로드 완료',
        metadata: {
          from: params.from,
          to: params.to,
        },
      });
    } catch (err) {
      showSnackbar(err instanceof Error ? err.message : '다운로드에 실패했습니다.', 'error');
      trackEvent({
        resourceKey: 'menu.admin.audit',
        action: 'EXPORT_ERROR',
        label: 'Excel 다운로드 실패',
        metadata: {
          error: err instanceof Error ? err.message : 'Unknown error',
        },
      });
    }
  }, [params, exportMutation, showSnackbar]);

  return (
    <Box
      data-testid="page-admin-audit"
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
          <Typography variant="h4">감사 로그</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            시스템 사용 이력 및 감사 로그를 확인합니다.
          </Typography>
        </Stack>

        {/* Filter Bar */}
        <AuditLogsFilterBar
          filters={filters}
          onFilterChange={updateFilter}
          onReset={resetFilters}
          onExport={handleExport}
          isExporting={exportMutation.isPending}
        />

        {/* Table */}
        <AuditLogsTable
          data={data}
          isLoading={isLoading}
          error={error}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={setPage}
          onRowsPerPageChange={setRowsPerPage}
          onRowClick={handleRowClick}
        />
      </Stack>

      {/* Detail Drawer */}
      <AuditLogDetailDrawer
        open={drawerOpen}
        onClose={handleDrawerClose}
        logId={selectedLogId}
        logDetail={logDetail}
        isLoading={detailLoading}
        error={detailError}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
