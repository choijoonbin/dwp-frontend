import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArchiveRestore, ArrowRightLeft, History, LibraryBig, ShieldCheck } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  listIdentityUsers,
  listOrphanedSavedViews,
  listSavedViewOwnershipTransfers,
  previewSavedViewOwnership,
  transferSavedViewOwnership,
  usePermissions,
  useToast,
  type IdentityUserAccess,
  type OrphanedSavedView,
  type SavedViewOwnershipDisposition,
  type SavedViewOwnershipPlanRequest,
  type SavedViewOwnershipPreview,
  type SavedViewOwnershipReason,
  type SavedViewOwnershipTransferSummary,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  DateTimePickerField,
  EnterpriseDataGrid,
  FormField,
  GuidedEmptyState,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';

import type { GridColDef } from '@mui/x-data-grid';
import type { TFunction } from 'i18next';

type WorkspaceTab = 'PLAN' | 'ORPHANED' | 'HISTORY';

const DISPOSITIONS: SavedViewOwnershipDisposition[] = ['TRANSFER', 'RETAIN_ORPHANED'];
const REASONS: SavedViewOwnershipReason[] = [
  'OFFBOARDING',
  'TEAM_REORGANIZATION',
  'OWNER_CORRECTION',
];

function userLabel(user: IdentityUserAccess) {
  return user.email ? `${user.displayName} (${user.email})` : user.displayName;
}

function displayDate(value?: string | null) {
  return value ? formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }) : '-';
}

