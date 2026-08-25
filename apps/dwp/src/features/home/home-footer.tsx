import { useTranslation } from 'react-i18next';
import { Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const HOME_FOOTER_LINKS = [
  ['privacy', '/account/settings?view=privacy'],
  ['terms', '/account/settings?view=terms'],
  ['help', '/services'],
  ['status', '/apps'],
] as const;

export function HomeFooter({ updatedAt }: { updatedAt: string }) {
  const { t } = useTranslation('home');

  return (
    <Box
      component="footer"
      sx={{
        minHeight: { xs: 120, md: 64 },
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      <Box
        sx={{
          width: 1,
          maxWidth: 2560,
          minHeight: 'inherit',
          mx: 'auto',
          pl: { xs: 2, md: '24px' },
          pr: { xs: 9, md: 12 },
          py: { xs: 2, md: 1.5 },
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'flex-start', md: 'center' },
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
          <Clock3 size={15} aria-hidden="true" />
          <Typography variant="caption" color="text.secondary">
            {t('page.lastRefreshed', { time: updatedAt })}
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            maxWidth: '100%',
            columnGap: { xs: 2.5, md: 4 },
            rowGap: 1,
          }}
        >
          {HOME_FOOTER_LINKS.map(([label, to], index) => (
            <Typography
              key={label}
              component={Link}
              to={to}
              variant="caption"
              color="text.primary"
              sx={{
                display: index === 3 ? { xs: 'none', md: 'inline' } : 'inline',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {t(`footer.${label}`)}
            </Typography>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
