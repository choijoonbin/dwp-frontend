/**
 * Cases worklist — API with mock fallback
 */

import type { MouseEvent } from 'react';

import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMemo, useState, useEffect } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { tableToCsv, is403Error, downloadCsv } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Select from '@mui/material/Select';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';
import DialogContentText from '@mui/material/DialogContentText';

import { SYNAPSE_ROUTES } from '../../routes';
import { useCasesList } from './hooks/use-cases-list';
import { ErrorStateWithRetry } from '../../components/ux';
import { StatusPill } from '../../components/finance/status-pill';
import { SeverityBadge } from '../../components/finance/severity-badge';
import { ConfidenceMeter } from '../../components/finance/confidence-meter';

import type { CaseListItem } from './adapters/case-list-adapter';

// ----------------------------------------------------------------------

const allColumns = [
  { id: 'caseNumber', label: 'Case ID', visible: true },
  { id: 'severity', label: 'Severity', visible: true },
  { id: 'status', label: 'Status', visible: true },
  { id: 'anomalyType', label: 'Anomaly Type', visible: true },
  { id: 'companyCode', label: 'Company', visible: true },
  { id: 'counterparty', label: 'Counterparty', visible: true },
  { id: 'amount', label: 'Amount', visible: true },
  { id: 'detectedAt', label: 'Detected', visible: true },
  { id: 'slaDue', label: 'SLA Due', visible: true },
  { id: 'assignee', label: 'Assignee', visible: true },
  { id: 'confidence', label: 'Confidence', visible: true },
];

const anomalyTypes = [
  { value: 'duplicate_invoice', label: 'Duplicate Invoice' },
  { value: 'bank_change', label: 'Bank Change' },
  { value: 'policy_violation', label: 'Policy Violation' },
  { value: 'integrity_mismatch', label: 'Integrity Mismatch' },
  { value: 'amount_variance', label: 'Amount Variance' },
  { value: 'timing_anomaly', label: 'Timing Anomaly' },
];

const severities = ['critical', 'high', 'medium', 'low'];
const statuses = ['open', 'in_progress', 'pending_approval', 'resolved', 'dismissed'];

const uiStatusToApi: Record<string, string> = {
  open: 'TRIAGED',
  triage: 'TRIAGED',
  in_progress: 'IN_PROGRESS',
  pending_approval: 'IN_PROGRESS',
  resolved: 'RESOLVED',
  dismissed: 'DISMISSED',
};

/** URL status (OPEN 등) → UI status (open 등) */
const urlStatusToUi: Record<string, string> = {
  OPEN: 'open',
  TRIAGE: 'triage',
  TRIAGED: 'triage',
  IN_PROGRESS: 'in_progress',
  PENDING_APPROVAL: 'pending_approval',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
};

// ----------------------------------------------------------------------

