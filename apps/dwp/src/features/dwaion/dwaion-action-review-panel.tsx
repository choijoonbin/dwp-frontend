import { useId, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  FileSearch,
  ShieldCheck,
  X,
} from 'lucide-react';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type { WorkplaceAction, WorkplaceActionPreview } from '@dwp-frontend/shared-utils';

import { actionDestination, actionInputLabel } from './dwaion-catalog-copy';

type Props = {
  action: WorkplaceAction;
  preview: WorkplaceActionPreview;
  language: 'ko' | 'en';
  valid: boolean;
  onCancel: () => void;
  onHandoff: () => void;
};

export function DwaionActionReviewPanel({
  action,
  preview,
  language,
  valid,
  onCancel,
  onHandoff,
}: Props) {
  const titleId = useId();
  const [copied, setCopied] = useState(false);
  const copy = reviewCopy(language);
  const destination = actionDestination(action.actionKey, language);
  const missing = action.inputFields.filter(
    (field) => !hasInputValue(preview.reviewedInputs[field])
  );
  const body = typeof preview.reviewedInputs.body === 'string' ? preview.reviewedInputs.body : '';

  const copyDraft = async () => {
    const draft = action.inputFields
      .map((field) => {
        const value = preview.reviewedInputs[field];
        return hasInputValue(value)
          ? `${actionInputLabel(field, language)}: ${displayInputValue(value, field, language)}`
          : null;
      })
      .filter(Boolean)
      .join('\n\n');
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Box
      component="aside"
      role="complementary"
      aria-labelledby={titleId}
      data-testid="dwaion-action-review"
      sx={{
        minWidth: 0,
        border: 1,
        borderColor: 'divider',
        borderRadius: (theme) => ({
          xs: Number(theme.shape.borderRadius) * 1.5 + 'px',
          lg: Number(theme.shape.borderRadius) * 2 + 'px',
        }),
        bgcolor: 'background.paper',
        boxShadow: (theme) => ({
          xs: 'none',
          lg: `0 8px 28px ${alpha(theme.palette.text.primary, 0.1)}`,
        }),
        overflow: 'hidden',
        position: { lg: 'sticky' },
        top: { lg: 16 },
      }}
    >
      <Box sx={{ p: { xs: 1.5, sm: 1.75, lg: 2 } }}>
        <Stack direction="row" alignItems="flex-start" gap={1}>
          <Box
            aria-hidden="true"
            sx={{
              width: 34,
              height: 34,
              display: 'grid',
              placeItems: 'center',
              borderRadius: (theme) => Number(theme.shape.borderRadius) * 1 + 'px',
              bgcolor: 'primary.lighter',
              color: 'primary.main',
              flex: '0 0 auto',
            }}
          >
            <FileSearch size={18} />
          </Box>
          <Box minWidth={0} flex={1}>
            <Stack direction="row" gap={0.6} useFlexGap flexWrap="wrap" alignItems="center">
              <Chip size="small" color="primary" label={copy.inspector} sx={{ height: 22 }} />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {copy.planId} {preview.plan.auditId}
              </Typography>
            </Stack>
            <Typography id={titleId} component="h2" variant="h5" sx={{ mt: 0.75 }}>
              {actionTitle(action, language)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {copy.targetApp}: {destination.app}
            </Typography>
          </Box>
        </Stack>

        <InlineFeedback severity="info" icon={<ShieldCheck size={18} />} sx={{ mt: 1.25 }}>
          <Typography variant="body2" fontWeight="fontWeightBold">
            {copy.reviewOnly}
          </Typography>
          <Typography variant="caption">{copy.boundary(destination.app)}</Typography>
        </InlineFeedback>
        {!valid && (
          <InlineFeedback severity="error" sx={{ mt: 1.25 }}>
            {copy.invalid}
          </InlineFeedback>
        )}
      </Box>

      <Divider />
      <Box sx={{ p: { xs: 1.5, sm: 1.75, lg: 2 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
            {copy.preflight}
          </Typography>
          <Chip
            size="small"
            color={missing.length ? 'error' : 'success'}
            icon={missing.length ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
            label={missing.length ? copy.missingCount(missing.length) : copy.ready}
          />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.45 }}>
          {copy.preflightDetail}
        </Typography>

        <Stack component="dl" spacing={0.85} sx={{ m: 0, mt: 1.25 }}>
          {action.inputFields.map((field) => {
            const value = preview.reviewedInputs[field];
            const supplied = hasInputValue(value);
            return (
              <Box
                key={field}
                sx={{
                  p: 1,
                  border: 1,
                  borderColor: supplied ? 'divider' : 'error.light',
                  borderRadius: (theme) => Number(theme.shape.borderRadius) * 1 + 'px',
                  bgcolor: supplied ? 'action.hover' : 'error.lighter',
                  minWidth: 0,
                }}
              >
                <Stack component="dt" direction="row" justifyContent="space-between" gap={1}>
                  <Typography variant="caption" fontWeight="fontWeightBold">
                    {actionInputLabel(field, language)}
                  </Typography>
                  <Typography
                    variant="caption"
                    color={supplied ? 'success.main' : 'error.main'}
                    fontWeight="fontWeightBold"
                  >
                    {supplied ? copy.supplied : copy.missing}
                  </Typography>
                </Stack>
                <Typography
                  component="dd"
                  variant="body2"
                  sx={{
                    m: 0,
                    mt: 0.55,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    color: supplied ? 'text.primary' : 'error.main',
                    maxHeight: field === 'body' ? 176 : 'none',
                    overflowY: field === 'body' ? 'auto' : 'visible',
                  }}
                >
                  {supplied
                    ? displayInputValue(value, field, language)
                    : copy.enterInApp(destination.app)}
                </Typography>
              </Box>
            );
          })}
        </Stack>

        <Box
          sx={{
            mt: 1.25,
            p: 1.2,
            borderRadius: (theme) => Number(theme.shape.borderRadius) * 1 + 'px',
            bgcolor: 'primary.lighter',
          }}
        >
          <Stack direction="row" justifyContent="space-between" gap={1}>
            <Typography component="h4" variant="caption" fontWeight="fontWeightBold">
              {copy.provenance}
            </Typography>
            {body && (
              <Typography variant="caption" color="text.secondary">
                {copy.characterCount(body.length)}
              </Typography>
            )}
          </Stack>
          {preview.plan.sourceReferences.length ? (
            <Stack direction="row" gap={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }}>
              {preview.plan.sourceReferences.map((source) => (
                <Chip
                  key={source}
                  size="small"
                  label={source}
                  sx={{ maxWidth: '100%', '& .MuiChip-label': { overflowWrap: 'anywhere' } }}
                />
              ))}
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.6 }}>
              {copy.noSources}
            </Typography>
          )}
        </Box>

        <Box
          sx={{
            mt: 1.25,
            p: 1.2,
            borderRadius: (theme) => Number(theme.shape.borderRadius) * 1 + 'px',
            bgcolor: 'action.hover',
          }}
        >
          <Typography component="h4" variant="caption" fontWeight="fontWeightBold">
            {copy.plan}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.35 }}>
            {preview.plan.summary}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.45 }}>
            {copy.stepCount(preview.plan.steps.length)}
          </Typography>
          <Stack component="ol" gap={0.55} sx={{ p: 0, m: 0, mt: 0.9, listStyle: 'none' }}>
            {preview.plan.steps.map((step, index) => (
              <Box
                component="li"
                key={step.id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '22px minmax(0, 1fr)',
                  gap: 0.75,
                  p: 0.75,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: (theme) => Number(theme.shape.borderRadius) * 0.75 + 'px',
                  bgcolor: 'background.paper',
                }}
              >
                <Box
                  aria-hidden="true"
                  sx={{
                    width: 20,
                    height: 20,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    fontSize: 'overline.fontSize',
                    fontWeight: 'fontWeightBold',
                  }}
                >
                  {index + 1}
                </Box>
                <Box minWidth={0}>
                  <Typography
                    variant="caption"
                    fontWeight="fontWeightBold"
                    sx={{ display: 'block' }}
                  >
                    {step.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.15, overflowWrap: 'anywhere' }}
                  >
                    {step.description}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>

      <Divider />
      <Stack
        direction={{ xs: 'column', sm: 'row', lg: 'column' }}
        gap={0.75}
        sx={{
          p: 1.25,
          bgcolor: 'background.paper',
          position: { xs: 'sticky', lg: 'static' },
          bottom: 0,
          zIndex: 2,
        }}
      >
        <ActionButton
          intent="primary"
          endIcon={<ExternalLink size={16} />}
          disabled={!valid}
          onClick={onHandoff}
          sx={{ minHeight: 48, whiteSpace: 'normal', order: { sm: 3, lg: 0 }, flex: 1 }}
        >
          {copy.open(destination.app)}
        </ActionButton>
        <Stack direction="row" gap={0.75} sx={{ flex: 1 }}>
          <ActionButton
            intent="secondary"
            startIcon={<ClipboardCopy size={16} />}
            disabled={!body}
            onClick={() => void copyDraft()}
            sx={{ minHeight: 44, flex: 1 }}
          >
            {copied ? copy.copied : copy.copy}
          </ActionButton>
          <ActionButton
            intent="quiet"
            startIcon={<X size={16} />}
            onClick={onCancel}
            sx={{ minHeight: 44, flex: 1 }}
          >
            {copy.cancel}
          </ActionButton>
        </Stack>
      </Stack>
    </Box>
  );
}

