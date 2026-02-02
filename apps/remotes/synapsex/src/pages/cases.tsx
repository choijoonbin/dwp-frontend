import type { MouseEvent } from 'react';

import { useNavigate } from 'react-router-dom';
import { useMemo, useState, useEffect } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

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

import { SYNAPSE_ROUTES } from '../routes';
import { StatusPill } from '../components/finance/status-pill';
import { SeverityBadge } from '../components/finance/severity-badge';
import { ConfidenceMeter } from '../components/finance/confidence-meter';
import { mockCases, mockSavedViews, type SavedView, type SynapseCase } from '../data/mock-data';

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

// ----------------------------------------------------------------------

export const CasesPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  // Saved Views (local state instead of useApp)
  const [savedViews] = useState<SavedView[]>(mockSavedViews);
  const [currentView, setCurrentView] = useState<SavedView | null>(
    mockSavedViews.find((v) => v.isDefault) || null
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedAnomalyTypes, setSelectedAnomalyTypes] = useState<string[]>([]);

  // Apply saved view filters when view changes
  useEffect(() => {
    if (currentView) {
      const filters = currentView.filters as Record<string, string[]>;
      if (filters.status) {
        setSelectedStatuses(filters.status);
      }
      if (filters.severity) {
        setSelectedSeverities(filters.severity);
      }
      // Reset other filters if not in view
      if (!filters.status) {
        setSelectedStatuses([]);
      }
      if (!filters.severity) {
        setSelectedSeverities([]);
      }
    }
  }, [currentView]);

  // Table state
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState(allColumns);
  const [sortColumn, setSortColumn] = useState<string>('detectedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Save View Dialog
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  // Menu anchors
  const [viewMenuAnchor, setViewMenuAnchor] = useState<null | HTMLElement>(null);
  const [severityMenuAnchor, setSeverityMenuAnchor] = useState<null | HTMLElement>(null);
  const [statusMenuAnchor, setStatusMenuAnchor] = useState<null | HTMLElement>(null);
  const [anomalyTypeMenuAnchor, setAnomalyTypeMenuAnchor] = useState<null | HTMLElement>(null);
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<null | HTMLElement>(null);
  const [rowMenuAnchor, setRowMenuAnchor] = useState<null | HTMLElement>(null);
  const [rowMenuCaseId, setRowMenuCaseId] = useState<string | null>(null);

  // Filter cases
  const filteredCases = useMemo(() => mockCases.filter((c) => {
      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !c.caseNumber.toLowerCase().includes(query) &&
          !c.counterparty.toLowerCase().includes(query) &&
          !c.description.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Severity filter
      if (selectedSeverities.length > 0 && !selectedSeverities.includes(c.severity)) {
        return false;
      }

      // Status filter
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(c.status)) {
        return false;
      }

      // Anomaly type filter
      if (selectedAnomalyTypes.length > 0 && !selectedAnomalyTypes.includes(c.anomalyType)) {
        return false;
      }

      return true;
    }), [searchQuery, selectedSeverities, selectedStatuses, selectedAnomalyTypes]);

  // Sort cases
  const sortedCases = useMemo(() => [...filteredCases].sort((a, b) => {
      const aVal = a[sortColumn as keyof SynapseCase];
      const bVal = b[sortColumn as keyof SynapseCase];

      if (aVal === null || aVal === undefined) {
        return 1;
      }
      if (bVal === null || bVal === undefined) {
        return -1;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    }), [filteredCases, sortColumn, sortDirection]);

  // Paginate
  const paginatedCases = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedCases.slice(start, start + pageSize);
  }, [sortedCases, page, pageSize]);

  const totalPages = Math.ceil(sortedCases.length / pageSize);

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(paginatedCases.map((c) => c.id));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedRows([...selectedRows, id]);
    } else {
      setSelectedRows(selectedRows.filter((r) => r !== id));
    }
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
    if (selectedSeverities.includes(severity)) {
      setSelectedSeverities(selectedSeverities.filter((s) => s !== severity));
    } else {
      setSelectedSeverities([...selectedSeverities, severity]);
    }
  };

  const handleToggleStatus = (status: string) => {
    if (selectedStatuses.includes(status)) {
      setSelectedStatuses(selectedStatuses.filter((s) => s !== status));
    } else {
      setSelectedStatuses([...selectedStatuses, status]);
    }
  };

  const handleToggleAnomalyType = (type: string) => {
    if (selectedAnomalyTypes.includes(type)) {
      setSelectedAnomalyTypes(selectedAnomalyTypes.filter((t) => t !== type));
    } else {
      setSelectedAnomalyTypes([...selectedAnomalyTypes, type]);
    }
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

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Page Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Case Worklist
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage and review anomaly detection cases
          </Typography>
        </Box>
        <Box>
          {/* Saved Views */}
          <Button
            variant="outlined"
            size="small"
            startIcon={<Iconify icon="solar:bookmark-bold" width={16} />}
            endIcon={<Iconify icon="solar:alt-arrow-down-linear" width={14} />}
            onClick={(e) => setViewMenuAnchor(e.currentTarget)}
          >
            {currentView?.name || 'Select View'}
          </Button>
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
      </Box>

      {/* Filters Bar */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" flexWrap="wrap" gap={1.5} alignItems="center">
            {/* Search */}
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

            {/* Severity Filter */}
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:filter-bold" width={16} />}
              onClick={(e) => setSeverityMenuAnchor(e.currentTarget)}
            >
              Severity
              {selectedSeverities.length > 0 && (
                <Chip
                  label={selectedSeverities.length}
                  size="small"
                  color="primary"
                  sx={{ ml: 1, height: 20, minWidth: 20 }}
                />
              )}
            </Button>
            <Menu
              anchorEl={severityMenuAnchor}
              open={Boolean(severityMenuAnchor)}
              onClose={() => setSeverityMenuAnchor(null)}
            >
              {severities.map((severity) => (
                <MenuItem key={severity} onClick={() => handleToggleSeverity(severity)}>
                  <Checkbox checked={selectedSeverities.includes(severity)} sx={{ mr: 1 }} />
                  <SeverityBadge severity={severity as SynapseCase['severity']} size="sm" />
                </MenuItem>
              ))}
            </Menu>

            {/* Status Filter */}
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:filter-bold" width={16} />}
              onClick={(e) => setStatusMenuAnchor(e.currentTarget)}
            >
              Status
              {selectedStatuses.length > 0 && (
                <Chip
                  label={selectedStatuses.length}
                  size="small"
                  color="primary"
                  sx={{ ml: 1, height: 20, minWidth: 20 }}
                />
              )}
            </Button>
            <Menu
              anchorEl={statusMenuAnchor}
              open={Boolean(statusMenuAnchor)}
              onClose={() => setStatusMenuAnchor(null)}
            >
              {statuses.map((status) => (
                <MenuItem key={status} onClick={() => handleToggleStatus(status)}>
                  <Checkbox checked={selectedStatuses.includes(status)} sx={{ mr: 1 }} />
                  <StatusPill status={status as SynapseCase['status']} size="sm" />
                </MenuItem>
              ))}
            </Menu>

            {/* Anomaly Type Filter */}
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:filter-bold" width={16} />}
              onClick={(e) => setAnomalyTypeMenuAnchor(e.currentTarget)}
            >
              Anomaly Type
              {selectedAnomalyTypes.length > 0 && (
                <Chip
                  label={selectedAnomalyTypes.length}
                  size="small"
                  color="primary"
                  sx={{ ml: 1, height: 20, minWidth: 20 }}
                />
              )}
            </Button>
            <Menu
              anchorEl={anomalyTypeMenuAnchor}
              open={Boolean(anomalyTypeMenuAnchor)}
              onClose={() => setAnomalyTypeMenuAnchor(null)}
            >
              {anomalyTypes.map((type) => (
                <MenuItem key={type.value} onClick={() => handleToggleAnomalyType(type.value)}>
                  <Checkbox checked={selectedAnomalyTypes.includes(type.value)} sx={{ mr: 1 }} />
                  {type.label}
                </MenuItem>
              ))}
            </Menu>

            {/* Clear Filters */}
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

            {/* Column Visibility */}
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

            {/* Export */}
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:download-bold" width={16} />}
            >
              Export
            </Button>
          </Stack>

          {/* Bulk Actions */}
          {selectedRows.length > 0 && (
            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Typography variant="body2" color="text.secondary">
                  {selectedRows.length} selected
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Iconify icon="solar:user-plus-bold" />}
                >
                  Assign
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Iconify icon="solar:tag-bold" />}
                >
                  Tag
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Iconify icon="solar:sort-bold" />}
                >
                  Reprioritize
                </Button>
                <Button variant="text" size="small" onClick={() => setSelectedRows([])}>
                  Clear Selection
                </Button>
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'background.neutral' }}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={
                        selectedRows.length === paginatedCases.length && paginatedCases.length > 0
                      }
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
                {paginatedCases.length === 0 ? (
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
                  paginatedCases.map((caseItem) => {
                    const isSelected = selectedRows.includes(caseItem.id);

                    return (
                      <TableRow
                        key={caseItem.id}
                        hover
                        onClick={() => handleRowClick(caseItem.id)}
                        sx={{
                          cursor: 'pointer',
                          ...(isSelected && {
                            bgcolor: 'action.selected',
                          }),
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
                          <IconButton
                            size="small"
                            onClick={(e) => handleRowMenuClick(e, caseItem.id)}
                          >
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

          {/* Pagination */}
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
                of {sortedCases.length} cases
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5}>
              <IconButton size="small" onClick={() => setPage(1)} disabled={page === 1}>
                <Iconify icon="solar:alt-arrow-left-linear" width={20} sx={{ transform: 'scaleX(-1)' }} />
              </IconButton>
              <IconButton size="small" onClick={() => setPage(page - 1)} disabled={page === 1}>
                <Iconify icon="solar:alt-arrow-left-linear" width={20} />
              </IconButton>
              <Box sx={{ px: 2, display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2">
                  Page {page} of {totalPages || 1}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={() => setPage(page + 1)}
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

      {/* Row Menu */}
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
        <MenuItem>
          <Iconify icon="solar:user-plus-bold" width={16} sx={{ mr: 1.5 }} />
          Assign
        </MenuItem>
        <MenuItem>
          <Iconify icon="solar:danger-triangle-bold" width={16} sx={{ mr: 1.5 }} />
          Escalate
        </MenuItem>
        <MenuItem>
          <Iconify icon="solar:plain-3-bold" width={16} sx={{ mr: 1.5 }} />
          Request Approval
        </MenuItem>
        <Divider />
        <MenuItem sx={{ color: 'error.main' }}>
          <Iconify icon="solar:close-circle-bold" width={16} sx={{ mr: 1.5 }} />
          Dismiss
        </MenuItem>
      </Menu>

      {/* Save View Dialog */}
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
              // Mock save
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
  caseItem: SynapseCase;
  theme: ReturnType<typeof useTheme>;
};

function CellContent({ column, caseItem, theme }: CellContentProps) {
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
      return <StatusPill status={caseItem.status} size="sm" />;
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
          <Typography
            variant="body2"
            sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
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
          {new Date(caseItem.detectedAt).toLocaleDateString()}
        </Typography>
      );
    case 'slaDue': {
      const slaDue = new Date(caseItem.slaDue);
      const now = new Date();
      const isOverdue =
        slaDue < now && caseItem.status !== 'resolved' && caseItem.status !== 'dismissed';
      const isAtRisk = !isOverdue && slaDue.getTime() - now.getTime() < 24 * 60 * 60 * 1000;
      return (
        <Typography
          variant="body2"
          sx={{
            color: isOverdue
              ? 'error.main'
              : isAtRisk
                ? 'warning.main'
                : 'text.secondary',
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
}
