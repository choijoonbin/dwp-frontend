import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, CheckCircle2, Database, Pencil, Plus, RefreshCw, Search } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useToast,
  getReferenceSet,
  listReferenceSets,
  createReferenceSet,
  updateReferenceSet,
  retireReferenceSet,
  activateReferenceSet,
  createReferenceItem,
  updateReferenceItem,
  retireReferenceItem,
  activateReferenceItem,
} from '@dwp-frontend/shared-utils';
import { EnterpriseDataGrid } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import ListItemButton from '@mui/material/ListItemButton';
import InputAdornment from '@mui/material/InputAdornment';
import useMediaQuery from '@mui/material/useMediaQuery';

import { AdminPanelError, AdminPanelLoading, LifecycleChip } from './admin-ui';
import { ConfirmActionDialog, ReferenceItemDialog, ReferenceSetDialog } from './reference-dialogs';

import type { GridColDef } from '@mui/x-data-grid';
import type {
  ReferenceItem,
  ReferenceSetDetail,
  CreateReferenceSetRequest,
  CreateReferenceItemRequest,
  UpdateReferenceSetRequest,
  UpdateReferenceItemRequest,
} from '@dwp-frontend/shared-utils';

type SetDialogMode = 'create' | 'edit' | null;
type ItemDialogState = { mode: 'create' } | { mode: 'edit'; item: ReferenceItem } | null;
type PendingAction =
  | { kind: 'activate-set' }
  | { kind: 'retire-set' }
  | { kind: 'activate-item'; item: ReferenceItem }
  | { kind: 'retire-item'; item: ReferenceItem }
  | null;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function preferredLabel(item: ReferenceItem, locale: string): string {
  const normalizedLocale = locale.toLowerCase();
  const baseLocale = normalizedLocale.split('-')[0];
  return (
    item.labels.find((label) => label.locale.toLowerCase() === normalizedLocale)?.label ??
    item.labels.find((label) => label.locale.toLowerCase().split('-')[0] === baseLocale)?.label ??
    item.labels.find((label) => label.locale.toLowerCase().startsWith('en'))?.label ??
    item.labels[0]?.label ??
    item.code
  );
}