function hasInputValue(value: unknown): boolean {
  if (typeof value === 'string') return Boolean(value.trim());
  return Array.isArray(value) && value.some((item) => typeof item === 'string' && item.trim());
}

function displayInputValue(value: unknown, field: string, language: 'ko' | 'en'): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value !== 'string') return '';
  if (field === 'startsAt' || field === 'endsAt') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime()))
      return formatDate(
        date,
        { dateStyle: 'medium', timeStyle: 'short' },
        resolveSupportedLocale(language)
      );
  }
  return value;
}

function actionTitle(action: WorkplaceAction, language: 'ko' | 'en'): string {
  const labels: Record<WorkplaceAction['actionKey'], [string, string]> = {
    'CALENDAR.EVENT.CREATE': ['일정 계획 검토', 'Calendar plan review'],
    'MAIL.DRAFT.CREATE': ['메일 초안 검토', 'Email draft review'],
    'SERVICE.REQUEST.CREATE': ['서비스 요청 검토', 'Service request review'],
    'APPROVAL.REQUEST.CREATE': ['결재 요청 검토', 'Approval request review'],
  };
  return labels[action.actionKey][language === 'ko' ? 0 : 1];
}

function reviewCopy(language: 'ko' | 'en') {
  if (language === 'ko') {
    return {
      inspector: '상세 인스펙터',
      planId: '계획 ID',
      targetApp: '담당 앱',
      reviewOnly: '서버 미리보기는 REVIEW 모드입니다.',
      boundary: (app: string) =>
        `DWAI·ON은 변경하지 않습니다. 저장·발송·제출은 ${app}에서 다시 확인합니다.`,
      invalid: '서버 미리보기의 행동, 출처 또는 담당 앱이 원 요청과 달라 이동을 중단했습니다.',
      preflight: '사전 점검 체크리스트',
      preflightDetail: '담당 앱으로 전달될 실제 값과 비어 있는 필드를 확인하세요.',
      missingCount: (count: number) => `${count}개 입력 필요`,
      ready: '입력 확인됨',
      supplied: '전달 예정',
      missing: '미지정 · 필수',
      enterInApp: (app: string) => `${app}에서 직접 입력하고 확인해야 합니다.`,
      provenance: '생성 근거',
      noSources: '서버 계획에 연결된 출처 식별자가 없습니다.',
      characterCount: (count: number) => `${count}자`,
      plan: '검증된 실행 계획',
      stepCount: (count: number) => `${count}단계 · mutationAllowed=false`,
      open: (app: string) => `${app}에서 열기 및 최종 확인`,
      copy: '초안 복사',
      copied: '복사됨',
      cancel: '검토 취소',
    };
  }
  return {
    inspector: 'Detail inspector',
    planId: 'Plan ID',
    targetApp: 'Responsible app',
    reviewOnly: 'The server preview is in REVIEW mode.',
    boundary: (app: string) =>
      `DWAI·ON does not change data. Review save, send, or submit again in ${app}.`,
    invalid:
      'The action, source, or destination differs from the source request, so handoff stopped.',
    preflight: 'Preflight checklist',
    preflightDetail: 'Review actual values and empty fields before handoff.',
    missingCount: (count: number) => `${count} ${count === 1 ? 'input' : 'inputs'} required`,
    ready: 'Inputs reviewed',
    supplied: 'Will transfer',
    missing: 'Missing · required',
    enterInApp: (app: string) => `Enter and verify this value in ${app}.`,
    provenance: 'Grounding provenance',
    noSources: 'The server plan has no attached source identifiers.',
    characterCount: (count: number) => `${count} characters`,
    plan: 'Verified execution plan',
    stepCount: (count: number) => `${count} steps · mutationAllowed=false`,
    open: (app: string) => `Open and confirm in ${app}`,
    copy: 'Copy draft',
    copied: 'Copied',
    cancel: 'Cancel review',
  };
}
