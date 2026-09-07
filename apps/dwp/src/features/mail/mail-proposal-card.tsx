import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BellRing,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  MailPlus,
  ShieldCheck,
} from 'lucide-react';
import { ActionButton, ConfirmDialog, foundationTokens } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, lighten, useTheme } from '@mui/material/styles';

import { mailProposalPresentation } from './mail-proposal-model';

import type { LucideIcon } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { MailActionProposal } from '@dwp-frontend/shared-utils';
import type {
  MailProposalField,
  MailProposalPresentation,
  MailProposalTone,
} from './mail-proposal-model';

const COMPACT_RADIUS = `${foundationTokens.radius.compact}px`;

type ProposalToneStyle = {
  accent: string;
  icon: LucideIcon;
  soft: string;
};

const proposalToneStyles = {
  calendar: { color: 'primary', icon: CalendarDays },
  draft: { color: 'success', icon: MailPlus },
  leave: { color: 'warning', icon: Clock3 },
  notification: { color: 'error', icon: BellRing },
  task: { color: 'secondary', icon: ClipboardCheck },
} as const;

function useProposalTone(key: MailProposalTone): ProposalToneStyle {
  const theme = useTheme();
  const style = proposalToneStyles[key];
  const palette = theme.palette[style.color];
  return {
    icon: style.icon,
    accent: theme.palette.mode === 'dark' ? lighten(palette.light, 0.22) : palette.dark,
    soft: alpha(palette.main, theme.palette.mode === 'dark' ? 0.16 : 0.065),
  };
}

export function MailProposalCard({
  proposal,
  onAccept,
  onDismiss,
  busy = false,
}: {
  proposal: MailActionProposal;
  onAccept: () => void;
  onDismiss: () => void;
  busy?: boolean;
}) {
  const { t, i18n } = useTranslation('mail');
  const presentation = mailProposalPresentation(proposal);
  const tone = useProposalTone(presentation.tone);
  const Icon = tone.icon;
  const confidence = normalizedConfidence(proposal.confidence);
  const blocked = presentation.reviewBlock !== null;
  const language = i18n.resolvedLanguage ?? i18n.language;

  return (
    <Box
      component="article"
      data-testid={`mail-proposal-${proposal.type}`}
      sx={(theme) => ({
        minWidth: 0,
        overflow: 'hidden',
        border: 1,
        borderColor: alpha(tone.accent, 0.19),
        borderRadius: COMPACT_RADIUS,
        bgcolor: theme.palette.background.paper,
        boxShadow: 'none',
        transition: theme.transitions.create(['border-color', 'box-shadow', 'transform']),
        '@media (hover: hover)': {
          '&:hover': {
            borderColor: alpha(tone.accent, 0.35),
            boxShadow: 'none',
            transform: 'translateY(-1px)',
          },
        },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
          '&:hover': { transform: 'none' },
        },
      })}
    >
      <Box sx={{ p: { xs: 1.5, sm: 1.75 } }}>
        <Stack direction="row" spacing={1.15} alignItems="flex-start">
          <Box
            aria-hidden="true"
            sx={{
              width: 34,
              height: 34,
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              borderRadius: COMPACT_RADIUS,
              color: tone.accent,
              bgcolor: tone.soft,
            }}
          >
            <Icon size={18} strokeWidth={1.9} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="flex-start"
              justifyContent="space-between"
            >
              <Box sx={{ minWidth: 0 }}>
                <Stack
                  direction="row"
                  spacing={0.55}
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                >
                  <Bot size={13} color={tone.accent} />
                  <Typography
                    variant="overline"
                    sx={{
                      color: tone.accent,
                      fontWeight: 'fontWeightBold',
                      lineHeight: 'body2.lineHeight',
                    }}
                  >
                    {t('proposal.assistant')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" aria-hidden="true">
                    ·
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight="fontWeightBold">
                    {t(`proposal.types.${presentation.typeKey}.label`)}
                  </Typography>
                </Stack>
                <Typography
                  component="h3"
                  variant="subtitle2"
                  fontWeight="fontWeightBold"
                  sx={{ mt: 0.35, lineHeight: 'body2.lineHeight', overflowWrap: 'anywhere' }}
                >
                  {proposal.title}
                </Typography>
              </Box>
              <Chip
                size="small"
                icon={<CheckCircle2 size={13} />}
                label={t('proposal.match', { value: confidence })}
                sx={{
                  flexShrink: 0,
                  height: 23,
                  color: tone.accent,
                  bgcolor: tone.soft,
                  '& .MuiChip-icon': { color: 'inherit', ml: 0.65 },
                  '& .MuiChip-label': {
                    px: 0.75,
                    fontSize: 'caption.fontSize',
                    fontWeight: 'fontWeightBold',
                  },
                }}
              />
            </Stack>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.7, lineHeight: 'body2.lineHeight', overflowWrap: 'anywhere' }}
            >
              {proposal.summary}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {(presentation.sourceSummary || presentation.fields.length > 0) && (
        <ProposalContextBand presentation={presentation} tone={tone} language={language} />
      )}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={0.75}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        sx={{ px: { xs: 1.5, sm: 1.75 }, py: 1.1 }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <Chip
            size="small"
            variant="outlined"
            label={t(`proposal.risk.${proposal.riskLevel}`)}
            sx={{ height: 22, '& .MuiChip-label': { px: 0.75, fontSize: 'caption.fontSize' } }}
          />
          {blocked && (
            <Typography
              id={`${proposal.proposalId}-blocked`}
              variant="caption"
              color="warning.dark"
              sx={{ overflowWrap: 'anywhere' }}
            >
              {t(`proposal.blocked.${presentation.reviewBlock}`)}
            </Typography>
          )}
        </Stack>
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          <ActionButton intent="quiet" size="small" onClick={onDismiss} disabled={busy}>
            {t('proposal.dismiss')}
          </ActionButton>
          <ActionButton
            intent="primary"
            size="small"
            endIcon={<ArrowRight size={14} />}
            onClick={onAccept}
            disabled={busy || blocked}
            aria-describedby={blocked ? `${proposal.proposalId}-blocked` : undefined}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {t('proposal.review')}
          </ActionButton>
        </Stack>
      </Stack>
    </Box>
  );
}

