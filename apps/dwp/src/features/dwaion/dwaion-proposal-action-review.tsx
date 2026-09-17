import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Save,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { ActionButton, InlineFeedback, foundationTokens } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  DwaionProposal,
  DwaionProposalHandoff,
  DwaionProposalHandoffDraft,
} from '@dwp-frontend/shared-utils';

export function DwaionProposalActionReview({
  proposal,
  handoff,
  draft,
  idempotencyKey,
  locale,
  busy,
  error,
  draftLoading,
  draftError,
  onRetry,
  onRetryDraft,
  onSaveDraft,
  onBack,
  onOpenTarget,
}: {
  proposal: DwaionProposal;
  handoff: DwaionProposalHandoff;
  draft: DwaionProposalHandoffDraft | null;
  idempotencyKey: string;
  locale: 'ko' | 'en';
  busy: boolean;
  error: boolean;
  draftLoading: boolean;
  draftError: boolean;
  onRetry: () => void;
  onRetryDraft: () => void;
  onSaveDraft: () => void;
  onBack: () => void;
  onOpenTarget: () => void;
}) {
  const ko = locale === 'ko';
  const evidence = proposal.content.evidence ?? [];
  const inputs = Object.entries(proposal.content.actionInputs ?? {});
  const completed = handoff.state === 'COMPLETED';
  const failed = ['FAILED', 'CANCELLED'].includes(handoff.state);
  const ownerCompletionSupported = [
    'CALENDAR.EVENT.CREATE',
    'MAIL.DRAFT.CREATE',
    'SERVICE.REQUEST.CREATE',
    'APPROVAL.REQUEST.CREATE',
  ].includes(handoff.actionKey);
  const immutableBinding =
    handoff.proposalId === proposal.proposalId && handoff.actionKey === proposal.actionKey;

  return (
    <Stack gap={2} data-testid="dwaion-proposal-action-review">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        gap={1}
        sx={{ p: 1.25, bgcolor: 'primary.50', borderRadius: 1.5 }}
      >
        <Stack gap={0.6}>
          <Stack direction="row" alignItems="center" gap={0.75} useFlexGap flexWrap="wrap">
            <LockKeyhole size={17} color="var(--mui-palette-primary-main)" aria-hidden="true" />
            <Typography component="h1" variant="subtitle2" color="primary.main">
              {ko ? '제안 수락 기반 행동 검토' : 'Proposal-to-governed action review'}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              label={`LAUNCH · ${shortIdentifier(handoff.handoffId)}`}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {ko
              ? '원본 제안과 행동 초안을 같은 인계 ID·revision·멱등성 키로 결속합니다.'
              : 'The source proposal and action draft are bound to one handoff ID, revision, and idempotency key.'}
          </Typography>
        </Stack>
        <Stack alignItems={{ xs: 'flex-start', sm: 'flex-end' }} gap={0.4}>
          <Typography variant="caption" color="text.secondary">
            {ko ? '최신 상태' : 'Freshness'} ·{' '}
            {formatDate(handoff.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }, locale)}
          </Typography>
          <Typography variant="caption" color={immutableBinding ? 'success.main' : 'error.main'}>
            {immutableBinding
              ? ko
                ? `불변 결속 확인 · proposal v${proposal.revision}`
                : `Immutable binding confirmed · proposal v${proposal.revision}`
              : ko
                ? '원본과 인계 결속 불일치'
                : 'Source-to-handoff binding mismatch'}
          </Typography>
        </Stack>
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        gap={1}
        sx={{
          p: 1.25,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1.5,
        }}
      >
        <StatusFact
          icon={<Fingerprint size={16} />}
          label={ko ? '응답 계약' : 'Response contract'}
          value={ko ? '스키마 검증 완료' : 'Schema validated'}
          tone="success"
        />
        <StatusFact
          icon={<LockKeyhole size={16} />}
          label={ko ? '전송 채널 증명' : 'Transport proof'}
          value={ko ? '응답에 미제공' : 'Not supplied in response'}
          tone="warning"
        />
        <StatusFact
          icon={<Clock3 size={16} />}
          label={ko ? '제안 수락 시각' : 'Accepted at'}
          value={formatDate(
            proposal.decidedAt ?? handoff.createdAt,
            { dateStyle: 'medium', timeStyle: 'short' },
            locale
          )}
        />
      </Stack>

      <InlineFeedback
        severity="info"
        title={ko ? '행동 전 거버넌스 알림' : 'Governance before action'}
      >
        {ko
          ? '제안 수락은 행동 검토 단계입니다. 원 업무 앱에서 내용을 다시 검토하고 제출해야 실제 업무가 완료됩니다.'
          : 'Accepting a proposal begins review. The original work app requires a final review and submission before the work is complete.'}
      </InlineFeedback>
      {error ? (
        <InlineFeedback
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={onRetry} sx={{ minHeight: 44 }}>
              {ko ? '다시 시도' : 'Retry'}
            </ActionButton>
          }
        >
          {ko
            ? '인계 상태를 확인하지 못했습니다. 같은 멱등성 키로 안전하게 다시 시도합니다.'
            : 'The handoff state could not be confirmed. Retry safely with the same idempotency key.'}
        </InlineFeedback>
      ) : null}
      {!ownerCompletionSupported ? (
        <InlineFeedback severity="warning" data-testid="dwaion-owner-callback-unavailable">
          {ko
            ? '이 작업 유형은 원 업무 시스템의 완료 콜백이 아직 연결되지 않아 실행할 수 없습니다. 실제 완료 영수증을 회수할 수 있는 전자결재 요청만 현재 지원합니다.'
            : 'This action cannot run because its owning work system has no completion callback. Approval request creation is the only proposal action currently able to return a verified completion receipt.'}
        </InlineFeedback>
      ) : null}

      <Box
        data-testid="dwaion-proposal-action-grid"
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: 'minmax(260px, .8fr) minmax(0, 1.25fr) minmax(280px, .85fr)',
          },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Panel
          title={ko ? '원본 제안 및 근거' : 'Proposal and evidence'}
          icon={<FileCheck2 size={20} />}
        >
          <Stack direction="row" gap={0.65} useFlexGap flexWrap="wrap">
            <Chip size="small" label={`v${proposal.revision}`} />
            <Chip size="small" color="primary" label={proposal.actionKey ?? 'REVIEW_ONLY'} />
            <Chip
              size="small"
              color={
                proposal.priority === 'URGENT' || proposal.priority === 'HIGH'
                  ? 'warning'
                  : 'default'
              }
              label={proposal.priority}
            />
          </Stack>
          <Typography component="h2" variant="h5" sx={{ mt: 1.5, overflowWrap: 'anywhere' }}>
            {proposal.content.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {proposal.content.summary}
          </Typography>
          <Box sx={{ mt: 1.5, p: 1.25, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="caption" fontWeight="fontWeightBold" color="text.secondary">
              {ko ? '발화 사유' : 'Trigger rationale'}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.45 }}>
              {proposal.content.rationale}
            </Typography>
          </Box>
          <Typography component="h2" variant="subtitle2" sx={{ mt: 2 }}>
            {ko ? `증거 및 타당성 근거 (${evidence.length})` : `Evidence (${evidence.length})`}
          </Typography>
          <Stack gap={0.75} sx={{ mt: 1 }}>
            {evidence.map((item) => (
              <Box
                key={`${item.sourceType}:${item.referenceId}`}
                sx={{ p: 1, bgcolor: 'primary.50', borderRadius: 1 }}
              >
                <Stack direction="row" gap={0.75} alignItems="flex-start">
                  <CheckCircle2
                    size={16}
                    color="var(--mui-palette-success-main)"
                    aria-hidden="true"
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight="fontWeightBold">
                      {item.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.sourceType} · {item.referenceId}
                    </Typography>
                    {item.occurredAt ? (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {ko ? '근거 발생' : 'Occurred'} ·{' '}
                        {formatDate(
                          item.occurredAt,
                          { dateStyle: 'medium', timeStyle: 'short' },
                          locale
                        )}
                      </Typography>
                    ) : null}
                    {item.route ? (
                      <Typography
                        variant="caption"
                        color="primary.main"
                        display="block"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {ko ? '원문 경로' : 'Source route'} · {item.route}
                      </Typography>
                    ) : null}
                  </Box>
                </Stack>
              </Box>
            ))}
          </Stack>
          <Box sx={{ mt: 1.25, p: 1.25, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Stack direction="row" alignItems="center" gap={0.75}>
              <Activity size={17} aria-hidden="true" />
              <Typography variant="subtitle2">
                {ko ? '원본 지표 추이' : 'Source metric trend'}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {ko
                ? '제안 계약에는 요약·근거 식별자만 포함되며 시계열 지표는 포함되지 않습니다. 원본 경로에서 최신 수치와 임계선을 재검증합니다.'
                : 'The proposal contract contains summaries and evidence identifiers, but no metric time series. Revalidate current values and thresholds at the source route.'}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              label={ko ? '시계열 데이터 미제공' : 'Metric series unavailable'}
              sx={{ mt: 1 }}
            />
          </Box>
          <InlineFeedback severity="info" sx={{ mt: 1.25 }}>
            {ko
              ? '근거 식별자와 원문 경로는 표시되지만, 첨부 파일의 별도 검사 결과는 이 제안 계약에 포함되지 않습니다. 첨부 검증은 원 업무 앱에서 다시 확인됩니다.'
              : 'Evidence identifiers and source routes are shown. Separate attachment inspection results are not included in this proposal contract and are rechecked in the target app.'}
          </InlineFeedback>
        </Panel>

        <Panel
          title={ko ? '행동 초안 검토' : 'Action draft review'}
          icon={<ShieldCheck size={20} />}
        >
          <Stack direction="row" justifyContent="space-between" gap={1} useFlexGap flexWrap="wrap">
            <Chip color="primary" label={handoff.actionKey} />
            <Chip variant="outlined" label={`${proposal.priority} RISK`} />
            <Chip
              color={failed ? 'error' : completed ? 'success' : 'warning'}
              label={handoff.state}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {ko ? '대상 업무 앱' : 'Target work app'} · {handoff.targetRoute}
          </Typography>
          <Typography component="h3" variant="subtitle2" sx={{ mt: 2 }}>
            {ko ? '실행 전후 영향 대조' : 'Impact diff preview'}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 1,
              mt: 1,
            }}
          >
            <Box sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" fontWeight="fontWeightBold" color="text.secondary">
                {ko ? 'BEFORE · 현재 원본 상태' : 'BEFORE · Current target state'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {ko
                  ? '현재값 조회 계약이 없어 이 화면에서 계산하지 않습니다. 원 업무 앱 진입 시 최신 권한과 원본 상태를 다시 확인합니다.'
                  : 'This contract does not expose current target values. The work app reloads the source and permissions before submission.'}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                color="warning"
                label={ko ? '원 업무 앱 재검증 필요' : 'Target revalidation required'}
                sx={{ mt: 1 }}
              />
            </Box>
            <Box sx={{ p: 1.25, bgcolor: 'primary.50', borderRadius: 1 }}>
              <Typography variant="caption" fontWeight="fontWeightBold" color="primary.main">
                {ko ? 'AFTER · 제안된 초안' : 'AFTER · Proposed draft'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {inputs.length
                  ? ko
                    ? `${inputs.length}개 입력값이 원본 제안 revision ${proposal.revision}에 결속되었습니다.`
                    : `${inputs.length} inputs are bound to proposal revision ${proposal.revision}.`
                  : ko
                    ? '제안된 추가 입력값이 없습니다.'
                    : 'No proposed input values are present.'}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                color="primary"
                label={ko ? '제출 전 검토 전용' : 'Review before submit'}
                sx={{ mt: 1 }}
              />
            </Box>
          </Box>
          <Typography component="h3" variant="subtitle2" sx={{ mt: 2 }}>
            {ko ? '검토된 파라미터' : 'Reviewed parameters'}
          </Typography>
          {inputs.length ? (
            <Stack component="dl" gap={0.75} sx={{ m: 0, mt: 1 }}>
              {inputs.map(([key, value]) => (
                <Box
                  key={key}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'minmax(130px, .45fr) minmax(0, 1fr)' },
                    gap: 0.75,
                    p: 1,
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                  }}
                >
                  <Typography component="dt" variant="caption" color="text.secondary">
                    {key}
                  </Typography>
                  <Typography
                    component="dd"
                    variant="body2"
                    sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    {displayValue(value)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {ko ? '추가 입력값이 없는 검토 요청입니다.' : 'This review has no additional inputs.'}
            </Typography>
          )}
          <Typography component="h3" variant="subtitle2" sx={{ mt: 2 }}>
            {ko ? 'Preflight 검증 상태' : 'Preflight checks'}
          </Typography>
          <Stack gap={0.75} sx={{ mt: 1 }}>
            <Check label={ko ? '사용자 검토 완료' : 'User review completed'} pass />
            <Check
              label={ko ? '원본 제안과 action key 결속' : 'Proposal and action key bound'}
              pass={handoff.actionKey === proposal.actionKey}
            />
            <Check
              label={
                ko
                  ? `승인 필요 계약 · ${handoff.approvalRequired ? '필수' : '요구되지 않음'}`
                  : `Approval contract · ${handoff.approvalRequired ? 'required' : 'not required'}`
              }
              pass={handoff.approvalRequired}
              review={!handoff.approvalRequired}
            />
            <Check
              label={ko ? '원 업무 앱 최종 제출 필요' : 'Final submission required in target app'}
              pass={false}
              review
            />
          </Stack>
          <Box sx={{ mt: 1.5, p: 1.25, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="subtitle2">
              {ko ? '필수 증빙·첨부 검증' : 'Required evidence and attachment validation'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.65 }}>
              {ko
                ? '제안 인계 응답은 첨부 파일·용량·검사 결과를 제공하지 않습니다. 전자결재 원본 편집기에서 필수 증빙과 최신 검사 상태를 확인합니다.'
                : 'The proposal handoff response does not expose attachment names, sizes, or inspection results. Verify required evidence and its latest scan state in the original approval editor.'}
            </Typography>
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              label={ko ? '원본 앱 재검증 필요' : 'Target-app verification required'}
              sx={{ mt: 1 }}
            />
          </Box>
          {failed ? (
            <InlineFeedback severity="error" sx={{ mt: 1.5 }}>
              {ko
                ? '인계가 실패했습니다. 감사 원장은 성공으로 기록되지 않았습니다.'
                : 'Handoff failed. The audit ledger has not recorded success.'}
            </InlineFeedback>
          ) : null}
        </Panel>

        <Stack gap={2} sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
          <Panel
            title={ko ? '인계 및 거버넌스 통제' : 'Handoff controls'}
            icon={<KeyRound size={20} />}
          >
            <ActionButton
              intent="primary"
              fullWidth
              endIcon={<ArrowRight size={17} />}
              disabled={busy || failed || completed || !ownerCompletionSupported}
              onClick={onOpenTarget}
              sx={{ minHeight: 50 }}
            >
              {handoffButtonLabel(proposal.actionKey, ko)}
            </ActionButton>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              textAlign="center"
              sx={{ mt: 0.75 }}
            >
              {ownerCompletionSupported
                ? ko
                  ? '원 업무 앱의 최종 제출 전에는 완료 처리되지 않습니다.'
                  : 'Completion is recorded only after final submission in the work app.'
                : ko
                  ? '완료 콜백 계약이 연결될 때까지 실행이 잠겨 있습니다.'
                  : 'Execution remains locked until an owner completion callback is installed.'}
            </Typography>
            <ActionButton
              intent="secondary"
              fullWidth
              startIcon={<Save size={16} />}
              disabled={busy || draftLoading || failed || completed}
              onClick={onSaveDraft}
              sx={{ mt: 1, minHeight: 44 }}
            >
              {draft
                ? ko
                  ? '서버 초안 갱신'
                  : 'Update server draft'
                : ko
                  ? '서버에 초안 보관'
                  : 'Save draft to server'}
            </ActionButton>
            {draft ? (
              <Typography
                role="status"
                variant="caption"
                color="success.main"
                display="block"
                sx={{ mt: 0.75 }}
              >
                {[
                  ko ? '암호화된 서버 초안 저장' : 'Encrypted server draft saved',
                  `v${draft.revision}`,
                  formatDate(draft.savedAt, { dateStyle: 'medium', timeStyle: 'short' }, locale),
                  `SHA-256 ${shortIdentifier(draft.contentSha256)}`,
                ].join(' · ')}
              </Typography>
            ) : null}
            {draftLoading ? (
              <Typography
                role="status"
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ mt: 0.75 }}
              >
                {ko ? '서버 초안 확인 중…' : 'Checking the server draft…'}
              </Typography>
            ) : null}
            {draftError ? (
              <InlineFeedback
                severity="warning"
                sx={{ mt: 1 }}
                action={
                  <ActionButton intent="quiet" onClick={onRetryDraft} sx={{ minHeight: 44 }}>
                    {ko ? '상태 다시 확인' : 'Check again'}
                  </ActionButton>
                }
              >
                {ko
                  ? '서버가 초안 저장을 확인하지 못했습니다. 성공으로 표시하지 않았으며 같은 명령 ID로 안전하게 다시 저장할 수 있습니다.'
                  : 'The server did not confirm the draft save. It was not marked successful and can be retried safely with the same command ID.'}
              </InlineFeedback>
            ) : null}
            <ActionButton
              intent="quiet"
              fullWidth
              startIcon={<ArrowLeft size={16} />}
              disabled={busy}
              onClick={onBack}
              sx={{ mt: 1, minHeight: 44 }}
            >
              {ko ? '제안으로 돌아가기' : 'Back to proposal'}
            </ActionButton>
            <Stack
              component="dl"
              gap={0.8}
              sx={{ m: 0, mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}
            >
              <Term label={ko ? '멱등성 키' : 'Idempotency key'} value={idempotencyKey} />
              <Term label={ko ? '인계 버전' : 'Handoff version'} value={`v${handoff.version}`} />
              <Term
                label={ko ? '승인 필요' : 'Approval required'}
                value={handoff.approvalRequired ? (ko ? '필수' : 'Required') : ko ? '아니요' : 'No'}
              />
              <Term
                label={ko ? '자동 승인' : 'Auto approval'}
                value={ko ? '허용 안 됨' : 'Disallowed'}
                danger
              />
              <Term
                label={ko ? '적용 정책 ID' : 'Applied policy ID'}
                value={ko ? '응답에 미제공' : 'Not supplied'}
              />
              <Term
                label={ko ? '인계 토큰 만료' : 'Handoff token expiry'}
                value={ko ? '응답에 미제공' : 'Not supplied'}
              />
              <Term label={ko ? '현재 상태' : 'Current state'} value={handoff.state} />
            </Stack>
          </Panel>
          <Panel title={ko ? '감사 추적 영수증' : 'Audit receipt'} icon={<ShieldCheck size={20} />}>
            {handoff.receiptId ? (
              <>
                <Typography variant="body2" color="success.main" fontWeight="fontWeightBold">
                  {handoff.receiptId}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {ko
                    ? '실제 도메인 완료가 확인된 영수증입니다.'
                    : 'This receipt confirms actual domain completion.'}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  sx={{ mt: 0.5 }}
                >
                  {ko ? '확인 시각' : 'Confirmed'} ·{' '}
                  {formatDate(
                    handoff.updatedAt,
                    { dateStyle: 'medium', timeStyle: 'short' },
                    locale
                  )}
                </Typography>
              </>
            ) : (
              <Stack direction="row" gap={0.75} alignItems="flex-start">
                <TriangleAlert size={17} color="var(--mui-palette-warning-main)" />
                <Typography variant="body2" color="text.secondary">
                  {ko
                    ? '최종 영수증 대기 중입니다. 인계 생성만으로 업무 완료를 표시하지 않습니다.'
                    : 'Final receipt pending. Creating a handoff does not mark the work complete.'}
                </Typography>
              </Stack>
            )}
            <Box sx={{ mt: 1.25, pt: 1.25, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary" display="block">
                {ko ? '인계 생성' : 'Handoff created'} ·{' '}
                {formatDate(handoff.createdAt, { dateStyle: 'medium', timeStyle: 'short' }, locale)}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {ko ? '마지막 상태 확인' : 'Last state check'} ·{' '}
                {formatDate(handoff.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }, locale)}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                {ko
                  ? '별도 감사 이벤트 상세는 이 응답에 포함되지 않습니다. receipt ID와 원 업무 기록으로 조회합니다.'
                  : 'Detailed audit events are not included in this response. Use the receipt ID and target work record for audit lookup.'}
              </Typography>
            </Box>
          </Panel>
          <Panel
            title={ko ? 'DWAI·ON 계약 아키텍처 상태' : 'DWAI·ON contract architecture'}
            icon={<Fingerprint size={20} />}
          >
            <Stack component="dl" gap={0.9} sx={{ m: 0 }}>
              <Term
                label={ko ? '제안 결속' : 'Proposal binding'}
                value={immutableBinding ? 'VERIFIED' : 'MISMATCH'}
                danger={!immutableBinding}
              />
              <Term label={ko ? '인계 상태 해석' : 'Handoff resolver'} value={handoff.state} />
              <Term
                label={ko ? '완료 권위' : 'Completion authority'}
                value={ko ? '원 업무 앱' : 'Owning work app'}
              />
              <Term
                label={ko ? '수령증 상태' : 'Receipt status'}
                value={handoff.receiptId ? 'CONFIRMED' : 'PENDING'}
              />
            </Stack>
          </Panel>
        </Stack>
      </Box>
    </Stack>
  );
}

function shortIdentifier(value: string) {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function StatusFact({
  icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning';
}) {
  const color =
    tone === 'success' ? 'success.main' : tone === 'warning' ? 'warning.main' : 'text.primary';
  return (
    <Stack direction="row" alignItems="center" gap={0.75} sx={{ flex: 1, minWidth: 0 }}>
      <Box sx={{ color, display: 'flex' }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
        <Typography
          variant="body2"
          color={color}
          fontWeight="fontWeightBold"
          sx={{ overflowWrap: 'anywhere' }}
        >
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}

function handoffButtonLabel(actionKey: string | null | undefined, ko: boolean) {
  if (actionKey?.startsWith('APPROVAL.')) {
    return ko ? '전자결재 원본 검토로 인계' : 'Continue in the original approval review';
  }
  return ko ? '원 업무 앱에서 검토 계속' : 'Continue review in work app';
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box
      component="section"
      sx={{
        p: { xs: 1.5, sm: 2 },
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.surface + 'px',
        minWidth: 0,
      }}
    >
      <Stack direction="row" gap={0.75} alignItems="center" sx={{ mb: 1.5, color: 'primary.main' }}>
        {icon}
        <Typography component="h2" variant="h6" color="text.primary">
          {title}
        </Typography>
      </Stack>
      {children}
    </Box>
  );
}

function Check({
  label,
  pass,
  review = false,
}: {
  label: string;
  pass: boolean;
  review?: boolean;
}) {
  return (
    <Stack
      direction="row"
      gap={0.75}
      alignItems="center"
      sx={{
        p: 1,
        bgcolor: pass ? 'success.50' : review ? 'warning.50' : 'error.50',
        borderRadius: 1,
      }}
    >
      {pass ? (
        <CheckCircle2 size={17} color="var(--mui-palette-success-main)" />
      ) : (
        <TriangleAlert size={17} color="var(--mui-palette-warning-main)" />
      )}
      <Typography variant="body2">{label}</Typography>
      <Typography
        variant="caption"
        fontWeight="fontWeightBold"
        color={pass ? 'success.main' : 'warning.main'}
        sx={{ ml: 'auto' }}
      >
        {pass ? 'PASS' : 'REVIEW_REQ'}
      </Typography>
    </Stack>
  );
}

function Term({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <Stack direction="row" justifyContent="space-between" gap={1}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="dd"
        variant="caption"
        color={danger ? 'error.main' : 'text.primary'}
        fontWeight="fontWeightBold"
        sx={{ m: 0, overflowWrap: 'anywhere', textAlign: 'right' }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

function displayValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(String).join(', ');
  return JSON.stringify(value) ?? String(value);
}
