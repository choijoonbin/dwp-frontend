import type { MouseEvent } from 'react';

import { useMemo, useState, useEffect } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { Link, useSearchParams } from 'react-router-dom';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import Badge from '@mui/material/Badge';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Drawer from '@mui/material/Drawer';
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
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';
import DialogContentText from '@mui/material/DialogContentText';

import { Timeline } from '../components/finance/timeline';
import { StatusPill } from '../components/finance/status-pill';
import { SeverityBadge } from '../components/finance/severity-badge';
import { SimulationResultCard } from '../components/finance/simulation-result-card';
import {
  mockCases,
  mockActions,
  mockAuditEvents,
  type SynapseAction,
} from '../data/mock-data';

// ----------------------------------------------------------------------

const actionTypes = [
  { value: 'post_reversal', label: 'Post Reversal' },
  { value: 'block_payment', label: 'Block Payment' },
  { value: 'flag_review', label: 'Flag for Review' },
  { value: 'clear_item', label: 'Clear Item' },
  { value: 'update_master', label: 'Update Master Data' },
];

const statuses = ['pending', 'approved', 'rejected', 'executed', 'failed'];
const riskLevels = ['critical', 'high', 'medium', 'low'];

// ----------------------------------------------------------------------

export const ActionsPage = () => {
  const theme = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const caseIdFilter = searchParams.get('caseId');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['pending']);
  const [selectedRiskLevels, setSelectedRiskLevels] = useState<string[]>([]);
  const [selectedActionTypes, setSelectedActionTypes] = useState<string[]>([]);
  const [selectedAction, setSelectedAction] = useState<SynapseAction | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedActionIds, setSelectedActionIds] = useState<Set<string>>(new Set());
  const [bulkApprovalOpen, setBulkApprovalOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Menu anchors
  const [statusMenuAnchor, setStatusMenuAnchor] = useState<null | HTMLElement>(null);
  const [riskMenuAnchor, setRiskMenuAnchor] = useState<null | HTMLElement>(null);
  const [actionTypeMenuAnchor, setActionTypeMenuAnchor] = useState<null | HTMLElement>(null);
  const [rowMenuAnchor, setRowMenuAnchor] = useState<null | HTMLElement>(null);
  const [rowMenuActionId, setRowMenuActionId] = useState<string | null>(null);

  // When caseId filter is present, clear status filter to show all
  useEffect(() => {
    if (caseIdFilter) {
      setSelectedStatuses([]);
    }
  }, [caseIdFilter]);

  // Filter actions
  const filteredActions = useMemo(() => mockActions.filter((action) => {
      // Case ID filter (from URL)
      if (caseIdFilter && action.caseId !== caseIdFilter) {
        return false;
      }

      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !action.description.toLowerCase().includes(query) &&
          !action.id.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Status filter
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(action.status)) {
        return false;
      }

      // Risk level filter
      if (selectedRiskLevels.length > 0 && !selectedRiskLevels.includes(action.riskLevel)) {
        return false;
      }

      // Action type filter
      if (selectedActionTypes.length > 0 && !selectedActionTypes.includes(action.type)) {
        return false;
      }

      return true;
    }), [caseIdFilter, searchQuery, selectedStatuses, selectedRiskLevels, selectedActionTypes]);

  const pendingCount = mockActions.filter((a) => a.status === 'pending').length;
  const approvedTodayCount = mockActions.filter((a) => a.status === 'approved').length;
  const executedTodayCount = mockActions.filter((a) => a.status === 'executed').length;

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedStatuses(['pending']);
    setSelectedRiskLevels([]);
    setSelectedActionTypes([]);
  };

  const hasCustomFilters =
    selectedStatuses.length !== 1 ||
    selectedStatuses[0] !== 'pending' ||
    selectedRiskLevels.length > 0 ||
    selectedActionTypes.length > 0 ||
    searchQuery;

  // Bulk selection helpers
  const pendingActions = filteredActions.filter((a) => a.status === 'pending');
  const allPendingSelected =
    pendingActions.length > 0 && pendingActions.every((a) => selectedActionIds.has(a.id));
  const somePendingSelected = pendingActions.some((a) => selectedActionIds.has(a.id));

  const toggleActionSelection = (actionId: string) => {
    const newSet = new Set(selectedActionIds);
    if (newSet.has(actionId)) {
      newSet.delete(actionId);
    } else {
      newSet.add(actionId);
    }
    setSelectedActionIds(newSet);
  };

  const toggleAllPendingSelection = () => {
    if (allPendingSelected) {
      setSelectedActionIds(new Set());
    } else {
      setSelectedActionIds(new Set(pendingActions.map((a) => a.id)));
    }
  };

  const selectedPendingCount = [...selectedActionIds].filter((id) =>
    filteredActions.find((a) => a.id === id && a.status === 'pending')
  ).length;

  const handleBulkApprove = () => {
    setBulkAction('approve');
    setBulkApprovalOpen(true);
  };

  const handleBulkReject = () => {
    setBulkAction('reject');
    setBulkApprovalOpen(true);
  };

  const executeBulkAction = async () => {
    setIsBulkProcessing(true);
    // Simulate processing
    await new Promise((resolve) => {
      setTimeout(resolve, 1500);
    });
    setIsBulkProcessing(false);
    setBulkApprovalOpen(false);
    setSelectedActionIds(new Set());
    setBulkAction(null);
  };

  const handleActionClick = (action: SynapseAction) => {
    setSelectedAction(action);
    setSheetOpen(true);
  };

  const handleClearCaseFilter = () => {
    setSearchParams({});
  };

  const handleToggleStatus = (status: string) => {
    if (selectedStatuses.includes(status)) {
      setSelectedStatuses(selectedStatuses.filter((s) => s !== status));
    } else {
      setSelectedStatuses([...selectedStatuses, status]);
    }
  };

  const handleToggleRisk = (risk: string) => {
    if (selectedRiskLevels.includes(risk)) {
      setSelectedRiskLevels(selectedRiskLevels.filter((r) => r !== risk));
    } else {
      setSelectedRiskLevels([...selectedRiskLevels, risk]);
    }
  };

  const handleToggleActionType = (type: string) => {
    if (selectedActionTypes.includes(type)) {
      setSelectedActionTypes(selectedActionTypes.filter((t) => t !== type));
    } else {
      setSelectedActionTypes([...selectedActionTypes, type]);
    }
  };

  const handleRowMenuClick = (event: MouseEvent<HTMLElement>, actionId: string) => {
    event.stopPropagation();
    setRowMenuAnchor(event.currentTarget);
    setRowMenuActionId(actionId);
  };

  const handleRowMenuClose = () => {
    setRowMenuAnchor(null);
    setRowMenuActionId(null);
  };

  const handleRowMenuViewDetails = () => {
    if (rowMenuActionId) {
      const action = filteredActions.find((a) => a.id === rowMenuActionId);
      if (action) {
        handleActionClick(action);
      }
    }
    handleRowMenuClose();
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Action Center
          </Typography>
          {caseIdFilter && (
            <Chip
              icon={<Iconify icon="solar:document-text-bold" width={16} />}
              label="Filtered by Case"
              size="small"
              color="secondary"
            />
          )}
        </Box>
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}
        >
          <Typography variant="body2" color="text.secondary">
            {caseIdFilter
              ? `Showing actions for case: ${mockCases.find((c) => c.id === caseIdFilter)?.caseNumber || caseIdFilter}`
              : 'Manage autonomous actions and approvals'}
          </Typography>
          {caseIdFilter && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="solar:close-circle-bold" />}
              onClick={handleClearCaseFilter}
            >
              Clear Filter
            </Button>
          )}
        </Box>
      </Box>

      {/* Bulk Action Bar */}
      {selectedPendingCount > 0 && (
        <Card
          sx={{
            mb: 3,
            bgcolor: (t) => t.palette.primary.lighter,
            border: (t) => `1px solid ${t.palette.primary.light}`,
          }}
        >
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Iconify icon="solar:checklist-minimalistic-bold" width={20} />
                </Box>
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {selectedPendingCount} action(s) selected
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Ready for bulk approval or rejection
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Iconify icon="solar:close-circle-bold" />}
                  onClick={() => setSelectedActionIds(new Set())}
                >
                  Clear Selection
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  color="error"
                  startIcon={<Iconify icon="solar:close-circle-bold" />}
                  onClick={handleBulkReject}
                >
                  Reject All
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  color="primary"
                  startIcon={<Iconify icon="solar:check-circle-bold" />}
                  onClick={handleBulkApprove}
                >
                  Approve All
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
        <Card>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Pending Approval
                </Typography>
                <Typography variant="h3" sx={{ color: 'warning.main', fontWeight: 700 }}>
                  {pendingCount}
                </Typography>
              </Box>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  bgcolor: 'warning.lighter',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Iconify icon="solar:clock-circle-bold" width={24} sx={{ color: 'warning.main' }} />
              </Box>
            </Stack>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Approved Today
                </Typography>
                <Typography variant="h3" sx={{ color: 'success.main', fontWeight: 700 }}>
                  {approvedTodayCount}
                </Typography>
              </Box>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  bgcolor: 'success.lighter',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Iconify icon="solar:check-circle-bold" width={24} sx={{ color: 'success.main' }} />
              </Box>
            </Stack>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Executed Today
                </Typography>
                <Typography variant="h3" sx={{ color: 'primary.main', fontWeight: 700 }}>
                  {executedTodayCount}
                </Typography>
              </Box>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  bgcolor: 'primary.lighter',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Iconify icon="solar:bolt-circle-bold" width={24} sx={{ color: 'primary.main' }} />
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" flexWrap="wrap" gap={1.5} alignItems="center">
            {/* Search */}
            <TextField
              size="small"
              placeholder="Search actions..."
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

            {/* Status Filter */}
            <Badge badgeContent={selectedStatuses.length} color="primary">
              <Button
                variant="outlined"
                size="small"
                startIcon={<Iconify icon="solar:filter-bold" width={16} />}
                onClick={(e) => setStatusMenuAnchor(e.currentTarget)}
              >
                Status
              </Button>
            </Badge>
            <Menu
              anchorEl={statusMenuAnchor}
              open={Boolean(statusMenuAnchor)}
              onClose={() => setStatusMenuAnchor(null)}
            >
              {statuses.map((status) => (
                <MenuItem key={status} onClick={() => handleToggleStatus(status)}>
                  <Checkbox checked={selectedStatuses.includes(status)} sx={{ mr: 1 }} />
                  <StatusPill status={status as SynapseAction['status']} size="sm" />
                </MenuItem>
              ))}
            </Menu>

            {/* Risk Level Filter */}
            <Badge badgeContent={selectedRiskLevels.length} color="primary">
              <Button
                variant="outlined"
                size="small"
                startIcon={<Iconify icon="solar:filter-bold" width={16} />}
                onClick={(e) => setRiskMenuAnchor(e.currentTarget)}
              >
                Risk Level
              </Button>
            </Badge>
            <Menu
              anchorEl={riskMenuAnchor}
              open={Boolean(riskMenuAnchor)}
              onClose={() => setRiskMenuAnchor(null)}
            >
              {riskLevels.map((level) => (
                <MenuItem key={level} onClick={() => handleToggleRisk(level)}>
                  <Checkbox checked={selectedRiskLevels.includes(level)} sx={{ mr: 1 }} />
                  <SeverityBadge severity={level as SynapseAction['riskLevel']} size="sm" />
                </MenuItem>
              ))}
            </Menu>

            {/* Action Type Filter */}
            <Badge badgeContent={selectedActionTypes.length} color="primary">
              <Button
                variant="outlined"
                size="small"
                startIcon={<Iconify icon="solar:filter-bold" width={16} />}
                onClick={(e) => setActionTypeMenuAnchor(e.currentTarget)}
              >
                Action Type
              </Button>
            </Badge>
            <Menu
              anchorEl={actionTypeMenuAnchor}
              open={Boolean(actionTypeMenuAnchor)}
              onClose={() => setActionTypeMenuAnchor(null)}
            >
              {actionTypes.map((type) => (
                <MenuItem key={type.value} onClick={() => handleToggleActionType(type.value)}>
                  <Checkbox checked={selectedActionTypes.includes(type.value)} sx={{ mr: 1 }} />
                  {type.label}
                </MenuItem>
              ))}
            </Menu>

            {/* Clear Filters */}
            {hasCustomFilters && (
              <Button
                variant="text"
                size="small"
                color="inherit"
                startIcon={<Iconify icon="solar:close-circle-bold" />}
                onClick={clearFilters}
              >
                Reset
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Action Queue Table */}
      <Card>
        <CardContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6">Action Queue</Typography>
            <Typography variant="body2" color="text.secondary">
              {filteredActions.length} actions matching your filters
            </Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'background.neutral' }}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={allPendingSelected}
                      indeterminate={somePendingSelected && !allPendingSelected}
                      onChange={toggleAllPendingSelection}
                    />
                  </TableCell>
                  <TableCell>Action ID</TableCell>
                  <TableCell>Linked Case</TableCell>
                  <TableCell>Action Type</TableCell>
                  <TableCell>Autonomy</TableCell>
                  <TableCell>Approval</TableCell>
                  <TableCell>Risk</TableCell>
                  <TableCell>Target</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredActions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 6 }}>
                      <Typography variant="body2" color="text.secondary">
                        No actions found matching your filters
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredActions.map((action) => {
                    const relatedCase = mockCases.find((c) => c.id === action.caseId);
                    const isSelected = selectedActionIds.has(action.id);
                    const isCaseFiltered = caseIdFilter && action.caseId === caseIdFilter;

                    return (
                      <TableRow
                        key={action.id}
                        hover
                        onClick={() => handleActionClick(action)}
                        sx={{
                          cursor: 'pointer',
                          ...(isCaseFiltered && {
                            bgcolor: 'primary.lighter',
                            '&:hover': { bgcolor: 'primary.light' },
                          }),
                          ...(isSelected && {
                            bgcolor: 'action.selected',
                          }),
                        }}
                      >
                        <TableCell
                          padding="checkbox"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {action.status === 'pending' ? (
                            <Checkbox
                              checked={isSelected}
                              onChange={() => toggleActionSelection(action.id)}
                            />
                          ) : (
                            <Box sx={{ width: 16 }} />
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" fontFamily="monospace">
                            {action.id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Link
                            to={`/cases/${action.caseId}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ color: theme.palette.primary.main, textDecoration: 'none' }}
                          >
                            {relatedCase?.caseNumber || action.caseId}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {action.type.replace(/_/g, ' ')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={action.autonomyMode.replace(/_/g, ' ')}
                            size="small"
                            variant="outlined"
                            sx={{ textTransform: 'capitalize', fontSize: 10 }}
                          />
                        </TableCell>
                        <TableCell>
                          {action.requiredApproval ? (
                            <Chip
                              label="Required"
                              size="small"
                              sx={{
                                bgcolor: 'warning.lighter',
                                color: 'warning.dark',
                                fontSize: 10,
                              }}
                            />
                          ) : (
                            <Chip
                              label="Auto"
                              size="small"
                              sx={{
                                bgcolor: 'success.lighter',
                                color: 'success.dark',
                                fontSize: 10,
                              }}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <SeverityBadge severity={action.riskLevel} size="sm" showIcon={false} />
                        </TableCell>
                        <TableCell>
                          <Chip label={action.targetSystem} size="small" variant="outlined" sx={{ fontSize: 10 }} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {new Date(action.createdAt).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <StatusPill status={action.status} size="sm" />
                        </TableCell>
                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          <IconButton
                            size="small"
                            onClick={(e) => handleRowMenuClick(e, action.id)}
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
        </CardContent>
      </Card>

      {/* Row Menu */}
      <Menu anchorEl={rowMenuAnchor} open={Boolean(rowMenuAnchor)} onClose={handleRowMenuClose}>
        <MenuItem onClick={handleRowMenuViewDetails}>View Details</MenuItem>
        {rowMenuActionId &&
          filteredActions.find((a) => a.id === rowMenuActionId)?.status === 'pending' && (
            <>
              <MenuItem>Approve</MenuItem>
              <MenuItem sx={{ color: 'error.main' }}>Reject</MenuItem>
            </>
          )}
      </Menu>

      {/* Action Detail Drawer */}
      <Drawer
        anchor="right"
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 500 }, p: 0 } }}
      >
        {selectedAction && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                    <Iconify icon="solar:bolt-circle-bold" width={20} sx={{ color: 'primary.main' }} />
                    <Typography variant="h6">Action Details</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {selectedAction.id}
                  </Typography>
                </Box>
                <StatusPill status={selectedAction.status} />
              </Stack>
            </Box>

            {/* Content */}
            <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
              <Stack spacing={3}>
                {/* Action Info */}
                <Box>
                  <Typography variant="subtitle2" sx={{ textTransform: 'capitalize', mb: 1 }}>
                    {selectedAction.type.replace(/_/g, ' ')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedAction.description}
                  </Typography>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Risk Level
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <SeverityBadge severity={selectedAction.riskLevel} />
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Autonomy Mode
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Chip
                        label={selectedAction.autonomyMode.replace(/_/g, ' ')}
                        size="small"
                        variant="outlined"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Target System
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {selectedAction.targetSystem}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Created
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {new Date(selectedAction.createdAt).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Linked Case
                  </Typography>
                  <Link
                    to={`/cases/${selectedAction.caseId}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <Card sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                      <CardContent>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Iconify icon="solar:document-text-bold" width={16} />
                            <Typography variant="body2" sx={{ color: 'primary.main' }}>
                              {mockCases.find((c) => c.id === selectedAction.caseId)?.caseNumber ||
                                selectedAction.caseId}
                            </Typography>
                          </Stack>
                          <Iconify icon="solar:alt-arrow-right-linear" width={16} />
                        </Stack>
                      </CardContent>
                    </Card>
                  </Link>
                </Box>

                <Divider />

                {/* Pre-execution Simulation */}
                <Box>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Iconify icon="solar:play-circle-bold" width={16} sx={{ color: 'primary.main' }} />
                      <Typography variant="subtitle2">Pre-execution Simulation</Typography>
                    </Stack>
                    {!selectedAction.simulation && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Iconify icon="solar:play-circle-bold" />}
                      >
                        Run Simulation
                      </Button>
                    )}
                  </Stack>

                  {selectedAction.simulation ? (
                    <SimulationResultCard result={selectedAction.simulation} />
                  ) : (
                    <Card>
                      <CardContent sx={{ textAlign: 'center', py: 4 }}>
                        <Iconify
                          icon="solar:play-circle-bold"
                          width={40}
                          sx={{ color: 'text.disabled', mb: 2 }}
                        />
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          No simulation has been run for this action yet.
                        </Typography>
                        <Button
                          variant="contained"
                          startIcon={<Iconify icon="solar:play-circle-bold" />}
                        >
                          Run Simulation Now
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </Box>

                <Divider />

                {/* Policy-based Guardrails */}
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                    <Iconify icon="solar:shield-check-bold" width={16} sx={{ color: 'primary.main' }} />
                    <Typography variant="subtitle2">Policy-based Guardrails</Typography>
                  </Stack>
                  <Card>
                    <CardContent>
                      <Stack spacing={2}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Stack direction="row" alignItems="center" spacing={1}>
                            {selectedAction.requiredApproval ? (
                              <Iconify
                                icon="solar:danger-triangle-bold"
                                width={16}
                                sx={{ color: 'warning.main' }}
                              />
                            ) : (
                              <Iconify
                                icon="solar:check-circle-bold"
                                width={16}
                                sx={{ color: 'success.main' }}
                              />
                            )}
                            <Typography variant="body2" fontWeight={600}>
                              {selectedAction.requiredApproval
                                ? 'Approval Required'
                                : 'Auto-execution Allowed'}
                            </Typography>
                          </Stack>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {selectedAction.requiredApproval
                            ? `This action requires manual approval due to ${selectedAction.riskLevel} risk level and the nature of the operation (${selectedAction.type.replace(/_/g, ' ')}).`
                            : 'This action can be executed automatically based on the current autonomy settings and risk profile.'}
                        </Typography>
                        <Box sx={{ pt: 1 }}>
                          <Link
                            to="/policies"
                            style={{
                              fontSize: 12,
                              color: theme.palette.primary.main,
                              textDecoration: 'none',
                            }}
                          >
                            View applicable policies
                          </Link>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Box>

                <Divider />

                {/* Audit Timeline */}
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                    <Iconify icon="solar:history-bold" width={16} sx={{ color: 'primary.main' }} />
                    <Typography variant="subtitle2">Audit Timeline</Typography>
                  </Stack>
                  <Timeline events={mockAuditEvents.slice(0, 3)} compact />
                </Box>

                {/* Approval Section */}
                {selectedAction.status === 'pending' && selectedAction.requiredApproval && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 2 }}>
                        Approval Decision
                      </Typography>
                      <Stack spacing={2}>
                        <TextField
                          multiline
                          rows={3}
                          placeholder="Add a comment or note for the approval decision..."
                          fullWidth
                        />
                        <Stack direction="row" spacing={1}>
                          <Button
                            variant="text"
                            size="small"
                            startIcon={<Iconify icon="solar:paperclip-bold" />}
                          >
                            Attach
                          </Button>
                          <Button
                            variant="text"
                            size="small"
                            startIcon={<Iconify icon="solar:info-circle-bold" />}
                          >
                            Request Info
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                  </>
                )}
              </Stack>
            </Box>

            {/* Footer Actions */}
            {selectedAction.status === 'pending' && (
              <Box sx={{ p: 3, borderTop: 1, borderColor: 'divider', bgcolor: 'background.neutral' }}>
                <Stack direction="row" spacing={1.5}>
                  <Button
                    variant="contained"
                    color="error"
                    fullWidth
                    startIcon={<Iconify icon="solar:close-circle-bold" />}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    startIcon={<Iconify icon="solar:check-circle-bold" />}
                  >
                    Approve
                  </Button>
                </Stack>
              </Box>
            )}
          </Box>
        )}
      </Drawer>

      {/* Bulk Action Confirmation Dialog */}
      <Dialog open={bulkApprovalOpen} onClose={() => setBulkApprovalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            {bulkAction === 'approve' ? (
              <>
                <Iconify icon="solar:check-circle-bold" width={20} sx={{ color: 'success.main' }} />
                <span>Bulk Approve Actions</span>
              </>
            ) : (
              <>
                <Iconify icon="solar:close-circle-bold" width={20} sx={{ color: 'error.main' }} />
                <span>Bulk Reject Actions</span>
              </>
            )}
          </Stack>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            You are about to {bulkAction} {selectedPendingCount} action(s). This action cannot be
            undone.
          </DialogContentText>
          <Card sx={{ bgcolor: 'background.neutral' }}>
            <CardContent>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Selected Actions:
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {selectedPendingCount}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Action:
                  </Typography>
                  <Chip
                    label={bulkAction === 'approve' ? 'Approve' : 'Reject'}
                    size="small"
                    color={bulkAction === 'approve' ? 'primary' : 'error'}
                  />
                </Stack>
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" color="text.secondary">
                All selected actions will be processed immediately. An audit trail will be created
                for each action.
              </Typography>
            </CardContent>
          </Card>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            variant="outlined"
            onClick={() => setBulkApprovalOpen(false)}
            disabled={isBulkProcessing}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color={bulkAction === 'approve' ? 'primary' : 'error'}
            onClick={executeBulkAction}
            disabled={isBulkProcessing}
            startIcon={
              isBulkProcessing ? (
                <CircularProgress size={16} />
              ) : bulkAction === 'approve' ? (
                <Iconify icon="solar:check-circle-bold" />
              ) : (
                <Iconify icon="solar:close-circle-bold" />
              )
            }
          >
            {isBulkProcessing
              ? 'Processing...'
              : `Confirm ${bulkAction === 'approve' ? 'Approval' : 'Rejection'}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