export function MailProposalReviewDialog({
  proposal,
  busy,
  onClose,
  onConfirm,
}: {
  proposal: MailActionProposal | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t, i18n } = useTranslation('mail');
  const lastProposal = useRef<MailActionProposal | null>(proposal);
  if (proposal) lastProposal.current = proposal;
  const renderedProposal = proposal ?? lastProposal.current;
  const presentation = renderedProposal ? mailProposalPresentation(renderedProposal) : null;
  const language = i18n.resolvedLanguage ?? i18n.language;

  return (
    <ConfirmDialog
      open={Boolean(proposal)}
      title={renderedProposal?.title ?? t('proposal.confirmTitle')}
      description={t('proposal.reviewDialog.description')}
      cancelLabel={t('actions.cancel')}
      confirmLabel={
        presentation ? t(`proposal.types.${presentation.typeKey}.confirm`) : t('proposal.confirm')
      }
      confirmingLabel={t('proposal.confirming')}
      busy={busy}
      details={
        renderedProposal && presentation ? (
          <ProposalReviewDetails
            proposal={renderedProposal}
            presentation={presentation}
            language={language}
          />
        ) : null
      }
      onClose={onClose}
      onConfirm={() => {
        if (renderedProposal && presentation?.reviewBlock === null) onConfirm();
      }}
    />
  );
}

