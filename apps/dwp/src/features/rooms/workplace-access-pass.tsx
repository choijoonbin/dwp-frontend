import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Nfc,
  QrCode,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  executeWorkplaceAccessPass,
  getWorkplaceAccessPassAuditEvents,
  getWorkplaceAccessPassCommand,
  getWorkplaceAccessPassContext,
  previewWorkplaceAccessPass,
} from '@dwp-frontend/shared-utils/api/workplace-access-pass-api';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { commandIdentity } from './workplace-navigation-device-ui';
import type { WorkplaceNavigationLocale } from './workplace-navigation-model';
import type { WorkplaceNavigationPoi } from '@dwp-frontend/shared-utils/api/workplace-navigation-contract';
import type {
  WorkplaceAccessPassCommandResult,
  WorkplaceAccessPassCommandType,
  WorkplaceAccessPassPreview,
} from '@dwp-frontend/shared-utils/api/workplace-access-pass-api';

type Props = Readonly<{
  destination: WorkplaceNavigationPoi;
  locale: WorkplaceNavigationLocale;
  canUpdate: boolean;
  elevated: boolean;
}>;

type AccessPassExecuteIntent = Readonly<{
  commandStateIdentity: string;
  previewId: string;
  idempotencyKey: string;
  correlationId: string;
  reason: string | null;
}>;

const MAX_TTL_SECONDS = 20 * 60;

function copyFor(locale: WorkplaceNavigationLocale) {
  return locale === 'ko'
    ? {
        title: 'DWP 모바일 원타임 패스',
        subtitle: '예약과 실내 경로에 연결된 본인 세션용 출입 자격증명',
        active: '활성',
        expired: '만료됨',
        revoked: '회수됨',
        notIssued: '발급된 패스가 없습니다.',
        eligible: '현재 예약으로 발급할 수 있습니다.',
        notEligible: '현재 사용자에게 유효한 예약이 없어 발급할 수 없습니다.',
        issue: '원타임 패스 발급',
        rotate: '보안 토큰 재발급',
        revoke: '긴급 회수',
        nfc: 'NFC 태그 활성화',
        qr: '키오스크 QR 인식',
        nfcReady: 'NFC 제시 모드가 준비되었습니다. 출입 단말 가까이에 기기를 대세요.',
        rawUnavailable: '보안 값은 최초 발급 응답에서만 표시됩니다. 필요하면 재발급하세요.',
        pairing: '키오스크 페어링 코드',
        pairingUnavailable: '페어링 코드는 최초 발급 응답에서만 확인할 수 있습니다.',
        expires: '남은 유효 시간',
        credential: '보안 토큰',
        provider: '출입 Provider',
        audit: 'DWP AUDIT RECORDED',
        auditDescription: '본인 세션 전용 · 키오스크 코드는 일회용 · 발급/회수 기록 보존',
        previewTitle: '출입 패스 변경 영향 확인',
        reason: '업무 사유',
        confirm: '영향을 확인했으며 이 작업을 실행합니다.',
        execute: '확인 후 실행',
        cancel: '취소',
        close: '닫기',
        recover: '처리 상태 재조회',
        stepUp: '이 작업은 최근 재인증이 필요합니다.',
        providerUnavailable:
          'NFC/키오스크 Provider가 검증되지 않아 해당 채널을 사용할 수 없습니다.',
        copy: '페어링 코드 복사',
        copied: '페어링 코드를 복사했습니다.',
        copyFailed: '페어링 코드를 복사하지 못했습니다. 코드를 선택해 직접 복사하세요.',
        qrTitle: '키오스크에서 스캔',
        qrDescription:
          '이 QR은 현재 패스 만료 시각까지만 유효하며 화면을 닫으면 다시 표시되지 않습니다.',
        commandFailed:
          '명령 결과를 확인하지 못했습니다. 이 창에서 다시 실행하면 같은 명령 영수증을 재조회합니다.',
      }
    : {
        title: 'DWP mobile one-time pass',
        subtitle: 'A session-bound access credential linked to your booking and indoor route',
        active: 'Active',
        expired: 'Expired',
        revoked: 'Revoked',
        notIssued: 'No access pass has been issued.',
        eligible: 'Your current booking is eligible for a pass.',
        notEligible: 'No eligible booking is available for this destination.',
        issue: 'Issue one-time pass',
        rotate: 'Rotate security token',
        revoke: 'Emergency revoke',
        nfc: 'Activate NFC presentation',
        qr: 'Show kiosk QR',
        nfcReady: 'NFC presentation is ready. Hold this device near the access reader.',
        rawUnavailable:
          'Secret values appear only in the first issue response. Rotate to replace them.',
        pairing: 'Kiosk pairing code',
        pairingUnavailable: 'The pairing code is shown only in the first issue response.',
        expires: 'Time remaining',
        credential: 'Security token',
        provider: 'Access provider',
        audit: 'DWP AUDIT RECORDED',
        auditDescription: 'Bound to this user session · one-time kiosk code · evidence retained',
        previewTitle: 'Review access-pass impact',
        reason: 'Business reason',
        confirm: 'I reviewed the impact and explicitly confirm this operation.',
        execute: 'Confirm and execute',
        cancel: 'Cancel',
        close: 'Close',
        recover: 'Refresh command status',
        stepUp: 'Fresh reauthentication is required for this operation.',
        providerUnavailable: 'An unverified NFC or kiosk provider cannot serve that channel.',
        copy: 'Copy pairing code',
        copied: 'Pairing code copied.',
        copyFailed: 'The pairing code could not be copied. Select and copy it manually.',
        qrTitle: 'Scan at the kiosk',
        qrDescription:
          'This QR expires with the current pass and cannot be shown again after closing.',
        commandFailed:
          'The command outcome was not confirmed. Retry in this dialog to replay the same command receipt.',
      };
}

