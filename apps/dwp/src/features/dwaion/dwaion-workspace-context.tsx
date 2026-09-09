import { useTranslation } from 'react-i18next';
import {
  BookOpenCheck,
  ExternalLink,
  FileText,
  Gauge,
  LockKeyhole,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { ActionIconButton, foundationTokens } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { Theme } from '@mui/material/styles';
import type { AskCitation, AskDwpResponse } from '@dwp-frontend/shared-utils';
import {
  confidenceValue,
  isGroundedFallbackResponse,
  responseTone,
} from './dwaion-workspace-model';

export function DwaionWorkspaceContext({
  response,
  onOpenCitation,
}: {
  response: AskDwpResponse;
  onOpenCitation: (citation: AskCitation) => void;
}) {
  const { t } = useTranslation('work');
  const compact = useMediaQuery((theme: Theme) => theme.breakpoints.down('md'));

  if (compact) {
    return (
      <Box component="aside" aria-label={t('askPage.contextRail.label')} sx={{ mt: 2 }}>
        <Box
          sx={{
            minHeight: 40,
            width: '100%',
            px: 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Typography
            component="h2"
            aria-label={t('askPage.contextRail.evidenceTitle')}
            variant="subtitle2"
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <BookOpenCheck size={18} aria-hidden="true" />
            {t('askPage.contextRail.evidenceSectionTitle')}
          </Typography>
          <Typography component="span" variant="caption" color="text.secondary">
            {t('askPage.contextRail.sourceCount', { count: response.sourceCount })}
          </Typography>
        </Box>
        <ResponseContext response={response} onOpenCitation={onOpenCitation} compact />
      </Box>
    );
  }

  return (
    <Box
      component="aside"
      aria-label={t('askPage.contextRail.label')}
      sx={{
        alignSelf: 'start',
        position: 'sticky',
        top: 16,
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.surface + 'px',
        bgcolor: 'background.paper',
        overflow: 'hidden',
        boxShadow: 'none',
      }}
    >
      <Box sx={{ p: 2, bgcolor: 'var(--dwp-product-soft)' }}>
        <Typography
          component="h2"
          aria-label={t('askPage.contextRail.evidenceTitle')}
          variant="subtitle2"
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <BookOpenCheck size={17} />
          {t('askPage.contextRail.evidenceSectionTitle')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('askPage.contextRail.evidenceDescription')}
        </Typography>
      </Box>
      <Divider />
      <ResponseContext response={response} onOpenCitation={onOpenCitation} />
    </Box>
  );
}

function ResponseContext({
  response,
  onOpenCitation,
  compact = false,
}: {
  response: AskDwpResponse;
  onOpenCitation: (citation: AskCitation) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation('work');
  const tone = responseTone(response);
  const groundedFallback = isGroundedFallbackResponse(response);
  const personalization = response.personalization ?? {
    state: 'NOT_EVALUATED' as const,
    appliedKinds: [],
  };

  if (compact) {
    return (
      <>
        <Box>
          {response.citations.length ? (
            <CitationList citations={response.citations} onOpenCitation={onOpenCitation} compact />
          ) : (
            <Box
              sx={{
                p: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: foundationTokens.radius.surface + 'px',
                bgcolor: 'background.paper',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {t('askPage.contextRail.noSources')}
              </Typography>
            </Box>
          )}
        </Box>
        <Box
          sx={{
            mt: 1.25,
            px: 1.5,
            py: 1.25,
            border: 1,
            borderColor: 'divider',
            borderRadius: foundationTokens.radius.surface + 'px',
            bgcolor: 'background.paper',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
              <ShieldCheck size={15} aria-hidden="true" />
              <Typography variant="caption" color="text.secondary" noWrap>
                {t('askPage.contextRail.policy')}
              </Typography>
              <Typography variant="caption" fontWeight="fontWeightBold" noWrap>
                {t(`askPage.policyOutcomes.${response.policy.outcome}`)}
              </Typography>
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ fontFamily: foundationTokens.font.mono }}
            >
              {response.auditId.slice(0, 12)}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            {t('askPage.evidence.privacy')}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'block',
              mt: 0.55,
              fontFamily: foundationTokens.font.mono,
              overflowWrap: 'anywhere',
            }}
          >
            {response.policy.code} · {response.policy.riskTier} ·{' '}
            {t(
              response.policy.mutationAllowed
                ? 'askPage.evidence.mutationAllowed'
                : 'askPage.evidence.mutationBlocked'
            )}
          </Typography>
        </Box>
      </>
    );
  }

  return (
    <>
      <Box sx={{ px: 2, py: 1.5, bgcolor: 'var(--dwp-product-soft)' }}>
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          <Chip
            size="small"
            color={tone}
            variant="outlined"
            label={
              groundedFallback ? t('askPage.fallback.state') : t(`askPage.states.${response.state}`)
            }
          />
          <Chip
            size="small"
            variant="outlined"
            label={t(`askPage.contextRail.confidence.${confidenceValue(response)}`)}
          />
          <Chip
            size="small"
            variant="outlined"
            label={t('askPage.contextRail.sourceCount', { count: response.sourceCount })}
          />
        </Stack>
      </Box>

      <Divider />

      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography
          component="h3"
          variant="caption"
          color="text.secondary"
          fontWeight="fontWeightBold"
        >
          {t('askPage.sourcesHeading', { count: response.citations.length })}
        </Typography>
        {response.citations.length ? (
          <CitationList
            citations={response.citations}
            onOpenCitation={onOpenCitation}
            compact={compact}
          />
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('askPage.contextRail.noSources')}
          </Typography>
        )}
      </Box>

      <Divider />

      <Box sx={{ px: 2, py: 1.5 }}>
        <Stack spacing={1.1}>
          <EvidenceRow
            icon={ShieldCheck}
            label={t('askPage.contextRail.policy')}
            value={t(`askPage.policyOutcomes.${response.policy.outcome}`)}
          />
          <EvidenceRow
            icon={BookOpenCheck}
            label={t('askPage.evidence.agent')}
            value={`${response.agentRegistry.entryKey} · r${response.agentRegistry.revision} · ${response.agentRegistry.artifactVersion}`}
            mono
          />
          <EvidenceRow
            icon={LockKeyhole}
            label={t('askPage.evidence.policyContract')}
            value={`${response.policy.code} · ${response.policy.riskTier} · ${t(
              response.policy.mutationAllowed
                ? 'askPage.evidence.mutationAllowed'
                : 'askPage.evidence.mutationBlocked'
            )}`}
            mono
          />
          <EvidenceRow
            icon={SlidersHorizontal}
            label={t('askPage.evidence.personalization')}
            value={t(`askPage.evidence.personalizationStates.${personalization.state}`, {
              count: personalization.appliedKinds?.length ?? 0,
            })}
          />
          {groundedFallback && (
            <EvidenceRow
              icon={BookOpenCheck}
              label={t('askPage.fallback.responseMode')}
              value={t('askPage.fallback.responseModeValue')}
            />
          )}
          <EvidenceRow
            icon={Gauge}
            label={t('askPage.evidence.usage')}
            value={
              response.modelRoute.totalTokens
                ? t('askPage.evidence.tokens', { count: response.modelRoute.totalTokens })
                : t('askPage.evidence.notApplicable')
            }
          />
          <EvidenceRow
            icon={LockKeyhole}
            label={t('askPage.evidence.audit')}
            value={response.auditId.slice(0, 12)}
            mono
          />
        </Stack>
      </Box>

      <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ lineHeight: 'caption.lineHeight' }}
        >
          {t('askPage.evidence.privacy')}
        </Typography>
      </Box>
    </>
  );
}

function CitationList({
  citations,
  onOpenCitation,
  compact = false,
}: {
  citations: AskCitation[];
  onOpenCitation: (citation: AskCitation) => void;
  compact?: boolean;
}) {
  const { t, i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  return (
    <Stack component="ol" spacing={1} sx={{ p: 0, m: 0, mt: compact ? 0.5 : 1, listStyle: 'none' }}>
      {citations.map((citation, index) => (
        <Box
          component="li"
          key={`${citation.sourceSystem}:${citation.sourceId}`}
          sx={{
            p: compact ? 1.5 : 1.4,
            border: 1,
            borderColor: 'divider',
            borderRadius: foundationTokens.radius.surface + 'px',
            bgcolor: 'background.paper',
            borderTop: compact ? 1 : 3,
            borderTopColor: compact ? 'divider' : 'primary.light',
            boxShadow: (theme) => (compact ? theme.shadows[1] : 'none'),
          }}
        >
          <Stack direction="row" gap={1} alignItems="flex-start">
            <Box
              sx={{
                width: 26,
                height: 26,
                display: 'grid',
                placeItems: 'center',
                borderRadius: foundationTokens.radius.control + 'px',
                bgcolor: 'primary.lighter',
                color: 'primary.main',
                flexShrink: 0,
              }}
            >
              <FileText size={15} aria-hidden="true" />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="body2"
                fontWeight="fontWeightBold"
                sx={{ overflowWrap: 'anywhere' }}
              >
                {index + 1}. {citation.title}
              </Typography>
              {citation.excerpt && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    mt: 0.5,
                    display: '-webkit-box',
                    WebkitLineClamp: compact ? 2 : 5,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: 'caption.lineHeight',
                  }}
                >
                  {citation.excerpt}
                </Typography>
              )}
            </Box>
            {citation.route && (
              <ActionIconButton
                label={t('askPage.openSource', { title: citation.title })}
                tooltip={t('askPage.openSource', { title: citation.title })}
                size="small"
                onClick={() => onOpenCitation(citation)}
                sx={{ width: 44, height: 44, flexShrink: 0 }}
              >
                <ExternalLink size={15} aria-hidden="true" />
              </ActionIconButton>
            )}
          </Stack>
          <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75} sx={{ mt: 0.9 }}>
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={`${t('askPage.evidence.sourceId')} · ${citation.sourceId}`}
              sx={{ '& .MuiChip-label': { fontFamily: foundationTokens.font.mono } }}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`${t(`askPage.sourceTypes.${citation.sourceType}`)} · ${citation.sourceSystem}`}
            />
            {citation.occurredAt && (
              <Chip
                size="small"
                variant="outlined"
                label={formatDate(
                  citation.occurredAt,
                  { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
                  locale
                )}
              />
            )}
          </Stack>
          {!citation.occurredAt && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.8 }}>
              {t('askPage.evidence.sourceTimeUnavailable')}
            </Typography>
          )}
          {!citation.route && (
            <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.7 }}>
              <LockKeyhole size={13} aria-hidden="true" />
              <Typography variant="caption" color="text.secondary">
                {t('askPage.evidence.sourceLinkUnavailable')}
              </Typography>
            </Stack>
          )}
        </Box>
      ))}
    </Stack>
  );
}

function EvidenceRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr)', gap: 0.75 }}>
      <Icon size={15} color="currentColor" aria-hidden="true" />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
        <Typography
          variant="body2"
          fontWeight="fontWeightMedium"
          sx={{
            fontFamily: mono ? foundationTokens.font.mono : undefined,
            overflowWrap: 'anywhere',
          }}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  );
}
