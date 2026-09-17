import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActionButton, LoadingState } from '@dwp-frontend/design-system';
import type { DwaionDeletionJob, DwaionPersonalDataCapabilities } from '@dwp-frontend/shared-utils';
import { DwaionCapabilityActions } from '../dwaion-capability-actions';

export function DwaionDeletionHistory({
  jobs,
  capabilities,
  loading,
  error,
  canManage,
  retryingJobId,
  locale,
  onRefresh,
  onRetry,
  formatTimestamp,
}: {
  jobs: readonly DwaionDeletionJob[];
  capabilities: DwaionPersonalDataCapabilities | null;
  loading: boolean;
  error: unknown;
  canManage: boolean;
  retryingJobId?: string;
  locale: 'ko' | 'en';
  onRefresh: () => void;
  onRetry: (job: DwaionDeletionJob) => void;
  formatTimestamp: (value: string) => string;
}) {
  const text = COPY[locale];
  return (
    <Box
      component="section"
      aria-labelledby="dwaion-deletion-history-title"
      data-testid="dwaion-deletion-history"
      sx={{
        p: { xs: 2, md: 2.5 },
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'flex-start' }}
        gap={1}
      >
        <Box>
          <Stack direction="row" gap={0.75} alignItems="center">
            <ShieldCheck size={18} aria-hidden="true" />
            <Typography id="dwaion-deletion-history-title" component="h2" variant="h6">
              {text.title}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {text.description}
          </Typography>
        </Box>
        <ActionButton
          intent="quiet"
          startIcon={<RefreshCw size={16} aria-hidden="true" />}
          onClick={onRefresh}
          sx={{ minHeight: 44 }}
        >
          {text.refresh}
        </ActionButton>
      </Stack>

      {loading ? <LoadingState label={text.loading} variant="skeleton" /> : null}
      {error ? (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          {text.error}
        </Alert>
      ) : null}
      {!loading && !error && jobs.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {text.empty}
        </Typography>
      ) : null}
      <Stack gap={1.25} sx={{ mt: jobs.length ? 1.5 : 0 }}>
        {jobs.map((job) => (
          <DeletionJobCard
            key={job.deletionJobId}
            job={job}
            canManage={canManage}
            retrying={retryingJobId === job.deletionJobId}
            locale={locale}
            onRetry={onRetry}
            formatTimestamp={formatTimestamp}
          />
        ))}
      </Stack>
      {jobs.length ? (
        <Box sx={{ mt: 1.5 }}>
          <DwaionCapabilityActions
            title={text.evidenceActions}
            description={text.evidenceActionsHelp}
            actions={deletionEvidenceActions(jobs, capabilities, text)}
          />
        </Box>
      ) : null}
    </Box>
  );
}

function deletionEvidenceActions(
  jobs: readonly DwaionDeletionJob[],
  capabilities: DwaionPersonalDataCapabilities | null,
  text: (typeof COPY)[keyof typeof COPY]
) {
  const completed = jobs.some((job) => job.state === 'COMPLETED' && job.deletionPerformed);
  const legalHold = jobs.some(
    (job) => job.state === 'BLOCKED_LEGAL_HOLD' || (job.blockedDomains?.length ?? 0) > 0
  );
  const safeError = jobs
    .flatMap((job) => job.targets ?? [])
    .find((target) => target.safeErrorCode)?.safeErrorCode;
  const providerReason = safeError
    ? `${text.providerUnavailable} (${safeError})`
    : text.providerUnavailable;
  const reason = (
    capability:
      | DwaionPersonalDataCapabilities[
          | 'backupDestructionLog'
          | 'sreSupport'
          | 'legalHoldEvidence'
          | 'legalHoldAppeal'
          | 'signedCertificate'
          | 'siemSync']
      | null
  ) =>
    capability?.available && capability.configured
      ? text.actualEvidence
      : (capability?.recoveryHint ?? capability?.reasonCode ?? providerReason);
  return [
    {
      key: 'backup-log',
      label: text.backupLog,
      capability: 'deletion.disposition.backup-state',
      reason: reason(capabilities?.backupDestructionLog ?? null),
      available: Boolean(capabilities?.backupDestructionLog.available && completed),
      onClick: () => downloadDeletionHistorySnapshot('backup-log', jobs),
    },
    {
      key: 'legal-hold-proof',
      label: text.legalHoldProof,
      capability: 'deletion.legal-hold-evidence',
      reason: reason(capabilities?.legalHoldEvidence ?? null),
      available: Boolean(capabilities?.legalHoldEvidence.available && legalHold),
      onClick: () => downloadDeletionHistorySnapshot('legal-hold', jobs),
    },
    {
      key: 'certificate',
      label: text.pdfCertificate,
      capability: 'browser.print',
      reason: reason(capabilities?.signedCertificate ?? null),
      available: Boolean(capabilities?.signedCertificate.available && completed),
    },
    {
      key: 'receipt-index',
      label: text.receiptIndex,
      capability: 'deletion.history',
      reason: text.actualEvidence,
      available: true,
      onClick: () => downloadDeletionHistorySnapshot('receipt-index', jobs),
    },
    ...(
      [
        ['sre-support', text.sreSupport, capabilities?.sreSupport],
        ['legal-hold-explanation', text.legalHoldExplanation, capabilities?.legalHoldAppeal],
        ['siem-sync', text.siemSync, capabilities?.siemSync],
      ] as const
    ).map(([key, label, capability]) => ({
      key,
      label,
      capability: `deletion.provider.${key}`,
      reason: reason(capability ?? null),
      available: Boolean(capability?.available && capability.configured),
    })),
  ];
}