function humanCode(code: string, locale: WorkplaceNavigationLocale) {
  const values: Record<string, readonly [string, string]> = {
    NEW_ONE_TIME_CREDENTIAL_ISSUED: [
      '새 일회용 자격증명이 발급됩니다.',
      'A new one-time credential is issued.',
    ],
    CURRENT_CREDENTIAL_INVALIDATED: [
      '현재 자격증명이 즉시 무효화됩니다.',
      'The current credential is invalidated immediately.',
    ],
    CURRENT_CREDENTIAL_REVOKED_IMMEDIATELY: [
      '출입 패스가 즉시 회수됩니다.',
      'The access pass is revoked immediately.',
    ],
    AUDIT_EVIDENCE_RECORDED: [
      '변경 근거와 영수증이 감사 기록에 남습니다.',
      'Evidence and a receipt are written to the audit record.',
    ],
    DESTINATION_NOT_IN_PUBLISHED_GRAPH: [
      '목적지가 게시된 실내 지도와 일치하지 않습니다.',
      'The destination is not in the published indoor graph.',
    ],
    ACTIVE_PASS_ALREADY_EXISTS: [
      '활성 패스는 재발급 또는 회수할 수 있습니다.',
      'The active pass can be rotated or revoked.',
    ],
    PASS_VERSION_CHANGED: [
      '패스 버전이 변경되었습니다. 새로고침하세요.',
      'The pass version changed. Refresh before continuing.',
    ],
    ACTIVE_PASS_NOT_FOUND: ['활성 패스를 찾을 수 없습니다.', 'An active pass could not be found.'],
    ELIGIBLE_BOOKING_NOT_FOUND: [
      '이 공간에 유효한 본인 예약이 없습니다.',
      'You do not have an eligible booking for this space.',
    ],
    NFC_PROVIDER_NOT_READY: [
      'NFC Provider가 준비되지 않았습니다.',
      'The NFC provider is not ready.',
    ],
    KIOSK_PROVIDER_NOT_READY: [
      '키오스크 Provider가 준비되지 않았습니다.',
      'The kiosk provider is not ready.',
    ],
    ACCESS_PROVIDER_NOT_CONFIGURED: [
      '출입 Provider가 구성되지 않았습니다.',
      'No access provider is configured.',
    ],
    INITIAL_VERSION_MUST_BE_ZERO: [
      '초기 발급 버전이 올바르지 않습니다.',
      'The initial issue version is invalid.',
    ],
  };
  return values[code]?.[locale === 'ko' ? 0 : 1] ?? code;
}