export function ReferenceDataManager() {
  const { t, i18n } = useTranslation('admin');
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const toast = useToast();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('sm'));
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [setDialogMode, setSetDialogMode] = useState<SetDialogMode>(null);
  const [itemDialog, setItemDialog] = useState<ItemDialogState>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);

  const setsQuery = useQuery({
    queryKey: ['admin', 'reference-sets', deferredQuery],
    queryFn: () => listReferenceSets(deferredQuery),
  });
  const sets = useMemo(() => setsQuery.data?.content ?? [], [setsQuery.data]);

  useEffect(() => {
    if (sets.length === 0) {
      setSelectedKey(null);
      return;
    }
    if (!selectedKey || !sets.some((set) => set.setKey === selectedKey)) {
      setSelectedKey(sets[0].setKey);
    }
  }, [selectedKey, sets]);

  const detailQuery = useQuery({
    queryKey: ['admin', 'reference-set', selectedKey],
    queryFn: () => getReferenceSet(selectedKey!),
    enabled: Boolean(selectedKey),
  });
  const detail = detailQuery.data;

  const acceptDetail = async (next: ReferenceSetDetail, message: string) => {
    setSelectedKey(next.setKey);
    queryClient.setQueryData(['admin', 'reference-set', next.setKey], next);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'reference-sets'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] }),
    ]);
    toast.success(message);
  };

  const run = async (operation: () => Promise<ReferenceSetDetail>, successMessage: string) => {
    setBusy(true);
    try {
      await acceptDetail(await operation(), successMessage);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, t('common.operationError')));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveSet = async (request: CreateReferenceSetRequest) => {
    const completed = await run(
      () => createReferenceSet(request),
      t('referenceData.toasts.setCreated')
    );
    if (completed) setSetDialogMode(null);
  };

  const updateSet = async (request: UpdateReferenceSetRequest) => {
    if (!detail) return;
    const completed = await run(
      () => updateReferenceSet(detail.setKey, request),
      t('referenceData.toasts.setUpdated')
    );
    if (completed) setSetDialogMode(null);
  };

  const saveItem = async (request: CreateReferenceItemRequest) => {
    if (!detail) return;
    const completed = await run(
      () => createReferenceItem(detail.setKey, request),
      t('referenceData.toasts.itemCreated')
    );
    if (completed) setItemDialog(null);
  };

  const updateItem = async (request: UpdateReferenceItemRequest) => {
    if (!detail || itemDialog?.mode !== 'edit') return;
    const completed = await run(
      () => updateReferenceItem(detail.setKey, itemDialog.item.code, request),
      t('referenceData.toasts.itemUpdated')
    );
    if (completed) setItemDialog(null);
  };

  const confirmAction = async () => {
    if (!detail || !pendingAction) return;
    let completed = false;
    if (pendingAction.kind === 'activate-set') {
      completed = await run(
        () => activateReferenceSet(detail.setKey, detail.version),
        t('referenceData.toasts.setActivated')
      );
    } else if (pendingAction.kind === 'retire-set') {
      completed = await run(
        () => retireReferenceSet(detail.setKey, detail.version),
        t('referenceData.toasts.setRetired')
      );
    } else if (pendingAction.kind === 'activate-item') {
      completed = await run(
        () =>
          activateReferenceItem(detail.setKey, pendingAction.item.code, pendingAction.item.version),
        t('referenceData.toasts.itemActivated')
      );
    } else {
      completed = await run(
        () =>
          retireReferenceItem(detail.setKey, pendingAction.item.code, pendingAction.item.version),
        t('referenceData.toasts.itemRetired')
      );
    }
    if (completed) setPendingAction(null);
  };

  const columns = useMemo<GridColDef<ReferenceItem>[]>(
    () => [
      {
        field: 'code',
        headerName: t('referenceData.columns.code'),
        minWidth: 150,
        flex: 1,
        renderCell: ({ row }) => (
          <Box sx={{ minWidth: 0, py: 1 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {row.code}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {preferredLabel(row, locale)}
            </Typography>
          </Box>
        ),
      },
      {
        field: 'lifecycleState',
        headerName: t('referenceData.columns.state'),
        width: 98,
        renderCell: ({ row }) => <LifecycleChip state={row.lifecycleState} />,
      },
      {
        field: 'labels',
        headerName: t('referenceData.columns.locales'),
        width: 84,
        sortable: false,
        renderCell: ({ row }) => <Chip label={row.labels.length} size="small" variant="outlined" />,
      },
      {
        field: 'sortOrder',
        headerName: t('referenceData.columns.order'),
        width: 72,
        type: 'number',
      },
      {
        field: 'parentCode',
        headerName: t('referenceData.columns.parent'),
        minWidth: 100,
        flex: 0.45,
        renderCell: ({ row }) => row.parentCode || '—',
      },
      {
        field: 'actions',
        headerName: '',
        width: 92,
        sortable: false,
        filterable: false,
        align: 'right',
        renderCell: ({ row }) => (
          <Stack direction="row" justifyContent="flex-end" sx={{ width: 1 }}>
            <Tooltip title={t('referenceData.actions.editItem')}>
              <span>
                <IconButton
                  size="small"
                  aria-label={t('referenceData.actions.editNamed', { code: row.code })}
                  disabled={
                    detail?.lifecycleState === 'RETIRED' || row.lifecycleState === 'RETIRED'
                  }
                  onClick={() => setItemDialog({ mode: 'edit', item: row })}
                >
                  <Pencil size={17} strokeWidth={1.8} />
                </IconButton>
              </span>
            </Tooltip>
            {row.lifecycleState === 'DRAFT' ? (
              <Tooltip title={t('referenceData.actions.activateItem')}>
                <span>
                  <IconButton
                    size="small"
                    color="success"
                    aria-label={t('referenceData.actions.activateNamed', { code: row.code })}
                    disabled={detail?.lifecycleState !== 'ACTIVE'}
                    onClick={() => setPendingAction({ kind: 'activate-item', item: row })}
                  >
                    <CheckCircle2 size={17} strokeWidth={1.8} />
                  </IconButton>
                </span>
              </Tooltip>
            ) : (
              <Tooltip title={t('referenceData.actions.retireItem')}>
                <span>
                  <IconButton
                    size="small"
                    aria-label={t('referenceData.actions.retireNamed', { code: row.code })}
                    disabled={
                      row.lifecycleState === 'RETIRED' || detail?.lifecycleState === 'RETIRED'
                    }
                    onClick={() => setPendingAction({ kind: 'retire-item', item: row })}
                  >
                    <Archive size={17} strokeWidth={1.8} />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Stack>
        ),
      },
    ],
    [detail?.lifecycleState, locale, t]
  );

  if (setsQuery.isLoading) {
    return <AdminPanelLoading label={t('referenceData.loading')} />;
  }
  if (setsQuery.isError) {
    return <AdminPanelError message={errorMessage(setsQuery.error, t('common.operationError'))} />;
  }

  const confirmCopy = pendingAction
    ? pendingAction.kind === 'activate-set'
      ? {
          title: t('referenceData.confirm.activateSetTitle'),
          message: t('referenceData.confirm.activateSetMessage'),
          confirmLabel: t('referenceData.actions.activate'),
          destructive: false,
        }
      : pendingAction.kind === 'retire-set'
        ? {
            title: t('referenceData.confirm.retireSetTitle'),
            message: t('referenceData.confirm.retireSetMessage'),
            confirmLabel: t('referenceData.actions.retire'),
            destructive: true,
          }
        : pendingAction.kind === 'activate-item'
          ? {
              title: t('referenceData.confirm.activateItemTitle', {
                code: pendingAction.item.code,
              }),
              message: t('referenceData.confirm.activateItemMessage'),
              confirmLabel: t('referenceData.actions.activate'),
              destructive: false,
            }
          : {
              title: t('referenceData.confirm.retireItemTitle', {
                code: pendingAction.item.code,
              }),
              message: t('referenceData.confirm.retireItemMessage'),
              confirmLabel: t('referenceData.actions.retire'),
              destructive: true,
            }
    : null;

  return (
    <>
      <Box
        sx={{
          minHeight: 600,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '280px minmax(0, 1fr)' },
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box
          component="aside"
          aria-label={t('referenceData.referenceSets')}
          sx={{
            minWidth: 0,
            borderRight: { xs: 0, md: 1 },
            borderBottom: { xs: 1, md: 0 },
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Database size={18} strokeWidth={1.8} aria-hidden="true" />
              <Typography component="h2" variant="subtitle1">
                {t('referenceData.referenceSets')}
              </Typography>
            </Box>
            <Tooltip title={t('referenceData.actions.newSet')}>
              <IconButton
                size="small"
                aria-label={t('referenceData.actions.newSet')}
                onClick={() => setSetDialogMode('create')}
              >
                <Plus size={18} strokeWidth={1.8} />
              </IconButton>
            </Tooltip>
          </Stack>
          <Box sx={{ px: 2, pb: 1.5 }}>
            <TextField
              fullWidth
              size="small"
              label={t('referenceData.searchSets')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={17} strokeWidth={1.8} aria-hidden="true" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
          <Box sx={{ maxHeight: { xs: 240, md: 560 }, overflowY: 'auto', px: 1, pb: 1 }}>
            {sets.length ? (
              sets.map((set) => (
                <ListItemButton
                  key={set.setKey}
                  selected={set.setKey === selectedKey}
                  onClick={() => setSelectedKey(set.setKey)}
                  sx={{ py: 1.25, px: 1.5, alignItems: 'flex-start', borderRadius: 1 }}
                >
                  <Box sx={{ minWidth: 0, width: 1 }}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      gap={1}
                    >
                      <Typography component="p" variant="subtitle2" noWrap>
                        {set.name}
                      </Typography>
                      <LifecycleChip state={set.lifecycleState} />
                    </Stack>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{ display: 'block', mt: 0.25 }}
                    >
                      {set.setKey} / {t('referenceData.itemCount', { count: set.itemCount })}
                    </Typography>
                  </Box>
                </ListItemButton>
              ))
            ) : (
              <Box sx={{ py: 6, px: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {t('referenceData.noSets')}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        <Box component="section" aria-label={t('referenceData.setDetail')} sx={{ minWidth: 0 }}>
          {detailQuery.isLoading ? (
            <AdminPanelLoading label={t('referenceData.loadingSet')} />
          ) : detailQuery.isError ? (
            <AdminPanelError
              message={errorMessage(detailQuery.error, t('common.operationError'))}
            />
          ) : detail ? (
            <>
              <Box
                sx={{
                  minHeight: 82,
                  px: { xs: 2, md: 2.5 },
                  py: 1.75,
                  display: 'flex',
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  justifyContent: 'space-between',
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 1.5,
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                    <Typography component="h2" variant="h6">
                      {detail.name}
                    </Typography>
                    <LifecycleChip state={detail.lifecycleState} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {t('referenceData.revision', {
                      key: detail.setKey,
                      revision: detail.revision,
                    })}
                  </Typography>
                </Box>
                <Stack direction="row" alignItems="center">
                  <Tooltip title={t('common.actions.refresh')}>
                    <IconButton
                      aria-label={t('referenceData.actions.refreshSet')}
                      onClick={() => void detailQuery.refetch()}
                    >
                      <RefreshCw size={18} strokeWidth={1.8} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('referenceData.actions.editSet')}>
                    <span>
                      <IconButton
                        aria-label={t('referenceData.actions.editSet')}
                        disabled={detail.lifecycleState === 'RETIRED'}
                        onClick={() => setSetDialogMode('edit')}
                      >
                        <Pencil size={18} strokeWidth={1.8} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={t('referenceData.actions.newItem')}>
                    <span>
                      <IconButton
                        aria-label={t('referenceData.actions.newItem')}
                        disabled={detail.lifecycleState === 'RETIRED'}
                        onClick={() => setItemDialog({ mode: 'create' })}
                      >
                        <Plus size={18} strokeWidth={1.8} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  {detail.lifecycleState === 'DRAFT' ? (
                    <Tooltip title={t('referenceData.actions.activateSet')}>
                      <span>
                        <IconButton
                          color="success"
                          aria-label={t('referenceData.actions.activateSet')}
                          disabled={detail.items.length === 0}
                          onClick={() => setPendingAction({ kind: 'activate-set' })}
                        >
                          <CheckCircle2 size={18} strokeWidth={1.8} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  ) : (
                    <Tooltip title={t('referenceData.actions.retireSet')}>
                      <span>
                        <IconButton
                          aria-label={t('referenceData.actions.retireSet')}
                          disabled={detail.lifecycleState === 'RETIRED'}
                          onClick={() => setPendingAction({ kind: 'retire-set' })}
                        >
                          <Archive size={18} strokeWidth={1.8} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </Stack>
              </Box>
              {desktop && (
                <Box>
                  <EnterpriseDataGrid
                    ariaLabel={t('referenceData.referenceItems')}
                    rows={detail.items}
                    columns={columns}
                    getRowId={(row) => row.code}
                    rowHeight={58}
                    columnHeaderHeight={44}
                    height={516}
                    hideFooter={detail.items.length <= 25}
                    initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
                    slots={{
                      noRowsOverlay: () => (
                        <Box sx={{ height: 1, display: 'grid', placeItems: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            {t('referenceData.noItems')}
                          </Typography>
                        </Box>
                      ),
                    }}
                    sx={{ border: 0, borderRadius: 0 }}
                  />
                </Box>
              )}
              {!desktop && (
                <Box
                  component="ul"
                  aria-label={t('referenceData.referenceItems')}
                  sx={{ display: 'grid', listStyle: 'none', p: 0, m: 0 }}
                >
                  {detail.items.length ? (
                    detail.items.map((item) => (
                      <Box
                        component="li"
                        key={item.code}
                        sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}
                      >
                        <Stack
                          direction="row"
                          alignItems="flex-start"
                          justifyContent="space-between"
                          gap={2}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography component="h3" variant="subtitle2">
                              {item.code}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                              {preferredLabel(item, locale)}
                            </Typography>
                          </Box>
                          <LifecycleChip state={item.lifecycleState} />
                        </Stack>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mt: 1 }}
                        >
                          {t('referenceData.itemSummary', {
                            order: item.sortOrder,
                            count: item.labels.length,
                          })}
                          {item.parentCode
                            ? ` / ${t('referenceData.parentSummary', { code: item.parentCode })}`
                            : ''}
                        </Typography>
                        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
                          <Tooltip title={t('referenceData.actions.editItem')}>
                            <span>
                              <IconButton
                                size="small"
                                aria-label={t('referenceData.actions.editNamed', {
                                  code: item.code,
                                })}
                                disabled={
                                  detail.lifecycleState === 'RETIRED' ||
                                  item.lifecycleState === 'RETIRED'
                                }
                                onClick={() => setItemDialog({ mode: 'edit', item })}
                              >
                                <Pencil size={17} strokeWidth={1.8} />
                              </IconButton>
                            </span>
                          </Tooltip>
                          {item.lifecycleState === 'DRAFT' ? (
                            <Tooltip title={t('referenceData.actions.activateItem')}>
                              <span>
                                <IconButton
                                  size="small"
                                  color="success"
                                  aria-label={t('referenceData.actions.activateNamed', {
                                    code: item.code,
                                  })}
                                  disabled={detail.lifecycleState !== 'ACTIVE'}
                                  onClick={() => setPendingAction({ kind: 'activate-item', item })}
                                >
                                  <CheckCircle2 size={17} strokeWidth={1.8} />
                                </IconButton>
                              </span>
                            </Tooltip>
                          ) : (
                            <Tooltip title={t('referenceData.actions.retireItem')}>
                              <span>
                                <IconButton
                                  size="small"
                                  aria-label={t('referenceData.actions.retireNamed', {
                                    code: item.code,
                                  })}
                                  disabled={
                                    item.lifecycleState === 'RETIRED' ||
                                    detail.lifecycleState === 'RETIRED'
                                  }
                                  onClick={() => setPendingAction({ kind: 'retire-item', item })}
                                >
                                  <Archive size={17} strokeWidth={1.8} />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                        </Stack>
                      </Box>
                    ))
                  ) : (
                    <Box component="li" sx={{ py: 6, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {t('referenceData.noItems')}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </>
          ) : (
            <Box sx={{ minHeight: 420, display: 'grid', placeItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {t('referenceData.selectSet')}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      <ReferenceSetDialog
        open={Boolean(setDialogMode)}
        value={setDialogMode === 'edit' ? detail : null}
        busy={busy}
        onClose={() => setSetDialogMode(null)}
        onCreate={saveSet}
        onUpdate={updateSet}
      />
      <ReferenceItemDialog
        open={Boolean(itemDialog)}
        value={itemDialog?.mode === 'edit' ? itemDialog.item : null}
        busy={busy}
        onClose={() => setItemDialog(null)}
        onCreate={saveItem}
        onUpdate={updateItem}
      />
      {confirmCopy && (
        <ConfirmActionDialog
          open
          {...confirmCopy}
          busy={busy}
          onClose={() => setPendingAction(null)}
          onConfirm={confirmAction}
        />
      )}
    </>
  );
}