function downloadDeletionHistorySnapshot(
  kind: 'backup-log' | 'legal-hold' | 'receipt-index',
  jobs: readonly DwaionDeletionJob[]
) {
  const payload = {
    kind: `DWAI_ON_DELETION_${kind.toUpperCase().replaceAll('-', '_')}`,
    evidenceClass: 'SERVER_RESPONSE_SNAPSHOT',
    officialCertificate: false,
    source: 'personal-data-deletion-history-api',
    generatedAt: new Date().toISOString(),
    jobs,
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `dwaion-deletion-${kind}-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function DeletionJobCard({
  job,
  canManage,
  retrying,
  locale,
  onRetry,
  formatTimestamp,
}: {
  job: DwaionDeletionJob;
  canManage: boolean;
  retrying: boolean;
  locale: 'ko' | 'en';
  onRetry: (job: DwaionDeletionJob) => void;
  formatTimestamp: (value: string) => string;
}) {
  const { t } = useTranslation('work');
  const text = COPY[locale];
  const blockedDomains = job.blockedDomains ?? [];
  const targets = job.targets ?? [];
  const terminalSuccess = job.state === 'COMPLETED' && job.deletionPerformed;
  const retryable = ['PARTIAL', 'FAILED'].includes(job.state);
  const legalHold = job.state === 'BLOCKED_LEGAL_HOLD' || blockedDomains.length > 0;
  return (
    <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'flex-start' }}
        gap={1}
      >
        <Stack direction="row" gap={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
          {terminalSuccess ? (
            <CheckCircle2 size={18} color="green" aria-hidden="true" />
          ) : retryable || legalHold ? (
            <AlertTriangle size={18} color="var(--dwp-semantic-warning)" aria-hidden="true" />
          ) : (
            <Clock3 size={18} aria-hidden="true" />
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
              {job.deletionJobId}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatTimestamp(job.requestedAt)} · {text.attempt} {job.attemptCount}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" gap={0.5} flexWrap="wrap">
          <Chip
            size="small"
            color={terminalSuccess ? 'success' : retryable || legalHold ? 'warning' : 'info'}
            variant="outlined"
            label={text.states[job.state]}
          />
          {retryable ? (
            <ActionButton
              intent="secondary"
              loading={retrying}
              disabled={!canManage}
              onClick={() => onRetry(job)}
              sx={{ minHeight: 44 }}
            >
              {text.retry}
            </ActionButton>
          ) : null}
        </Stack>
      </Stack>

      <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 1 }}>
        {job.domains.map((domain) => (
          <Chip
            key={domain}
            size="small"
            color={blockedDomains.includes(domain) ? 'warning' : 'default'}
            label={`${text.domains[domain]}${blockedDomains.includes(domain) ? ` · ${text.legalHold}` : ''}`}
          />
        ))}
      </Stack>

      {targets.length ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 0.75,
            mt: 1.25,
          }}
        >
          {targets.map((target) => (
            <Box key={target.domain} sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Stack direction="row" justifyContent="space-between" gap={1}>
                <Typography variant="body2" fontWeight="fontWeightBold">
                  {text.domains[target.domain]}
                </Typography>
                <Typography variant="caption">{text.targetStates[target.state]}</Typography>
              </Stack>
              {target.safeErrorCode ? (
                <Typography variant="caption" color="warning.main">
                  {target.safeErrorCode}
                </Typography>
              ) : null}
              {target.disposition ? (
                <Stack
                  data-testid="dwaion-deletion-receipt"
                  gap={0.25}
                  sx={{ mt: 0.75, overflowWrap: 'anywhere' }}
                >
                  <Typography variant="caption">
                    {text.receipt} · {target.disposition.dispositionId}
                  </Typography>
                  <Typography variant="caption">
                    {t('dwaionOperational.deletion.checksumPrefix')}{' '}
                    {target.disposition.receiptFingerprint}
                  </Typography>
                  <Typography variant="caption">
                    {text.purgedRows} {target.disposition.purgedRowCount}
                  </Typography>
                </Stack>
              ) : null}
            </Box>
          ))}
        </Box>
      ) : null}
      {job.completedAt ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {text.completed} {formatTimestamp(job.completedAt)}
        </Typography>
      ) : null}
    </Box>
  );
}

const COPY = {
  ko: {
    title: '개인 데이터 소멸 이력',
    description: '실제 삭제 작업, 도메인별 상태, 봉인된 물리 삭제 영수증을 확인합니다.',
    refresh: '이력 새로고침',
    loading: '삭제 이력을 확인하는 중입니다',
    error: '삭제 이력을 확인하지 못했습니다. 상태를 다시 확인해 주세요.',
    empty: '아직 요청한 개인 데이터 삭제 작업이 없습니다.',
    attempt: '시도',
    retry: '실패 대상 다시 시도',
    legalHold: '법적 보존',
    receipt: '소멸 영수증',
    purgedRows: '삭제 행',
    completed: '완료',
    states: {
      REQUESTED: '요청 접수',
      RUNNING: '물리 삭제 중',
      PARTIAL: '일부 완료',
      COMPLETED: '삭제 완료',
      BLOCKED_LEGAL_HOLD: '법적 보존으로 차단',
      FAILED: '삭제 실패',
    },
    targetStates: {
      REQUESTED: '대기',
      RUNNING: '진행 중',
      COMPLETED: '완료',
      BLOCKED_LEGAL_HOLD: '법적 보존',
      FAILED: '실패',
    },
    domains: {
      ROUTINE: '개인 루틴',
      MEMORY: '개인 메모리',
      ARTIFACT: '산출물',
      ARTIFACT_EXPORT: '산출물 내보내기',
    },
    evidenceActions: '소멸 증거와 감사 연계',
    evidenceActionsHelp:
      '현재 서버 삭제 이력 응답을 JSON 스냅샷으로 내보냅니다. 공식 증명서는 별도 서버 계약이 있을 때만 제공됩니다.',
    backupLog: '현재 백업 파기 상태 스냅샷 (JSON)',
    sreSupport: 'SRE 보안팀 지원 요청',
    legalHoldProof: '현재 법적 보존 상태 스냅샷 (JSON)',
    legalHoldExplanation: '보존 사유 소명 요청',
    pdfCertificate: '공식 소멸 증명서 PDF 다운로드',
    receiptIndex: '현재 서버 삭제 이력 스냅샷 (JSON)',
    siemSync: 'SIEM 감사 로그 수동 동기화',
    actualEvidence: '현재 서버 삭제 이력 응답의 스냅샷입니다. 공식 증명서가 아닙니다.',
    providerUnavailable: '현재 데이터 거버넌스 공급자가 이 작업을 제공하지 않습니다.',
  },
  en: {
    title: 'Personal data deletion history',
    description:
      'Review live deletion jobs, per-domain state, and sealed physical-deletion receipts.',
    refresh: 'Refresh history',
    loading: 'Loading deletion history',
    error: 'Deletion history could not be verified. Check status again.',
    empty: 'No personal-data deletion jobs have been requested.',
    attempt: 'Attempt',
    retry: 'Retry failed targets',
    legalHold: 'Legal hold',
    receipt: 'Disposition receipt',
    purgedRows: 'Rows purged',
    completed: 'Completed',
    states: {
      REQUESTED: 'Requested',
      RUNNING: 'Physical deletion running',
      PARTIAL: 'Partially completed',
      COMPLETED: 'Deletion completed',
      BLOCKED_LEGAL_HOLD: 'Blocked by legal hold',
      FAILED: 'Deletion failed',
    },
    targetStates: {
      REQUESTED: 'Pending',
      RUNNING: 'Running',
      COMPLETED: 'Completed',
      BLOCKED_LEGAL_HOLD: 'Legal hold',
      FAILED: 'Failed',
    },
    domains: {
      ROUTINE: 'Personal routines',
      MEMORY: 'Personal memory',
      ARTIFACT: 'Artifacts',
      ARTIFACT_EXPORT: 'Artifact exports',
    },
    evidenceActions: 'Destruction evidence and audit integration',
    evidenceActionsHelp:
      'Exports the current server deletion-history response as a JSON snapshot. An official certificate is available only through a separate server contract.',
    backupLog: 'Export current backup-disposition snapshot (JSON)',
    sreSupport: 'Request SRE security support',
    legalHoldProof: 'Export current legal-hold state snapshot (JSON)',
    legalHoldExplanation: 'Request legal-hold explanation',
    pdfCertificate: 'Download official destruction certificate PDF',
    receiptIndex: 'Export current server deletion-history snapshot (JSON)',
    siemSync: 'Synchronize SIEM audit log',
    actualEvidence:
      'This is a snapshot of the current server deletion-history response, not an official certificate.',
    providerUnavailable: 'The data-governance provider does not expose this operation.',
  },
} as const;
