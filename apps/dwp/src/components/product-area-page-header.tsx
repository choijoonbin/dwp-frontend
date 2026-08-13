import { useTranslation } from 'react-i18next';
import { CalendarRange, ShieldCheck } from 'lucide-react';
import { GlyphSurface } from '@dwp-frontend/design-system/components/glyph-surface/glyph-surface';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { LucideIcon } from 'lucide-react';

export function ProductAreaPageHeader({
  area,
  view,
  icon: Icon,
}: {
  area: 'people' | 'workforce' | 'hris';
  view: string;
  icon: LucideIcon;
}) {
  const { t } = useTranslation(area === 'hris' ? 'hris' : 'workforce');
  const workforce =
    area === 'workforce' ||
    (area === 'hris' && !['me', 'directory', 'organization', 'team'].includes(view));

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: { xs: 'flex-start', md: 'center' },
        justifyContent: 'space-between',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 2,
        pb: 2.5,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" alignItems="flex-start" gap={1.5} sx={{ minWidth: 0 }}>
        <GlyphSurface size={42} variant="soft">
          <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
        </GlyphSurface>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="p" variant="overline" color="primary.main">
            {t(`pages.${area}.${view}.eyebrow`)}
          </Typography>
          <Typography component="h1" variant="h4">
            {t(`pages.${area}.${view}.title`)}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.35 }}>
            {t(`pages.${area}.${view}.description`)}
          </Typography>
        </Box>
      </Stack>
      <Chip
        size="small"
        variant="outlined"
        icon={
          workforce ? (
            <CalendarRange size={14} strokeWidth={1.8} />
          ) : (
            <ShieldCheck size={14} strokeWidth={1.8} />
          )
        }
        label={t(workforce ? 'pages.context.effectiveDated' : 'pages.context.directorySafe')}
        sx={{ bgcolor: 'background.paper' }}
      />
    </Box>
  );
}