export const CasesPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = searchParams.get('status');
  const urlCaseType = searchParams.get('caseType');
  const urlSeverity = searchParams.get('severity');
  const urlAssignee = searchParams.get('assignee');
  const urlAssigneeUserId = searchParams.get('assigneeUserId');
  const urlSlaRisk = searchParams.get('slaRisk');
  const urlIds = searchParams.get('ids');
  const urlCaseKey = searchParams.get('caseKey');

  type SavedView = { id: string; name: string; filters: Record<string, unknown>; isDefault?: boolean };
  const defaultView: SavedView = { id: 'all', name: 'All Cases', filters: {}, isDefault: true };
  const [savedViews] = useState<SavedView[]>([defaultView]);
  const [currentView, setCurrentView] = useState<SavedView | null>(defaultView);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedAnomalyTypes, setSelectedAnomalyTypes] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortColumn, setSortColumn] = useState<string>('detectedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState(allColumns);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [viewMenuAnchor, setViewMenuAnchor] = useState<null | HTMLElement>(null);
  const [severityMenuAnchor, setSeverityMenuAnchor] = useState<null | HTMLElement>(null);
  const [statusMenuAnchor, setStatusMenuAnchor] = useState<null | HTMLElement>(null);
  const [anomalyTypeMenuAnchor, setAnomalyTypeMenuAnchor] = useState<null | HTMLElement>(null);
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<null | HTMLElement>(null);
  const [rowMenuAnchor, setRowMenuAnchor] = useState<null | HTMLElement>(null);
  const [rowMenuCaseId, setRowMenuCaseId] = useState<string | null>(null);

  useEffect(() => {
    if (currentView) {
      const filters = currentView.filters as Record<string, string[]>;
      if (filters.status) setSelectedStatuses(filters.status);
      else setSelectedStatuses([]);
      if (filters.severity) setSelectedSeverities(filters.severity);
      else setSelectedSeverities([]);
    }
  }, [currentView]);

  useEffect(() => {
    if (urlStatus) {
      const parts = urlStatus.split(',').map((s) => s.trim());
      const uiStatuses = parts
        .map((s) => urlStatusToUi[s.toUpperCase()] ?? s.toLowerCase())
        .filter(Boolean);
      if (uiStatuses.length) setSelectedStatuses(uiStatuses);
    }
    if (urlCaseType) {
      const normalized = urlCaseType.toLowerCase().replace(/\s/g, '_');
      setSelectedAnomalyTypes([normalized]);
    }
    if (urlSeverity) {
      const parts = urlSeverity.split(',').map((s) => s.trim().toLowerCase());
      if (parts.length) setSelectedSeverities(parts);
    }
  }, [urlStatus, urlCaseType, urlSeverity]);

  const apiStatus =
    selectedStatuses.length > 0
      ? selectedStatuses
          .map((s) => uiStatusToApi[s] ?? s)
          .filter(Boolean)
          .join(',') || undefined
      : undefined;
  const apiSeverity =
    selectedSeverities.length > 0 ? selectedSeverities.join(',') : undefined;
  const apiCaseType = selectedAnomalyTypes[0];

  const {
    items,
    isLoading,
    error,
    refetch,
    totalCount,
    totalPages,
    triageBacklogCount,
    filtersApplied,
  } = useCasesList({
    page: page - 1,
    size: pageSize,
    status: apiStatus,
    severity: apiSeverity,
    caseType: apiCaseType,
    assignee: urlAssignee ?? undefined,
    assigneeUserId: urlAssigneeUserId ?? undefined,
    slaRisk: urlSlaRisk ?? undefined,
    ids: urlIds ? urlIds.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    caseKey: urlCaseKey ?? undefined,
    filters: {
      searchQuery,
      severities: selectedSeverities,
      statuses: selectedStatuses,
      anomalyTypes: selectedAnomalyTypes,
    },
  });

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const aVal = a[sortColumn as keyof CaseListItem];
        const bVal = b[sortColumn as keyof CaseListItem];
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return 0;
      }),
    [items, sortColumn, sortDirection]
  );

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedRows(checked ? sortedItems.map((c) => c.id) : []);
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedRows((prev) =>
      checked ? [...prev, id] : prev.filter((r) => r !== id)
    );
  };

  const toggleColumnVisibility = (columnId: string) => {
    setVisibleColumns((cols) =>
      cols.map((col) => (col.id === columnId ? { ...col, visible: !col.visible } : col))
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedSeverities([]);
    setSelectedStatuses([]);
    setSelectedAnomalyTypes([]);
  };

  const hasActiveFilters =
    searchQuery ||
    selectedSeverities.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedAnomalyTypes.length > 0;

  const handleRowClick = (caseId: string) => {
    navigate(SYNAPSE_ROUTES.CASE_DETAIL.replace(':id', caseId));
  };

  const handleToggleSeverity = (severity: string) => {
    setSelectedSeverities((prev) =>
      prev.includes(severity) ? prev.filter((s) => s !== severity) : [...prev, severity]
    );
  };

  const handleToggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const handleToggleAnomalyType = (type: string) => {
    setSelectedAnomalyTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleRowMenuClick = (event: MouseEvent<HTMLElement>, caseId: string) => {
    event.stopPropagation();
    setRowMenuAnchor(event.currentTarget);
    setRowMenuCaseId(caseId);
  };

  const handleRowMenuClose = () => {
    setRowMenuAnchor(null);
    setRowMenuCaseId(null);
  };

  const handleRowMenuOpen = () => {
    if (rowMenuCaseId) {
      navigate(SYNAPSE_ROUTES.CASE_DETAIL.replace(':id', rowMenuCaseId));
    }
    handleRowMenuClose();
  };

  if (error) {
    return (
      <ErrorStateWithRetry
        title={is403Error(error) ? '권한 부족' : 'Failed to load cases'}
        message={error instanceof Error ? error.message : 'Unknown error'}
        onRetry={() => refetch()}
        is403={is403Error(error)}
      />
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Case Worklist
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage and review anomaly detection cases · Triage backlog: {triageBacklogCount}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Iconify icon="solar:file-export-bold" width={16} />}
            onClick={() => {
              const csv = tableToCsv(sortedItems, [
                { id: 'caseNumber', label: 'Case ID' },
                { id: 'severity', label: 'Severity' },
                { id: 'status', label: 'Status' },
                { id: 'anomalyType', label: 'Anomaly Type' },
                { id: 'companyCode', label: 'Company' },
                { id: 'counterparty', label: 'Counterparty' },
                { id: 'amount', label: 'Amount', getValue: (r) => `${r.currency} ${r.amount.toLocaleString()}` },
                { id: 'detectedAt', label: 'Detected' },
                { id: 'slaDue', label: 'SLA Due' },
                { id: 'assignee', label: 'Assignee' },
                { id: 'confidence', label: 'Confidence' },
              ]);
              downloadCsv(csv, `cases-${new Date().toISOString().slice(0, 10)}.csv`);
            }}
          >
            Export CSV
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Iconify icon="solar:bookmark-bold" width={16} />}
            endIcon={<Iconify icon="solar:alt-arrow-down-linear" width={14} />}
            onClick={(e) => setViewMenuAnchor(e.currentTarget)}
          >
            {currentView?.name ?? 'Select View'}
          </Button>
        </Stack>
        <Menu
          anchorEl={viewMenuAnchor}
          open={Boolean(viewMenuAnchor)}
          onClose={() => setViewMenuAnchor(null)}
        >
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="caption" fontWeight={600} color="text.secondary">
              Saved Views
            </Typography>
          </Box>
          <Divider />
          {savedViews.map((view) => (
            <MenuItem
              key={view.id}
              onClick={() => {
                setCurrentView(view);
                setViewMenuAnchor(null);
              }}
            >
              <Iconify
                icon="solar:check-circle-bold"
                width={16}
                sx={{
                  mr: 1,
                  opacity: currentView?.id === view.id ? 1 : 0,
                  color: 'primary.main',
                }}
              />
              {view.name}
              {view.isDefault && (
                <Chip label="Default" size="small" sx={{ ml: 'auto', height: 16, fontSize: 10 }} />
              )}
            </MenuItem>
          ))}
          <Divider />
          <MenuItem
            onClick={() => {
              setSaveViewOpen(true);
              setViewMenuAnchor(null);
            }}
          >
            <Iconify icon="solar:add-circle-bold" width={16} sx={{ mr: 1 }} />
            Save Current View
          </MenuItem>
        </Menu>
      </Box>

      {((filtersApplied && Object.keys(filtersApplied).length > 0) || hasActiveFilters || urlCaseKey || urlIds) && (
        <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
            적용된 필터:
          </Typography>
          {filtersApplied?.range && (
            <Chip
              size="small"
              label={`기간: ${filtersApplied.range}`}
              onDelete={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('range');
                next.delete('from');
                next.delete('to');
                setSearchParams(next);
              }}
            />
          )}
          {((filtersApplied?.status as string[] | undefined) ?? (selectedStatuses.length ? selectedStatuses : [])).map(
            (s) => (
              <Chip
                key={`status-${s}`}
                size="small"
                label={`상태: ${s}`}
                onDelete={() => {
                  setSelectedStatuses((prev) => prev.filter((x) => x !== s));
                  const next = new URLSearchParams(searchParams);
                  const uiKey = urlStatusToUi[s.toUpperCase()] ?? s.toLowerCase();
                  const current = next
                    .get('status')
                    ?.split(',')
                    .map((x) => x.trim())
                    .filter((x) => urlStatusToUi[x.toUpperCase()] !== uiKey && x.toLowerCase() !== s) ?? [];
                  if (current.length) next.set('status', current.join(','));
                  else next.delete('status');
                  setSearchParams(next);
                }}
              />
            )
          )}
          {((filtersApplied?.severity as string[] | undefined) ?? (selectedSeverities.length ? selectedSeverities : [])).map(
            (s) => (
              <Chip
                key={`severity-${s}`}
                size="small"
                label={`심각도: ${s}`}
                onDelete={() => {
                  const newSevs = selectedSeverities.filter((x) => x !== s);
                  setSelectedSeverities(newSevs);
                  const next = new URLSearchParams(searchParams);
                  if (newSevs.length) next.set('severity', newSevs.join(','));
                  else next.delete('severity');
                  setSearchParams(next);
                }}
              />
            )
          )}
          {urlCaseKey && (
            <Chip
              size="small"
              label={`케이스: ${urlCaseKey}`}
              onDelete={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('caseKey');
                setSearchParams(next);
              }}
            />
          )}
          {urlIds && (
            <Chip
              size="small"
              label={`IDs: ${urlIds.split(',').length}건`}
              onDelete={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('ids');
                setSearchParams(next);
              }}
            />
          )}
        </Stack>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" flexWrap="wrap" gap={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder="Search cases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ flexGrow: 1, minWidth: 200, maxWidth: 400 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Iconify icon="solar:magnifer-linear" width={20} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:filter-bold" width={16} />}
              onClick={(e) => setSeverityMenuAnchor(e.currentTarget)}
            >
              Severity
              {selectedSeverities.length > 0 && (
                <Chip label={selectedSeverities.length} size="small" color="primary" sx={{ ml: 1, height: 20, minWidth: 20 }} />
              )}
            </Button>
            <Menu
              anchorEl={severityMenuAnchor}
              open={Boolean(severityMenuAnchor)}
              onClose={() => setSeverityMenuAnchor(null)}
            >
              {severities.map((s) => (
                <MenuItem key={s} onClick={() => handleToggleSeverity(s)}>
                  <Checkbox checked={selectedSeverities.includes(s)} sx={{ mr: 1 }} />
                  <SeverityBadge severity={s as CaseListItem['severity']} size="sm" />
                </MenuItem>
              ))}
            </Menu>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:filter-bold" width={16} />}
              onClick={(e) => setStatusMenuAnchor(e.currentTarget)}
            >
              Status
              {selectedStatuses.length > 0 && (
                <Chip label={selectedStatuses.length} size="small" color="primary" sx={{ ml: 1, height: 20, minWidth: 20 }} />
              )}
            </Button>
            <Menu
              anchorEl={statusMenuAnchor}
              open={Boolean(statusMenuAnchor)}
              onClose={() => setStatusMenuAnchor(null)}
            >
              {statuses.map((s) => (
                <MenuItem key={s} onClick={() => handleToggleStatus(s)}>
                  <Checkbox checked={selectedStatuses.includes(s)} sx={{ mr: 1 }} />
                  <StatusPill status={s as import('../../components/finance/status-pill').Status} size="sm" />
                </MenuItem>
              ))}
            </Menu>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:filter-bold" width={16} />}
              onClick={(e) => setAnomalyTypeMenuAnchor(e.currentTarget)}
            >
              Anomaly Type
              {selectedAnomalyTypes.length > 0 && (
                <Chip label={selectedAnomalyTypes.length} size="small" color="primary" sx={{ ml: 1, height: 20, minWidth: 20 }} />
              )}
            </Button>
            <Menu
              anchorEl={anomalyTypeMenuAnchor}
              open={Boolean(anomalyTypeMenuAnchor)}
              onClose={() => setAnomalyTypeMenuAnchor(null)}
            >
              {anomalyTypes.map((t) => (
                <MenuItem key={t.value} onClick={() => handleToggleAnomalyType(t.value)}>
                  <Checkbox checked={selectedAnomalyTypes.includes(t.value)} sx={{ mr: 1 }} />
                  {t.label}
                </MenuItem>
              ))}
            </Menu>
            {hasActiveFilters && (
              <Button
                variant="text"
                size="small"
                color="inherit"
                startIcon={<Iconify icon="solar:close-circle-bold" />}
                onClick={clearFilters}
              >
                Clear
              </Button>
            )}
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:widget-4-bold" width={16} />}
              onClick={(e) => setColumnMenuAnchor(e.currentTarget)}
            >
              Columns
            </Button>
            <Menu
              anchorEl={columnMenuAnchor}
              open={Boolean(columnMenuAnchor)}
              onClose={() => setColumnMenuAnchor(null)}
            >
              <Box sx={{ px: 2, py: 1 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  Toggle Columns
                </Typography>
              </Box>
              <Divider />
              {visibleColumns.map((col) => (
                <MenuItem key={col.id} onClick={() => toggleColumnVisibility(col.id)}>
                  <Checkbox checked={col.visible} sx={{ mr: 1 }} />
                  {col.label}
                </MenuItem>
              ))}
            </Menu>
          </Stack>
          {selectedRows.length > 0 && (
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Typography variant="body2" color="text.secondary">
                  {selectedRows.length} selected
                </Typography>
                <Button variant="outlined" size="small" startIcon={<Iconify icon="solar:user-plus-bold" />}>
                  Assign
                </Button>
                <Button variant="outlined" size="small" startIcon={<Iconify icon="solar:tag-bold" />}>
                  Tag
                </Button>
                <Button variant="text" size="small" onClick={() => setSelectedRows([])}>
                  Clear Selection
                </Button>
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 0 }}>
          {isLoading ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Loading cases...
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'background.neutral' }}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedRows.length === sortedItems.length && sortedItems.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </TableCell>
                    {visibleColumns
                      .filter((c) => c.visible)
                      .map((col) => (
                        <TableCell
                          key={col.id}
                          onClick={() => handleSort(col.id)}
                          sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                        >
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <span>{col.label}</span>
                            {sortColumn === col.id && (
                              <Iconify
                                icon="solar:alt-arrow-down-linear"
                                width={16}
                                sx={{
                                  transform: sortDirection === 'asc' ? 'rotate(180deg)' : 'none',
                                  transition: 'transform 0.2s',
                                }}
                              />
                            )}
                          </Stack>
                        </TableCell>
                      ))}
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedItems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={visibleColumns.filter((c) => c.visible).length + 2}
                        align="center"
                        sx={{ py: 6 }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          No cases found matching your filters
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedItems.map((caseItem) => {
                      const isSelected = selectedRows.includes(caseItem.id);
                      return (
                        <TableRow
                          key={caseItem.id}
                          hover
                          onClick={() => handleRowClick(caseItem.id)}
                          sx={{
                            cursor: 'pointer',
                            ...(isSelected && { bgcolor: 'action.selected' }),
                          }}
                        >
                          <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onChange={(e) => handleSelectRow(caseItem.id, e.target.checked)}
                            />
                          </TableCell>
                          {visibleColumns
                            .filter((c) => c.visible)
                            .map((col) => (
                              <TableCell key={col.id}>
                                <CellContent column={col.id} caseItem={caseItem} theme={theme} />
                              </TableCell>
                            ))}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <IconButton size="small" onClick={(e) => handleRowMenuClick(e, caseItem.id)}>
                              <Iconify icon="solar:menu-dots-bold" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 2,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Showing
              </Typography>
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <Select
                  value={String(pageSize)}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  sx={{ height: 32 }}
                >
                  <MenuItem value="10">10</MenuItem>
                  <MenuItem value="25">25</MenuItem>
                  <MenuItem value="50">50</MenuItem>
                  <MenuItem value="100">100</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary">
                of {totalCount} cases
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5}>
              <IconButton size="small" onClick={() => setPage(1)} disabled={page === 1}>
                <Iconify icon="solar:alt-arrow-left-linear" width={20} sx={{ transform: 'scaleX(-1)' }} />
              </IconButton>
              <IconButton size="small" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <Iconify icon="solar:alt-arrow-left-linear" width={20} />
              </IconButton>
              <Box sx={{ px: 2, display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2">
                  Page {page} of {totalPages || 1}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
              >
                <Iconify icon="solar:alt-arrow-right-linear" width={20} />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages || totalPages === 0}
              >
                <Iconify icon="solar:alt-arrow-right-linear" width={20} sx={{ transform: 'scaleX(-1)' }} />
              </IconButton>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Menu anchorEl={rowMenuAnchor} open={Boolean(rowMenuAnchor)} onClose={handleRowMenuClose}>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="caption" fontWeight={600} color="text.secondary">
            Quick Actions
          </Typography>
        </Box>
        <Divider />
        <MenuItem onClick={handleRowMenuOpen}>
          <Iconify icon="solar:eye-bold" width={16} sx={{ mr: 1.5 }} />
          Open Case
        </MenuItem>
      </Menu>

      <Dialog open={saveViewOpen} onClose={() => setSaveViewOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Save View</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Save your current filters and column settings as a reusable view.
          </DialogContentText>
          <TextField
            fullWidth
            label="View Name"
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
            placeholder="e.g., My Critical Cases"
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" onClick={() => setSaveViewOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setSaveViewOpen(false);
              setNewViewName('');
            }}
          >
            Save View
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ----------------------------------------------------------------------

type CellContentProps = {
  column: string;
  caseItem: CaseListItem;
  theme: ReturnType<typeof useTheme>;
};

const CellContent = ({ column, caseItem, theme }: CellContentProps) => {
  switch (column) {
    case 'caseNumber':
      return (
        <Box>
          <Typography variant="body2" fontWeight={600} sx={{ '&:hover': { color: 'primary.main' } }}>
            {caseItem.caseNumber}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}
          >
            {caseItem.title}
          </Typography>
        </Box>
      );
    case 'severity':
      return <SeverityBadge severity={caseItem.severity} size="sm" />;
    case 'status':
      return <StatusPill status={caseItem.status as import('../../components/finance/status-pill').Status} size="sm" />;
    case 'anomalyType':
      return (
        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
          {caseItem.anomalyType.replace(/_/g, ' ')}
        </Typography>
      );
    case 'companyCode':
      return <Typography variant="body2">{caseItem.companyCode}</Typography>;
    case 'counterparty':
      return (
        <Box>
          <Typography variant="body2" sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {caseItem.counterparty}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {caseItem.counterpartyId}
          </Typography>
        </Box>
      );
    case 'amount':
      return (
        <Typography variant="body2" fontWeight={600} sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {caseItem.currency} {caseItem.amount.toLocaleString()}
        </Typography>
      );
    case 'detectedAt':
      return (
        <Typography variant="body2" color="text.secondary">
          {caseItem.detectedAt ? new Date(caseItem.detectedAt).toLocaleDateString() : '-'}
        </Typography>
      );
    case 'slaDue': {
      const slaDue = caseItem.slaDue ? new Date(caseItem.slaDue) : null;
      if (!slaDue) return <Typography variant="body2" color="text.secondary">-</Typography>;
      const now = new Date();
      const isOverdue =
        slaDue < now && caseItem.status !== 'resolved' && caseItem.status !== 'dismissed';
      const isAtRisk = !isOverdue && slaDue.getTime() - now.getTime() < 24 * 60 * 60 * 1000;
      return (
        <Typography
          variant="body2"
          sx={{
            color: isOverdue ? 'error.main' : isAtRisk ? 'warning.main' : 'text.secondary',
            fontWeight: isOverdue || isAtRisk ? 600 : 400,
          }}
        >
          {slaDue.toLocaleDateString()}
        </Typography>
      );
    }
    case 'assignee':
      return caseItem.assignee ? (
        <Typography variant="body2">{caseItem.assignee}</Typography>
      ) : (
        <Typography variant="body2" color="text.secondary" fontStyle="italic">
          Unassigned
        </Typography>
      );
    case 'confidence':
      return <ConfidenceMeter value={caseItem.confidence} size="sm" />;
    default:
      return null;
  }
};
