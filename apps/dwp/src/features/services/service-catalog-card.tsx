import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Building2,
  LifeBuoy,
  MonitorCog,
  ShoppingBag,
  Sparkles,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { LucideIcon } from 'lucide-react';
import type { ServiceCatalogItem, ServiceCategory } from '@dwp-frontend/shared-utils';

const categoryIcons: Record<string, LucideIcon> = {
  TECHNOLOGY: MonitorCog,
  PEOPLE: UsersRound,
  WORKPLACE: Building2,
  FINANCE: WalletCards,
  PROCUREMENT: ShoppingBag,
};

const categoryColors: Record<string, { color: string; background: string }> = {
  BLUE: { color: '#175CD3', background: '#E9F2FF' },
  GREEN: { color: '#087A5B', background: '#E7F6F0' },
  TEAL: { color: '#087A85', background: '#E6F6F7' },
  AMBER: { color: '#A15C00', background: '#FFF2D8' },
  CORAL: { color: '#B23A3A', background: '#FDECEC' },
};

export function ServiceCatalogCard({
  item,
  category,
  onRequest,
}: {
  item: ServiceCatalogItem;
  category?: ServiceCategory;
  onRequest: (item: ServiceCatalogItem) => void;
}) {
  const { t } = useTranslation('services');
  const Icon = categoryIcons[item.categoryKey] ?? LifeBuoy;
  const tone = categoryColors[category?.tone ?? 'BLUE'] ?? categoryColors.BLUE;
  return (
    <Box
      component="article"
      sx={{
        minHeight: 228,
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 12px 30px rgba(16, 24, 40, 0.08)',
          borderColor: 'primary.light',
        },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
        <Box
          aria-hidden="true"
          sx={{
            width: 42,
            height: 42,
            display: 'grid',
            placeItems: 'center',
            color: tone.color,
            bgcolor: tone.background,
            borderRadius: 1,
          }}
        >
          <Icon size={21} strokeWidth={1.8} />
        </Box>
        {item.featured && (
          <Chip
            size="small"
            icon={<Sparkles size={13} />}
            label={t('discover.featuredBadge')}
            color="primary"
            variant="outlined"
          />
        )}
      </Stack>
      <Typography component="h3" variant="subtitle1" fontWeight={800} sx={{ mt: 2 }}>
        {item.name}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, flex: 1 }}>
        {item.description}
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 2 }}>
        <Chip
          size="small"
          variant="outlined"
          label={t('discover.estimate', { hours: item.estimatedResolutionHours })}
        />
        <Chip
          size="small"
          variant="outlined"
          label={t('discover.classification', {
            level: t(`classification.${item.dataClassification}`),
          })}
        />
      </Stack>
      <ActionButton
        intent="quiet"
        endIcon={<ArrowRight size={16} />}
        onClick={() => onRequest(item)}
        sx={{ alignSelf: 'flex-start', mt: 1.5, px: 0.5 }}
      >
        {t('discover.request')}
      </ActionButton>
    </Box>
  );
}
