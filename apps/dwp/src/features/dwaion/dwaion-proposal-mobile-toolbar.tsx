import { useTranslation } from 'react-i18next';
import { Circle, SlidersHorizontal } from 'lucide-react';
import { ActionIconButton, foundationTokens } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function DwaionProposalMobileToolbar({
  reviewCount,
  filtersOpen,
  onToggleFilters,
}: {
  reviewCount: number;
  filtersOpen: boolean;
  onToggleFilters: () => void;
}) {
  const { t } = useTranslation('work');
  return (
    <Box sx={{ display: { xs: 'block', md: 'none' } }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.5}>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={0.8} flexWrap="wrap">
            <Typography component="h1" variant="h4" fontWeight="fontWeightBold">
              {t('dwaionProposals.title')}
            </Typography>
            <Chip
              size="small"
              color={reviewCount ? 'warning' : 'default'}
              label={t('dwaionProposals.mobile.reviewCount', { count: reviewCount })}
              sx={{ height: 'auto', minHeight: 26, '& .MuiChip-label': { whiteSpace: 'normal' } }}
            />
          </Stack>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, lineHeight: 'typography.body2.lineHeight' }}
          >
            {t('dwaionProposals.description')}
          </Typography>
        </Box>
        <ActionIconButton
          label={t('dwaionProposals.mobile.filters')}
          aria-pressed={filtersOpen}
          onClick={onToggleFilters}
          sx={{ width: 48, height: 48, flex: '0 0 auto', bgcolor: 'var(--dwp-product-soft)' }}
        >
          <SlidersHorizontal size={20} aria-hidden="true" />
        </ActionIconButton>
      </Stack>
    </Box>
  );
}

export function DwaionProposalContextStrip({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation('work');
  return (
    <Stack
      component="aside"
      aria-label={t('dwaionProposals.context.live')}
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      gap={1}
      sx={{
        minHeight: { xs: 32, md: 42 },
        mb: { xs: 1.5, md: 2 },
        px: { xs: 1.25, md: 1.75 },
        py: { xs: 0.55, md: 0.8 },
        borderRadius: foundationTokens.radius.surface + foundationTokens.radius.compact / 2 + 'px',
        bgcolor: 'var(--dwp-product-soft)',
        color: 'text.secondary',
      }}
    >
      <Stack direction="row" alignItems="center" gap={0.65} sx={{ minWidth: 0 }}>
        <Circle
          size={10}
          fill="currentColor"
          color="var(--dwp-product-accent)"
          aria-hidden="true"
        />
        <Typography
          variant="caption"
          fontWeight="fontWeightBold"
          noWrap
          sx={{ maxWidth: { xs: compact ? 220 : 250, md: 'none' } }}
        >
          {compact ? (
            <>
              {t('dwaionProposals.context.live')} · {t('dwaionProposals.context.readOnly')}
            </>
          ) : (
            <>
              {t('dwaionProposals.context.live')} · {t('dwaionProposals.context.scope')} ·{' '}
              {t('dwaionProposals.context.readOnly')}
            </>
          )}
        </Typography>
      </Stack>
      <Chip
        size="small"
        color="primary"
        variant="outlined"
        label={t('dwaionProposals.context.connected')}
        sx={{
          flex: '0 0 auto',
          height: 24,
          bgcolor: 'background.paper',
          fontWeight: 'fontWeightBold',
        }}
      />
    </Stack>
  );
}
