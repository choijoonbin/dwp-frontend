import { useTranslation } from 'react-i18next';
import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
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
    <Box sx={{ borderBlock: 1, borderColor: 'divider' }}>
      {proposals.map((proposal, index) => (
        <Box key={proposal.proposalId}>
          {index > 0 && <Divider />}
          <ProposalRow
            proposal={proposal}
            selected={proposal.proposalId === selectedId}
            locale={locale}
            onSelect={() => onSelect(proposal)}
          />
        </Box>
      ))}
    </Box>
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
  const Icon = kindIcons[proposal.kind];
  const handled = ['ACCEPTED', 'DISMISSED', 'EXPIRED'].includes(proposal.state);
  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      sx={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: { xs: '40px minmax(0, 1fr)', md: '40px minmax(0, 1fr) auto' },
        gap: 1.25,
        alignItems: 'start',
        border: 0,
        bgcolor: selected ? 'var(--dwp-product-soft)' : 'transparent',
        color: 'text.primary',
        textAlign: 'left',
        px: { xs: 1, sm: 1.5 },
        py: 1.55,
        cursor: 'pointer',
        transition: 'background-color 140ms ease',
        '&:hover': { bgcolor: selected ? 'var(--dwp-product-soft)' : 'action.hover' },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: -2,
        },
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 40,
          height: 40,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 1,
          bgcolor: handled ? 'action.hover' : 'var(--dwp-product-soft)',
          color: handled ? 'text.secondary' : 'var(--dwp-product-accent)',
        }}
      >
        {handled ? <CheckCircle2 size={18} /> : <Icon size={18} />}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
          <Typography variant="body2" fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>
            {proposal.content.title}
          </Typography>
          {proposalIsHighPriority(proposal) && proposal.state === 'PENDING' && (
            <Chip
              size="small"
              color={proposal.priority === 'URGENT' ? 'error' : 'warning'}
              variant="outlined"
              label={t(`dwaionProposals.priorities.${proposal.priority}`)}
              sx={{ height: 22 }}
            />
          )}
        </Stack>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mt: 0.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {proposal.content.summary}
        </Typography>
        <Stack direction="row" spacing={0.65} alignItems="center" flexWrap="wrap" sx={{ mt: 0.75 }}>
          <Typography variant="caption" color="text.secondary">
            {t(`dwaionProposals.kinds.${proposal.kind}`)}
          </Typography>
          <Typography variant="caption" color="text.disabled" aria-hidden="true">
            ·
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t(`dwaionProposals.states.${proposal.state}`)}
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
      </Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ whiteSpace: 'nowrap', pt: 0.35, gridColumn: { xs: '2', md: 'auto' } }}
      >
        {formatDate(
          proposal.proposedAt,
          { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
          locale
        )}
      </Typography>
    </Box>
  );
}
