import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link2, RefreshCw, ShieldAlert, Zap } from 'lucide-react';
import { resolveIdempotentMutationIntent } from '@dwp-frontend/shared-utils';
import {
  approveWorkplaceDevice,
  bindWorkplaceDevice,
  executeWorkplaceDeviceCommand,
  getWorkplaceDeviceCommandReceipt,
  previewWorkplaceDeviceCommand,
} from '@dwp-frontend/shared-utils/api/workplace-navigation-api';
import { ActionButton, FormField, InlineFeedback } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberSoftSurface } from './workplace-member-surfaces';
import {
  workplaceDeviceCommandMaySubmit,
  workplaceDeviceCommandNeedsGetRecovery,
  workplaceNavigationCopy,
} from './workplace-navigation-model';
import {
  commandIdentity,
  displayTime,
  stateChipSx,
  stateColor,
} from './workplace-navigation-device-ui';

import type { IdempotentMutationIntent } from '@dwp-frontend/shared-utils';
import type { WorkplaceDeviceCommandPreviewInput } from '@dwp-frontend/shared-utils/api/workplace-navigation-api';
import type {
  WorkplaceDevice,
  WorkplaceDeviceCommandPreview,
  WorkplaceDeviceCommandReceipt,
  WorkplaceDeviceCommandType,
} from '@dwp-frontend/shared-utils/api/workplace-navigation-contract';
import type { WorkplaceNavigationLocale } from './workplace-navigation-model';

type WorkplaceDevicePreviewIntent = IdempotentMutationIntent & Readonly<{ correlationId: string }>;

export function ApprovalWorkflow({
  device,
  canMutate,
  locale,
  onCompleted,
}: {
  device: WorkplaceDevice;
  canMutate: boolean;
  locale: WorkplaceNavigationLocale;
  onCompleted: () => Promise<void>;
}) {
  const copy = workplaceNavigationCopy(locale);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [commandKeys] = useState(() => ({
    idempotencyKey: commandIdentity(device.deviceId, 'approve'),
    correlationId: commandIdentity(device.deviceId, 'correlation'),
  }));
  const mutation = useMutation({
    mutationFn: () =>
      approveWorkplaceDevice(
        device.deviceId,
        { expectedVersion: device.version, reason: reason.trim(), explicitConfirmation: true },
        {
          ...commandKeys,
          activeAccessMode: 'ELEVATED',
        }
      ),
    onSuccess: onCompleted,
  });
  return (
    <Stack spacing={1.5} data-testid="device-approval-workflow">
      <InlineFeedback severity="info">
        {locale === 'ko'
          ? '장치 Identity와 하드웨어 정보를 검토한 뒤 등록을 승인하세요.'
          : 'Review device identity and hardware before approving registration.'}
      </InlineFeedback>
      <FormField
        label={copy.reason}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        inputProps={{ maxLength: 500 }}
        required
      />
      <FormControlLabel
        control={
          <Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        }
        label={copy.explicitConfirm}
      />
      {mutation.isError && (
        <InlineFeedback severity="error">
          {locale === 'ko'
            ? '승인하지 못했습니다. 최신 장치 버전을 확인하세요.'
            : 'Approval failed. Refresh the device version.'}
        </InlineFeedback>
      )}
      <ActionButton
        intent="primary"
        loading={mutation.isPending}
        disabled={
          !canMutate || !reason.trim() || !confirmed || device.registrationState !== 'PENDING'
        }
        onClick={() => mutation.mutate()}
      >
        {copy.approve}
      </ActionButton>
    </Stack>
  );
}