function dispositionLabel(value: SavedViewOwnershipDisposition, t: TFunction<'admin'>) {
  return t(`savedViewCustody.dispositions.${value}`);
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof LibraryBig;
}) {
  return (
    <Stack direction="row" alignItems="center" gap={1.25} sx={{ p: 2 }}>
      <Icon size={19} aria-hidden="true" />
      <Box>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography component="p" variant="h5">
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}

export function SavedViewCustodyManager() {
  const { t } = useTranslation('admin');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('ADMIN.SAVED_VIEW_CUSTODY', 'MANAGE');
  const [tab, setTab] = useState<WorkspaceTab>('PLAN');
  const [sourceOwnerUserId, setSourceOwnerUserId] = useState('');
  const [targetOwnerUserId, setTargetOwnerUserId] = useState('');
  const [disposition, setDisposition] = useState<SavedViewOwnershipDisposition>('TRANSFER');
  const [reasonCode, setReasonCode] = useState<SavedViewOwnershipReason>('OFFBOARDING');
  const [sourceReference, setSourceReference] = useState('');
  const [reason, setReason] = useState('');
  const [retentionUntil, setRetentionUntil] = useState<string | null>(null);
  const [preview, setPreview] = useState<SavedViewOwnershipPreview | null>(null);
  const [busy, setBusy] = useState(false);

  const users = useQuery({
    queryKey: ['admin', 'identity-users', 'saved-view-custody'],
    queryFn: () => listIdentityUsers(''),
  });
  const orphaned = useQuery({
    queryKey: ['admin', 'saved-view-custody', 'orphaned'],
    queryFn: listOrphanedSavedViews,
  });
  const history = useQuery({
    queryKey: ['admin', 'saved-view-custody', 'transfers'],
    queryFn: () => listSavedViewOwnershipTransfers(50),
  });

  const activeUsers = useMemo(
    () => (users.data?.content ?? []).filter((user) => user.status === 'ACTIVE'),
    [users.data?.content]
  );
  const usersById = useMemo(
    () => new Map((users.data?.content ?? []).map((user) => [user.userId, user])),
    [users.data?.content]
  );

  useEffect(() => {
    setPreview(null);
  }, [
    disposition,
    reason,
    reasonCode,
    retentionUntil,
    sourceOwnerUserId,
    sourceReference,
    targetOwnerUserId,
  ]);

  useEffect(() => {
    if (disposition === 'TRANSFER') setRetentionUntil(null);
    else setTargetOwnerUserId('');
  }, [disposition]);

  const plan = (): SavedViewOwnershipPlanRequest => ({
    sourceOwnerUserId: Number(sourceOwnerUserId),
    disposition,
    targetOwnerUserId: disposition === 'TRANSFER' ? Number(targetOwnerUserId) : null,
    reasonCode,
    reason: reason.trim(),
    sourceReference: sourceReference.trim(),
    retentionUntil: disposition === 'RETAIN_ORPHANED' ? retentionUntil : null,
  });
  const valid =
    Number(sourceOwnerUserId) > 0 &&
    (disposition === 'TRANSFER'
      ? Number(targetOwnerUserId) > 0 && targetOwnerUserId !== sourceOwnerUserId
      : Boolean(retentionUntil && new Date(retentionUntil).getTime() > Date.now())) &&
    reason.trim().length >= 10 &&
    sourceReference.trim().length >= 3;

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'saved-view-custody'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit-events'] }),
    ]);

  const candidateColumns = useMemo<GridColDef<SavedViewOwnershipPreview['views'][number]>[]>(
    () => [
      {
        field: 'name',
        headerName: t('savedViewCustody.columns.view'),
        minWidth: 200,
        flex: 1.2,
      },
      {
        field: 'surfaceKey',
        headerName: t('savedViewCustody.columns.surface'),
        minWidth: 170,
        flex: 1,
      },
      {
        field: 'scope',
        headerName: t('savedViewCustody.columns.scope'),
        width: 130,
        valueFormatter: (value) => t(`savedViewCustody.scopes.${String(value)}`),
      },
      {
        field: 'updatedAt',
        headerName: t('savedViewCustody.columns.updatedAt'),
        width: 180,
        valueFormatter: (value) => displayDate(String(value)),
      },
    ],
    [t]
  );
  const orphanColumns = useMemo<GridColDef<OrphanedSavedView>[]>(
    () => [
      { field: 'name', headerName: t('savedViewCustody.columns.view'), minWidth: 200, flex: 1.2 },
      {
        field: 'surfaceKey',
        headerName: t('savedViewCustody.columns.surface'),
        minWidth: 170,
        flex: 1,
      },
      {
        field: 'scope',
        headerName: t('savedViewCustody.columns.scope'),
        width: 130,
        valueFormatter: (value) => t(`savedViewCustody.scopes.${String(value)}`),
      },
      {
        field: 'retentionUntil',
        headerName: t('savedViewCustody.columns.retentionUntil'),
        width: 190,
        valueFormatter: (value) => displayDate(String(value)),
      },
    ],
    [t]
  );
  const historyColumns = useMemo<GridColDef<SavedViewOwnershipTransferSummary>[]>(
    () => [
      {
        field: 'sourceOwnerUserId',
        headerName: t('savedViewCustody.columns.sourceOwner'),
        minWidth: 190,
        flex: 1,
        valueFormatter: (value) =>
          usersById.get(Number(value))
            ? userLabel(usersById.get(Number(value))!)
            : t('savedViewCustody.userFallback', { id: value }),
      },
      {
        field: 'disposition',
        headerName: t('savedViewCustody.columns.disposition'),
        width: 170,
        valueFormatter: (value) =>
          dispositionLabel(String(value) as SavedViewOwnershipDisposition, t),
      },
      {
        field: 'targetOwnerUserId',
        headerName: t('savedViewCustody.columns.targetOwner'),
        minWidth: 190,
        flex: 1,
        valueFormatter: (value) =>
          value && usersById.get(Number(value))
            ? userLabel(usersById.get(Number(value))!)
            : value
              ? t('savedViewCustody.userFallback', { id: value })
              : '-',
      },
      {
        field: 'transferredCount',
        headerName: t('savedViewCustody.columns.affected'),
        width: 110,
      },
      {
        field: 'sourceReference',
        headerName: t('savedViewCustody.columns.sourceReference'),
        minWidth: 160,
        flex: 0.8,
      },
      {
        field: 'createdAt',
        headerName: t('savedViewCustody.columns.executedAt'),
        width: 180,
        valueFormatter: (value) => displayDate(String(value)),
      },
    ],
    [t, usersById]
  );

  if (users.isLoading || orphaned.isLoading || history.isLoading) {
    return <ManagementPanelLoading label={t('savedViewCustody.loading')} />;
  }
  if (users.isError || orphaned.isError || history.isError) {
    const error = users.error || orphaned.error || history.error;
    return (
      <ManagementPanelError
        message={error instanceof Error ? error.message : t('common.loadError')}
      />
    );
  }

  return (
    <Stack gap={2.5}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          borderBlock: 1,
          borderColor: 'divider',
        }}
      >
        <Metric
          label={t('savedViewCustody.metrics.activeUsers')}
          value={activeUsers.length}
          icon={ShieldCheck}
        />
        <Metric
          label={t('savedViewCustody.metrics.orphaned')}
          value={(orphaned.data ?? []).length}
          icon={ArchiveRestore}
        />
        <Metric
          label={t('savedViewCustody.metrics.recentTransfers')}
          value={(history.data ?? []).length}
          icon={History}
        />
      </Box>

      <Tabs
        value={tab}
        onChange={(_, value: WorkspaceTab) => setTab(value)}
        aria-label={t('savedViewCustody.tabs.label')}
      >
        <Tab value="PLAN" label={t('savedViewCustody.tabs.plan')} />
        <Tab
          value="ORPHANED"
          label={t('savedViewCustody.tabs.orphaned', { count: (orphaned.data ?? []).length })}
        />
        <Tab value="HISTORY" label={t('savedViewCustody.tabs.history')} />
      </Tabs>

      {tab === 'PLAN' && (
        <Stack gap={2.5}>
          {!canManage && <Alert severity="info">{t('savedViewCustody.readOnly')}</Alert>}
          <Box
            component="section"
            aria-labelledby="saved-view-plan-title"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 420px) minmax(0, 1fr)' },
              gap: 3,
            }}
          >
            <Stack gap={2}>
              <Box>
                <Typography id="saved-view-plan-title" component="h2" variant="h6">
                  {t('savedViewCustody.plan.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {t('savedViewCustody.plan.description')}
                </Typography>
              </Box>
              <SelectField
                required
                disabled={!canManage}
                label={t('savedViewCustody.fields.sourceOwner')}
                value={sourceOwnerUserId}
                placeholder={t('savedViewCustody.fields.selectUser')}
                options={(users.data?.content ?? []).map((user) => ({
                  value: String(user.userId),
                  label: userLabel(user),
                }))}
                onValueChange={(value) => setSourceOwnerUserId(String(value))}
              />
              <SelectField
                required
                disabled={!canManage}
                label={t('savedViewCustody.fields.disposition')}
                value={disposition}
                options={DISPOSITIONS.map((value) => ({
                  value,
                  label: dispositionLabel(value, t),
                }))}
                onValueChange={(value) => value && setDisposition(value)}
              />
              {disposition === 'TRANSFER' ? (
                <SelectField
                  required
                  disabled={!canManage}
                  label={t('savedViewCustody.fields.targetOwner')}
                  value={targetOwnerUserId}
                  placeholder={t('savedViewCustody.fields.selectUser')}
                  options={activeUsers
                    .filter((user) => String(user.userId) !== sourceOwnerUserId)
                    .map((user) => ({ value: String(user.userId), label: userLabel(user) }))}
                  onValueChange={(value) => setTargetOwnerUserId(String(value))}
                />
              ) : (
                <DateTimePickerField
                  required
                  disabled={!canManage}
                  label={t('savedViewCustody.fields.retentionUntil')}
                  supportingText={t('savedViewCustody.fields.retentionHelp')}
                  value={retentionUntil}
                  onValueChange={setRetentionUntil}
                />
              )}
              <SelectField
                required
                disabled={!canManage}
                label={t('savedViewCustody.fields.reasonCode')}
                value={reasonCode}
                options={REASONS.map((value) => ({
                  value,
                  label: t(`savedViewCustody.reasons.${value}`),
                }))}
                onValueChange={(value) => value && setReasonCode(value)}
              />
              <FormField
                required
                disabled={!canManage}
                label={t('savedViewCustody.fields.sourceReference')}
                supportingText={t('savedViewCustody.fields.sourceReferenceHelp')}
                value={sourceReference}
                inputProps={{ maxLength: 240 }}
                onChange={(event) => setSourceReference(event.target.value)}
              />
              <FormField
                required
                multiline
                minRows={3}
                disabled={!canManage}
                label={t('savedViewCustody.fields.reason')}
                supportingText={t('savedViewCustody.fields.reasonHelp')}
                value={reason}
                inputProps={{ maxLength: 1000 }}
                onChange={(event) => setReason(event.target.value)}
              />
              <ActionButton
                intent="secondary"
                startIcon={<LibraryBig size={16} />}
                disabled={!canManage || !valid}
                loading={busy && !preview}
                loadingLabel={t('savedViewCustody.actions.previewing')}
                onClick={async () => {
                  setBusy(true);
                  try {
                    setPreview(await previewSavedViewOwnership(plan()));
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : t('common.operationError')
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t('savedViewCustody.actions.preview')}
              </ActionButton>
            </Stack>

            <Stack gap={1.5} sx={{ minWidth: 0 }}>
              <Box>
                <Typography component="h2" variant="h6">
                  {t('savedViewCustody.preview.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {t('savedViewCustody.preview.description')}
                </Typography>
              </Box>
              {!preview ? (
                <GuidedEmptyState
                  kind="first-use"
                  title={t('savedViewCustody.preview.emptyTitle')}
                  description={t('savedViewCustody.preview.emptyDescription')}
                  size="standard"
                />
              ) : (
                <>
                  <Alert severity={preview.affectedCount ? 'warning' : 'info'}>
                    {t('savedViewCustody.preview.summary', {
                      count: preview.affectedCount,
                      disposition: dispositionLabel(preview.disposition, t),
                    })}
                  </Alert>
                  <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t('savedViewCustody.preview.evaluatedAt', {
                        value: displayDate(preview.evaluatedAt),
                      })}
                    />
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ overflowWrap: 'anywhere' }}
                    >
                      {t('savedViewCustody.preview.fingerprint', {
                        value: preview.ownershipFingerprint.slice(0, 16),
                      })}
                    </Typography>
                  </Stack>
                  <EnterpriseDataGrid
                    ariaLabel={t('savedViewCustody.preview.gridLabel')}
                    rows={preview.views}
                    columns={candidateColumns}
                    getRowId={(row) => row.savedViewId}
                    minVisibleRows={4}
                    maxVisibleRows={8}
                    sx={{ borderRadius: 0 }}
                  />
                  <Divider />
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    gap={1.5}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {t('savedViewCustody.preview.confirmHelp')}
                    </Typography>
                    <ActionButton
                      intent={disposition === 'RETAIN_ORPHANED' ? 'danger' : 'primary'}
                      startIcon={<ArrowRightLeft size={16} />}
                      disabled={!canManage || preview.affectedCount === 0}
                      loading={busy}
                      loadingLabel={t('savedViewCustody.actions.executing')}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const result = await transferSavedViewOwnership({
                            ...plan(),
                            idempotencyKey: `custody-${crypto.randomUUID()}`,
                            expectedCount: preview.affectedCount,
                            ownershipFingerprint: preview.ownershipFingerprint,
                          });
                          await refresh();
                          setPreview(null);
                          setTab('HISTORY');
                          toast.success(
                            t('savedViewCustody.toasts.completed', {
                              count: result.transferredCount,
                            })
                          );
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : t('common.operationError')
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {t('savedViewCustody.actions.execute')}
                    </ActionButton>
                  </Stack>
                </>
              )}
            </Stack>
          </Box>
        </Stack>
      )}

      {tab === 'ORPHANED' &&
        ((orphaned.data ?? []).length ? (
          <EnterpriseDataGrid
            ariaLabel={t('savedViewCustody.orphaned.gridLabel')}
            rows={orphaned.data ?? []}
            columns={orphanColumns}
            getRowId={(row) => row.savedViewId}
            minVisibleRows={5}
            maxVisibleRows={10}
            sx={{ border: 0, borderRadius: 0 }}
          />
        ) : (
          <GuidedEmptyState
            kind="empty"
            title={t('savedViewCustody.orphaned.emptyTitle')}
            description={t('savedViewCustody.orphaned.emptyDescription')}
            size="standard"
          />
        ))}

      {tab === 'HISTORY' &&
        ((history.data ?? []).length ? (
          <EnterpriseDataGrid
            ariaLabel={t('savedViewCustody.history.gridLabel')}
            rows={history.data ?? []}
            columns={historyColumns}
            getRowId={(row) => row.transferBatchId}
            minVisibleRows={5}
            maxVisibleRows={10}
            sx={{ border: 0, borderRadius: 0 }}
          />
        ) : (
          <GuidedEmptyState
            kind="first-use"
            title={t('savedViewCustody.history.emptyTitle')}
            description={t('savedViewCustody.history.emptyDescription')}
            size="standard"
          />
        ))}
    </Stack>
  );
}
