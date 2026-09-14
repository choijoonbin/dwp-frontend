import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Armchair, CalendarRange, Plus, XCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelWorkplaceReleaseWindow,
  createWorkplaceReleaseWindow,
  createWorkplaceIdempotencyKey,
  getWorkplaceAssignedResources,
  getWorkplaceReleaseWindows,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ConfirmDialog,
  DateTimePickerField,
  DwpDateTimeProvider,
  EmptyState,
  FormDialog,
  FormField,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import { InlineFeedback } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useRoomsCapabilities } from './rooms-capabilities';
import { retryRecoverableWorkplaceRead } from './workplace-authority-failure';
import { workplaceHomeSourceData, workplaceHomeSourceState } from './workplace-home-source-state';
import { workplaceMemberCard } from './workplace-member-surfaces';

import type { WorkplaceAssignedResource, WorkplaceReleaseWindow } from '@dwp-frontend/shared-utils';

function defaultPeriod() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setMinutes(0, 0, 0);
  start.setHours(Math.max(9, start.getHours()));
  const end = new Date(start);
  end.setHours(start.getHours() + 8);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

function queryPeriod() {
  const from = new Date();
  from.setDate(from.getDate() - 1);
  const to = new Date();
  to.setFullYear(to.getFullYear() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function WorkplaceReleaseWindows() {
  const { t, i18n } = useTranslation('rooms');
  const toast = useToast();
  const queryClient = useQueryClient();
  const capabilities = useRoomsCapabilities();
  const auth = useAuth();
  const identityKey = `${auth.user?.tenantId ?? 'anonymous'}:${auth.user?.userId ?? 'anonymous'}`;
  const identityRef = useRef(identityKey);
  identityRef.current = identityKey;
  const range = useMemo(queryPeriod, []);
  const resourcesQuery = useQuery({
    queryKey: ['workplace', 'release-windows', identityKey, 'eligible-resources'],
    queryFn: getWorkplaceAssignedResources,
    staleTime: 60_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const windowsQuery = useQuery({
    queryKey: ['workplace', 'release-windows', identityKey, range.from, range.to],
    queryFn: () => getWorkplaceReleaseWindows(range.from, range.to),
    staleTime: 20_000,
    retry: retryRecoverableWorkplaceRead,
  });
  const resourcesState = workplaceHomeSourceState({
    data: resourcesQuery.data,
    error: resourcesQuery.error,
    failureCount: resourcesQuery.failureCount,
    failureReason: resourcesQuery.failureReason,
    isError: resourcesQuery.isError,
    isPending: resourcesQuery.isPending,
    required: true,
  });
  const windowsState = workplaceHomeSourceState({
    data: windowsQuery.data,
    error: windowsQuery.error,
    failureCount: windowsQuery.failureCount,
    failureReason: windowsQuery.failureReason,
    isError: windowsQuery.isError,
    isPending: windowsQuery.isPending,
    required: true,
  });
  const resources = workplaceHomeSourceData(resourcesState, resourcesQuery.data) ?? [];
  const windows = [...(workplaceHomeSourceData(windowsState, windowsQuery.data) ?? [])].sort(
    (left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt)
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogIdentity, setDialogIdentity] = useState(identityKey);
  const [reconcileIdentity, setReconcileIdentity] = useState<string | null>(null);
  const [resourceId, setResourceId] = useState('');
  const [startsAt, setStartsAt] = useState(defaultPeriod().startsAt);
  const [endsAt, setEndsAt] = useState(defaultPeriod().endsAt);
  const [note, setNote] = useState('');
  const [cancelling, setCancelling] = useState<{
    identityKey: string;
    window: WorkplaceReleaseWindow;
  } | null>(null);
  const activeCancelling = cancelling?.identityKey === identityKey ? cancelling.window : null;
  const requiresReconcile = reconcileIdentity === identityKey;
  const commandRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const selectedResource =
    resources.find((resource) => resource.resourceId === resourceId) ?? resources[0] ?? null;
  const valid = Boolean(
    selectedResource &&
    Date.parse(endsAt) > Date.parse(startsAt) &&
    Date.parse(startsAt) > Date.now()
  );
  const format = (value: string) =>
    formatDate(
      value,
      { dateStyle: 'medium', timeStyle: 'short' },
      resolveSupportedLocale(i18n.resolvedLanguage)
    );

  const createMutation = useMutation({
    mutationFn: (submittedIdentity: string) => {
      if (
        submittedIdentity !== identityRef.current ||
        resourcesState !== 'READY' ||
        requiresReconcile ||
        !selectedResource ||
        !capabilities.canCreateWorkplaceBooking
      ) {
        throw new Error(t('workplace.my.releaseWindows.readOnly', {}));
      }
      const input = {
        resourceId: selectedResource.resourceId,
        startsAt,
        endsAt,
        note: note.trim(),
      };
      const fingerprint = JSON.stringify(input);
      const command =
        commandRef.current?.fingerprint === fingerprint
          ? commandRef.current
          : {
              fingerprint,
              key: createWorkplaceIdempotencyKey('release-window'),
            };
      commandRef.current = command;
      return createWorkplaceReleaseWindow(input, command.key);
    },
    onSuccess: async (_, submittedIdentity) => {
      if (submittedIdentity !== identityRef.current) return;
      commandRef.current = null;
      setDialogOpen(false);
      setNote('');
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
      if (submittedIdentity !== identityRef.current) return;
      toast.success(t('workplace.my.releaseWindows.created'));
    },
    onError: (_, submittedIdentity) => {
      if (submittedIdentity === identityRef.current) setReconcileIdentity(submittedIdentity);
    },
  });
  const cancelMutation = useMutation({
    mutationFn: ({
      identityKey: submittedIdentity,
      window,
    }: {
      identityKey: string;
      window: WorkplaceReleaseWindow;
    }) => {
      const current = windows.find(
        (candidate) =>
          candidate.releaseWindowId === window.releaseWindowId &&
          candidate.version === window.version
      );
      if (
        submittedIdentity !== identityRef.current ||
        windowsState !== 'READY' ||
        requiresReconcile ||
        !current?.canCancel ||
        !capabilities.canUpdateWorkplaceBooking
      ) {
        throw new Error(t('workplace.my.releaseWindows.readOnly', {}));
      }
      return cancelWorkplaceReleaseWindow(window.releaseWindowId, window.version);
    },
    onSuccess: async (_, variables) => {
      if (variables.identityKey !== identityRef.current) return;
      setCancelling(null);
      await queryClient.invalidateQueries({ queryKey: ['workplace'] });
      if (variables.identityKey !== identityRef.current) return;
      toast.success(t('workplace.my.releaseWindows.cancelled'));
    },
    onError: (_, variables) => {
      if (variables.identityKey === identityRef.current)
        setReconcileIdentity(variables.identityKey);
    },
  });
  const busy = createMutation.isPending || cancelMutation.isPending;
  useEffect(() => {
    setDialogOpen(false);
    setCancelling(null);
    setNote('');
    commandRef.current = null;
  }, [identityKey]);
  const recheck = async () => {
    const submittedIdentity = identityKey;
    const results = await Promise.all([resourcesQuery.refetch(), windowsQuery.refetch()]);
    if (submittedIdentity === identityRef.current && results.every((result) => !result.isError)) {
      setReconcileIdentity(null);
      createMutation.reset();
      cancelMutation.reset();
    }
  };

  if (resourcesQuery.isLoading) return <Skeleton variant="rectangular" height={176} />;
  if (resourcesQuery.isError && !resourcesQuery.data) {
    return (
      <InlineFeedback
        severity="error"
        action={
          <ActionButton intent="quiet" onClick={() => resourcesQuery.refetch()}>
            {t('actions.retry')}
          </ActionButton>
        }
      >
        {t('workplace.my.releaseWindows.resourceLoadError')}
      </InlineFeedback>
    );
  }
  if (resources.length === 0) return null;

  const openDialog = () => {
    const period = defaultPeriod();
    setResourceId(resources[0]?.resourceId ?? '');
    setStartsAt(period.startsAt);
    setEndsAt(period.endsAt);
    setNote('');
    commandRef.current = null;
    setDialogIdentity(identityKey);
    setDialogOpen(true);
  };

  return (
    <Box sx={(theme) => ({ ...workplaceMemberCard(theme), mt: 2.5 })}>
      {requiresReconcile ? (
        <InlineFeedback
          severity="warning"
          action={
            <ActionButton intent="secondary" onClick={() => void recheck()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('workplace.experience.changeUnknown')}
        </InlineFeedback>
      ) : null}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ p: { xs: 1.5, md: 2 }, borderBottom: 1, borderColor: 'divider' }}
      >
        <Stack direction="row" gap={1} alignItems="center">
          <Box
            sx={{
              width: 34,
              height: 34,
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'var(--dwp-product-soft)',
              color: 'var(--dwp-product-accent)',
            }}
          >
            <Armchair size={18} />
          </Box>
          <Box>
            <Typography component="h2" fontWeight="fontWeightBold">
              {t('workplace.my.releaseWindows.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('workplace.my.releaseWindows.description')}
            </Typography>
          </Box>
        </Stack>
        {capabilities.canCreateWorkplaceBooking && (
          <ActionButton
            intent="primary"
            startIcon={<Plus size={16} />}
            disabled={resourcesState !== 'READY' || busy || requiresReconcile}
            onClick={openDialog}
          >
            {t('workplace.my.releaseWindows.add')}
          </ActionButton>
        )}
      </Stack>

      {resourcesQuery.isError && resourcesQuery.data && (
        <InlineFeedback
          severity="warning"
          action={
            <ActionButton intent="quiet" onClick={() => resourcesQuery.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('workplace.staleWarning')}
        </InlineFeedback>
      )}

      {windowsQuery.isLoading && (
        <Stack spacing={1} p={2}>
          <Skeleton height={72} />
          <Skeleton height={72} />
        </Stack>
      )}
      {windowsQuery.isError && (
        <InlineFeedback
          severity={windowsQuery.data ? 'warning' : 'error'}
          action={
            <ActionButton intent="quiet" onClick={() => windowsQuery.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t(
            windowsQuery.data ? 'workplace.staleWarning' : 'workplace.my.releaseWindows.loadError'
          )}
        </InlineFeedback>
      )}
      {!windowsQuery.isLoading &&
        (!windowsQuery.isError || windowsQuery.data) &&
        windows.length === 0 && (
          <EmptyState
            icon={<CalendarRange size={26} />}
            title={t('workplace.my.releaseWindows.empty')}
            description={t('workplace.my.releaseWindows.emptyDescription')}
          />
        )}
      {!windowsQuery.isLoading &&
        (!windowsQuery.isError || windowsQuery.data) &&
        windows.length > 0 && (
          <Stack divider={<Divider flexItem />}>
            {windows.map((window) => (
              <Stack
                key={window.releaseWindowId}
                direction={{ xs: 'column', md: 'row' }}
                justifyContent="space-between"
                gap={1.5}
                sx={{ p: { xs: 1.5, md: 2 } }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" gap={0.8} alignItems="center" flexWrap="wrap">
                    <Typography fontWeight="fontWeightBold">{window.resourceName}</Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t(`workplace.my.releaseWindows.status.${window.status}`)}
                    />
                  </Stack>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {format(window.startsAt)} - {format(window.endsAt)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {window.siteName} · {window.floorName}
                    {window.note ? ` · ${window.note}` : ''}
                  </Typography>
                </Box>
                {window.canCancel && capabilities.canUpdateWorkplaceBooking && (
                  <ActionButton
                    intent="danger"
                    disabled={windowsState !== 'READY' || busy || requiresReconcile}
                    startIcon={<XCircle size={16} />}
                    onClick={() => setCancelling({ identityKey, window })}
                  >
                    {t('workplace.my.releaseWindows.cancel')}
                  </ActionButton>
                )}
              </Stack>
            ))}
          </Stack>
        )}

      <FormDialog
        open={dialogOpen && dialogIdentity === identityKey && resourcesState !== 'DENIED'}
        title={t('workplace.my.releaseWindows.dialogTitle')}
        description={t('workplace.my.releaseWindows.dialogDescription')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('workplace.my.releaseWindows.publish')}
        submittingLabel={t('actions.saving')}
        busy={createMutation.isPending}
        submitDisabled={
          !valid ||
          !capabilities.canCreateWorkplaceBooking ||
          resourcesState !== 'READY' ||
          requiresReconcile
        }
        onClose={() => setDialogOpen(false)}
        onSubmit={() => createMutation.mutate(identityKey)}
        maxWidth="sm"
        mobileFullScreen
      >
        <Stack spacing={2}>
          {requiresReconcile ? (
            <InlineFeedback
              severity="warning"
              action={
                <ActionButton intent="secondary" onClick={() => void recheck()}>
                  {t('actions.retry')}
                </ActionButton>
              }
            >
              {t('workplace.experience.changeUnknown')}
            </InlineFeedback>
          ) : null}
          <SelectField
            label={t('workplace.my.releaseWindows.resource')}
            value={selectedResource?.resourceId ?? ''}
            options={resources.map((resource: WorkplaceAssignedResource) => ({
              value: resource.resourceId,
              label: `${resource.resourceName} · ${resource.siteName} · ${resource.floorName}`,
            }))}
            onValueChange={setResourceId}
          />
          <DwpDateTimeProvider
            locale={i18n.resolvedLanguage}
            timeZone={selectedResource?.timeZone ?? 'UTC'}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.5,
              }}
            >
              <DateTimePickerField
                required
                label={t('workplace.my.releaseWindows.start')}
                value={startsAt}
                onValueChange={(value) => value && setStartsAt(value)}
                supportingText={selectedResource?.timeZone}
              />
              <DateTimePickerField
                required
                label={t('workplace.my.releaseWindows.end')}
                value={endsAt}
                onValueChange={(value) => value && setEndsAt(value)}
                errorMessage={!valid ? t('workplace.my.releaseWindows.invalidRange') : undefined}
              />
            </Box>
          </DwpDateTimeProvider>
          <FormField
            label={t('workplace.my.releaseWindows.note')}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            inputProps={{ maxLength: 240 }}
          />
          <InlineFeedback severity="info">
            {t('workplace.my.releaseWindows.policyNotice')}
          </InlineFeedback>
        </Stack>
      </FormDialog>

      <ConfirmDialog
        open={Boolean(activeCancelling) && windowsState !== 'DENIED'}
        title={t('workplace.my.releaseWindows.cancelTitle')}
        description={t('workplace.my.releaseWindows.cancelDescription')}
        cancelLabel={t('actions.keep')}
        confirmLabel={t('workplace.my.releaseWindows.cancel')}
        confirmingLabel={t('actions.saving')}
        intent="danger"
        busy={cancelMutation.isPending}
        minimumActionHeight={44}
        focusCancelAfterOpen
        onClose={() => setCancelling(null)}
        onConfirm={() => {
          if (activeCancelling && windowsState === 'READY' && !requiresReconcile)
            cancelMutation.mutate({ identityKey, window: activeCancelling });
        }}
      />
    </Box>
  );
}
