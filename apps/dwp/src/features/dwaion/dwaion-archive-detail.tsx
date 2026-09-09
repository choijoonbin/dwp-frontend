import { ArrowUpRight, Bot, FileText, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ActionButton,
  foundationTokens,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import type {
  AskCitation,
  DwaionConversation,
  DwaionConversationSummary,
} from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { conversationAnswerSummary, conversationCopy } from './dwaion-conversation-copy';

function conversationReference(item: DwaionConversationSummary) {
  return `#CONV-${item.conversationId.replaceAll('-', '').slice(-8).toUpperCase()}`;
}

function uniqueCitations(detail?: DwaionConversation) {
  const citations =
    [...(detail?.messages ?? [])].reverse().find((message) => message.role === 'ASSISTANT')
      ?.citations ?? [];
  return [
    ...new Map(
      citations.map((citation) => [`${citation.sourceSystem}:${citation.sourceId}`, citation])
    ).values(),
  ];
}

function agentLabel(
  item: DwaionConversationSummary,
  detail: DwaionConversation | undefined,
  copy: ReturnType<typeof conversationCopy>
) {
  const key =
    [...(detail?.messages ?? [])].reverse().find((message) => message.role === 'ASSISTANT')
      ?.agentKey ?? item.agentKey;
  if (key === 'DWP_ASSISTANT' || !key) return copy.defaultAgent;
  if (key === 'DWP_APPROVAL_EXPERT') return copy.approvalAgent;
  return copy.unknownAgent;
}

function SourceRow({ source }: { source: string }) {
  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        borderRadius: foundationTokens.radius.surface + 'px',
        bgcolor: 'action.hover',
        minWidth: 0,
      }}
    >
      <FileText size={17} aria-hidden="true" style={{ flexShrink: 0 }} />
      <Typography
        variant="caption"
        sx={{ fontWeight: 'fontWeightMedium', overflowWrap: 'anywhere' }}
      >
        {source}
      </Typography>
    </Box>
  );
}

function DetailTerm({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'minmax(108px, 0.7fr) minmax(0, 1.3fr)',
        alignItems: 'start',
        gap: 1,
        px: 1.25,
        py: 0.9,
        borderRadius: foundationTokens.radius.surface + 'px',
        bgcolor: 'action.hover',
      }}
    >
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="dd"
        variant="caption"
        sx={{
          m: 0,
          textAlign: 'right',
          fontWeight: 'fontWeightMedium',
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function CitationRow({ citation }: { citation: AskCitation }) {
  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        borderRadius: foundationTokens.radius.surface + 'px',
        bgcolor: 'action.hover',
        minWidth: 0,
      }}
    >
      <FileText size={17} aria-hidden="true" style={{ flexShrink: 0 }} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="caption"
          sx={{ display: 'block', fontWeight: 'fontWeightMedium' }}
          noWrap
        >
          {citation.title}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
          {citation.sourceSystem}
        </Typography>
      </Box>
    </Box>
  );
}