function ProposalContextBand({
  presentation,
  tone,
  language,
}: {
  presentation: MailProposalPresentation;
  tone: ProposalToneStyle;
  language: string;
}) {
  const { t } = useTranslation('mail');
  return (
    <Box sx={{ px: { xs: 1.5, sm: 1.75 }, py: 1.15, bgcolor: tone.soft }}>
      {presentation.sourceSummary && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mb: presentation.fields.length ? 0.75 : 0 }}
        >
          {t('proposal.source', { source: presentation.sourceSummary })}
        </Typography>
      )}
      {presentation.fields.length > 0 && (
        <Box
          component="dl"
          sx={{
            m: 0,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: '6px 14px',
          }}
        >
          {presentation.fields.map((field) => (
            <Box key={field.key} sx={{ minWidth: 0 }}>
              <Typography component="dt" variant="caption" color="text.secondary">
                {t(`proposal.fields.${field.key}`)}
              </Typography>
              <Typography
                component="dd"
                variant="caption"
                fontWeight="fontWeightBold"
                sx={{ m: 0, mt: 0.15, overflowWrap: 'anywhere' }}
              >
                {formatProposalField(field, t, language)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

function ProposalReviewDetails({
  proposal,
  presentation,
  language,
}: {
  proposal: MailActionProposal;
  presentation: MailProposalPresentation;
  language: string;
}) {
  const { t } = useTranslation('mail');
  const tone = useProposalTone(presentation.tone);
  const Icon = tone.icon;

  return (
    <Stack spacing={1.5}>
      <Box sx={{ px: 1.5, py: 1.25, bgcolor: tone.soft }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Icon size={17} color={tone.accent} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary">
              {t('proposal.reviewDialog.target')}
            </Typography>
            <Typography variant="body2" fontWeight="fontWeightBold">
              {t(`proposal.targets.${presentation.targetKey}`)}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {presentation.fields.length > 0 && (
        <Box component="dl" sx={{ m: 0, display: 'grid', gap: 1 }}>
          {presentation.fields.map((field) => (
            <Stack
              key={field.key}
              component="div"
              direction="row"
              spacing={2}
              justifyContent="space-between"
            >
              <Typography component="dt" variant="caption" color="text.secondary">
                {t(`proposal.fields.${field.key}`)}
              </Typography>
              <Typography
                component="dd"
                variant="caption"
                fontWeight="fontWeightBold"
                textAlign="right"
                sx={{ m: 0, overflowWrap: 'anywhere' }}
              >
                {formatProposalField(field, t, language)}
              </Typography>
            </Stack>
          ))}
        </Box>
      )}

      <Stack spacing={0.45}>
        {presentation.sourceSummary && (
          <Typography variant="caption" color="text.secondary">
            {t('proposal.source', { source: presentation.sourceSummary })}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary">
          {t('proposal.reviewDialog.evidence', { count: proposal.evidence.length })}
        </Typography>
        {proposal.expiresAt && (
          <Typography variant="caption" color="text.secondary">
            {t('proposal.reviewDialog.expires', {
              value: formatDate(
                proposal.expiresAt,
                { dateStyle: 'medium', timeStyle: 'short' },
                resolveSupportedLocale(language)
              ),
            })}
          </Typography>
        )}
      </Stack>

      <Stack direction="row" spacing={0.75} alignItems="flex-start">
        <ShieldCheck size={15} color={tone.accent} style={{ flexShrink: 0, marginTop: 1 }} />
        <Typography variant="caption" color="text.secondary">
          {t('proposal.reviewDialog.safety')}
        </Typography>
      </Stack>
    </Stack>
  );
}

function formatProposalField(field: MailProposalField, t: TFunction, language: string) {
  if (field.format === 'datetime' && typeof field.value === 'string') {
    return formatDate(
      field.value,
      { dateStyle: 'medium', timeStyle: 'short' },
      resolveSupportedLocale(language)
    );
  }
  if (field.format === 'date' && Array.isArray(field.value)) {
    return field.value
      .map((value) => formatDate(value, { dateStyle: 'medium' }, resolveSupportedLocale(language)))
      .join(' - ');
  }
  if (field.format === 'durationMinutes' && typeof field.value === 'number') {
    return t('proposal.values.durationMinutes', { count: field.value });
  }
  if (field.format === 'durationDays' && typeof field.value === 'number') {
    return t('proposal.values.durationDays', { count: field.value });
  }
  if (field.format === 'list' && Array.isArray(field.value)) return field.value.join(', ');
  if (typeof field.value === 'string') {
    const normalized = field.value.toUpperCase();
    const knownValueKey = proposalValueKeys[normalized];
    return knownValueKey ? t(`proposal.values.${knownValueKey}`) : field.value;
  }
  return String(field.value);
}

const proposalValueKeys: Record<string, string> = {
  CONCISE: 'concise',
  EMAIL: 'email',
  EN: 'english',
  ENGLISH: 'english',
  FORMAL: 'formal',
  HIGH: 'high',
  IN_APP: 'inApp',
  KO: 'korean',
  KOREAN: 'korean',
  LOW: 'low',
  MEDIUM: 'medium',
  PROFESSIONAL: 'professional',
};

function normalizedConfidence(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value * 100)));
}