export function BindingWorkflow({
  device,
  canMutate,
  locale,
  onCompleted,
}: {
  device: WorkplaceDevice;
  canMutate: boolean;
  locale: WorkplaceNavigationLocale;
  onCompleted: () => Promise<void>;
}) {
  const copy = workplaceNavigationCopy(locale);
  const [siteId, setSiteId] = useState(device.siteId ?? '');
  const [floorId, setFloorId] = useState(device.floorId ?? '');
  const [resourceId, setResourceId] = useState(device.resourceId ?? '');
  const [offlineFallback, setOfflineFallback] = useState(device.safetyOfflineFallback);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [commandKeys] = useState(() => ({
    idempotencyKey: commandIdentity(device.deviceId, 'bind'),
    correlationId: commandIdentity(device.deviceId, 'correlation'),
  }));
  const mutation = useMutation({
    mutationFn: () =>
      bindWorkplaceDevice(
        device.deviceId,
        {
          expectedVersion: device.version,
          siteId: siteId.trim(),
          floorId: floorId.trim(),
          resourceId: resourceId.trim() || null,
          safetyOfflineFallback: offlineFallback,
          reason: reason.trim(),
          explicitConfirmation: true,
        },
        {
          ...commandKeys,
          activeAccessMode: 'ELEVATED',
        }
      ),
    onSuccess: onCompleted,
  });
  const valid = Boolean(
    siteId.trim() && floorId.trim() && (device.deviceType === 'STATUS_BOARD' || resourceId.trim())
  );
  return (
    <Stack spacing={1.25} data-testid="device-binding-workflow">
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}>
        <FormField
          label={copy.bindingSite}
          value={siteId}
          onChange={(event) => setSiteId(event.target.value)}
          required
        />
        <FormField
          label={copy.bindingFloor}
          value={floorId}
          onChange={(event) => setFloorId(event.target.value)}
          required
        />
        <FormField
          label={copy.bindingResource}
          value={resourceId}
          onChange={(event) => setResourceId(event.target.value)}
          required={device.deviceType === 'ROOM_PANEL'}
        />
      </Box>
      <FormControlLabel
        control={
          <Checkbox
            checked={offlineFallback}
            onChange={(event) => setOfflineFallback(event.target.checked)}
          />
        }
        label={copy.safetyOffline}
      />
      <FormField
        label={copy.reason}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        inputProps={{ maxLength: 500 }}
        required
      />
      <FormControlLabel
        control={
          <Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        }
        label={copy.explicitConfirm}
      />
      {mutation.isError && (
        <InlineFeedback severity="error">
          {locale === 'ko'
            ? '바인딩하지 못했습니다. Site·Floor·Resource와 최신 버전을 확인하세요.'
            : 'Binding failed. Verify Site, Floor, Resource, and the latest version.'}
        </InlineFeedback>
      )}
      <ActionButton
        intent="primary"
        startIcon={<Link2 size={16} />}
        loading={mutation.isPending}
        disabled={
          !canMutate ||
          !valid ||
          !reason.trim() ||
          !confirmed ||
          !['APPROVED', 'BOUND'].includes(device.registrationState)
        }
        onClick={() => mutation.mutate()}
      >
        {copy.bind}
      </ActionButton>
    </Stack>
  );
}

function ReceiptView({
  receipt,
  refreshing,
  onRefresh,
  locale,
}: {
  receipt: WorkplaceDeviceCommandReceipt;
  refreshing: boolean;
  onRefresh: () => void;
  locale: WorkplaceNavigationLocale;
}) {
  const copy = workplaceNavigationCopy(locale);
  const recovery = workplaceDeviceCommandNeedsGetRecovery(receipt);
  return (
    <Stack spacing={1.25} data-testid="device-command-receipt">
      {receipt.state === 'RESULT_UNKNOWN' && (
        <InlineFeedback severity="warning" icon={<ShieldAlert size={17} />}>
          {copy.resultUnknown}
        </InlineFeedback>
      )}
      <Stack direction="row" justifyContent="space-between" gap={1} alignItems="center">
        <Box>
          <Typography fontWeight={800}>{copy.commandReceipt}</Typography>
          <Typography variant="caption" color="text.secondary">
            {receipt.commandId}
          </Typography>
        </Box>
        <Chip
          color={stateColor(receipt.state)}
          label={receipt.state}
          sx={stateChipSx(receipt.state)}
        />
      </Stack>
      <Box
        component="dl"
        sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1, m: 0 }}
      >
        {[
          [locale === 'ko' ? '상관 ID' : 'Correlation ID', receipt.correlationId ?? '—'],
          [
            locale === 'ko' ? 'Provider 작업' : 'Provider operation',
            receipt.providerOperationReference ?? '—',
          ],
          [locale === 'ko' ? '수락 시각' : 'Accepted', displayTime(receipt.acceptedAt, locale)],
          [locale === 'ko' ? '결과 코드' : 'Result code', receipt.resultCode ?? '—'],
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
      {recovery && (
        <ActionButton
          intent="secondary"
          startIcon={<RefreshCw size={15} />}
          loading={refreshing}
          onClick={onRefresh}
        >
          {copy.refreshReceipt}
        </ActionButton>
      )}
    </Stack>
  );
}

