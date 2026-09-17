import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { ActionButton, InlineFeedback, foundationTokens } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { DwaionProposal, DwaionProposalHandoff } from '@dwp-frontend/shared-utils';

export function DwaionProposalActionReview({
  proposal,
  handoff,
  idempotencyKey,
  locale,
  busy,
  error,
  onRetry,
  onBack,
  onOpenTarget,
}: {
  proposal: DwaionProposal;
  handoff: DwaionProposalHandoff;
  idempotencyKey: string;
  locale: 'ko' | 'en';
  busy: boolean;
  error: boolean;
  onRetry: () => void;
  onBack: () => void;
  onOpenTarget: () => void;
}) {
  const ko = locale === 'ko';
  const evidence = proposal.content.evidence ?? [];
  const inputs = Object.entries(proposal.content.actionInputs ?? {});
  const completed = handoff.state === 'COMPLETED';
  const failed = ['FAILED', 'CANCELLED'].includes(handoff.state);

  return (
    <Stack gap={2} data-testid="dwaion-proposal-action-review">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        gap={1}
        sx={{ p: 1.25, bgcolor: 'primary.50', borderRadius: 1.5 }}
      >
        <Stack direction="row" alignItems="center" gap={0.75}>
          <LockKeyhole size={17} color="var(--mui-palette-primary-main)" aria-hidden="true" />
          <Typography variant="subtitle2" color="primary.main">
            {ko ? '보안 인계 세션' : 'Governed handoff session'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            · {handoff.handoffId}
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {formatDate(handoff.updatedAt, { dateStyle: 'medium', timeStyle: 'short' }, locale)}
        </Typography>
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
            <ActionButton intent="quiet" onClick={onRetry}>
              {ko ? '다시 시도' : 'Retry'}
            </ActionButton>
          }
        >
          {ko
            ? '인계 상태를 확인하지 못했습니다. 같은 멱등성 키로 안전하게 다시 시도합니다.'
            : 'The handoff state could not be confirmed. Retry safely with the same idempotency key.'}
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
          <Typography component="h1" variant="h5" sx={{ mt: 1.5, overflowWrap: 'anywhere' }}>
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
                  </Box>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Panel>

        <Panel
          title={ko ? '행동 초안 검토' : 'Action draft review'}
          icon={<ShieldCheck size={20} />}
        >
          <Stack direction="row" justifyContent="space-between" gap={1} useFlexGap flexWrap="wrap">
            <Chip color="primary" label={handoff.actionKey} />
            <Chip
              color={failed ? 'error' : completed ? 'success' : 'warning'}
              label={handoff.state}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {ko ? '대상 업무 앱' : 'Target work app'} · {handoff.targetRoute}
          </Typography>
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
              label={ko ? '원 업무 앱 최종 제출 필요' : 'Final submission required in target app'}
              pass={false}
              review
            />
          </Stack>
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
              disabled={busy || failed || completed}
              onClick={onOpenTarget}
              sx={{ minHeight: 50 }}
            >
              {ko ? '원 업무 앱에서 검토 계속' : 'Continue review in work app'}
            </ActionButton>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              textAlign="center"
              sx={{ mt: 0.75 }}
            >
              {ko
                ? '원 업무 앱의 최종 제출 전에는 완료 처리되지 않습니다.'
                : 'Completion is recorded only after final submission in the work app.'}
            </Typography>
            <ActionButton
              intent="quiet"
              fullWidth
              startIcon={<ArrowLeft size={16} />}
              disabled={busy}
              onClick={onBack}
              sx={{ mt: 1 }}
            >
              {ko ? '제안으로 돌아가기' : 'Back to proposal'}
            </ActionButton>
            <Stack
              component="dl"
              gap={0.8}
              sx={{ m: 0, mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}
            >
              <Term label={ko ? '멱등성 키' : 'Idempotency key'} value={idempotencyKey} />
              <Term
                label={ko ? '자동 승인' : 'Auto approval'}
                value={ko ? '허용 안 됨' : 'Disallowed'}
                danger
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
          </Panel>
        </Stack>
      </Box>
    </Stack>
  );
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
