import { useTranslation } from 'react-i18next';
import { CheckCircle2, History, KeyRound, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { ActionButton, EmptyState, ErrorState, InlineFeedback } from '@dwp-frontend/design-system';
import {
  formatDate,
  resolveSupportedLocale,
  useDisplayDictionary,
} from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';

import { ApprovalPolicyComparison } from './approval-policy-comparison';
import { ApprovalPolicySection } from './approval-policy-presentation';
import { StatusChip } from './approval-ui';

import type { ReactNode } from 'react';
import type { ApprovalPolicy, ApprovalPolicyVersion } from '@dwp-frontend/shared-utils';

export function ApprovalPolicyListItem({
  policy,
  selected,
  locale,
  onSelect,
}: {
  policy: ApprovalPolicy;
  selected: boolean;
  locale?: string;
  onSelect: () => void;
}) {
  const { t, i18n } = useTranslation('approvals');
  const display = useDisplayDictionary();
  const korean = resolveSupportedLocale(locale, i18n.resolvedLanguage, i18n.language) === 'ko';
  return (
    <Box component="li">
      <ButtonBase
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        sx={(theme) => ({
          width: 1,
          minHeight: 96,
          p: 1.5,
          display: 'block',
          textAlign: 'left',
          borderBottom: 1,
          borderColor: 'divider',
          borderInlineStart: 3,
          borderInlineStartColor: selected ? 'primary.main' : 'transparent',
          bgcolor: selected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
          '&:hover': { bgcolor: 'action.hover' },
          '&.Mui-focusVisible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: -2,
          },
          '@media (forced-colors: active)': {
            borderInlineStartColor: selected ? 'Highlight' : 'Canvas',
            '&.Mui-focusVisible': { outlineColor: 'Highlight' },
          },
        })}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Chip
            size="small"
            variant="outlined"
            color={
              policy.severity === 'CRITICAL' || policy.severity === 'HIGH' ? 'error' : 'default'
            }
            label={display('severities', policy.severity)}
          />
          <StatusChip status={policy.pendingReview ? 'ATTENTION' : policy.lifecycleState} />
        </Stack>
        <Box
          sx={{
            mt: 1,
            typography: 'body2',
            fontWeight: 'fontWeightBold',
            overflowWrap: 'anywhere',
          }}
        >
          {korean ? policy.nameKo : policy.nameEn}
        </Box>
        <Box
          sx={{ mt: 0.5, typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}
        >
          {policy.policyKey}
        </Box>
        <Box sx={{ mt: 0.5, typography: 'caption', color: 'text.secondary' }}>
          {t(`admin.studio.policyTypes.${policy.policyType}`, { defaultValue: policy.policyType })}
        </Box>
      </ButtonBase>
    </Box>
  );
}

export function ApprovalPolicyDetail({
  policy,
  publishedVersionLabel,
  locale,
}: {
  policy: ApprovalPolicy;
  publishedVersionLabel: string;
  locale?: string;
}) {
  const { t, i18n } = useTranslation('approvals');
  const korean = resolveSupportedLocale(locale, i18n.resolvedLanguage, i18n.language) === 'ko';
  return (
    <Stack gap={2} minWidth={0}>
      <Box component="header" sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <Box sx={{ typography: 'caption', color: 'primary.main' }}>
            {t(`admin.studio.policyTypes.${policy.policyType}`, {
              defaultValue: policy.policyType,
            })}
          </Box>
          <StatusChip status={policy.lifecycleState} />
        </Stack>
        <Box component="h2" sx={{ m: 0, mt: 1, typography: 'h5', overflowWrap: 'anywhere' }}>
          {korean ? policy.nameKo : policy.nameEn}
        </Box>
        <Box
          sx={{ mt: 1, typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}
        >
          {policy.policyKey}
        </Box>
      </Box>
      <ApprovalPolicySection
        title={t(policy.pendingReview ? 'admin.studio.pendingTitle' : 'admin.studio.ruleTitle')}
        meta={t(policy.pendingReview ? 'admin.studio.pendingMeta' : 'admin.studio.ruleMeta')}
      >
        <ApprovalPolicyComparison policy={policy} publishedVersionLabel={publishedVersionLabel} />
      </ApprovalPolicySection>
      {policy.pendingReview && policy.pendingChangeReason ? (
        <ApprovalPolicySection title={t('admin.studio.changeReason')}>
          <Box
            sx={{ py: 1.5, typography: 'body2', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
          >
            {policy.pendingChangeReason}
          </Box>
        </ApprovalPolicySection>
      ) : null}
    </Stack>
  );
}

export function ApprovalPolicyInspector({
  policy,
  versions,
  versionsLoading,
  versionsError,
  versionsFetching,
  publishedVersionLabel,
  locale,
  canEdit,
  canReview,
  makerBlocked,
  onEdit,
  onReview,
  onRetryVersions,
  impact,
}: {
  policy: ApprovalPolicy;
  versions: ApprovalPolicyVersion[] | undefined;
  versionsLoading: boolean;
  versionsError: boolean;
  versionsFetching: boolean;
  publishedVersionLabel: string;
  locale?: string;
  canEdit: boolean;
  canReview: boolean;
  makerBlocked: boolean;
  onEdit: () => void;
  onReview: () => void;
  onRetryVersions: () => void;
  impact: ReactNode;
}) {
  const { t, i18n } = useTranslation('approvals');
  const displayLocale = resolveSupportedLocale(locale, i18n.resolvedLanguage, i18n.language);
  const evidenceText = (value: string) => {
    if (value === 'Initial governed policy baseline')
      return t('admin.studio.initialPolicyEvidence.change');
    if (value === 'Baseline captured during policy governance upgrade')
      return t('admin.studio.initialPolicyEvidence.review');
    return value;
  };
  return (
    <Stack gap={2} minWidth={0}>
      <ApprovalPolicySection
        title={t('admin.studio.workspace.reviewAuthority')}
        action={<ShieldCheck size={17} aria-hidden="true" />}
      >
        <Stack gap={1.5} sx={{ py: 1.5 }}>
          <Box component="dl" sx={{ m: 0 }}>
            <Box component="dt" sx={{ typography: 'caption', color: 'text.secondary' }}>
              {t('admin.studio.policyVersion')}
            </Box>
            <Box component="dd" sx={{ m: 0, mt: 0.5, typography: 'subtitle2' }}>
              {publishedVersionLabel}
            </Box>
            {policy.pendingReview && policy.pendingAt ? (
              <>
                <Box
                  component="dt"
                  sx={{ mt: 1.5, typography: 'caption', color: 'text.secondary' }}
                >
                  {t('admin.studio.workspace.requestedAt')}
                </Box>
                <Box component="dd" sx={{ m: 0, mt: 0.5, typography: 'body2' }}>
                  {formatDate(
                    policy.pendingAt,
                    { dateStyle: 'medium', timeStyle: 'short' },
                    displayLocale
                  )}
                </Box>
              </>
            ) : null}
          </Box>
          {policy.pendingReview && policy.pendingBy != null ? (
            <Box sx={{ typography: 'body2', overflowWrap: 'anywhere' }}>
              {t('admin.studio.pendingMaker', { userId: policy.pendingBy })}
            </Box>
          ) : null}
          {makerBlocked ? (
            <InlineFeedback severity="warning" icon={<ShieldCheck size={18} />}>
              {t('admin.studio.makerCheckerNotice')}
            </InlineFeedback>
          ) : null}
          <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
            {t('admin.studio.policyReviewNotice')}
          </Box>
          <Stack gap={1}>
            {canReview ? (
              <ActionButton
                intent="primary"
                startIcon={<CheckCircle2 size={17} />}
                disabled={makerBlocked || versionsLoading || versionsError}
                onClick={onReview}
                sx={{ transition: 'none' }}
              >
                {t('admin.studio.reviewAndPublish')}
              </ActionButton>
            ) : null}
            {canEdit ? (
              <ActionButton
                intent="secondary"
                startIcon={<SlidersHorizontal size={17} />}
                onClick={onEdit}
              >
                {t('admin.studio.configurePolicy')}
              </ActionButton>
            ) : null}
          </Stack>
        </Stack>
      </ApprovalPolicySection>
      {impact}
      <ApprovalPolicySection
        title={t('admin.studio.historyTitle')}
        meta={t('admin.studio.historyMeta')}
        action={<History size={17} aria-hidden="true" />}
      >
        {versionsError ? (
          <Box sx={{ py: 1.5 }}>
            <ErrorState
              title={t('admin.studio.historyLoadError')}
              retryLabel={t('actions.retry')}
              retrying={versionsFetching}
              onRetry={onRetryVersions}
              size="compact"
            />
          </Box>
        ) : (versions?.length ?? 0) === 0 ? (
          <EmptyState
            title={t('admin.studio.historyEmpty')}
            description={t('admin.studio.historyMeta')}
            icon={<History size={22} />}
          />
        ) : (
          <Stack component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {(versions ?? []).slice(0, 8).map((version) => (
              <Box
                component="li"
                key={version.policyVersionId}
                sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}
              >
                <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center">
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    label={`v${version.versionNumber}`}
                  />
                  <StatusChip status={version.lifecycleState} />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t(`admin.studio.enforcementModes.${version.enforcementMode}`, {
                      defaultValue: version.enforcementMode,
                    })}
                  />
                </Stack>
                <Box
                  sx={{
                    mt: 1,
                    typography: 'body2',
                    fontWeight: 'fontWeightBold',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {evidenceText(version.changeReason)}
                </Box>
                <Box
                  sx={{
                    mt: 0.5,
                    typography: 'caption',
                    color: 'text.secondary',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {evidenceText(version.reviewComment)}
                </Box>
                <Box sx={{ mt: 0.75, typography: 'caption', color: 'text.secondary' }}>
                  {formatDate(
                    version.publishedAt,
                    { dateStyle: 'medium', timeStyle: 'short' },
                    displayLocale
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </ApprovalPolicySection>
      <InlineFeedback
        severity={policy.enforcementMode === 'BLOCK' ? 'warning' : 'info'}
        icon={<KeyRound size={18} />}
      >
        {t('admin.studio.policyChangeNotice')}
      </InlineFeedback>
    </Stack>
  );
}
