import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  CircleAlert,
  Clock3,
  FileSearch,
  Inbox,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { ActionButton, FormField, foundationTokens } from '@dwp-frontend/design-system';
import { formatDate, useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import type { DwaionProposal } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DwaionProposalEvidence } from './dwaion-proposal-evidence';
import { proposalIsHighPriority } from './dwaion-proposal-model';

type Summary = {
  active: number;
  highPriority: number;
  snoozed: number;
  handled: number;
};

export function DwaionProposalMetrics({ summary }: { summary: Summary }) {
  const { t } = useTranslation('work');
  const items = [
    {
      key: 'active',
      value: summary.active,
      icon: Inbox,
      color: 'primary.main',
      background: 'var(--dwp-product-soft)',
    },
    {
      key: 'highPriority',
      value: summary.highPriority,
      icon: CircleAlert,
      color: 'error.main',
      background: 'error.light',
    },
    {
      key: 'snoozed',
      value: summary.snoozed,
      icon: Clock3,
      color: 'text.secondary',
      background: 'action.hover',
    },
    {
      key: 'handled',
      value: summary.handled,
      icon: ShieldCheck,
      color: 'success.main',
      background: 'success.light',
    },
  ] as const;

  return (
    <Box
      component="section"
      aria-label={t('dwaionProposals.summaryLabel')}
      data-testid="dwaion-proposal-metrics"
      sx={{
        display: { xs: 'none', md: 'grid' },
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
        gap: 1.5,
        mt: 2,
      }}
    >
      {items.map(({ key, value, icon: Icon, color, background }) => (
        <Paper
          key={key}
          variant="outlined"
          sx={{
            display: 'grid',
            gridTemplateColumns: '44px minmax(0, 1fr)',
            gap: 1.25,
            alignItems: 'center',
            minWidth: 0,
            p: { xs: 1.5, md: 1.75 },
          }}
        >
          <Box
            aria-hidden="true"
            sx={{
              width: 44,
              height: 44,
              display: 'grid',
              placeItems: 'center',
              borderRadius: foundationTokens.radius.surface + 'px',
              color,
              bgcolor: background,
              '@media (forced-colors: active)': { border: '1px solid CanvasText' },
            }}
          >
            <Icon size={20} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" fontWeight="fontWeightBold">
              {t(`dwaionProposals.metrics.${key}`)}
            </Typography>
            <Stack direction="row" alignItems="baseline" gap={0.5}>
              <Typography
                component="strong"
                variant="h4"
                sx={{ color, fontVariantNumeric: 'tabular-nums' }}
              >
                {value}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('dwaionProposals.inbox.items')}
              </Typography>
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: 'block',
                mt: 0.2,
                lineHeight: 'typography.caption.lineHeight',
              }}
            >
              {t(`dwaionProposals.metrics.${key}Detail`)}
            </Typography>
          </Box>
        </Paper>
      ))}
    </Box>
  );
}

