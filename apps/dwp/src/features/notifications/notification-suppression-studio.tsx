import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, CircleStop, Clock3, ShieldAlert, Siren } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createNotificationIdempotencyKey,
  createNotificationSuppression,
  getNotificationSuppressions,
  getNotificationTypeContracts,
  previewNotificationSuppression,
  revokeNotificationSuppression,
  type NotificationSuppression,
  type NotificationSuppressionChannel,
  type NotificationSuppressionCommand,
  type NotificationSuppressionPreview,
  type NotificationSuppressionScope,
} from '@dwp-frontend/shared-utils/api/notification-api';
import { usePermissions, useToast } from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  DateTimePickerField,
  EmptyState,
  ErrorState,
  FormDialog,
  FormField,
  LoadingState,
  OperationalKpiStrip,
} from '@dwp-frontend/design-system';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { notificationQueryKeys } from './integration-contract';

const CHANNELS: readonly NotificationSuppressionChannel[] = [
  'ALL',
  'IN_APP',
  'EMAIL',
  'WEB_PUSH',
  'MOBILE_PUSH',
  'TEAMS',
  'SLACK',
];

type SuppressionEditor = {
  scopeType: NotificationSuppressionScope;
  scopeKey: string;
  channel: NotificationSuppressionChannel;
  startsAt: string;
  expiresAt: string;
  criticalBypass: boolean;
  reason: string;
};

function newEditor(): SuppressionEditor {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  return {
    scopeType: 'APP',
    scopeKey: '',
    channel: 'IN_APP',
    startsAt: '',
    expiresAt: expiresAt.toISOString(),
    criticalBypass: true,
    reason: '',
  };
}

function command(editor: SuppressionEditor): NotificationSuppressionCommand {
  return {
    scopeType: editor.scopeType,
    scopeKey: editor.scopeType === 'TENANT' ? '*' : editor.scopeKey.trim(),
    channel: editor.channel,
    startsAt: editor.startsAt || null,
    expiresAt: editor.expiresAt,
    criticalBypass: editor.criticalBypass,
    reason: editor.reason.trim(),
  };
}

function stateOf(item: NotificationSuppression): 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'REVOKED' {
  if (item.revokedAt) return 'REVOKED';
  const now = Date.now();
  if (new Date(item.expiresAt).getTime() <= now) return 'EXPIRED';
  if (item.startsAt && new Date(item.startsAt).getTime() > now) return 'SCHEDULED';
  return 'ACTIVE';
}

function stateColor(state: ReturnType<typeof stateOf>): 'error' | 'warning' | 'default' {
  if (state === 'ACTIVE') return 'error';
  if (state === 'SCHEDULED') return 'warning';
  return 'default';
}

function impactTone(preview: NotificationSuppressionPreview): 'warning' | 'error' | 'info' {
  if (!preview.criticalBypass || preview.overlappingSuppressionCount > 0) return 'error';
  if (preview.scopeType === 'TENANT' || preview.channel === 'ALL') return 'warning';
  return 'info';
}

