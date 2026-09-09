import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  CalendarClock,
  CircleAlert,
  FileCheck2,
  Lightbulb,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { foundationTokens } from '@dwp-frontend/design-system';
import { formatDate, useDisplayDictionary } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { proposalIsHighPriority } from './dwaion-proposal-model';

import type { DwaionProposal } from '@dwp-frontend/shared-utils';

const kindIcons = {
  WORK_SIGNAL: Sparkles,
  RISK: CircleAlert,
  SCHEDULE: CalendarClock,
  APPROVAL: FileCheck2,
  INSIGHT: Lightbulb,
} as const;

export function DwaionProposalList({
  proposals,
  selectedId,
  locale,
  onSelect,
}: {
  proposals: DwaionProposal[];
  selectedId?: string;
  locale: 'ko' | 'en';
  onSelect: (proposal: DwaionProposal) => void;
}) {
  return (
    <Stack gap={1.5}>
      {proposals.map((proposal) => (
        <ProposalRow
          key={proposal.proposalId}
          proposal={proposal}
          selected={proposal.proposalId === selectedId}
          locale={locale}
          onSelect={() => onSelect(proposal)}
        />
      ))}
    </Stack>
  );
}

function ProposalRow({
  proposal,
  selected,
  locale,
  onSelect,
}: {
  proposal: DwaionProposal;
  selected: boolean;
  locale: 'ko' | 'en';
  onSelect: () => void;
}) {
  const { t } = useTranslation('work');
  const display = useDisplayDictionary();
  const sources = [...new Set(proposal.content.evidence?.map((item) => item.sourceType) ?? [])]
    .map((source) => display('sourceTypes', source))
    .join(', ');
  const Icon = kindIcons[proposal.kind];
  const handled = ['ACCEPTED', 'DISMISSED', 'EXPIRED'].includes(proposal.state);
  const expired = proposal.state === 'EXPIRED';
  return (
    <Box
      component="button"
      type="button"
      data-dwaion-proposal-id={proposal.proposalId}
      onClick={onSelect}
      aria-pressed={selected}
      sx={{
        position: 'relative',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) auto' },
        gap: { xs: 1, sm: 1.4 },
        alignItems: 'start',
        border: 1,
        borderColor: selected ? 'primary.main' : 'divider',
        borderInlineStartWidth: 5,
        borderInlineStartColor: selected
          ? 'primary.main'
          : proposalIsHighPriority(proposal)
            ? 'warning.main'
            : 'divider',
        borderRadius: foundationTokens.radius.surface + foundationTokens.radius.compact + 'px',
        bgcolor: selected ? 'var(--dwp-product-soft)' : 'background.paper',
        color: 'text.primary',
        textAlign: 'left',
        px: { xs: 1.5, sm: 1.75 },
        py: { xs: 1.75, sm: 1.6 },
        boxShadow: selected ? 2 : 0,
        opacity: handled ? 0.76 : 1,
        cursor: 'pointer',
        transition: 'background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease',
        '&:hover': {
          bgcolor: selected ? 'var(--dwp-product-soft)' : 'action.hover',
          borderColor: 'primary.main',
          boxShadow: 1,
        },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: -2,
        },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
          <Stack direction="row" gap={0.65} alignItems="center" flexWrap="wrap">
            {proposalIsHighPriority(proposal) && proposal.state === 'PENDING' && (
              <Chip
                size="small"
                color={proposal.priority === 'URGENT' ? 'error' : 'warning'}
                label={t(`dwaionProposals.priorities.${proposal.priority}`)}
                sx={{
                  height: 'auto',
                  minHeight: 24,
                  '& .MuiChip-label': { whiteSpace: 'normal' },
                }}
              />
            )}
            <Chip
              size="small"
              variant="outlined"
              label={t(`dwaionProposals.states.${proposal.state}`)}
              sx={{
                height: 'auto',
                minHeight: 24,
                '& .MuiChip-label': { whiteSpace: 'normal' },
              }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: { xs: 'none', sm: 'inline' }, fontWeight: 'fontWeightBold' }}
            >
              #{proposal.proposalId}
            </Typography>
          </Stack>
          <Typography
            variant="caption"
            color={proposalIsHighPriority(proposal) ? 'error.main' : 'text.secondary'}
            sx={{ display: { xs: 'block', sm: 'none' }, flex: '0 0 auto', pt: 0.35 }}
          >
            {t('dwaionProposals.detail.expiresAt')}
            {': '}
            {formatDate(
              proposal.expiresAt,
              { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
              locale
            )}
          </Typography>
        </Stack>
        <Typography
          component="h3"
          variant="h6"
          fontWeight="fontWeightBold"
          sx={{
            mt: 1,
            overflowWrap: 'anywhere',
            lineHeight: 'typography.subtitle1.lineHeight',
            textDecoration: expired ? 'line-through' : 'none',
          }}
        >
          {proposal.content.title}
        </Typography>
        <Stack direction="row" spacing={0.65} alignItems="center" flexWrap="wrap" sx={{ mt: 0.65 }}>
          <Icon size={15} color="var(--dwp-product-accent)" aria-hidden="true" />
          <Typography variant="caption" color="text.secondary" fontWeight="fontWeightBold">
            {t(`dwaionProposals.kinds.${proposal.kind}`)}
          </Typography>
          <Typography variant="caption" color="text.disabled" aria-hidden="true">
            ·
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {sources || t('dwaionProposals.detail.noEvidence')}
          </Typography>
          <Typography variant="caption" color="text.disabled" aria-hidden="true">
            ·
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('dwaionProposals.evidenceCount', {
              count: proposal.content.evidence?.length ?? 0,
            })}
          </Typography>
        </Stack>
        <Typography
          variant="body2"
          sx={{
            mt: 1.1,
            p: { xs: 1.25, sm: 0 },
            borderRadius: foundationTokens.radius.surface + 'px',
            bgcolor: { xs: 'action.hover', sm: 'transparent' },
            color: 'text.secondary',
            lineHeight: 'typography.body2.lineHeight',
            display: '-webkit-box',
            WebkitLineClamp: { xs: 3, sm: 2 },
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {proposal.content.summary}
        </Typography>
        {proposal.content.evidence?.length ? (
          <Stack
            direction="row"
            gap={1}
            useFlexGap
            flexWrap="wrap"
            sx={{ display: { xs: 'none', sm: 'flex' }, mt: 0.8 }}
          >
            {proposal.content.evidence.slice(0, 2).map((evidence) => (
              <Typography
                key={`${evidence.sourceType}:${evidence.referenceId}`}
                variant="caption"
                color="text.secondary"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.45 }}
              >
                <ShieldCheck size={12} aria-hidden="true" />
                {evidence.label}
              </Typography>
            ))}
          </Stack>
        ) : null}
        <Stack
          direction="column"
          alignItems="stretch"
          gap={1}
          sx={{
            mt: 1.25,
            display: { xs: 'flex', sm: 'none' },
            minHeight: 44,
          }}
        >
          <Stack component="span" direction="row" alignItems="center" gap={0.65}>
            <Sparkles size={15} color="var(--dwp-product-accent)" aria-hidden="true" />
            <Typography
              component="span"
              variant="caption"
              color="text.secondary"
              fontWeight="fontWeightBold"
            >
              {t('dwaionProposals.mobile.confidenceUnavailable')} ·{' '}
              {t('dwaionProposals.mobile.generatedAt', {
                at: formatDate(
                  proposal.proposedAt,
                  { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
                  locale
                ),
              })}
            </Typography>
          </Stack>
          <Stack
            component="span"
            direction="row"
            justifyContent="center"
            alignItems="center"
            gap={0.5}
            sx={{
              minHeight: 48,
              px: 1.25,
              borderRadius: foundationTokens.radius.surface + 'px',
              bgcolor: selected ? 'primary.main' : 'var(--dwp-product-soft)',
              color: selected ? 'primary.contrastText' : 'primary.main',
            }}
          >
            <Typography component="span" variant="subtitle1" fontWeight="fontWeightBold">
              {t('dwaionProposals.preview.open')}
            </Typography>
            <ArrowRight size={18} aria-hidden="true" />
          </Stack>
        </Stack>
      </Box>
      <Stack
        gap={0.35}
        sx={{
          pt: 0.35,
          display: { xs: 'none', sm: 'flex' },
          textAlign: 'right',
          minWidth: 0,
        }}
      >
        <Box
          component="span"
          sx={{
            mb: 0.5,
            px: 1.25,
            py: 0.55,
            borderRadius: foundationTokens.radius.control + 'px',
            bgcolor: selected ? 'primary.main' : 'var(--dwp-product-soft)',
            color: selected ? 'primary.contrastText' : 'primary.main',
            fontSize: (theme) => theme.typography.pxToRem(12),
            fontWeight: 'fontWeightBold',
          }}
        >
          {t('dwaionProposals.preview.open')}
        </Box>
        <Typography variant="caption" color="text.secondary">
          {formatDate(
            proposal.proposedAt,
            { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
            locale
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {t('dwaionProposals.detail.expiresAt')}
          {': '}
          {formatDate(
            proposal.expiresAt,
            { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
            locale
          )}
        </Typography>
      </Stack>
    </Box>
  );
}
