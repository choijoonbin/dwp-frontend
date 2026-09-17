import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ActionButton, LoadingState } from '@dwp-frontend/design-system';
import {
  buildDwaionBackupLedgerSnapshot,
  downloadDwaionPersonalDataCertificate,
  downloadDwaionPersonalDataLegalHoldEvidence,
  downloadDwaionPersonalDataReceiptIndex,
  executeDwaionPersonalDataEvidenceAction,
  type DwaionDeletionJob,
  type DwaionPersonalDataCapabilities,
  type DwaionPersonalDataEvidenceAction,
  type DwaionPersonalDataEvidenceCommand,
} from '@dwp-frontend/shared-utils';
import { DwaionCapabilityActions } from '../dwaion-capability-actions';
import { useDwaionGovernedMutation } from '../../../components/use-dwaion-governed-mutation';

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
  const governEvidence = useDwaionGovernedMutation(
    'route.dwaion.work.personal-deletion-evidence.action'
  );
  const [evidenceBusy, setEvidenceBusy] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState(false);
  const [evidenceReceipt, setEvidenceReceipt] = useState<DwaionPersonalDataEvidenceCommand | null>(
    null
  );
  const evidenceCommands = useRef(new Map<string, string>());
  const latestJob = jobs[0] ?? null;
  const completedJob = jobs.find((job) => job.state === 'COMPLETED' && job.deletionPerformed);
  const legalHoldJob = jobs.find(
    (job) => job.state === 'BLOCKED_LEGAL_HOLD' || (job.blockedDomains?.length ?? 0) > 0
  );

  const saveBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadReceiptIndex = async () => {
    setEvidenceBusy('receipt-index');
    setEvidenceError(false);
    try {
      saveBlob(await downloadDwaionPersonalDataReceiptIndex(), 'dwaion-deletion-receipts.json');
    } catch {
      setEvidenceError(true);
    } finally {
      setEvidenceBusy(null);
    }
  };

  const downloadLegalHold = async () => {
    if (!legalHoldJob) return;
    setEvidenceBusy('legal-hold-proof');
    setEvidenceError(false);
    try {
      saveBlob(
        await downloadDwaionPersonalDataLegalHoldEvidence(legalHoldJob.deletionJobId),
        `dwaion-legal-hold-${legalHoldJob.deletionJobId}.json`
      );
    } catch {
      setEvidenceError(true);
    } finally {
      setEvidenceBusy(null);
    }
  };

  const executeEvidence = async (
    action: DwaionPersonalDataEvidenceAction,
    job: DwaionDeletionJob | undefined
  ) => {
    if (!job || !canManage) return;
    const key = `${action}:${job.deletionJobId}:${job.attemptCount}`;
    const commandId = evidenceCommands.current.get(key) ?? globalThis.crypto.randomUUID();
    evidenceCommands.current.set(key, commandId);
    setEvidenceBusy(action);
    setEvidenceError(false);
    try {
      const command = await governEvidence((authority) =>
        executeDwaionPersonalDataEvidenceAction(
          job.deletionJobId,
          job.attemptCount,
          action,
          commandId,
          authority
        )
      );
      setEvidenceReceipt(command);
      if (command.state !== 'PENDING') evidenceCommands.current.delete(key);
      if (command.state === 'FAILED') {
        setEvidenceError(true);
      } else if (command.state === 'COMPLETED' && command.action === 'BACKUP_LEDGER') {
        saveBlob(
          buildDwaionBackupLedgerSnapshot(command),
          `dwaion-backup-ledger-${job.deletionJobId}.json`
        );
      } else if (command.downloadAvailable) {
        saveBlob(
          await downloadDwaionPersonalDataCertificate(job.deletionJobId, command.commandId),
          `dwaion-destruction-certificate-${job.deletionJobId}.pdf`
        );
      }
    } catch {
      setEvidenceError(true);
    } finally {
      setEvidenceBusy(null);
    }
  };
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
          {evidenceError ? <Alert severity="warning">{text.evidenceFailed}</Alert> : null}
          {evidenceReceipt ? (
            <Alert severity={evidenceReceipt.state === 'COMPLETED' ? 'success' : 'info'}>
              {text.evidenceReceipt} · {evidenceReceipt.receiptId ?? evidenceReceipt.commandId}
              {evidenceReceipt.state === 'COMPLETED' ? (
                <Typography
                  component="span"
                  data-testid="personal-data-evidence-outcome"
                  sx={{ display: 'block', mt: 0.5 }}
                >
                  {evidenceOutcomeSummary(evidenceReceipt, text)}
                </Typography>
              ) : null}
              {evidenceReceipt.recoveryHint ? ` · ${evidenceReceipt.recoveryHint}` : ''}
            </Alert>
          ) : null}
          <DwaionCapabilityActions
            title={text.evidenceActions}
            description={text.evidenceActionsHelp}
            actions={deletionEvidenceActions(jobs, capabilities, text, {
              canManage,
              busy: evidenceBusy,
              onReceiptIndex: () => void downloadReceiptIndex(),
              onLegalHoldProof: () => void downloadLegalHold(),
              onProviderAction: (action, job) => void executeEvidence(action, job),
              latestJob,
              completedJob,
              legalHoldJob,
            })}
          />
        </Box>
      ) : null}
    </Box>
  );
}