export function NotificationSuppressionStudio() {
  const { t } = useTranslation('notifications');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('ADMIN.NOTIFICATION_OPERATIONS', 'MANAGE');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<SuppressionEditor>(newEditor);
  const [preview, setPreview] = useState<NotificationSuppressionPreview | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<NotificationSuppression | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  const suppressionQuery = useQuery({
    queryKey: notificationQueryKeys.adminSuppressions(),
    queryFn: ({ signal }) => getNotificationSuppressions(signal),
    staleTime: 15_000,
    retry: 1,
  });
  const contractQuery = useQuery({
    queryKey: notificationQueryKeys.adminTypes({ state: 'ACTIVE', limit: 100 }),
    queryFn: ({ signal }) => getNotificationTypeContracts({ state: 'ACTIVE', limit: 100 }, signal),
    staleTime: 60_000,
    retry: 1,
  });
  const contracts = useMemo(() => contractQuery.data?.items ?? [], [contractQuery.data]);
  const apps = useMemo(
    () =>
      [...new Map(contracts.map((item) => [item.appKey, item.appName])).entries()].sort((a, b) =>
        a[1].localeCompare(b[1])
      ),
    [contracts]
  );

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.adminSuppressions() }),
      queryClient.invalidateQueries({ queryKey: notificationQueryKeys.adminOperations() }),
    ]);
  };
  const previewMutation = useMutation({
    mutationFn: () => previewNotificationSuppression(command(editor)),
    onSuccess: setPreview,
    onError: () => toast.error(t('admin.suppressions.feedback.previewFailed')),
  });
  const createMutation = useMutation({
    mutationFn: () =>
      createNotificationSuppression(
        command(editor),
        createNotificationIdempotencyKey('notification-suppression')
      ),
    onSuccess: async () => {
      setEditorOpen(false);
      setPreview(null);
      setEditor(newEditor());
      await refresh();
      toast.success(t('admin.suppressions.feedback.created'));
    },
    onError: () => toast.error(t('admin.suppressions.feedback.createFailed')),
  });
  const revokeMutation = useMutation({
    mutationFn: () => {
      if (!revokeTarget) throw new Error('Suppression is required.');
      return revokeNotificationSuppression(
        revokeTarget.suppressionId,
        { expectedVersion: revokeTarget.version, reason: revokeReason.trim() },
        createNotificationIdempotencyKey('notification-suppression-revoke')
      );
    },
    onSuccess: async () => {
      setRevokeTarget(null);
      setRevokeReason('');
      await refresh();
      toast.success(t('admin.suppressions.feedback.revoked'));
    },
    onError: () => toast.error(t('admin.suppressions.feedback.revokeFailed')),
  });

  if (suppressionQuery.isLoading) {
    return (
      <LoadingState
        label={t('admin.suppressions.loading')}
        variant="skeleton"
        skeletonRows={7}
        size="page"
      />
    );
  }
  if (suppressionQuery.isError || !suppressionQuery.data) {
    return (
      <ErrorState
        title={t('admin.suppressions.errorTitle')}
        description={t('admin.suppressions.errorDescription')}
        retryLabel={t('actions.retry')}
        onRetry={() => void suppressionQuery.refetch()}
        retrying={suppressionQuery.isFetching}
        size="page"
      />
    );
  }

  const items = suppressionQuery.data.items;
  const activeCount = items.filter((item) => stateOf(item) === 'ACTIVE').length;
  const scheduledCount = items.filter((item) => stateOf(item) === 'SCHEDULED').length;
  const bypassDisabledCount = items.filter(
    (item) => stateOf(item) === 'ACTIVE' && !item.criticalBypass
  ).length;
  const scopeOptions =
    editor.scopeType === 'TYPE'
      ? contracts.map((item) => [item.typeKey, `${item.appName} · ${item.displayName}`] as const)
      : apps;
  const invalidEditor =
    (editor.scopeType !== 'TENANT' && !editor.scopeKey.trim()) ||
    !editor.expiresAt ||
    editor.reason.trim().length < 10;

  return (
    <Stack gap={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        gap={1.5}
      >
        <Box>
          <Typography component="h2" variant="h6">
            {t('admin.suppressions.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {t('admin.suppressions.description')}
          </Typography>
        </Box>
        {canManage && (
          <ActionButton
            intent="primary"
            startIcon={<CircleStop size={17} />}
            onClick={() => {
              setEditor(newEditor());
              setPreview(null);
              setEditorOpen(true);
            }}
          >
            {t('admin.suppressions.create')}
          </ActionButton>
        )}
      </Stack>

      <Alert severity="warning" icon={<ShieldAlert size={19} />}>
        {t('admin.suppressions.governanceNotice')}
      </Alert>
      <OperationalKpiStrip
        ariaLabel={t('admin.suppressions.metricsLabel')}
        items={[
          {
            key: 'active',
            label: t('admin.suppressions.metrics.active'),
            value: activeCount,
            tone: activeCount ? 'warning' : 'success',
          },
          {
            key: 'scheduled',
            label: t('admin.suppressions.metrics.scheduled'),
            value: scheduledCount,
            tone: scheduledCount ? 'info' : 'neutral',
          },
          {
            key: 'critical',
            label: t('admin.suppressions.metrics.criticalBlocked'),
            value: bypassDisabledCount,
            tone: bypassDisabledCount ? 'critical' : 'success',
          },
        ]}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<Siren size={28} />}
          title={t('admin.suppressions.emptyTitle')}
          description={t('admin.suppressions.emptyDescription')}
          size="page"
        />
      ) : (
        <Box sx={{ overflowX: 'auto', borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Table
            size="small"
            aria-label={t('admin.suppressions.tableLabel')}
            sx={{ minWidth: 980 }}
          >
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.suppressions.columns.scope')}</TableCell>
                <TableCell>{t('admin.suppressions.columns.channel')}</TableCell>
                <TableCell>{t('admin.suppressions.columns.window')}</TableCell>
                <TableCell>{t('admin.suppressions.columns.critical')}</TableCell>
                <TableCell>{t('admin.suppressions.columns.reason')}</TableCell>
                <TableCell>{t('admin.suppressions.columns.state')}</TableCell>
                <TableCell align="right">{t('admin.suppressions.columns.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => {
                const state = stateOf(item);
                return (
                  <TableRow key={item.suppressionId}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>
                        {item.scopeKey}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t(`admin.suppressions.scope.${item.scopeType}`)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {item.channel === 'ALL'
                        ? t('admin.suppressions.allChannels')
                        : t(`channels.${item.channel}`)}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" display="block">
                        {formatDate(item.startsAt ?? item.createdAt, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(item.expiresAt, { dateStyle: 'medium', timeStyle: 'short' })}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={item.criticalBypass ? 'success' : 'error'}
                        label={
                          item.criticalBypass
                            ? t('admin.suppressions.criticalBypass')
                            : t('admin.suppressions.criticalBlocked')
                        }
                      />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 280 }}>
                      <Typography variant="body2" noWrap title={item.reason}>
                        {item.reason}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={stateColor(state)}
                        label={t(`admin.suppressions.state.${state}`)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {canManage && ['ACTIVE', 'SCHEDULED'].includes(state) && (
                        <ActionButton
                          intent="danger"
                          size="small"
                          onClick={() => setRevokeTarget(item)}
                        >
                          {t('admin.suppressions.revoke')}
                        </ActionButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}

      <FormDialog
        open={editorOpen}
        title={t('admin.suppressions.dialog.title')}
        description={t('admin.suppressions.dialog.description')}
        cancelLabel={t('actions.cancel')}
        submitLabel={
          preview ? t('admin.suppressions.dialog.activate') : t('admin.suppressions.dialog.preview')
        }
        submittingLabel={t('admin.suppressions.dialog.processing')}
        busy={previewMutation.isPending || createMutation.isPending}
        submitDisabled={invalidEditor || Boolean(preview?.overlappingSuppressionCount)}
        submitIntent={preview && impactTone(preview) === 'error' ? 'danger' : 'primary'}
        onClose={() => setEditorOpen(false)}
        onSubmit={() => (preview ? createMutation.mutate() : previewMutation.mutate())}
        maxWidth="md"
      >
        <Stack gap={2}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 1.5,
            }}
          >
            <FormField
              select
              label={t('admin.suppressions.fields.scopeType')}
              value={editor.scopeType}
              onChange={(event) => {
                setPreview(null);
                setEditor((current) => ({
                  ...current,
                  scopeType: event.target.value as NotificationSuppressionScope,
                  scopeKey: '',
                }));
              }}
            >
              {(['TENANT', 'APP', 'TYPE'] as const).map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`admin.suppressions.scope.${value}`)}
                </MenuItem>
              ))}
            </FormField>
            {editor.scopeType === 'TENANT' ? (
              <FormField
                label={t('admin.suppressions.fields.scopeKey')}
                value={t('admin.suppressions.tenantScope')}
                disabled
              />
            ) : (
              <FormField
                select
                label={t('admin.suppressions.fields.scopeKey')}
                value={editor.scopeKey}
                onChange={(event) => {
                  setPreview(null);
                  setEditor((current) => ({ ...current, scopeKey: event.target.value }));
                }}
              >
                {scopeOptions.map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </FormField>
            )}
            <FormField
              select
              label={t('admin.suppressions.fields.channel')}
              value={editor.channel}
              onChange={(event) => {
                setPreview(null);
                setEditor((current) => ({
                  ...current,
                  channel: event.target.value as NotificationSuppressionChannel,
                }));
              }}
            >
              {CHANNELS.map((value) => (
                <MenuItem key={value} value={value}>
                  {value === 'ALL' ? t('admin.suppressions.allChannels') : t(`channels.${value}`)}
                </MenuItem>
              ))}
            </FormField>
            <FormControlLabel
              control={
                <Switch
                  checked={editor.criticalBypass}
                  onChange={(event) => {
                    setPreview(null);
                    setEditor((current) => ({ ...current, criticalBypass: event.target.checked }));
                  }}
                />
              }
              label={t('admin.suppressions.fields.criticalBypass')}
            />
            <DateTimePickerField
              label={t('admin.suppressions.fields.startsAt')}
              value={editor.startsAt || null}
              onValueChange={(value) => {
                setPreview(null);
                setEditor((current) => ({ ...current, startsAt: value ?? '' }));
              }}
              supportingText={t('admin.suppressions.fields.startsAtHelp')}
            />
            <DateTimePickerField
              label={t('admin.suppressions.fields.expiresAt')}
              value={editor.expiresAt}
              onValueChange={(value) => {
                setPreview(null);
                setEditor((current) => ({ ...current, expiresAt: value ?? '' }));
              }}
              required
            />
          </Box>
          <FormField
            label={t('admin.suppressions.fields.reason')}
            value={editor.reason}
            onChange={(event) => {
              setPreview(null);
              setEditor((current) => ({ ...current, reason: event.target.value }));
            }}
            multiline
            minRows={3}
            required
            supportingText={t('admin.suppressions.fields.reasonHelp')}
          />
          {preview && (
            <Alert severity={impactTone(preview)} icon={<Ban size={19} />}>
              <Typography variant="subtitle2">{t('admin.suppressions.preview.title')}</Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {t('admin.suppressions.preview.summary', {
                  types: formatNumber(preview.affectedTypeCount),
                  notifications: formatNumber(preview.observedNotifications7Days),
                  critical: formatNumber(preview.criticalBypassCandidates7Days),
                })}
              </Typography>
              {preview.riskFlags.length > 0 && (
                <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
                  {preview.riskFlags.map((flag) => (
                    <Chip
                      key={flag}
                      size="small"
                      variant="outlined"
                      label={t(`admin.suppressions.risk.${flag}`)}
                    />
                  ))}
                </Stack>
              )}
              {preview.overlappingSuppressionCount > 0 && (
                <Typography variant="body2" fontWeight={700} sx={{ mt: 1 }}>
                  {t('admin.suppressions.preview.overlap', {
                    count: preview.overlappingSuppressionCount,
                  })}
                </Typography>
              )}
            </Alert>
          )}
        </Stack>
      </FormDialog>

      <FormDialog
        open={Boolean(revokeTarget)}
        title={t('admin.suppressions.revokeDialog.title')}
        description={t('admin.suppressions.revokeDialog.description')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('admin.suppressions.revoke')}
        submittingLabel={t('admin.suppressions.revokeDialog.processing')}
        busy={revokeMutation.isPending}
        submitDisabled={revokeReason.trim().length < 10}
        submitIntent="danger"
        onClose={() => setRevokeTarget(null)}
        onSubmit={() => revokeMutation.mutate()}
      >
        <Alert severity="info" icon={<Clock3 size={18} />}>
          {revokeTarget
            ? `${revokeTarget.scopeType} · ${revokeTarget.scopeKey} · ${revokeTarget.channel}`
            : ''}
        </Alert>
        <FormField
          sx={{ mt: 2 }}
          label={t('admin.suppressions.fields.revokeReason')}
          value={revokeReason}
          onChange={(event) => setRevokeReason(event.target.value)}
          multiline
          minRows={3}
          required
        />
      </FormDialog>
    </Stack>
  );
}
