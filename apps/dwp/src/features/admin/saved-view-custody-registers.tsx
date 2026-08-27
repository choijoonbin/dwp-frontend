import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import {
  ActionButton,
  EnterpriseDataGrid,
  FormField,
  GuidedEmptyState,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import { ManagementPanelLoading } from '../../components/management-panel-state';
import { SavedViewOrphanActionDialog } from './saved-view-orphan-action-dialog';
import {
  daysUntil,
  filterOrphanedSavedViews,
  filterOwnershipHistory,
} from './saved-view-custody-model';
import {
  displayDate,
  dispositionLabel,
  SectionLoadError,
  surfaceLabel,
  userIdentityLabel,
} from './saved-view-custody-ui';

import type {
  OrphanedSavedView,
  SavedViewCustodyUser,
  SavedViewOwnershipTransferSummary,
} from '@dwp-frontend/shared-utils';
import type { GridColDef } from '@mui/x-data-grid';
import type { Theme } from '@mui/material/styles';

export function OrphanedSavedViewRegister({
  data,
  loading,
  error,
  canManage,
  onRetry,
  onChanged,
}: {
  data: OrphanedSavedView[];
  loading: boolean;
  error: boolean;
  canManage: boolean;
  onRetry: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const mobile = useMediaQuery<Theme>((theme) => theme.breakpoints.down('sm'));
  const [query, setQuery] = useState('');
  const [selectedView, setSelectedView] = useState<OrphanedSavedView | null>(null);
  const [conflictViewName, setConflictViewName] = useState<string | null>(null);
  const conflictNoticeRef = useRef<HTMLDivElement | null>(null);
  const openView = useCallback((view: OrphanedSavedView) => {
    setConflictViewName(null);
    setSelectedView(view);
  }, []);
  useEffect(() => {
    if (!conflictViewName) return;
    const timeout = window.setTimeout(() => conflictNoticeRef.current?.focus(), 300);
    return () => window.clearTimeout(timeout);
  }, [conflictViewName]);
  const filtered = filterOrphanedSavedViews(data, query, (value) => surfaceLabel(value, t));
  const columns = useMemo<GridColDef<OrphanedSavedView>[]>(() => {
    const values: GridColDef<OrphanedSavedView>[] = [
      {
        field: 'name',
        headerName: t('savedViewCustody.columns.view'),
        minWidth: 260,
        flex: 1.25,
        renderCell: ({ row }) => (
          <Stack justifyContent="center" sx={{ height: '100%', minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {row.name}
            </Typography>
            {row.reassignmentBlockReason === 'SHARED_NAME_CONFLICT' ? (
              <Typography variant="caption" color="warning.main" noWrap>
                {t('savedViewCustody.orphaned.reassignmentBlocked')}
              </Typography>
            ) : null}
          </Stack>
        ),
      },
      {
        field: 'surfaceKey',
        headerName: t('savedViewCustody.columns.surface'),
        minWidth: 190,
        flex: 1,
        valueFormatter: (value) => surfaceLabel(String(value), t),
      },
      {
        field: 'scope',
        headerName: t('savedViewCustody.columns.scope'),
        width: 120,
        valueFormatter: (value) => t('savedViewCustody.scopes.' + String(value)),
      },
      {
        field: 'retentionUntil',
        headerName: t('savedViewCustody.columns.retentionUntil'),
        minWidth: 220,
        renderCell: ({ row }) => {
          const remaining = daysUntil(row.retentionUntil);
          return (
            <Stack justifyContent="center" sx={{ height: '100%' }}>
              <Typography variant="body2">{displayDate(row.retentionUntil)}</Typography>
              <Typography
                variant="caption"
                color={remaining <= 7 ? 'error.main' : 'text.secondary'}
              >
                {remaining <= 0
                  ? t('savedViewCustody.orphaned.dueNow')
                  : t('savedViewCustody.orphaned.daysRemaining', {
                      count: remaining,
                    })}
              </Typography>
            </Stack>
          );
        },
      },
      {
        field: 'updatedAt',
        headerName: t('savedViewCustody.columns.suspendedAt'),
        width: 180,
        valueFormatter: (value) => displayDate(String(value)),
      },
    ];
    if (canManage) {
      values.push({
        field: 'actions',
        headerName: t('savedViewCustody.columns.actions'),
        width: 116,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: ({ row }) => (
          <ActionButton intent="secondary" size="small" onClick={() => openView(row)}>
            {t('savedViewCustody.orphanActions.open')}
          </ActionButton>
        ),
      });
    }
    return values;
  }, [canManage, openView, t]);

  return (
    <Stack component="section" gap={2} aria-labelledby="orphaned-title">
      <Box>
        <Typography id="orphaned-title" component="h2" variant="h6">
          {t('savedViewCustody.orphaned.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('savedViewCustody.orphaned.description')}
        </Typography>
      </Box>
      {conflictViewName && (
        <Alert
          ref={conflictNoticeRef}
          tabIndex={-1}
          severity="warning"
          aria-live="assertive"
          sx={{ '&:focus-visible': { outline: '3px solid', outlineColor: 'warning.main' } }}
        >
          {t('savedViewCustody.orphanActions.conflict', { name: conflictViewName })}
        </Alert>
      )}
      {loading ? (
        <ManagementPanelLoading label={t('savedViewCustody.orphaned.loading')} />
      ) : error ? (
        <SectionLoadError
          message={t('savedViewCustody.errors.orphaned')}
          retryLabel={t('savedViewCustody.actions.retry')}
          onRetry={onRetry}
        />
      ) : data.length ? (
        <>
          <FormField
            label={t('savedViewCustody.orphaned.search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            sx={{ maxWidth: 420 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={17} aria-hidden="true" />
                  </InputAdornment>
                ),
              },
            }}
          />
          {filtered.length ? (
            mobile ? (
              <Stack
                component="ul"
                gap={1.5}
                aria-label={t('savedViewCustody.orphaned.gridLabel')}
                sx={{ p: 0, m: 0, listStyle: 'none' }}
              >
                {filtered.map((view) => {
                  const remaining = daysUntil(view.retentionUntil);
                  return (
                    <Box
                      component="li"
                      key={view.savedViewId}
                      sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}
                    >
                      <Stack gap={1.5}>
                        <Box>
                          <Typography variant="subtitle2">{view.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {surfaceLabel(view.surfaceKey, t)} ·{' '}
                            {t('savedViewCustody.scopes.' + view.scope)}
                          </Typography>
                          {view.reassignmentBlockReason === 'SHARED_NAME_CONFLICT' ? (
                            <Typography component="p" variant="caption" color="warning.main">
                              {t('savedViewCustody.orphaned.reassignmentBlocked')}
                            </Typography>
                          ) : null}
                          {view.scope === 'TEAM' && view.ownerGroupRef ? (
                            <Typography variant="caption" color="text.secondary">
                              {t('savedViewCustody.preview.teamGroup', {
                                value: view.ownerGroupRef,
                              })}
                            </Typography>
                          ) : null}
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('savedViewCustody.columns.retentionUntil')}
                          </Typography>
                          <Typography variant="body2" fontWeight={650}>
                            {displayDate(view.retentionUntil)}
                          </Typography>
                          <Typography
                            variant="caption"
                            color={remaining <= 7 ? 'error.main' : 'text.secondary'}
                          >
                            {remaining <= 0
                              ? t('savedViewCustody.orphaned.dueNow')
                              : t('savedViewCustody.orphaned.daysRemaining', {
                                  count: remaining,
                                })}
                          </Typography>
                        </Box>
                        {canManage ? (
                          <ActionButton intent="secondary" onClick={() => openView(view)}>
                            {t('savedViewCustody.orphanActions.open')}
                          </ActionButton>
                        ) : null}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            ) : (
              <EnterpriseDataGrid
                ariaLabel={t('savedViewCustody.orphaned.gridLabel')}
                rows={filtered}
                columns={columns}
                getRowId={(row) => row.savedViewId}
                minVisibleRows={5}
                maxVisibleRows={10}
                sx={{ border: 0, borderRadius: 0 }}
              />
            )
          ) : (
            <GuidedEmptyState
              kind="no-results"
              title={t('savedViewCustody.orphaned.noResultsTitle')}
              description={t('savedViewCustody.orphaned.noResultsDescription')}
              size="standard"
            />
          )}
        </>
      ) : (
        <GuidedEmptyState
          kind="empty"
          title={t('savedViewCustody.orphaned.emptyTitle')}
          description={t('savedViewCustody.orphaned.emptyDescription')}
          size="standard"
        />
      )}
      <SavedViewOrphanActionDialog
        view={selectedView}
        onClose={() => setSelectedView(null)}
        onCompleted={async () => {
          setSelectedView(null);
          setConflictViewName(null);
          await onChanged();
        }}
        onConflict={async (viewName) => {
          setSelectedView(null);
          await onChanged();
          setConflictViewName(viewName);
        }}
      />
    </Stack>
  );
}

export function SavedViewOwnershipHistory({
  data,
  loading,
  error,
  knownUsers,
  onRetry,
}: {
  data: SavedViewOwnershipTransferSummary[];
  loading: boolean;
  error: boolean;
  knownUsers: Map<number, SavedViewCustodyUser>;
  onRetry: () => void;
}) {
  const { t } = useTranslation('admin');
  const mobile = useMediaQuery<Theme>((theme) => theme.breakpoints.down('sm'));
  const [query, setQuery] = useState('');
  const ownerLabel = useCallback(
    (userId: number | null | undefined, displayName?: string | null) => {
      if (displayName?.trim()) return displayName.trim();
      if (!userId) return '-';
      const user = knownUsers.get(userId);
      return user ? userIdentityLabel(user) : t('savedViewCustody.userFallback', { id: userId });
    },
    [knownUsers, t]
  );
  const filtered = filterOwnershipHistory(data, query, ownerLabel);
  const columns = useMemo<GridColDef<SavedViewOwnershipTransferSummary>[]>(
    () => [
      {
        field: 'sourceOwnerUserId',
        headerName: t('savedViewCustody.columns.sourceOwner'),
        minWidth: 190,
        flex: 1,
        valueFormatter: (value, row) => ownerLabel(Number(value), row.sourceOwnerDisplayName),
      },
      {
        field: 'disposition',
        headerName: t('savedViewCustody.columns.result'),
        minWidth: 230,
        flex: 1.1,
        renderCell: ({ row }) => (
          <Stack justifyContent="center" sx={{ height: '100%' }}>
            <Typography variant="body2" fontWeight={600}>
              {dispositionLabel(row.disposition, t)}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {row.disposition === 'TRANSFER'
                ? ownerLabel(row.targetOwnerUserId, row.targetOwnerDisplayName)
                : t('savedViewCustody.history.archiveOn', {
                    value: displayDate(row.retentionUntil),
                  })}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'transferredCount',
        headerName: t('savedViewCustody.columns.affected'),
        width: 100,
      },
      {
        field: 'reasonCode',
        headerName: t('savedViewCustody.columns.reasonCode'),
        minWidth: 150,
        valueFormatter: (value) => t('savedViewCustody.reasons.' + String(value)),
      },
      {
        field: 'sourceReference',
        headerName: t('savedViewCustody.columns.evidence'),
        minWidth: 230,
        flex: 1,
        renderCell: ({ row }) => (
          <Stack justifyContent="center" sx={{ height: '100%', minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap title={row.sourceReference}>
              {row.sourceReference}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap title={row.reason}>
              {row.reason}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'createdBy',
        headerName: t('savedViewCustody.columns.actor'),
        minWidth: 170,
        valueFormatter: (value) => ownerLabel(Number(value)),
      },
      {
        field: 'createdAt',
        headerName: t('savedViewCustody.columns.executedAt'),
        width: 180,
        valueFormatter: (value) => displayDate(String(value)),
      },
    ],
    [ownerLabel, t]
  );

  return (
    <Stack component="section" gap={2} aria-labelledby="history-title">
      <Box>
        <Typography id="history-title" component="h2" variant="h6">
          {t('savedViewCustody.history.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('savedViewCustody.history.description')}
        </Typography>
      </Box>
      {loading ? (
        <ManagementPanelLoading label={t('savedViewCustody.history.loading')} />
      ) : error ? (
        <SectionLoadError
          message={t('savedViewCustody.errors.history')}
          retryLabel={t('savedViewCustody.actions.retry')}
          onRetry={onRetry}
        />
      ) : data.length ? (
        <>
          <FormField
            label={t('savedViewCustody.history.search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            sx={{ maxWidth: 420 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={17} aria-hidden="true" />
                  </InputAdornment>
                ),
              },
            }}
          />
          {filtered.length ? (
            mobile ? (
              <Stack
                component="ul"
                gap={1.5}
                aria-label={t('savedViewCustody.history.gridLabel')}
                sx={{ p: 0, m: 0, listStyle: 'none' }}
              >
                {filtered.map((entry) => (
                  <Box
                    component="li"
                    key={entry.transferBatchId}
                    sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}
                  >
                    <Stack component="dl" gap={1.25} sx={{ m: 0 }}>
                      <Box>
                        <Typography component="dt" variant="caption" color="text.secondary">
                          {t('savedViewCustody.columns.sourceOwner')}
                        </Typography>
                        <Typography component="dd" variant="subtitle2" sx={{ m: 0 }}>
                          {ownerLabel(entry.sourceOwnerUserId, entry.sourceOwnerDisplayName)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography component="dt" variant="caption" color="text.secondary">
                          {t('savedViewCustody.columns.result')}
                        </Typography>
                        <Typography component="dd" variant="body2" fontWeight={650} sx={{ m: 0 }}>
                          {dispositionLabel(entry.disposition, t)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {entry.disposition === 'TRANSFER'
                            ? ownerLabel(entry.targetOwnerUserId, entry.targetOwnerDisplayName)
                            : t('savedViewCustody.history.archiveOn', {
                                value: displayDate(entry.retentionUntil),
                              })}
                        </Typography>
                      </Box>
                      <Stack direction="row" gap={2} flexWrap="wrap">
                        <Box sx={{ minWidth: 96 }}>
                          <Typography component="dt" variant="caption" color="text.secondary">
                            {t('savedViewCustody.columns.affected')}
                          </Typography>
                          <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                            {entry.transferredCount}
                          </Typography>
                        </Box>
                        <Box sx={{ minWidth: 120 }}>
                          <Typography component="dt" variant="caption" color="text.secondary">
                            {t('savedViewCustody.columns.reasonCode')}
                          </Typography>
                          <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                            {t('savedViewCustody.reasons.' + entry.reasonCode)}
                          </Typography>
                        </Box>
                      </Stack>
                      <Box>
                        <Typography component="dt" variant="caption" color="text.secondary">
                          {t('savedViewCustody.columns.evidence')}
                        </Typography>
                        <Typography
                          component="dd"
                          variant="body2"
                          fontWeight={650}
                          sx={{ m: 0, overflowWrap: 'anywhere' }}
                        >
                          {entry.sourceReference}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {entry.reason}
                        </Typography>
                      </Box>
                      <Stack direction="row" gap={2} flexWrap="wrap">
                        <Box sx={{ minWidth: 120 }}>
                          <Typography component="dt" variant="caption" color="text.secondary">
                            {t('savedViewCustody.columns.actor')}
                          </Typography>
                          <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                            {ownerLabel(entry.createdBy)}
                          </Typography>
                        </Box>
                        <Box sx={{ minWidth: 150 }}>
                          <Typography component="dt" variant="caption" color="text.secondary">
                            {t('savedViewCustody.columns.executedAt')}
                          </Typography>
                          <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                            {displayDate(entry.createdAt)}
                          </Typography>
                        </Box>
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            ) : (
              <EnterpriseDataGrid
                ariaLabel={t('savedViewCustody.history.gridLabel')}
                rows={filtered}
                columns={columns}
                getRowId={(row) => row.transferBatchId}
                minVisibleRows={5}
                maxVisibleRows={10}
                sx={{ border: 0, borderRadius: 0 }}
              />
            )
          ) : (
            <GuidedEmptyState
              kind="no-results"
              title={t('savedViewCustody.history.noResultsTitle')}
              description={t('savedViewCustody.history.noResultsDescription')}
              size="standard"
            />
          )}
        </>
      ) : (
        <GuidedEmptyState
          kind="first-use"
          title={t('savedViewCustody.history.emptyTitle')}
          description={t('savedViewCustody.history.emptyDescription')}
          size="standard"
        />
      )}
    </Stack>
  );
}