export function DwaionProposalFilterBar({
  query,
  source,
  priority,
  sources,
  onQueryChange,
  onSourceChange,
  onPriorityChange,
  mobileOpen = false,
}: {
  query: string;
  source: string;
  priority: string;
  sources: string[];
  onQueryChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  mobileOpen?: boolean;
}) {
  const { t } = useTranslation('work');
  const display = useDisplayDictionary();
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-label={t('dwaionProposals.inbox.filters')}
      sx={{
        display: { xs: mobileOpen ? 'block' : 'none', md: 'block' },
        p: { xs: 1.5, md: 1.25 },
        mt: 1.5,
        borderRadius: foundationTokens.radius.surface + foundationTokens.radius.compact + 'px',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(260px, 1fr) 190px 170px' },
          gap: 1,
        }}
      >
        <FormField
          size="small"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          label={t('dwaionProposals.inbox.searchLabel')}
          placeholder={t('dwaionProposals.inbox.searchPlaceholder')}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={17} aria-hidden="true" />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': { bgcolor: 'var(--dwp-product-soft)' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
          }}
        />
        <FormControl size="small">
          <InputLabel id="dwaion-proposal-source-filter-label">
            {t('dwaionProposals.inbox.sourceFilter')}
          </InputLabel>
          <Select
            labelId="dwaion-proposal-source-filter-label"
            value={source}
            label={t('dwaionProposals.inbox.sourceFilter')}
            onChange={(event) => onSourceChange(event.target.value)}
            sx={{
              bgcolor: 'var(--dwp-product-soft)',
              borderRadius: foundationTokens.radius.surface * 125 + 'px',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
            }}
          >
            <MenuItem value="ALL">{t('dwaionProposals.inbox.allSources')}</MenuItem>
            {sources.map((value) => (
              <MenuItem key={value} value={value}>
                {display('sourceTypes', value)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel id="dwaion-proposal-priority-filter-label">
            {t('dwaionProposals.inbox.priorityFilter')}
          </InputLabel>
          <Select
            labelId="dwaion-proposal-priority-filter-label"
            value={priority}
            label={t('dwaionProposals.inbox.priorityFilter')}
            onChange={(event) => onPriorityChange(event.target.value)}
            sx={{
              bgcolor: 'var(--dwp-product-soft)',
              borderRadius: foundationTokens.radius.surface * 125 + 'px',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
            }}
          >
            <MenuItem value="ALL">{t('dwaionProposals.inbox.allPriorities')}</MenuItem>
            {(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const).map((value) => (
              <MenuItem key={value} value={value}>
                {t(`dwaionProposals.priorities.${value}`)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </Paper>
  );
}

export function DwaionProposalPreview({
  proposal,
  locale,
  onOpen,
}: {
  proposal: DwaionProposal | null;
  locale: 'ko' | 'en';
  onOpen: (proposal: DwaionProposal) => void;
}) {
  const { t } = useTranslation('work');
  if (!proposal) {
    return (
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="h6">{t('dwaionProposals.preview.title')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t('dwaionProposals.preview.empty')}
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      component="aside"
      variant="outlined"
      aria-labelledby="dwaion-proposal-preview-title"
      data-testid="dwaion-proposal-preview"
      sx={{ p: 2, position: 'sticky', top: 16, boxShadow: (theme) => theme.shadows[2] }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Stack direction="row" alignItems="center" gap={0.75}>
          <FileSearch size={19} color="var(--dwp-product-accent)" aria-hidden="true" />
          <Typography id="dwaion-proposal-preview-title" component="h2" variant="h6">
            {t('dwaionProposals.preview.title')}
          </Typography>
        </Stack>
        <Chip size="small" label={t(`dwaionProposals.states.${proposal.state}`)} />
      </Stack>

      <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 2 }}>
        <Chip
          size="small"
          color={proposalIsHighPriority(proposal) ? 'warning' : 'default'}
          label={t('dwaionProposals.detail.priority', {
            priority: t(`dwaionProposals.priorities.${proposal.priority}`),
          })}
        />
        <Chip size="small" variant="outlined" label={t(`dwaionProposals.kinds.${proposal.kind}`)} />
        <Chip
          size="small"
          variant="outlined"
          label={`#${proposal.proposalId}`}
          sx={{ '& .MuiChip-label': { fontFamily: foundationTokens.font.mono } }}
        />
      </Stack>
      <Typography component="h3" variant="h5" fontWeight="fontWeightBold" sx={{ mt: 1.25 }}>
        {proposal.content.title}
      </Typography>

      <Box
        sx={{
          mt: 2,
          p: 1.5,
          borderRadius: foundationTokens.radius.surface + 'px',
          bgcolor: 'var(--dwp-product-soft)',
        }}
      >
        <Typography variant="subtitle2" color="primary.main" fontWeight="fontWeightBold">
          {t('dwaionProposals.detail.why')}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.65, lineHeight: 'typography.body2.lineHeight' }}>
          {proposal.content.rationale}
        </Typography>
      </Box>

      <Box component="section" sx={{ mt: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
            {t('dwaionProposals.preview.evidence')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('dwaionProposals.evidenceCount', { count: proposal.content.evidence?.length ?? 0 })}
          </Typography>
        </Stack>
        <Box sx={{ mt: 1 }}>
          <DwaionProposalEvidence proposal={proposal} locale={locale} compact />
        </Box>
      </Box>

      <Box
        sx={{
          mt: 2,
          p: 1.5,
          borderRadius: foundationTokens.radius.surface + 'px',
          bgcolor: 'action.hover',
        }}
      >
        <Typography variant="subtitle2" color="primary.main" fontWeight="fontWeightBold">
          {t('dwaionProposals.preview.nextStep')}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {proposal.actionKey
            ? t('dwaionProposals.preview.reviewAction')
            : t('dwaionProposals.preview.reviewOnly')}
        </Typography>
      </Box>

      <Stack direction="row" gap={0.75} alignItems="flex-start" sx={{ mt: 1.5 }}>
        <ShieldCheck size={16} color="var(--dwp-product-secondary)" aria-hidden="true" />
        <Typography variant="caption" color="text.secondary">
          {t('dwaionProposals.actions.reviewBoundary')}
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
        {t('dwaionProposals.detail.proposedAt')}
        {': '}
        {formatDate(proposal.proposedAt, { dateStyle: 'medium', timeStyle: 'short' }, locale)}
        {' · '}
        {t('dwaionProposals.detail.expiresAt')}
        {': '}
        {formatDate(proposal.expiresAt, { dateStyle: 'medium', timeStyle: 'short' }, locale)}
      </Typography>
      <ActionButton
        fullWidth
        intent="primary"
        endIcon={<ArrowRight size={17} aria-hidden="true" />}
        onClick={() => onOpen(proposal)}
        sx={{ mt: 2, minHeight: 46 }}
      >
        {t('dwaionProposals.preview.open')}
      </ActionButton>
    </Paper>
  );
}
