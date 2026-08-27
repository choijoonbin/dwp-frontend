import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { EnterpriseDataGrid, FormField, GuidedEmptyState } from '@dwp-frontend/design-system';
import { useDisplayDictionary } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import { ManagementPanelLoading } from '../../components/management-panel-state';
import {
  displayDate,
  SectionLoadError,
  surfaceLabel,
  userIdentityLabel,
} from './saved-view-custody-ui';

import type { OrphanLifecycleResult, SavedViewCustodyUser } from '@dwp-frontend/shared-utils';
import type { GridColDef } from '@mui/x-data-grid';
import type { Theme } from '@mui/material/styles';

export function SavedViewOrphanActionHistory({
  data,
  loading,
  error,
  knownUsers,
  onRetry,
}: {
  data: OrphanLifecycleResult[];
  loading: boolean;
  error: boolean;
  knownUsers: Map<number, SavedViewCustodyUser>;
  onRetry: () => void;
}) {
  const { t } = useTranslation('admin');
  const display = useDisplayDictionary();
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
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return data;
    return data.filter((entry) =>
      [
        entry.savedViewId,
        entry.savedViewName,
        entry.surfaceKey,
        entry.scope,
        entry.action,
        entry.targetOwnerDisplayName,
        ownerLabel(entry.targetOwnerUserId, entry.targetOwnerDisplayName),
        ownerLabel(entry.createdBy),
        entry.nextRetentionUntil,
        entry.reasonCode,
        entry.reason,
        entry.sourceReference,
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalized)
    );
  }, [data, ownerLabel, query]);
  const outcomeLabel = useCallback(
    (row: OrphanLifecycleResult) =>
      row.action === 'REASSIGN'
        ? t('savedViewCustody.actionHistory.outcomes.REASSIGN', {
            owner: ownerLabel(row.targetOwnerUserId, row.targetOwnerDisplayName),
          })
        : row.action === 'EXTEND_RETENTION'
          ? t('savedViewCustody.actionHistory.outcomes.EXTEND_RETENTION', {
              value: displayDate(row.nextRetentionUntil),
            })
          : t('savedViewCustody.actionHistory.outcomes.ARCHIVE_NOW'),
    [ownerLabel, t]
  );

  const columns = useMemo<GridColDef<OrphanLifecycleResult>[]>(
    () => [
      {
        field: 'savedViewId',
        headerName: t('savedViewCustody.columns.view'),
        minWidth: 230,
        flex: 1,
        renderCell: ({ row }) => (
          <Stack justifyContent="center" sx={{ height: '100%', minWidth: 0 }}>
            <Typography variant="body2" fontWeight={650} noWrap title={row.savedViewName}>
              {row.savedViewName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap title={row.savedViewId}>
              {surfaceLabel(row.surfaceKey, t)} · {t('savedViewCustody.scopes.' + row.scope)}
            </Typography>
          </Stack>
        ),
      },
      {
        field: 'action',
        headerName: t('savedViewCustody.columns.result'),
        minWidth: 260,
        flex: 1.15,
        renderCell: ({ row }) => (
          <Stack justifyContent="center" sx={{ height: '100%', minWidth: 0 }}>
            <Typography variant="body2" fontWeight={650}>
              {display('auditActions', row.action)}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {outcomeLabel(row)}
            </Typography>
          </Stack>
        ),
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
        minWidth: 250,
        flex: 1.15,
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
    [display, outcomeLabel, ownerLabel, t]
  );

  return (
    <Stack component="section" gap={2} aria-labelledby="orphan-action-history-title">
      <Box>
        <Typography id="orphan-action-history-title" component="h2" variant="h6">
          {t('savedViewCustody.actionHistory.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('savedViewCustody.actionHistory.description')}
        </Typography>
      </Box>
      {loading ? (
        <ManagementPanelLoading label={t('savedViewCustody.actionHistory.loading')} />
      ) : error ? (
        <SectionLoadError
          message={t('savedViewCustody.errors.actionHistory')}
          retryLabel={t('savedViewCustody.actions.retry')}
          onRetry={onRetry}
        />
      ) : data.length ? (
        <>
          <FormField
            label={t('savedViewCustody.actionHistory.search')}
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
              <Stack component="ul" gap={1.5} sx={{ p: 0, m: 0, listStyle: 'none' }}>
                {filtered.map((entry) => (
                  <Box
                    component="li"
                    key={entry.commandId}
                    sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}
                  >
                    <Stack gap={1.5}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                          {entry.savedViewName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {surfaceLabel(entry.surfaceKey, t)} ·{' '}
                          {t('savedViewCustody.scopes.' + entry.scope)}
                        </Typography>
                        <Typography
                          component="p"
                          variant="caption"
                          color="text.secondary"
                          sx={{ overflowWrap: 'anywhere' }}
                        >
                          {t('savedViewCustody.actionHistory.immutableId')}: {entry.savedViewId}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          {display('auditActions', entry.action)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {outcomeLabel(entry)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {t('savedViewCustody.columns.evidence')}
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={650}
                          sx={{ overflowWrap: 'anywhere' }}
                        >
                          {entry.sourceReference}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ whiteSpace: 'pre-wrap' }}
                        >
                          {entry.reason}
                        </Typography>
                      </Box>
                      <Stack gap={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          {t('savedViewCustody.columns.actor')}: {ownerLabel(entry.createdBy)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('savedViewCustody.columns.executedAt')}: {displayDate(entry.createdAt)}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            ) : (
              <EnterpriseDataGrid
                ariaLabel={t('savedViewCustody.actionHistory.gridLabel')}
                rows={filtered}
                columns={columns}
                getRowId={(row) => row.commandId}
                minVisibleRows={4}
                maxVisibleRows={10}
                sx={{ border: 0, borderRadius: 0 }}
              />
            )
          ) : (
            <GuidedEmptyState
              kind="no-results"
              title={t('savedViewCustody.actionHistory.noResultsTitle')}
              description={t('savedViewCustody.actionHistory.noResultsDescription')}
              size="standard"
            />
          )}
        </>
      ) : (
        <GuidedEmptyState
          kind="first-use"
          title={t('savedViewCustody.actionHistory.emptyTitle')}
          description={t('savedViewCustody.actionHistory.emptyDescription')}
          size="standard"
        />
      )}
    </Stack>
  );
}