function stateLabel(state: string, locale: WorkplaceNavigationLocale) {
  const copy = copyFor(locale);
  return state === 'ACTIVE' ? copy.active : state === 'REVOKED' ? copy.revoked : copy.expired;
}

function remainingSeconds(expiresAt: string | undefined, now: number) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
}

function durationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function WorkplaceAccessPassPanel({ destination, locale, canUpdate, elevated }: Props) {
  const copy = copyFor(locale);
  const queryClient = useQueryClient();
  const queryKey = [
    'workplace',
    'navigation',
    'access-pass',
    destination.siteId,
    destination.resourceId,
  ];
  const [now, setNow] = useState(Date.now());
  const [preview, setPreview] = useState<WorkplaceAccessPassPreview | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [credential, setCredential] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [nfcReady, setNfcReady] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [lastResult, setLastResult] = useState<WorkplaceAccessPassCommandResult | null>(null);
  const executeIntent = useRef<AccessPassExecuteIntent | null>(null);
  const destinationIdentity = [
    destination.siteId,
    destination.floorId,
    destination.resourceId ?? '',
    destination.poiId,
  ].join(':');
  const contextQuery = useQuery({
    queryKey,
    queryFn: () => getWorkplaceAccessPassContext(destination.siteId, destination.resourceId!),
    enabled: Boolean(destination.resourceId),
    retry: false,
    refetchInterval: 30_000,
  });
  const pass = contextQuery.data?.pass ?? null;
  const passIdentity = pass ? `${pass.passId}:v${pass.version}` : '';
  const commandStateIdentity = `${destinationIdentity}|${passIdentity}`;
  const activeCommandStateIdentity = useRef(commandStateIdentity);
  activeCommandStateIdentity.current = commandStateIdentity;
  const active = pass?.state === 'ACTIVE' && Date.parse(pass.expiresAt) > now;
  const seconds = remainingSeconds(pass?.expiresAt, now);
  const auditQuery = useQuery({
    queryKey: ['workplace', 'navigation', 'access-pass', pass?.passId, 'audit'],
    queryFn: () => getWorkplaceAccessPassAuditEvents(pass?.passId),
    enabled: Boolean(pass?.passId),
    retry: false,
  });

  useEffect(() => {
    if (!active) {
      setCredential(null);
      setPairingCode(null);
      setQrOpen(false);
      setNfcReady(false);
      setCopyStatus('idle');
      return undefined;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [active]);

  const previewMutation = useMutation({
    onMutate: () => {
      executeIntent.current = null;
      setPreview(null);
    },
    mutationFn: async (commandType: WorkplaceAccessPassCommandType) => ({
      commandStateIdentity,
      value: await previewWorkplaceAccessPass(
        {
          commandType,
          passId: commandType === 'ISSUE' ? null : (pass?.passId ?? null),
          siteId: destination.siteId,
          floorId: destination.floorId,
          resourceId: destination.resourceId!,
          destinationPoiId: destination.poiId,
          expectedPassVersion: commandType === 'ISSUE' ? 0 : (pass?.version ?? 0),
        },
        commandIdentity(destination.poiId, `access-pass-preview-${commandType.toLowerCase()}`)
      ),
    }),
    onSuccess: ({ commandStateIdentity: completedIdentity, value }) => {
      if (activeCommandStateIdentity.current !== completedIdentity) return;
      executeIntent.current = {
        commandStateIdentity: completedIdentity,
        previewId: value.previewId,
        idempotencyKey: commandIdentity(
          destination.poiId,
          `access-pass-${value.commandType.toLowerCase()}`
        ),
        correlationId: commandIdentity(destination.poiId, 'access-pass-correlation'),
        reason: null,
      };
      setPreview(value);
      setReason('');
      setConfirmed(false);
    },
  });

  const executeMutation = useMutation({
    gcTime: 0,
    mutationFn: async (intent: AccessPassExecuteIntent) => {
      if (!preview || intent.previewId !== preview.previewId || intent.reason === null) {
        throw new Error('A current access-pass command intent is required.');
      }
      return {
        commandStateIdentity: intent.commandStateIdentity,
        value: await executeWorkplaceAccessPass(
          {
            previewId: intent.previewId,
            expectedPassVersion: preview.expectedPassVersion,
            reason: intent.reason,
            explicitConfirmation: true,
          },
          {
            idempotencyKey: intent.idempotencyKey,
            correlationId: intent.correlationId,
            activeAccessMode: 'ELEVATED',
          }
        ),
      };
    },
    onSuccess: async ({ commandStateIdentity: completedIdentity, value }) => {
      if (activeCommandStateIdentity.current !== completedIdentity) return;
      setLastResult(value);
      executeIntent.current = null;
      setCredential(value.oneTimeCredential);
      setPairingCode(value.pairingCode);
      setCopyStatus('idle');
      setPreview(null);
      setConfirmed(false);
      setReason('');
      setNow(Date.now());
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({
        queryKey: ['workplace', 'navigation', 'access-pass', value.pass.passId, 'audit'],
      });
    },
  });

  const recoverMutation = useMutation({
    mutationFn: async () => ({
      commandStateIdentity,
      value: await getWorkplaceAccessPassCommand(lastResult!.receipt.commandId),
    }),
    onSuccess: async ({ commandStateIdentity: completedIdentity, value }) => {
      if (activeCommandStateIdentity.current !== completedIdentity) return;
      setLastResult(value);
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const stateIdentity = useRef({ destinationIdentity, passIdentity });
  useLayoutEffect(() => {
    const previous = stateIdentity.current;
    stateIdentity.current = { destinationIdentity, passIdentity };
    if (
      previous.destinationIdentity === destinationIdentity &&
      previous.passIdentity === passIdentity
    )
      return;
    const resultMatchesCurrentPass = Boolean(
      lastResult &&
      lastResult.pass.siteId === destination.siteId &&
      lastResult.pass.floorId === destination.floorId &&
      lastResult.pass.resourceId === destination.resourceId &&
      lastResult.pass.destinationPoiId === destination.poiId &&
      `${lastResult.pass.passId}:v${lastResult.pass.version}` === passIdentity
    );
    previewMutation.reset();
    executeMutation.reset();
    recoverMutation.reset();
    executeIntent.current = null;
    setPreview(null);
    setReason('');
    setConfirmed(false);
    setQrOpen(false);
    setNfcReady(false);
    setCopyStatus('idle');
    if (!resultMatchesCurrentPass) {
      setCredential(null);
      setPairingCode(null);
      setLastResult(null);
    }
  }, [destinationIdentity, passIdentity]); // eslint-disable-line react-hooks/exhaustive-deps

  const closePreview = () => {
    if (executeMutation.isPending) return;
    executeIntent.current = null;
    setPreview(null);
  };

  const executePreview = () => {
    const intent = executeIntent.current;
    if (!intent || !preview || intent.previewId !== preview.previewId || !reason.trim()) return;
    const stableIntent = intent.reason === null ? { ...intent, reason: reason.trim() } : intent;
    executeIntent.current = stableIntent;
    executeMutation.mutate(stableIntent);
  };

  const providerSummary = useMemo(
    () =>
      (contextQuery.data?.providers ?? []).map((provider) => ({
        ...provider,
        ready: provider.state === 'HEALTHY' && Boolean(provider.evidenceReference),
      })),
    [contextQuery.data?.providers]
  );

  if (!destination.resourceId) {
    return (
      <InlineFeedback severity="warning">
        {locale === 'ko'
          ? '출입 패스는 공간 리소스 목적지에서만 발급할 수 있습니다.'
          : 'Access passes are available only for resource destinations.'}
      </InlineFeedback>
    );
  }

  return (
    <Box
      component="section"
      aria-labelledby="workplace-access-pass-title"
      data-testid="workplace-access-pass"
    >
      <Box
        sx={{
          borderRadius: 3,
          p: { xs: 2, sm: 2.25 },
          color: '#fff',
          background: active
            ? 'linear-gradient(145deg, #0b4fd8 0%, #2563eb 55%, #435b8b 100%)'
            : 'linear-gradient(145deg, #374151 0%, #1f2937 100%)',
          boxShadow: '0 14px 30px rgba(15, 56, 140, 0.22)',
        }}
      >
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
          <Stack direction="row" gap={1.25} alignItems="center" minWidth={0}>
            <Box
              aria-hidden="true"
              sx={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,.16)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Nfc size={24} />
            </Box>
            <Box minWidth={0}>
              <Typography
                id="workplace-access-pass-title"
                component="h2"
                variant="h6"
                fontWeight={800}
              >
                {copy.title}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.82)' }}>
                {destination.nameKo || destination.nameEn}
              </Typography>
            </Box>
          </Stack>
          <Chip
            size="small"
            label={pass ? stateLabel(active ? 'ACTIVE' : pass.state, locale) : '—'}
            sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,.17)', fontWeight: 800 }}
          />
        </Stack>

        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,.84)', mt: 1.5 }}>
          {copy.subtitle}
        </Typography>

        {active && pass ? (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              border: '1px solid rgba(255,255,255,.25)',
              bgcolor: 'rgba(255,255,255,.1)',
              borderRadius: 2,
            }}
          >
            <Stack direction="row" justifyContent="space-between" gap={2}>
              <Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.78)' }}>
                  {copy.expires}
                </Typography>
                <Typography
                  variant="h4"
                  fontWeight={850}
                  sx={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {durationLabel(seconds)}
                </Typography>
              </Box>
              <Box textAlign="right">
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.78)' }}>
                  {copy.credential}
                </Typography>
                <Typography
                  component="code"
                  variant="h6"
                  fontWeight={800}
                  sx={{ letterSpacing: '.16em' }}
                >
                  •••• •••• · {pass.credentialLastFour}
                </Typography>
              </Box>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, (seconds / MAX_TTL_SECONDS) * 100)}
              aria-label={copy.expires}
              sx={{
                mt: 1.25,
                height: 6,
                borderRadius: 3,
                bgcolor: 'rgba(255,255,255,.2)',
                '& .MuiLinearProgress-bar': { bgcolor: '#6ee7b7' },
              }}
            />
          </Box>
        ) : (
          <InlineFeedback
            severity={contextQuery.data?.bookingEligible ? 'info' : 'warning'}
            sx={{ mt: 2 }}
          >
            {contextQuery.isLoading
              ? locale === 'ko'
                ? '패스 발급 조건을 확인하는 중입니다.'
                : 'Checking pass eligibility.'
              : contextQuery.data?.bookingEligible
                ? copy.eligible
                : copy.notEligible}
          </InlineFeedback>
        )}

        {pairingCode && active ? (
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            sx={{ mt: 1.5, p: 1.25, bgcolor: 'rgba(255,255,255,.1)', borderRadius: 2 }}
          >
            <Box minWidth={0}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.78)' }}>
                {copy.pairing}
              </Typography>
              <Typography
                component="code"
                variant="h6"
                fontWeight={850}
                sx={{ letterSpacing: '.15em' }}
              >
                {pairingCode.match(/.{1,4}/gu)?.join(' ')}
              </Typography>
              <Typography
                component="span"
                role="status"
                aria-live="polite"
                variant="caption"
                sx={{
                  display: 'block',
                  color: copyStatus === 'failed' ? '#fde68a' : 'rgba(255,255,255,.82)',
                }}
              >
                {copyStatus === 'copied'
                  ? copy.copied
                  : copyStatus === 'failed'
                    ? copy.copyFailed
                    : null}
              </Typography>
            </Box>
            <Tooltip title={copyStatus === 'copied' ? copy.copied : copy.copy}>
              <IconButton
                aria-label={copyStatus === 'copied' ? copy.copied : copy.copy}
                onClick={async () => {
                  try {
                    if (!navigator.clipboard?.writeText) {
                      throw new Error('Clipboard API unavailable.');
                    }
                    await navigator.clipboard.writeText(pairingCode);
                    setCopyStatus('copied');
                  } catch {
                    setCopyStatus('failed');
                  }
                }}
                sx={{ color: '#fff' }}
              >
                {copyStatus === 'copied' ? <CheckCircle2 /> : <Copy />}
              </IconButton>
            </Tooltip>
          </Stack>
        ) : active && pass?.pairingAvailable ? (
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 1.5, color: 'rgba(255,255,255,.76)' }}
          >
            {copy.pairingUnavailable}
          </Typography>
        ) : null}

        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 2 }}>
          {active ? (
            <>
              <ActionButton
                intent="secondary"
                startIcon={<Nfc size={17} />}
                disabled={!pass?.nfcEnabled || !credential}
                onClick={() => setNfcReady(true)}
                sx={{
                  flex: 1,
                  bgcolor: '#fff',
                  color: '#0b4fd8',
                  '&:hover': { bgcolor: '#eff6ff' },
                }}
              >
                {copy.nfc}
              </ActionButton>
              <ActionButton
                intent="secondary"
                startIcon={<QrCode size={17} />}
                disabled={!pass?.qrEnabled || !pairingCode}
                onClick={() => setQrOpen(true)}
                sx={{ flex: 1, borderColor: 'rgba(255,255,255,.55)', color: '#fff' }}
              >
                {copy.qr}
              </ActionButton>
            </>
          ) : (
            <ActionButton
              intent="primary"
              startIcon={<KeyRound size={17} />}
              loading={previewMutation.isPending}
              disabled={!canUpdate || !contextQuery.data?.bookingEligible}
              onClick={() => previewMutation.mutate('ISSUE')}
              sx={{ bgcolor: '#fff', color: '#0b4fd8', '&:hover': { bgcolor: '#eff6ff' } }}
            >
              {copy.issue}
            </ActionButton>
          )}
        </Stack>

        {active ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 1 }}>
            <ActionButton
              intent="quiet"
              startIcon={<RotateCcw size={16} />}
              loading={previewMutation.isPending}
              disabled={!canUpdate}
              onClick={() => previewMutation.mutate('ROTATE')}
              sx={{ color: '#fff' }}
            >
              {copy.rotate}
            </ActionButton>
            <ActionButton
              intent="danger"
              startIcon={<ShieldAlert size={16} />}
              loading={previewMutation.isPending}
              disabled={!canUpdate}
              onClick={() => previewMutation.mutate('REVOKE')}
              sx={{ ml: { sm: 'auto' } }}
            >
              {copy.revoke}
            </ActionButton>
          </Stack>
        ) : null}
      </Box>

      {nfcReady ? (
        <Box sx={{ mt: 1 }}>
          <InlineFeedback
            severity="success"
            action={
              <ActionButton intent="quiet" size="small" onClick={() => setNfcReady(false)}>
                {copy.close}
              </ActionButton>
            }
          >
            {copy.nfcReady}
          </InlineFeedback>
        </Box>
      ) : null}
      {active && !credential ? (
        <InlineFeedback severity="info" sx={{ mt: 1 }}>
          {copy.rawUnavailable}
        </InlineFeedback>
      ) : null}
      {!elevated && canUpdate ? (
        <InlineFeedback severity="warning" sx={{ mt: 1 }}>
          {copy.stepUp}
        </InlineFeedback>
      ) : null}
      {previewMutation.isError || executeMutation.isError || contextQuery.isError ? (
        <InlineFeedback severity="error" sx={{ mt: 1 }}>
          {locale === 'ko'
            ? '출입 패스 작업을 완료하지 못했습니다. 새로고침 후 다시 시도하세요.'
            : 'The access-pass operation could not be completed. Refresh and try again.'}
        </InlineFeedback>
      ) : null}

      <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1.25 }}>
        {providerSummary.map((provider) => (
          <Chip
            key={provider.capability}
            size="small"
            icon={provider.ready ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
            color={provider.ready ? 'success' : 'warning'}
            variant="outlined"
            label={`${provider.capability} · ${provider.state}`}
          />
        ))}
      </Stack>
      {providerSummary.some((provider) => !provider.ready) ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          {copy.providerUnavailable}
        </Typography>
      ) : null}

      <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 2, bgcolor: 'action.hover' }}>
        <Stack direction="row" gap={1} alignItems="center">
          <ShieldCheck size={18} />
          <Box>
            <Typography variant="caption" fontWeight={850}>
              {copy.audit}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {copy.auditDescription}
            </Typography>
          </Box>
          {auditQuery.data?.[0] ? (
            <Chip
              size="small"
              label={auditQuery.data[0].action.split('.').at(-1)?.toUpperCase()}
              sx={{ ml: 'auto' }}
            />
          ) : null}
        </Stack>
      </Box>

      {lastResult?.receipt.recoveryByGetOnly ? (
        <ActionButton
          intent="secondary"
          startIcon={<RefreshCw size={16} />}
          loading={recoverMutation.isPending}
          onClick={() => recoverMutation.mutate()}
          sx={{ mt: 1 }}
        >
          {copy.recover}
        </ActionButton>
      ) : null}

      {preview ? (
        <Dialog open onClose={closePreview} fullWidth maxWidth="sm">
          <DialogTitle>{copy.previewTitle}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Stack component="ul" spacing={0.75} sx={{ pl: 2.5, m: 0 }}>
                {preview.impact.map((item) => (
                  <Typography component="li" variant="body2" key={item}>
                    {humanCode(item, locale)}
                  </Typography>
                ))}
              </Stack>
              {preview.limitations.length ? (
                <InlineFeedback severity={preview.eligible ? 'warning' : 'error'}>
                  {preview.limitations.map((item) => humanCode(item, locale)).join(' ')}
                </InlineFeedback>
              ) : null}
              {!elevated ? <InlineFeedback severity="warning">{copy.stepUp}</InlineFeedback> : null}
              <TextField
                label={copy.reason}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={executeIntent.current?.reason != null}
                inputProps={{ maxLength: 500 }}
                multiline
                minRows={2}
                fullWidth
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    disabled={executeIntent.current?.reason != null}
                  />
                }
                label={copy.confirm}
              />
              {executeMutation.isError ? (
                <InlineFeedback severity="error">{copy.commandFailed}</InlineFeedback>
              ) : null}
            </Stack>
          </DialogContent>
          <DialogActions>
            <ActionButton
              intent="quiet"
              disabled={executeMutation.isPending}
              onClick={closePreview}
            >
              {copy.cancel}
            </ActionButton>
            <ActionButton
              intent="primary"
              loading={executeMutation.isPending}
              disabled={!preview.eligible || !elevated || !reason.trim() || !confirmed}
              onClick={executePreview}
            >
              {copy.execute}
            </ActionButton>
          </DialogActions>
        </Dialog>
      ) : null}

      {qrOpen ? (
        <Dialog open onClose={() => setQrOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>{copy.qrTitle}</DialogTitle>
          <DialogContent>
            {pairingCode && pass ? (
              <Stack alignItems="center" spacing={2} sx={{ pt: 1 }}>
                <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: 2 }}>
                  <QRCodeSVG
                    value={`dwp://workplace/access-pass/pair?passId=${encodeURIComponent(pass.passId)}&code=${encodeURIComponent(pairingCode)}`}
                    size={220}
                    level="H"
                    aria-label={copy.qrTitle}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {copy.qrDescription}
                </Typography>
                <Stack direction="row" gap={1} alignItems="center">
                  <Timer size={16} />
                  <Typography fontWeight={750}>{durationLabel(seconds)}</Typography>
                </Stack>
              </Stack>
            ) : (
              <InlineFeedback severity="warning">{copy.rawUnavailable}</InlineFeedback>
            )}
          </DialogContent>
          <DialogActions>
            <ActionButton intent="primary" onClick={() => setQrOpen(false)}>
              {copy.close}
            </ActionButton>
          </DialogActions>
        </Dialog>
      ) : null}
    </Box>
  );
}