function evidenceOutcomeSummary(
  command: DwaionPersonalDataEvidenceCommand,
  text: (typeof COPY)[keyof typeof COPY]
): string {
  const result = command.result ?? {};
  switch (command.action) {
    case 'BACKUP_LEDGER':
      return `${text.backupLedgerEntries}: ${stringList(result.ledgerEntryIds).length} · ${text.destroyedPartitions}: ${stringList(result.destroyedPartitionIds).length} · ${text.retainedPartitions}: ${stringList(result.retainedPartitionIds).length}`;
    case 'SRE_ESCALATION':
      return `${text.sreCase}: ${String(result.caseId)} · ${String(result.queue)} · ${String(result.severity)}`;
    case 'LEGAL_HOLD_APPEAL':
      return `${text.appeal}: ${String(result.appealId)} · ${text.legalHold}: ${String(result.holdId)}`;
    case 'SIEM_SYNC':
      return `${text.siemReceipt}: ${String(result.syncId)} · ${String(result.destination)} · ${text.acceptedEvents}: ${String(result.acceptedEventCount)}`;
    case 'SIGNED_CERTIFICATE':
      return `${text.signingKey}: ${String(result.signingKeyId)} · ${String(result.signingAlgorithm)}`;
  }
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function deletionEvidenceActions(
  jobs: readonly DwaionDeletionJob[],
  capabilities: DwaionPersonalDataCapabilities | null,
  text: (typeof COPY)[keyof typeof COPY],
  controls: {
    canManage: boolean;
    busy: string | null;
    onReceiptIndex: () => void;
    onLegalHoldProof: () => void;
    onProviderAction: (
      action: DwaionPersonalDataEvidenceAction,
      job: DwaionDeletionJob | undefined
    ) => void;
    latestJob: DwaionDeletionJob | null;
    completedJob: DwaionDeletionJob | undefined;
    legalHoldJob: DwaionDeletionJob | undefined;
  }
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
      reason: capabilities?.backupDestructionLog.available
        ? text.actualEvidence
        : reason(capabilities?.backupDestructionLog ?? null),
      available: Boolean(
        controls.canManage && capabilities?.backupDestructionLog.available && controls.latestJob
      ),
      onClick: () => controls.onProviderAction('BACKUP_LEDGER', controls.latestJob ?? undefined),
    },
    {
      key: 'legal-hold-proof',
      label: text.legalHoldProof,
      capability: 'deletion.legal-hold-evidence',
      reason:
        capabilities?.legalHoldEvidence.available && legalHold
          ? text.actualEvidence
          : reason(capabilities?.legalHoldEvidence ?? null),
      available: Boolean(capabilities?.legalHoldEvidence.available && legalHold),
      onClick: controls.onLegalHoldProof,
    },
    {
      key: 'certificate',
      label: text.pdfCertificate,
      capability: 'browser.print',
      reason: reason(capabilities?.signedCertificate ?? null),
      available: Boolean(
        controls.canManage && capabilities?.signedCertificate.available && completed
      ),
      onClick: () => controls.onProviderAction('SIGNED_CERTIFICATE', controls.completedJob),
    },
    {
      key: 'receipt-index',
      label: text.receiptIndex,
      capability: 'deletion.history',
      reason: text.actualEvidence,
      available: true,
      onClick: controls.onReceiptIndex,
    },
    ...(
      [
        ['sre-support', text.sreSupport, capabilities?.sreSupport],
        ['legal-hold-explanation', text.legalHoldExplanation, capabilities?.legalHoldAppeal],
        ['siem-sync', text.siemSync, capabilities?.siemSync],
      ] as const
    ).map(([key, label, capability]) => {
      const action: DwaionPersonalDataEvidenceAction = {
        'sre-support': 'SRE_ESCALATION',
        'legal-hold-explanation': 'LEGAL_HOLD_APPEAL',
        'siem-sync': 'SIEM_SYNC',
      }[key] as DwaionPersonalDataEvidenceAction;
      const job = action === 'LEGAL_HOLD_APPEAL' ? controls.legalHoldJob : controls.latestJob;
      return {
        key,
        label,
        capability: `deletion.provider.${key}`,
        reason: reason(capability ?? null),
        available: Boolean(
          controls.canManage && capability?.available && capability.configured && job
        ),
        onClick: () => controls.onProviderAction(action, job ?? undefined),
      };
    }),
  ].map((action) => ({
    ...action,
    available: action.available && !controls.busy,
  }));
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

      <Box component="section" aria-label={text.stages} sx={{ mt: 1.25 }}>
        <Typography variant="subtitle2">{text.stages}</Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(5, minmax(0, 1fr))' },
            gap: 0.75,
            mt: 0.75,
          }}
        >
          {(job.stages ?? []).map((stage, index) => (
            <Box
              key={stage.key}
              sx={{ p: 1, border: 1, borderColor: 'divider', borderRadius: 1, minWidth: 0 }}
            >
              <Typography variant="overline" color="text.secondary">
                {index + 1}. {text.stageLabels[stage.key]}
              </Typography>
              <Chip
                size="small"
                color={
                  stage.state === 'COMPLETED'
                    ? 'success'
                    : ['BLOCKED', 'FAILED'].includes(stage.state)
                      ? 'warning'
                      : 'default'
                }
                label={text.stageStates[stage.state]}
                sx={{ mt: 0.25 }}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.5, overflowWrap: 'anywhere' }}
              >
                {stage.detailCode}
                {stage.evidenceReference ? ` · ${stage.evidenceReference}` : ''}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

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
                  <Typography variant="caption">
                    {text.dispositionMethod} {target.disposition.dispositionMethod}
                  </Typography>
                  <Typography variant="caption">
                    {text.dispositionScope} {target.disposition.dispositionScope}
                  </Typography>
                  <Typography variant="caption">
                    {text.backupBoundary} {target.disposition.backupDispositionState}
                  </Typography>
                </Stack>
              ) : null}
              {target.legalHoldEvidence ? (
                <Stack
                  data-testid="dwaion-legal-hold-evidence"
                  gap={0.25}
                  sx={{ mt: 0.75, overflowWrap: 'anywhere' }}
                >
                  <Typography variant="caption" fontWeight="fontWeightBold">
                    {text.legalHoldDetails}
                  </Typography>
                  {target.legalHoldEvidence.available ? (
                    <>
                      <Typography variant="caption">
                        {text.authority} {target.legalHoldEvidence.authorityReference}
                      </Typography>
                      <Typography variant="caption">
                        {text.dpo} {target.legalHoldEvidence.dpoSubjectId}
                      </Typography>
                      <Typography variant="caption">
                        {text.holdReason} {target.legalHoldEvidence.reasonCode}
                      </Typography>
                      <Typography variant="caption">
                        {text.effectiveAt} {formatTimestamp(target.legalHoldEvidence.effectiveAt!)}
                      </Typography>
                      {target.legalHoldEvidence.expiresAt ? (
                        <Typography variant="caption">
                          {text.expiresAt} {formatTimestamp(target.legalHoldEvidence.expiresAt)}
                        </Typography>
                      ) : null}
                    </>
                  ) : (
                    <Typography variant="caption" color="warning.main">
                      {target.legalHoldEvidence.reasonCode} · {text.holdEvidenceUnavailable}
                    </Typography>
                  )}
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
    stages: '삭제 처리 5단계',
    stageLabels: {
      REQUEST_ACCEPTED: '요청 접수',
      TARGETS_SCHEDULED: '대상 예약',
      ACTIVE_STORE_DISPOSITION: '활성 저장소 처분',
      BACKUP_BOUNDARY: '백업 경계',
      RECEIPT_FINALIZATION: '영수증 확정',
    },
    stageStates: {
      PENDING: '대기',
      RUNNING: '진행',
      COMPLETED: '완료',
      PARTIAL: '일부',
      BLOCKED: '차단',
      FAILED: '실패',
      UNAVAILABLE: '제공 안 됨',
    },
    dispositionMethod: '처분 방식',
    dispositionScope: '처분 범위',
    backupBoundary: '백업 상태',
    legalHoldDetails: '법적 보존 근거',
    authority: '권한 참조',
    dpo: 'DPO 담당자',
    holdReason: '보존 사유',
    effectiveAt: '발효',
    expiresAt: '만료',
    holdEvidenceUnavailable: '권한·DPO 세부 증거가 서버에 기록되지 않았습니다.',
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
    downloadUnavailable:
      '검증된 서버 다운로드 API가 없어 파일을 생성하지 않습니다. 화면의 서버 응답 증거를 확인해 주세요.',
    providerUnavailable: '현재 데이터 거버넌스 공급자가 이 작업을 제공하지 않습니다.',
    evidenceFailed: '증적 작업을 완료하지 못했습니다. 공급자 사유와 복구 안내를 확인해 주세요.',
    evidenceReceipt: '증적 처리 영수증',
    backupLedgerEntries: '백업 원장 항목',
    destroyedPartitions: '파기 파티션',
    retainedPartitions: '보존 파티션',
    sreCase: 'SRE 케이스',
    appeal: '이의제기',
    siemReceipt: 'SIEM 동기화',
    acceptedEvents: '수락 이벤트',
    signingKey: '서명 키',
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
    stages: 'Five deletion stages',
    stageLabels: {
      REQUEST_ACCEPTED: 'Request accepted',
      TARGETS_SCHEDULED: 'Targets scheduled',
      ACTIVE_STORE_DISPOSITION: 'Active-store disposition',
      BACKUP_BOUNDARY: 'Backup boundary',
      RECEIPT_FINALIZATION: 'Receipt finalization',
    },
    stageStates: {
      PENDING: 'Pending',
      RUNNING: 'Running',
      COMPLETED: 'Completed',
      PARTIAL: 'Partial',
      BLOCKED: 'Blocked',
      FAILED: 'Failed',
      UNAVAILABLE: 'Unavailable',
    },
    dispositionMethod: 'Method',
    dispositionScope: 'Scope',
    backupBoundary: 'Backup state',
    legalHoldDetails: 'Legal-hold authority',
    authority: 'Authority reference',
    dpo: 'DPO subject',
    holdReason: 'Hold reason',
    effectiveAt: 'Effective',
    expiresAt: 'Expires',
    holdEvidenceUnavailable: 'Authority and DPO details were not recorded by the server.',
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
    downloadUnavailable:
      'No governed server download API is available. Review the server-returned evidence on this page.',
    providerUnavailable: 'The data-governance provider does not expose this operation.',
    evidenceFailed:
      'The evidence action could not be completed. Review its provider recovery guidance.',
    evidenceReceipt: 'Evidence command receipt',
    backupLedgerEntries: 'Backup ledger entries',
    destroyedPartitions: 'Destroyed partitions',
    retainedPartitions: 'Retained partitions',
    sreCase: 'SRE case',
    appeal: 'Appeal',
    siemReceipt: 'SIEM synchronization',
    acceptedEvents: 'Accepted events',
    signingKey: 'Signing key',
  },
} as const;
