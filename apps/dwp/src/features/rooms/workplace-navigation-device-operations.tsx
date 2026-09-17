import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Cpu,
  Link2,
  RefreshCw,
  Router,
  ScrollText,
  ShieldAlert,
  WifiOff,
  Zap,
} from 'lucide-react';
import {
  getWorkplaceDeviceAuditEvents,
  getWorkplaceDeviceCommands,
  getWorkplaceDeviceProviders,
  getWorkplaceDevices,
} from '@dwp-frontend/shared-utils/api/workplace-navigation-api';
import {
  ActionButton,
  EmptyState,
  InlineFeedback,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { displayTime, stateChipSx, stateColor } from './workplace-navigation-device-ui';
import {
  ApprovalWorkflow,
  BindingWorkflow,
  RemoteCommandWorkflow,
} from './workplace-navigation-device-workflows';
import {
  workplaceDeviceAttentionTone,
  workplaceNavigationCopy,
  workplaceProviderDisplayState,
} from './workplace-navigation-model';

import type { WorkplaceDevice } from '@dwp-frontend/shared-utils/api/workplace-navigation-contract';
import type { WorkplaceNavigationLocale } from './workplace-navigation-model';

export type WorkplaceDeviceOperationsProps = Readonly<{
  locale?: WorkplaceNavigationLocale;
  canManage: boolean;
  elevated: boolean;
}>;

type Workflow = 'approve' | 'bind' | 'command' | null;

function DeviceSummary({
  device,
  selected,
  onSelect,
  locale,
}: {
  device: WorkplaceDevice;
  selected: boolean;
  onSelect: () => void;
  locale: WorkplaceNavigationLocale;
}) {
  const tone = workplaceDeviceAttentionTone(device);
  return (
    <Box component="li" sx={{ listStyle: 'none' }}>
      <Box
        component="button"
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        sx={(theme) => ({
          ...workplaceMemberCard(theme),
          width: '100%',
          p: 1.5,
          textAlign: 'start',
          color: 'text.primary',
          cursor: 'pointer',
          borderColor: selected ? 'primary.main' : undefined,
          bgcolor: selected ? 'action.selected' : 'background.paper',
          '&:focus-visible': {
            outline: '3px solid',
            outlineColor: 'primary.main',
            outlineOffset: 2,
          },
        })}
      >
        <Stack direction="row" justifyContent="space-between" gap={1} alignItems="flex-start">
          <Box sx={{ minWidth: 0 }}>
            <Typography fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>
              {device.displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {device.deviceType} · {device.hardwareModel} · {device.osVersion}
            </Typography>
          </Box>
          <Chip
            size="small"
            color={tone}
            label={device.connectivity}
            icon={device.connectivity === 'OFFLINE' ? <WifiOff size={14} /> : undefined}
            sx={stateChipSx(device.connectivity)}
          />
        </Stack>
        <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
          <Chip
            size="small"
            variant="outlined"
            color={stateColor(device.registrationState)}
            label={device.registrationState}
            sx={stateChipSx(device.registrationState, false)}
          />
          <Chip
            size="small"
            variant="outlined"
            color={stateColor(device.scheduleFreshness)}
            label={`SCHEDULE ${device.scheduleFreshness}`}
            sx={stateChipSx(device.scheduleFreshness, false)}
          />
          {device.recentErrorCode && (
            <Chip
              size="small"
              color="error"
              label={device.recentErrorCode}
              sx={stateChipSx('FAILED')}
            />
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {displayTime(device.heartbeatAt, locale)}
        </Typography>
      </Box>
    </Box>
  );
}

function DeviceInspector({
  device,
  workflow,
  setWorkflow,
  canMutate,
  locale,
  onCompleted,
}: {
  device: WorkplaceDevice;
  workflow: Workflow;
  setWorkflow: (value: Workflow) => void;
  canMutate: boolean;
  locale: WorkplaceNavigationLocale;
  onCompleted: () => Promise<void>;
}) {
  const copy = workplaceNavigationCopy(locale);
  const auditQuery = useQuery({
    queryKey: ['workplace', 'device-audit', device.deviceId],
    queryFn: () => getWorkplaceDeviceAuditEvents(device.deviceId),
    retry: false,
  });
  const commandsQuery = useQuery({
    queryKey: ['workplace', 'device-commands', device.deviceId],
    queryFn: () => getWorkplaceDeviceCommands(device.deviceId),
    retry: false,
  });
  return (
    <Box
      component="aside"
      aria-labelledby="device-inspector-heading"
      sx={(theme) => ({ ...workplaceMemberCard(theme), p: { xs: 1.5, sm: 2 } })}
    >
      <Stack direction="row" justifyContent="space-between" gap={1}>
        <Box>
          <Typography id="device-inspector-heading" component="h2" variant="h6" fontWeight={800}>
            {copy.deviceDetail}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {device.deviceId}
          </Typography>
        </Box>
        <Chip
          color={workplaceDeviceAttentionTone(device)}
          label={device.registrationState}
          sx={stateChipSx(device.registrationState)}
        />
      </Stack>
      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' },
          gap: 1.25,
          my: 2,
        }}
      >
        {[
          [copy.connectivity, device.connectivity],
          [copy.heartbeat, displayTime(device.heartbeatAt, locale)],
          [copy.scheduleFreshness, device.scheduleFreshness],
          [copy.versions, `${device.appVersion ?? '—'} / ${device.policyVersion ?? '—'}`],
          [copy.recentError, device.recentErrorCode ?? '—'],
          [
            locale === 'ko' ? '바인딩' : 'Binding',
            [device.siteId, device.floorId, device.resourceId].filter(Boolean).join(' · ') || '—',
          ],
        ].map(([label, value]) => (
          <Box key={label}>
            <Typography component="dt" variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
      <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: 2 }}>
        {device.registrationState === 'PENDING' && (
          <ActionButton
            intent={workflow === 'approve' ? 'primary' : 'secondary'}
            onClick={() => setWorkflow(workflow === 'approve' ? null : 'approve')}
          >
            {copy.approve}
          </ActionButton>
        )}
        {['APPROVED', 'BOUND'].includes(device.registrationState) && (
          <ActionButton
            intent={workflow === 'bind' ? 'primary' : 'secondary'}
            startIcon={<Link2 size={15} />}
            onClick={() => setWorkflow(workflow === 'bind' ? null : 'bind')}
          >
            {copy.bind}
          </ActionButton>
        )}
        {device.registrationState === 'BOUND' && (
          <ActionButton
            intent={workflow === 'command' ? 'primary' : 'secondary'}
            startIcon={<Zap size={15} />}
            onClick={() => setWorkflow(workflow === 'command' ? null : 'command')}
          >
            {copy.command}
          </ActionButton>
        )}
      </Stack>
      {workflow && (
        <Box sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5, mb: 2 })}>
          {workflow === 'approve' ? (
            <ApprovalWorkflow
              device={device}
              canMutate={canMutate}
              locale={locale}
              onCompleted={onCompleted}
            />
          ) : workflow === 'bind' ? (
            <BindingWorkflow
              device={device}
              canMutate={canMutate}
              locale={locale}
              onCompleted={onCompleted}
            />
          ) : (
            <RemoteCommandWorkflow
              device={device}
              canMutate={canMutate}
              locale={locale}
              onCompleted={onCompleted}
            />
          )}
        </Box>
      )}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
        <Box>
          <Typography fontWeight={800} sx={{ mb: 1 }}>
            <Activity size={16} aria-hidden="true" /> {copy.commandReceipt}
          </Typography>
          {commandsQuery.isLoading ? (
            <LoadingState embedded label={copy.loading} />
          ) : commandsQuery.isError ? (
            <InlineFeedback severity="error">
              {locale === 'ko'
                ? '명령 이력을 불러오지 못했습니다.'
                : 'Command history unavailable.'}
            </InlineFeedback>
          ) : commandsQuery.data?.length ? (
            <Stack spacing={0.75}>
              {commandsQuery.data.slice(0, 5).map((command) => (
                <Stack
                  key={command.commandId}
                  direction="row"
                  justifyContent="space-between"
                  gap={1}
                >
                  <Typography variant="body2">{command.commandType}</Typography>
                  <Chip
                    size="small"
                    color={stateColor(command.state)}
                    label={command.state}
                    sx={stateChipSx(command.state)}
                  />
                </Stack>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              —
            </Typography>
          )}
        </Box>
        <Box>
          <Typography fontWeight={800} sx={{ mb: 1 }}>
            <ScrollText size={16} aria-hidden="true" /> {copy.audit}
          </Typography>
          {auditQuery.isLoading ? (
            <LoadingState embedded label={copy.loading} />
          ) : auditQuery.isError ? (
            <InlineFeedback severity="error">
              {locale === 'ko' ? '감사 기록을 불러오지 못했습니다.' : 'Audit events unavailable.'}
            </InlineFeedback>
          ) : auditQuery.data?.length ? (
            <Stack spacing={0.75}>
              {auditQuery.data.slice(0, 5).map((event) => (
                <Box key={event.auditEventId}>
                  <Typography variant="body2" fontWeight={700}>
                    {event.action}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {displayTime(event.occurredAt, locale)} · {event.correlationId ?? '—'}
                  </Typography>
                </Box>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              —
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export function WorkplaceDeviceOperations({
  locale = 'ko',
  canManage,
  elevated,
}: WorkplaceDeviceOperationsProps) {
  const { t } = useTranslation('rooms');
  const copy = workplaceNavigationCopy(locale);
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<Workflow>(null);
  const devicesQuery = useQuery({
    queryKey: ['workplace', 'devices'],
    queryFn: () => getWorkplaceDevices(),
    retry: false,
    refetchInterval: 30_000,
  });
  const providersQuery = useQuery({
    queryKey: ['workplace', 'device-providers'],
    queryFn: getWorkplaceDeviceProviders,
    retry: false,
    refetchInterval: 30_000,
  });
  const devices = useMemo(() => devicesQuery.data ?? [], [devicesQuery.data]);
  useEffect(() => {
    if (!selectedId && devices[0]) setSelectedId(devices[0].deviceId);
    else if (selectedId && !devices.some((device) => device.deviceId === selectedId))
      setSelectedId(devices[0]?.deviceId ?? null);
  }, [devices, selectedId]);
  useEffect(() => setWorkflow(null), [selectedId]);
  const selected = devices.find((device) => device.deviceId === selectedId) ?? null;
  const canMutate = canManage && elevated;
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['workplace', 'devices'] }),
      queryClient.invalidateQueries({ queryKey: ['workplace', 'device-providers'] }),
      selectedId
        ? queryClient.invalidateQueries({ queryKey: ['workplace', 'device-commands', selectedId] })
        : Promise.resolve(),
      selectedId
        ? queryClient.invalidateQueries({ queryKey: ['workplace', 'device-audit', selectedId] })
        : Promise.resolve(),
    ]);
  };
  return (
    <PageCanvas topInset="compact" data-testid="workplace-device-operations">
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        gap={2}
        sx={{ mb: 2.5 }}
      >
        <Box>
          <Typography variant="overline" color="primary.main">
            {t('screen19.devices.eyebrow')}
          </Typography>
          <Typography component="h1" variant="h4" fontWeight={800}>
            {copy.devicesTitle}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>
            {copy.devicesDescription}
          </Typography>
        </Box>
        <ActionButton
          intent="secondary"
          startIcon={<RefreshCw size={16} />}
          loading={devicesQuery.isFetching || providersQuery.isFetching}
          onClick={() => void refresh()}
        >
          {copy.refresh}
        </ActionButton>
      </Stack>
      {!canManage && (
        <InlineFeedback severity="info" sx={{ mb: 1.5 }}>
          {locale === 'ko' ? '읽기 전용 권한입니다.' : 'You have read-only access.'}
        </InlineFeedback>
      )}
      {canManage && !elevated && (
        <InlineFeedback severity="warning" icon={<ShieldAlert size={17} />} sx={{ mb: 1.5 }}>
          {locale === 'ko'
            ? '장치 변경과 원격 명령에는 최신 Step-up 인증이 필요합니다.'
            : 'Fresh step-up access is required for device changes and remote commands.'}
        </InlineFeedback>
      )}
      <Box
        component="section"
        aria-labelledby="provider-heading"
        sx={(theme) => ({ ...workplaceMemberCard(theme), p: 1.5, mb: 2 })}
      >
        <Typography
          id="provider-heading"
          component="h2"
          variant="h6"
          fontWeight={800}
          sx={{ mb: 1 }}
        >
          {copy.providers}
        </Typography>
        {providersQuery.isLoading ? (
          <LoadingState embedded label={copy.loading} />
        ) : providersQuery.isError ? (
          <InlineFeedback severity="error">
            {locale === 'ko'
              ? 'Provider 상태를 확인할 수 없습니다. 정상으로 간주하지 않습니다.'
              : 'Provider status is unavailable and is not treated as healthy.'}
          </InlineFeedback>
        ) : (
          <Stack direction="row" gap={0.75} flexWrap="wrap">
            {providersQuery.data?.map((provider) => {
              const state = workplaceProviderDisplayState(provider);
              return (
                <Chip
                  key={provider.capability}
                  icon={<Router size={14} />}
                  color={stateColor(state)}
                  variant="outlined"
                  label={`${provider.capability} · ${state}`}
                  sx={stateChipSx(state, false)}
                />
              );
            })}
          </Stack>
        )}
      </Box>
      {devicesQuery.isLoading ? (
        <LoadingState label={copy.loading} />
      ) : devicesQuery.isError ? (
        <InlineFeedback
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={() => void devicesQuery.refetch()}>
              {copy.retry}
            </ActionButton>
          }
        >
          {locale === 'ko'
            ? '장치 Registry를 불러오지 못했습니다.'
            : 'The device registry is unavailable.'}
        </InlineFeedback>
      ) : devices.length === 0 ? (
        <EmptyState
          icon={<Cpu />}
          title={copy.devicesTitle}
          description={
            locale === 'ko'
              ? '등록된 장치가 없습니다. 장치는 device plane에서 먼저 등록해야 합니다.'
              : 'No devices are registered. A device must register through the device plane first.'
          }
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(260px, 0.8fr) minmax(0, 2.2fr)' },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <Box
            component="ul"
            aria-label={copy.devicesTitle}
            sx={{ display: 'grid', gap: 1, p: 0, m: 0 }}
          >
            {devices.map((device) => (
              <DeviceSummary
                key={device.deviceId}
                device={device}
                selected={device.deviceId === selectedId}
                onSelect={() => setSelectedId(device.deviceId)}
                locale={locale}
              />
            ))}
          </Box>
          {selected && (
            <DeviceInspector
              device={selected}
              workflow={workflow}
              setWorkflow={setWorkflow}
              canMutate={canMutate}
              locale={locale}
              onCompleted={refresh}
            />
          )}
        </Box>
      )}
    </PageCanvas>
  );
}