export function DwaionArchiveDetail({
  item,
  detail,
  loading,
  error,
  onOpen,
}: {
  item?: DwaionConversationSummary;
  detail?: DwaionConversation;
  loading: boolean;
  error: boolean;
  onOpen: () => void;
}) {
  const { i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const copy = conversationCopy(locale);
  const citations = uniqueCitations(detail);
  const sources = citations.length
    ? [...new Set(citations.map((citation) => citation.sourceSystem))]
    : (item?.sourceSystems ?? []);
  const rawSnapshot =
    [...(detail?.messages ?? [])].reverse().find((message) => message.role === 'ASSISTANT')
      ?.content ?? item?.summaryExcerpt;
  const snapshot = conversationAnswerSummary(rawSnapshot, item?.lastAnswerStatus ?? null, locale);
  const evidenceTotal = citations.length || item?.evidenceCount || 0;
  const retentionValue = item?.legalHold
    ? copy.legalHoldActive
    : item?.retentionUntil
      ? copy.retainedUntil.replace(
          '{{date}}',
          formatDate(
            item.retentionUntil,
            { year: 'numeric', month: 'short', day: 'numeric' },
            locale
          )
        )
      : copy.policyApplied;

  return (
    <Stack component="aside" aria-label={copy.detailTitle} gap={2} sx={{ minWidth: 0 }}>
      <Box
        sx={{
          p: 2.25,
          border: 1,
          borderColor: 'divider',
          borderRadius: foundationTokens.radius.surface + foundationTokens.radius.compact + 'px',
          bgcolor: 'background.paper',
          boxShadow: (theme) => theme.shadows[1],
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
            <Bot size={20} aria-hidden="true" />
            <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 'fontWeightBold' }}>
              {copy.detailTitle}
            </Typography>
          </Stack>
          {item && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                fontFamily: foundationTokens.font.mono,
                overflowWrap: 'anywhere',
                textAlign: 'right',
              }}
            >
              {conversationReference(item)}
            </Typography>
          )}
        </Stack>

        {!item ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {copy.selectDetail}
          </Typography>
        ) : loading ? (
          <Box sx={{ mt: 2 }}>
            <LoadingState
              label={copy.detailLoading}
              variant="skeleton"
              embedded
              skeletonHeights={[112, 34, 34, 72]}
            />
          </Box>
        ) : error ? (
          <InlineFeedback severity="warning" sx={{ mt: 2 }}>
            {copy.detailError}
          </InlineFeedback>
        ) : (
          <>
            <Box
              sx={{
                position: 'relative',
                mt: 2,
                minHeight: 124,
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderRadius:
                  foundationTokens.radius.surface + foundationTokens.radius.compact / 2 + 'px',
                overflow: 'hidden',
                color: (theme) =>
                  theme.palette.mode === 'dark'
                    ? theme.palette.text.primary
                    : theme.palette.common.white,
                bgcolor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? theme.palette.background.default
                    : theme.palette.primary.dark,
                border: 1,
                borderColor: (theme) =>
                  theme.palette.mode === 'dark' ? theme.palette.primary.main : 'transparent',
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: 'inherit', fontWeight: 'fontWeightMedium' }}
              >
                {copy.snapshotLabel}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  mt: 1,
                  fontWeight: 'fontWeightMedium',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {snapshot ?? item.title}
              </Typography>
            </Box>

            <Stack component="dl" gap={0.75} sx={{ m: 0, mt: 1.5 }}>
              <DetailTerm label={copy.agent} value={agentLabel(item, detail, copy)} />
              <DetailTerm
                label={copy.sourceScope}
                value={sources.length ? sources.join(', ') : copy.sourceUnavailable}
              />
              <DetailTerm
                label={copy.verification}
                value={
                  evidenceTotal
                    ? copy.verifiedEvidence.replace('{{count}}', String(evidenceTotal))
                    : copy.noVerifiedEvidence
                }
              />
              <DetailTerm label={copy.retention} value={retentionValue} />
            </Stack>

            <Box sx={{ mt: 2 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 'fontWeightBold' }}
              >
                {copy.evidenceTitle.replace('{{count}}', String(evidenceTotal))}
              </Typography>
              {citations.length ? (
                <Stack component="ul" gap={0.75} sx={{ listStyle: 'none', p: 0, m: 0, mt: 1 }}>
                  {citations.slice(0, 4).map((citation) => (
                    <CitationRow
                      key={`${citation.sourceSystem}:${citation.sourceId}`}
                      citation={citation}
                    />
                  ))}
                </Stack>
              ) : sources.length ? (
                <Stack component="ul" gap={0.75} sx={{ listStyle: 'none', p: 0, m: 0, mt: 1 }}>
                  {sources.slice(0, 4).map((source) => (
                    <SourceRow key={source} source={source} />
                  ))}
                </Stack>
              ) : (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 1 }}
                >
                  {copy.noEvidence}
                </Typography>
              )}
            </Box>

            <ActionButton
              component={RouterLink}
              to={`/dwaion/conversations/${encodeURIComponent(item.conversationId)}`}
              onClick={onOpen}
              intent="primary"
              endIcon={<ArrowUpRight size={16} />}
              fullWidth
              sx={{ mt: 2, minHeight: 44 }}
            >
              {copy.openWorkspace}
            </ActionButton>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.75, textAlign: 'center' }}
            >
              {copy.restoreNote}
            </Typography>
          </>
        )}
      </Box>

      <Box
        sx={{
          p: 2,
          border: 1,
          borderColor: 'divider',
          borderRadius: foundationTokens.radius.surface + foundationTokens.radius.compact + 'px',
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <LockKeyhole size={18} aria-hidden="true" />
          <Typography component="h2" variant="subtitle2">
            {copy.retentionTitle}
          </Typography>
        </Stack>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1, lineHeight: 'typography.body2.lineHeight' }}
        >
          {copy.retentionDescription}
        </Typography>
      </Box>
    </Stack>
  );
}

export function DwaionArchivePrivacyNotice() {
  const { i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const copy = conversationCopy(locale);
  return (
    <Box
      component="section"
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        p: 2,
        borderRadius: foundationTokens.radius.surface + foundationTokens.radius.compact + 'px',
        bgcolor: 'action.hover',
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '50%',
          bgcolor: 'action.selected',
          color: 'primary.main',
          flexShrink: 0,
        }}
      >
        <ShieldCheck size={18} aria-hidden="true" />
      </Box>
      <Box>
        <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 'fontWeightBold' }}>
          {copy.privacyTitle}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          {copy.privacyDescription}
        </Typography>
      </Box>
    </Box>
  );
}