export function RemoteCommandWorkflow({
  device,
  canMutate,
  locale,
  onCompleted,
}: {
  device: WorkplaceDevice;
  canMutate: boolean;
  locale: WorkplaceNavigationLocale;
  onCompleted: () => Promise<void>;
}) {
  const copy = workplaceNavigationCopy(locale);
  const [commandType, setCommandType] = useState<WorkplaceDeviceCommandType>('FORCE_SYNC');
  const [safetyMessage, setSafetyMessage] = useState('');
  const [safetyDirection, setSafetyDirection] = useState('');
  const [preview, setPreview] = useState<WorkplaceDeviceCommandPreview | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [acceptedReceipt, setAcceptedReceipt] = useState<WorkplaceDeviceCommandReceipt | null>(
    null
  );
  const previewIntentRef = useRef<WorkplaceDevicePreviewIntent | null>(null);
  const [commandKeys, setCommandKeys] = useState(() => ({
    idempotencyKey: commandIdentity(device.deviceId, 'pending'),
    correlationId: commandIdentity(device.deviceId, 'correlation'),
  }));
  useEffect(() => {
    previewIntentRef.current = null;
    setPreview(null);
    setReason('');
    setConfirmed(false);
    setAcceptedReceipt(null);
  }, [device.deviceId, device.version]);
  const previewMutation = useMutation({
    mutationFn: () => {
      const input: WorkplaceDeviceCommandPreviewInput = {
        commandType,
        expectedDeviceVersion: device.version,
        payload:
          commandType === 'SAFETY_TAKEOVER'
            ? {
                message: safetyMessage.trim(),
                direction: safetyDirection.trim(),
                offlineFallback: String(device.safetyOfflineFallback),
              }
            : {},
      };
      const resolved = resolveIdempotentMutationIntent(
        previewIntentRef.current,
        { deviceId: device.deviceId, ...input },
        () => commandIdentity(device.deviceId, 'preview')
      );
      const intent =
        previewIntentRef.current?.key === resolved.key
          ? previewIntentRef.current
          : {
              ...resolved,
              correlationId: commandIdentity(device.deviceId, 'preview-correlation'),
            };
      previewIntentRef.current = intent;
      return previewWorkplaceDeviceCommand(device.deviceId, input, {
        idempotencyKey: intent.key,
        correlationId: intent.correlationId,
      });
    },
    onSuccess: (result) => {
      previewIntentRef.current = null;
      setPreview(result);
      setReason('');
      setConfirmed(false);
      setAcceptedReceipt(null);
      setCommandKeys({
        idempotencyKey: commandIdentity(device.deviceId, commandType.toLowerCase()),
        correlationId: commandIdentity(device.deviceId, 'correlation'),
      });
    },
  });
  const cancelPreview = () => {
    previewIntentRef.current = null;
    previewMutation.reset();
    setPreview(null);
    setReason('');
    setConfirmed(false);
  };
  const executeMutation = useMutation({
    mutationFn: () =>
      executeWorkplaceDeviceCommand(
        device.deviceId,
        {
          previewId: preview!.previewId,
          expectedDeviceVersion: device.version,
          reason: reason.trim(),
          explicitConfirmation: true,
        },
        {
          ...commandKeys,
          activeAccessMode: 'ELEVATED',
        }
      ),
    onSuccess: async (receipt) => {
      setAcceptedReceipt(receipt);
      await onCompleted();
    },
  });
  const receiptQuery = useQuery({
    queryKey: ['workplace', 'device-command', acceptedReceipt?.commandId],
    queryFn: () => getWorkplaceDeviceCommandReceipt(acceptedReceipt!.commandId),
    enabled: Boolean(acceptedReceipt),
    initialData: acceptedReceipt ?? undefined,
    refetchInterval: (query) =>
      query.state.data && ['ACCEPTED', 'RUNNING'].includes(query.state.data.state) ? 2_000 : false,
    retry: false,
  });
  const receipt = receiptQuery.data ?? acceptedReceipt;
  const safetyValid =
    commandType !== 'SAFETY_TAKEOVER' || Boolean(safetyMessage.trim() && safetyDirection.trim());
  const canExecute = Boolean(
    canMutate &&
    preview?.eligible &&
    reason.trim() &&
    confirmed &&
    workplaceDeviceCommandMaySubmit(receipt)
  );
  return (
    <Stack spacing={1.5} data-testid="device-command-workflow">
      <FormControl fullWidth>
        <InputLabel id="device-command-type-label">{copy.command}</InputLabel>
        <Select
          labelId="device-command-type-label"
          label={copy.command}
          value={commandType}
          onChange={(event) => {
            previewIntentRef.current = null;
            setCommandType(event.target.value as WorkplaceDeviceCommandType);
            setPreview(null);
            setAcceptedReceipt(null);
          }}
        >
          {(
            [
              'FORCE_SYNC',
              'CLEAR_CACHE',
              'REBOOT',
              'SAFETY_TAKEOVER',
              'CLEAR_SAFETY',
              'UNBIND',
            ] as const
          ).map((type) => (
            <MenuItem key={type} value={type}>
              {type}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {commandType === 'SAFETY_TAKEOVER' && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}>
          <FormField
            label={locale === 'ko' ? '안전 메시지' : 'Safety message'}
            value={safetyMessage}
            onChange={(event) => {
              previewIntentRef.current = null;
              setSafetyMessage(event.target.value);
              setPreview(null);
            }}
            required
          />
          <FormField
            label={locale === 'ko' ? '이동 방향' : 'Direction'}
            value={safetyDirection}
            onChange={(event) => {
              previewIntentRef.current = null;
              setSafetyDirection(event.target.value);
              setPreview(null);
            }}
            required
          />
        </Box>
      )}
      <ActionButton
        intent="secondary"
        startIcon={<Zap size={16} />}
        disabled={
          !canMutate ||
          !safetyValid ||
          Boolean(receipt && !workplaceDeviceCommandMaySubmit(receipt))
        }
        loading={previewMutation.isPending}
        onClick={() => previewMutation.mutate()}
      >
        {copy.preview}
      </ActionButton>
      {previewMutation.isError && (
        <InlineFeedback severity="error">
          {locale === 'ko'
            ? '영향을 확인하지 못했습니다. 명령은 실행되지 않았습니다.'
            : 'Impact preview failed. No command was executed.'}
        </InlineFeedback>
      )}
      {preview && (
        <Box sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5 })}>
          <Stack direction="row" justifyContent="space-between">
            <Typography fontWeight={800}>{copy.preview}</Typography>
            <Chip
              color={preview.eligible ? 'success' : 'error'}
              label={preview.eligible ? 'ELIGIBLE' : 'BLOCKED'}
              sx={stateChipSx(preview.eligible ? 'SUCCEEDED' : 'FAILED')}
            />
          </Stack>
          <Box component="ul" sx={{ mb: 0 }}>
            {preview.impact.map((item) => (
              <li key={item}>
                <Typography variant="body2">{item}</Typography>
              </li>
            ))}
          </Box>
          {preview.limitations.map((item) => (
            <InlineFeedback key={item} severity="warning" sx={{ mt: 1 }}>
              {item}
            </InlineFeedback>
          ))}
        </Box>
      )}
      {preview && !receipt && (
        <>
          <FormField
            label={copy.reason}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            inputProps={{ maxLength: 500 }}
            required
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
            }
            label={copy.explicitConfirm}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <ActionButton
              intent="primary"
              loading={executeMutation.isPending}
              disabled={!canExecute}
              onClick={() => executeMutation.mutate()}
            >
              {copy.execute}
            </ActionButton>
            <ActionButton intent="secondary" onClick={cancelPreview}>
              {locale === 'ko' ? '미리보기 취소' : 'Cancel preview'}
            </ActionButton>
          </Stack>
        </>
      )}
      {executeMutation.isError && (
        <InlineFeedback severity="error">
          {locale === 'ko'
            ? '명령을 수락하지 못했습니다. 같은 키로 임의 재시도하지 마세요.'
            : 'The command was not accepted. Do not retry with an arbitrary new key.'}
        </InlineFeedback>
      )}
      {receipt && (
        <ReceiptView
          receipt={receipt}
          refreshing={receiptQuery.isFetching}
          onRefresh={() => void receiptQuery.refetch()}
          locale={locale}
        />
      )}
    </Stack>
  );
}
