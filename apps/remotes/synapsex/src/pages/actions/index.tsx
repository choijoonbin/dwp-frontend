/**
 * Action Center — API with mock fallback
 * Bulk select, Create action modal, Approve/Execute flows
 */

import type { MouseEvent } from 'react';

import { useRef, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { Iconify, PermissionGate } from '@dwp-frontend/design-system';
import {
  is403Error,
  saveFiltersToStorage,
  getFiltersFromStorage,
  getResourceKeyForPath,
  useCreateActionMutation,
  useResumeActionMutation,
  useRejectActionMutation,
  useApproveActionMutation,
  useExecuteActionMutation,
  useSimulateActionMutation,
} from '@dwp-frontend/shared-utils';

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

import { SYNAPSE_ROUTES } from '../../routes';
import { ErrorStateWithRetry } from '../../components/ux';
import { useActionsList } from './hooks/use-actions-list';
import { StatusPill } from '../../components/finance/status-pill';
import { SeverityBadge } from '../../components/finance/severity-badge';
import { SimulationResultCard } from '../../components/finance/simulation-result-card';
import { CreateActionModal, type CreateActionForm } from './components/create-action-modal';

import type { ActionListItem } from './adapters/action-list-adapter';

// ----------------------------------------------------------------------

const ACTION_TYPE_KEYS = [
  'post_reversal',
  'block_payment',
  'flag_review',
  'clear_item',
  'update_master',
] as const;

const statuses = ['pending', 'approved', 'rejected', 'executed', 'failed'];
const riskLevels = ['critical', 'high', 'medium', 'low'];

const ACTIONS_RESOURCE = getResourceKeyForPath('actions') ?? 'menu.autonomous-operations.actions';

const ACTIONS_FILTERS_KEY = 'actions';

// ----------------------------------------------------------------------

const getActionTypes = (t: (key: string) => string) =>
  ACTION_TYPE_KEYS.map((key) => ({ value: key, label: t(`actions.actionTypes.${key}`) }));

export const ActionsPage = () => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const actionTypes = getActionTypes(t);
  const [searchParams, setSearchParams] = useSearchParams();
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    const params = Object.fromEntries(searchParams.entries());
    const filterKeys = ['caseId', 'assignee', 'status', 'actionStatus', 'requiresApproval', 'focus', 'range'];
    const hasFilterParams = filterKeys.some((k) => params[k]);
    if (hasFilterParams) {
      saveFiltersToStorage<Record<string, string>>(ACTIONS_FILTERS_KEY, params);
    }
  }, [searchParams]);

  useEffect(() => {
    if (hasRestoredRef.current) return;
    const filterKeys = ['caseId', 'assignee', 'status', 'actionStatus', 'requiresApproval', 'focus', 'range'];
    const hasUrlParams = filterKeys.some((k) => searchParams.get(k));
    if (hasUrlParams) return;
    const stored = getFiltersFromStorage<Record<string, string>>(ACTIONS_FILTERS_KEY);
    if (!stored || Object.keys(stored).length === 0) return;
    hasRestoredRef.current = true;
    setSearchParams(new URLSearchParams(stored), { replace: true });
  }, [searchParams, setSearchParams]);

  const {
    items: filteredActions,
    isLoading,
    error,
    refetch,
    caseIdFilter,
    assigneeFilter,
    statusFilter,
    actionStatusFilter,
    requiresApprovalFilter,
    focusActionId,
    linkedCase,
    pendingCount,
    approvedCount,
    executedCount,
    casesForDropdown,
    filtersApplied,
  } = useActionsList();

  const createMutation = useCreateActionMutation();
  const approveMutation = useApproveActionMutation();
  const executeMutation = useExecuteActionMutation();
  const resumeMutation = useResumeActionMutation();
  const simulateMutation = useSimulateActionMutation();
  const rejectMutation = useRejectActionMutation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() => {
    const s = (statusFilter ?? actionStatusFilter ?? '').toUpperCase();
    if (s === 'PENDING_APPROVAL' || s === 'PENDING') return ['pending'];
    if (s === 'APPROVED') return ['approved'];
    if (s === 'REJECTED') return ['rejected'];
    if (s === 'EXECUTED' || s === 'COMPLETED') return ['executed'];
    if (s === 'FAILED') return ['failed'];
    return ['pending'];
  });
  const [selectedRiskLevels, setSelectedRiskLevels] = useState<string[]>([]);
  const [selectedActionTypes, setSelectedActionTypes] = useState<string[]>([]);
  const [selectedAction, setSelectedAction] = useState<ActionListItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedActionIds, setSelectedActionIds] = useState<Set<string>>(new Set());
  const [bulkApprovalOpen, setBulkApprovalOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject' | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [drawerSimulationResult, setDrawerSimulationResult] = useState<{
    predictedSuccess: boolean;
    impactedObjects?: string[];
    validations?: { name: string; passed: boolean; message: string }[];
    riskNotes?: string[];
  } | null>(null);

  const [statusMenuAnchor, setStatusMenuAnchor] = useState<null | HTMLElement>(null);
  const [riskMenuAnchor, setRiskMenuAnchor] = useState<null | HTMLElement>(null);
  const [actionTypeMenuAnchor, setActionTypeMenuAnchor] = useState<null | HTMLElement>(null);
  const [rowMenuAnchor, setRowMenuAnchor] = useState<null | HTMLElement>(null);
  const [rowMenuActionId, setRowMenuActionId] = useState<string | null>(null);

  useEffect(() => {
    if (caseIdFilter) setSelectedStatuses([]);
  }, [caseIdFilter]);

  useEffect(() => {
    if (focusActionId && filteredActions.length > 0) {
      const action = filteredActions.find((a) => a.id === focusActionId);
      if (action) {
        setSelectedAction(action);
        setSheetOpen(true);
      }
    }
  }, [focusActionId, filteredActions]);

  const displayActions = filteredActions.filter((a) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!a.description.toLowerCase().includes(q) && !a.id.toLowerCase().includes(q)) return false;
    }
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(a.status)) return false;
    if (selectedRiskLevels.length > 0 && !selectedRiskLevels.includes(a.riskLevel)) return false;
    if (selectedActionTypes.length > 0 && !selectedActionTypes.includes(a.type)) return false;
    return true;
  });

  const pendingActions = displayActions.filter((a) => a.status === 'pending');
  const allPendingSelected =
    pendingActions.length > 0 && pendingActions.every((a) => selectedActionIds.has(a.id));
  const somePendingSelected = pendingActions.some((a) => selectedActionIds.has(a.id));
  const selectedPendingCount = [...selectedActionIds].filter((id) =>
    displayActions.find((a) => a.id === id && a.status === 'pending')
  ).length;

  const toggleActionSelection = (actionId: string) => {
    setSelectedActionIds((prev) => {
      const next = new Set(prev);
      if (next.has(actionId)) next.delete(actionId);
      else next.add(actionId);
      return next;
    });
  };

  const toggleAllPendingSelection = () => {
    if (allPendingSelected) setSelectedActionIds(new Set());
    else setSelectedActionIds(new Set(pendingActions.map((a) => a.id)));
  };

  const handleActionClick = (action: ActionListItem) => {
    setSelectedAction(action);
    setSheetOpen(true);
  };

  const handleCreateAction = (form: CreateActionForm) => {
    createMutation.mutate({
      caseId: String(form.caseId),
      actionType: form.actionType,
      payload: form.payload,
    });
  };

  const executeBulkAction = async () => {
    if (bulkAction !== 'approve') {
      setBulkApprovalOpen(false);
      setBulkAction(null);
      setSelectedActionIds(new Set());
      return;
    }
    setIsBulkProcessing(true);
    for (const id of selectedActionIds) {
      if (displayActions.find((a) => a.id === id && a.status === 'pending')) {
        try {
          await approveMutation.mutateAsync(id);
        } catch {
          // toast already shown by mutation
        }
      }
    }
    setIsBulkProcessing(false);
    setBulkApprovalOpen(false);
    setSelectedActionIds(new Set());
    setBulkAction(null);
  };

  const handleSimulate = (actionId: string) => {
    simulateMutation.mutate(actionId, {
      onSuccess: (data: unknown) => {
        const d = data as { predictedSuccess?: boolean; impactedObjects?: string[]; validations?: { name: string; passed: boolean; message: string }[]; riskNotes?: string[] };
        setDrawerSimulationResult({
          predictedSuccess: d?.predictedSuccess ?? false,
          impactedObjects: d?.impactedObjects ?? [],
          validations: d?.validations ?? [],
          riskNotes: d?.riskNotes ?? [],
        });
      },
    });
  };

  const handleApprove = (actionId: string) => {
    approveMutation.mutate(actionId, {
      onSuccess: () => {
        setSheetOpen(false);
        setSelectedAction(null);
        setDrawerSimulationResult(null);
      },
    });
  };

  const handleReject = (actionId: string) => {
    rejectMutation.mutate(actionId, {
      onSuccess: () => {
        setSheetOpen(false);
        setSelectedAction(null);
        setDrawerSimulationResult(null);
      },
    });
  };

  const handleExecute = (actionId: string) => {
    executeMutation.mutate(actionId, {
      onSuccess: () => {
        setSheetOpen(false);
        setSelectedAction(null);
        setDrawerSimulationResult(null);
      },
    });
  };

  const handleResume = (actionId: string) => {
    resumeMutation.mutate(actionId, {
      onSuccess: () => {
        setSheetOpen(false);
        setSelectedAction(null);
        setDrawerSimulationResult(null);
      },
    });
  };

  const isDrawerActionPending =
    approveMutation.isPending ||
    executeMutation.isPending ||
    resumeMutation.isPending ||
    simulateMutation.isPending ||
    rejectMutation.isPending;

  const handleClearCaseFilter = () => setSearchParams({});

  const hasActiveFilters =
    Boolean(caseIdFilter) ||
    Boolean(statusFilter) ||
    Boolean(actionStatusFilter) ||
    Boolean(requiresApprovalFilter) ||
    Boolean(assigneeFilter) ||
    Boolean(focusActionId) ||
    Boolean(searchParams.get('range')) ||
    Boolean(filtersApplied && Object.keys(filtersApplied).length > 0);

  if (error) {
    return (
      <ErrorStateWithRetry
        title={is403Error(error) ? undefined : t('error.errorState.failedToLoadActions')}
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
        is403={is403Error(error)}
      />
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {t('actions.title')}
          </Typography>
          {caseIdFilter && (
            <Chip
              icon={<Iconify icon="solar:document-text-bold" width={16} />}
              label={t('actions.filteredByCaseLabel')}
              size="small"
              color="secondary"
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {caseIdFilter
              ? t('actions.filteredByCase', { caseNumber: linkedCase?.caseNumber ?? caseIdFilter })
              : t('actions.subtitleDescription')}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              size="small"
              startIcon={<Iconify icon="solar:add-circle-bold" width={18} />}
              onClick={() => setCreateModalOpen(true)}
            >
              {t('actions.buttons.createAction')}
            </Button>
            {caseIdFilter && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<Iconify icon="solar:close-circle-bold" />}
                onClick={handleClearCaseFilter}
              >
                {t('actions.clearFilter')}
              </Button>
            )}
          </Stack>
        </Box>
      </Box>

      {hasActiveFilters && (
        <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
            적용된 필터:
          </Typography>
          {(filtersApplied?.range ?? searchParams.get('range')) && (
            <Chip
              size="small"
              label={`기간: ${filtersApplied?.range ?? searchParams.get('range')}`}
              onDelete={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('range');
                next.delete('from');
                next.delete('to');
                setSearchParams(next);
              }}
            />
          )}
          {(
            (filtersApplied?.status as string[] | undefined) ??
            (filtersApplied?.actionStatus as string[] | undefined) ??
            (statusFilter ? [statusFilter] : actionStatusFilter ? [actionStatusFilter] : [])
          ).map((s) => (
            <Chip
              key={`status-${s}`}
              size="small"
              label={`상태: ${s}`}
              onDelete={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('status');
                next.delete('actionStatus');
                setSearchParams(next);
              }}
            />
          ))}
          {requiresApprovalFilter && (
            <Chip
              size="small"
              label="승인 필요"
              onDelete={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('requiresApproval');
                setSearchParams(next);
              }}
            />
          )}
          {(assigneeFilter ?? (filtersApplied?.assignee as string | undefined)) && (
            <Chip
              size="small"
              label={`담당자: ${assigneeFilter ?? (filtersApplied?.assignee as string)}`}
              onDelete={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('assignee');
                setSearchParams(next);
                window.location.reload();
              }}
            />
          )}
          {caseIdFilter && (
            <Chip
              size="small"
              label={`케이스: ${linkedCase?.caseNumber ?? caseIdFilter}`}
              onDelete={handleClearCaseFilter}
            />
          )}
          {focusActionId && (
            <Chip
              size="small"
              label={`포커스: ${focusActionId}`}
              onDelete={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('focus');
                setSearchParams(next);
              }}
            />
          )}
        </Stack>
      )}

      {selectedPendingCount > 0 && (
        <Card sx={{ mb: 3, bgcolor: 'primary.lighter', border: '1px solid', borderColor: 'primary.light' }}>
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
                    {t('actions.bulk.selected', { count: selectedPendingCount })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('actions.bulk.readyForBulk')}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" size="small" onClick={() => setSelectedActionIds(new Set())}>
                  {t('actions.bulk.clearSelection')}
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  color="error"
                  startIcon={<Iconify icon="solar:close-circle-bold" />}
                  onClick={() => {
                    setBulkAction('reject');
                    setBulkApprovalOpen(true);
                  }}
                >
                  {t('actions.bulk.rejectAll')}
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  color="primary"
                  startIcon={<Iconify icon="solar:check-circle-bold" />}
                  onClick={() => {
                    setBulkAction('approve');
                    setBulkApprovalOpen(true);
                  }}
                >
                  {t('actions.bulk.approveAll')}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
        <Card>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" color="text.secondary">
                  {t('actions.cards.pendingApproval')}
                </Typography>
                <Typography variant="h3" sx={{ color: 'warning.main', fontWeight: 700 }}>
                  {pendingCount}
                </Typography>
              </Box>
              <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: 'warning.lighter', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  {t('actions.cards.approvedToday')}
                </Typography>
                <Typography variant="h3" sx={{ color: 'success.main', fontWeight: 700 }}>
                  {approvedCount}
                </Typography>
              </Box>
              <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: 'success.lighter', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  {t('actions.cards.executedToday')}
                </Typography>
                <Typography variant="h3" sx={{ color: 'primary.main', fontWeight: 700 }}>
                  {executedCount}
                </Typography>
              </Box>
              <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: 'primary.lighter', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Iconify icon="solar:bolt-circle-bold" width={24} sx={{ color: 'primary.main' }} />
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" flexWrap="wrap" gap={1.5} alignItems="center">
            <TextField
              size="small"
              placeholder={t('actions.searchPlaceholder')}
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
            <Badge badgeContent={selectedStatuses.length} color="primary">
              <Button variant="outlined" size="small" startIcon={<Iconify icon="solar:filter-bold" width={16} />} onClick={(e) => setStatusMenuAnchor(e.currentTarget)}>
                Status
              </Button>
            </Badge>
            <Menu anchorEl={statusMenuAnchor} open={Boolean(statusMenuAnchor)} onClose={() => setStatusMenuAnchor(null)}>
              {statuses.map((s) => (
                <MenuItem
                  key={s}
                  onClick={() =>
                    setSelectedStatuses((prev) =>
                      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                    )
                  }
                >
                  <Checkbox checked={selectedStatuses.includes(s)} sx={{ mr: 1 }} />
                  <StatusPill status={s as import('../../components/finance/status-pill').Status} size="sm" />
                </MenuItem>
              ))}
            </Menu>
            <Badge badgeContent={selectedRiskLevels.length} color="primary">
              <Button variant="outlined" size="small" startIcon={<Iconify icon="solar:filter-bold" width={16} />} onClick={(e) => setRiskMenuAnchor(e.currentTarget)}>
                Risk Level
              </Button>
            </Badge>
            <Menu anchorEl={riskMenuAnchor} open={Boolean(riskMenuAnchor)} onClose={() => setRiskMenuAnchor(null)}>
              {riskLevels.map((r) => (
                <MenuItem
                  key={r}
                  onClick={() =>
                    setSelectedRiskLevels((prev) =>
                      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
                    )
                  }
                >
                  <Checkbox checked={selectedRiskLevels.includes(r)} sx={{ mr: 1 }} />
                  <SeverityBadge severity={r as ActionListItem['riskLevel']} size="sm" />
                </MenuItem>
              ))}
            </Menu>
            <Badge badgeContent={selectedActionTypes.length} color="primary">
              <Button variant="outlined" size="small" startIcon={<Iconify icon="solar:filter-bold" width={16} />} onClick={(e) => setActionTypeMenuAnchor(e.currentTarget)}>
                {t('actions.actionType')}
              </Button>
            </Badge>
            <Menu anchorEl={actionTypeMenuAnchor} open={Boolean(actionTypeMenuAnchor)} onClose={() => setActionTypeMenuAnchor(null)}>
              {actionTypes.map((actionType) => (
                <MenuItem
                  key={actionType.value}
                  onClick={() =>
                    setSelectedActionTypes((prev) =>
                      prev.includes(actionType.value)
                        ? prev.filter((x) => x !== actionType.value)
                        : [...prev, actionType.value]
                    )
                  }
                >
                  <Checkbox checked={selectedActionTypes.includes(actionType.value)} sx={{ mr: 1 }} />
                  {actionType.label}
                </MenuItem>
              ))}
            </Menu>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6">{t('actions.queue.title')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('actions.queue.matchingFilters', { count: displayActions.length })}
            </Typography>
          </Box>
          {isLoading ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {t('actions.queue.loading')}
              </Typography>
            </Box>
          ) : (
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
                    <TableCell>{t('actions.table.actionId')}</TableCell>
                    <TableCell>{t('actions.table.linkedCase')}</TableCell>
                    <TableCell>{t('actions.table.actionType')}</TableCell>
                    <TableCell>{t('actions.table.risk')}</TableCell>
                    <TableCell>{t('actions.table.created')}</TableCell>
                    <TableCell>{t('actions.table.status')}</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayActions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                        <Typography variant="body2" color="text.secondary">
                          {t('actions.queue.noActionsFound')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayActions.map((action) => {
                      const relatedCase = casesForDropdown.find((c) => String(c.caseId) === action.caseId);
                      const isSelected = selectedActionIds.has(action.id);
                      const isCaseFiltered = caseIdFilter && action.caseId === caseIdFilter;
                      return (
                        <TableRow
                          key={action.id}
                          hover
                          onClick={() => handleActionClick(action)}
                          sx={{
                            cursor: 'pointer',
                            ...(isCaseFiltered && { bgcolor: 'primary.lighter' }),
                            ...(isSelected && { bgcolor: 'action.selected' }),
                          }}
                        >
                          <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
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
                              to={SYNAPSE_ROUTES.CASE_DETAIL.replace(':id', action.caseId)}
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: theme.palette.primary.main, textDecoration: 'none' }}
                            >
                              {relatedCase ? `CS-${relatedCase.caseId}` : action.caseId}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                              {action.type.replace(/_/g, ' ')}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <SeverityBadge severity={action.riskLevel} size="sm" showIcon={false} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {new Date(action.createdAt).toLocaleDateString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <StatusPill status={action.status as import('../../components/finance/status-pill').Status} size="sm" />
                          </TableCell>
                          <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                            <IconButton
                              size="small"
                              onClick={(e: MouseEvent<HTMLElement>) => {
                                e.stopPropagation();
                                setRowMenuAnchor(e.currentTarget);
                                setRowMenuActionId(action.id);
                              }}
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
          )}
        </CardContent>
      </Card>

      <Menu anchorEl={rowMenuAnchor} open={Boolean(rowMenuAnchor)} onClose={() => setRowMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            if (rowMenuActionId) {
              const action = displayActions.find((a) => a.id === rowMenuActionId);
              if (action) handleActionClick(action);
            }
            setRowMenuAnchor(null);
          }}
        >
          View Details
        </MenuItem>
      </Menu>

      <Drawer
        anchor="right"
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 500 }, p: 0 } }}
      >
        {selectedAction && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
                <StatusPill status={selectedAction.status as import('../../components/finance/status-pill').Status} />
              </Stack>
            </Box>
            <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
              <Stack spacing={3}>
                <Box>
                  <Typography variant="subtitle2" sx={{ textTransform: 'capitalize', mb: 1 }}>
                    {selectedAction.type.replace(/_/g, ' ')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedAction.description}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Linked Case
                  </Typography>
                  <Link to={SYNAPSE_ROUTES.CASE_DETAIL.replace(':id', selectedAction.caseId)} style={{ textDecoration: 'none' }}>
                    <Card sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                      <CardContent>
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Typography variant="body2" sx={{ color: 'primary.main' }}>
                            {casesForDropdown.find((c) => String(c.caseId) === selectedAction.caseId) ? `CS-${selectedAction.caseId}` : selectedAction.caseId}
                          </Typography>
                          <Iconify icon="solar:alt-arrow-right-linear" width={16} />
                        </Stack>
                      </CardContent>
                    </Card>
                  </Link>
                </Box>
                {(drawerSimulationResult || selectedAction.simulation) && (
                  <SimulationResultCard
                    result={{
                      predictedSuccess:
                        drawerSimulationResult?.predictedSuccess ??
                        selectedAction.simulation?.predictedSuccess ??
                        false,
                      impactedObjects:
                        drawerSimulationResult?.impactedObjects ??
                        selectedAction.simulation?.impactedObjects ??
                        [],
                      validations:
                        drawerSimulationResult?.validations ??
                        selectedAction.simulation?.validations ??
                        [],
                      riskNotes:
                        drawerSimulationResult?.riskNotes ??
                        selectedAction.simulation?.riskNotes ??
                        [],
                    }}
                  />
                )}
              </Stack>
            </Box>
            {selectedAction.status === 'pending' && (
              <Box sx={{ p: 3, borderTop: 1, borderColor: 'divider', bgcolor: 'background.neutral' }}>
                <Stack spacing={2}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Step 1: Simulate (optional) → Step 2: Approve → Step 3: Execute / Resume
                  </Typography>
                  <Stack direction="row" spacing={1.5} flexWrap="wrap">
                    <PermissionGate resource={ACTIONS_RESOURCE} permission="USE">
                      <Button
                        variant="outlined"
                        fullWidth
                        startIcon={
                          simulateMutation.isPending ? (
                            <CircularProgress size={16} />
                          ) : (
                            <Iconify icon="solar:play-circle-bold" />
                          )
                        }
                        onClick={() => handleSimulate(selectedAction.id)}
                        disabled={isDrawerActionPending}
                      >
                        Simulate
                      </Button>
                    </PermissionGate>
                    <PermissionGate resource={ACTIONS_RESOURCE} permission="APPROVE">
                      <Button
                        variant="contained"
                        color="error"
                        fullWidth
                        startIcon={
                          rejectMutation.isPending ? (
                            <CircularProgress size={16} />
                          ) : (
                            <Iconify icon="solar:close-circle-bold" />
                          )
                        }
                        onClick={() => handleReject(selectedAction.id)}
                        disabled={isDrawerActionPending}
                      >
                        Reject
                      </Button>
                    </PermissionGate>
                    <PermissionGate resource={ACTIONS_RESOURCE} permission="APPROVE">
                      <Button
                        variant="contained"
                        color="primary"
                        fullWidth
                        startIcon={
                          approveMutation.isPending ? (
                            <CircularProgress size={16} />
                          ) : (
                            <Iconify icon="solar:check-circle-bold" />
                          )
                        }
                        onClick={() => handleApprove(selectedAction.id)}
                        disabled={isDrawerActionPending}
                      >
                        Approve
                      </Button>
                    </PermissionGate>
                    <PermissionGate resource={ACTIONS_RESOURCE} permission="EXECUTE">
                      <Button
                        variant="contained"
                        fullWidth
                        startIcon={
                          executeMutation.isPending ? (
                            <CircularProgress size={16} />
                          ) : (
                            <Iconify icon="solar:bolt-bold" />
                          )
                        }
                        onClick={() => handleExecute(selectedAction.id)}
                        disabled={isDrawerActionPending}
                      >
                        Execute
                      </Button>
                    </PermissionGate>
                  </Stack>
                </Stack>
              </Box>
            )}
            {selectedAction.status === 'approved' && (
              <Box sx={{ p: 3, borderTop: 1, borderColor: 'divider', bgcolor: 'background.neutral' }}>
                <Stack spacing={2}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    HITL 재개 — 승인 후 실행
                  </Typography>
                  <Stack direction="row" spacing={1.5}>
                    <PermissionGate resource={ACTIONS_RESOURCE} permission="EXECUTE">
                      <Button
                        variant="contained"
                        fullWidth
                        startIcon={
                          resumeMutation.isPending ? (
                            <CircularProgress size={16} />
                          ) : (
                            <Iconify icon="solar:play-circle-bold" />
                          )
                        }
                        onClick={() => handleResume(selectedAction.id)}
                        disabled={isDrawerActionPending}
                      >
                        Resume
                      </Button>
                    </PermissionGate>
                    <PermissionGate resource={ACTIONS_RESOURCE} permission="EXECUTE">
                      <Button
                        variant="outlined"
                        fullWidth
                        startIcon={
                          executeMutation.isPending ? (
                            <CircularProgress size={16} />
                          ) : (
                            <Iconify icon="solar:bolt-bold" />
                          )
                        }
                        onClick={() => handleExecute(selectedAction.id)}
                        disabled={isDrawerActionPending}
                      >
                        Execute
                      </Button>
                    </PermissionGate>
                  </Stack>
                </Stack>
              </Box>
            )}
          </Box>
        )}
      </Drawer>

      <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} maxWidth="sm" fullWidth>
        <CreateActionModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSubmit={handleCreateAction}
          isLoading={createMutation.isPending}
          defaultCaseId={caseIdFilter ?? undefined}
          availableCaseIds={casesForDropdown.map((c) => ({
            id: String(c.caseId),
            caseNumber: `CS-${c.caseId}`,
            caseIdNum: Number(c.caseId) || undefined,
          }))}
        />
      </Dialog>

      <Dialog open={bulkApprovalOpen} onClose={() => setBulkApprovalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            {bulkAction === 'approve' ? (
              <>
                <Iconify icon="solar:check-circle-bold" width={20} sx={{ color: 'success.main' }} />
                <span>{t('actions.bulk.approveTitle')}</span>
              </>
            ) : (
              <>
                <Iconify icon="solar:close-circle-bold" width={20} sx={{ color: 'error.main' }} />
                <span>{t('actions.bulk.rejectTitle')}</span>
              </>
            )}
          </Stack>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t('actions.bulk.confirmBulk', {
              count: selectedPendingCount,
              action: bulkAction === 'approve' ? t('actions.buttons.approve') : t('actions.buttons.reject'),
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" onClick={() => setBulkApprovalOpen(false)} disabled={isBulkProcessing}>
            {t('actions.bulk.cancel')}
          </Button>
          <PermissionGate resource={ACTIONS_RESOURCE} permission="APPROVE">
            <Button
              variant="contained"
              color={bulkAction === 'approve' ? 'primary' : 'error'}
              onClick={executeBulkAction}
              disabled={isBulkProcessing}
              startIcon={isBulkProcessing ? <CircularProgress size={16} /> : undefined}
            >
              {isBulkProcessing ? t('actions.bulk.processing') : bulkAction === 'approve' ? t('actions.bulk.confirmApproval') : t('actions.bulk.confirmRejection')}
            </Button>
          </PermissionGate>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
