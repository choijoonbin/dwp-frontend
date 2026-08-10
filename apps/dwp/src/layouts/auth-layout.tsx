import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProductMark } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { LanguageMenu } from '../components/language-menu';

const AUTH_WORLD_ASSET = '/assets/auth/dwp-auth-world-v1.jpg';

export function AuthLayout() {
  const { t } = useTranslation('auth');
  const { t: tShell } = useTranslation('shell');

  return (
    <Box
      component="main"
      data-dwp-auth-layout
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(430px, 500px)' },
        gridTemplateRows: {
          xs: '230px minmax(0, 1fr)',
          sm: '260px minmax(0, 1fr)',
          md: 'minmax(0, 1fr)',
        },
        position: 'relative',
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        component="section"
        aria-labelledby="dwp-auth-title"
        sx={{
          gridColumn: 1,
          gridRow: 1,
          minWidth: 0,
          minHeight: { xs: 230, sm: 260, md: '100dvh' },
          position: 'relative',
          overflow: 'hidden',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: { xs: 3, sm: 4, md: 6, lg: 7 },
          color: '#FFFFFF',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: {
              xs: 'linear-gradient(180deg, rgba(10, 18, 24, 0.66) 0%, rgba(10, 18, 24, 0.16) 44%, rgba(10, 18, 24, 0.78) 100%)',
              md: 'linear-gradient(90deg, rgba(10, 18, 24, 0.68) 0%, rgba(10, 18, 24, 0.28) 58%, rgba(10, 18, 24, 0.04) 100%)',
            },
          },
        }}
      >
        <Box
          component="img"
          src={AUTH_WORLD_ASSET}
          alt=""
          aria-hidden="true"
          data-testid="auth-world-visual"
          sx={{
            position: 'absolute',
            inset: 0,
            width: 1,
            height: 1,
            objectFit: 'cover',
            objectPosition: 'left center',
            transform: 'scale(1.55)',
            transformOrigin: 'left center',
            userSelect: 'none',
          }}
        />

        <ProductMark
          aria-label={tShell('brand.productName')}
          sx={{
            position: 'relative',
            zIndex: 1,
            alignSelf: 'flex-start',
            color: '#FFFFFF',
            textShadow: '0 1px 12px rgba(0, 0, 0, 0.28)',
          }}
        />

        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            maxWidth: 650,
            animation: 'dwp-auth-copy-enter 520ms cubic-bezier(0.2, 0, 0, 1) both',
            '@keyframes dwp-auth-copy-enter': {
              from: { opacity: 0, transform: 'translateY(8px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        >
          <Typography
            variant="overline"
            sx={{ color: '#BDEFE7', display: { xs: 'none', sm: 'block' }, mb: 1.5 }}
          >
            {t('layout.eyebrow')}
          </Typography>
          <Typography
            id="dwp-auth-title"
            component="h1"
            sx={{
              m: 0,
              color: 'inherit',
              fontSize: { xs: '1.75rem', md: '3.25rem', xl: '3.75rem' },
              lineHeight: { xs: 1.25, md: 1.12 },
              fontWeight: 760,
              letterSpacing: 0,
              textShadow: '0 2px 24px rgba(0, 0, 0, 0.28)',
            }}
          >
            {t('layout.title')}
          </Typography>
          <Typography
            sx={{
              mt: { xs: 1, md: 2.5 },
              maxWidth: { xs: '100%', md: 640 },
              color: '#F2F6F7',
              fontSize: { xs: '0.875rem', md: '1.0625rem' },
              lineHeight: 1.65,
              textShadow: '0 1px 16px rgba(0, 0, 0, 0.36)',
            }}
          >
            {t('layout.description')}
          </Typography>
        </Box>

        <Typography
          variant="caption"
          sx={{
            position: 'relative',
            zIndex: 1,
            display: { xs: 'none', md: 'block' },
            color: '#E6ECEE',
          }}
        >
          {t('layout.platform')}
        </Typography>
      </Box>

      <Box
        component="section"
        aria-label={t('layout.accessRegion')}
        sx={{
          gridColumn: { xs: 1, md: 2 },
          gridRow: { xs: 2, md: 1 },
          minWidth: 0,
          minHeight: {
            xs: 'calc(100dvh - 230px)',
            sm: 'calc(100dvh - 260px)',
            md: '100dvh',
          },
          position: 'relative',
          zIndex: 2,
          display: 'grid',
          gridTemplateRows: { xs: 'minmax(min-content, 1fr) auto', md: '1fr' },
          justifyItems: 'center',
          alignItems: 'stretch',
          px: { xs: 3, sm: 6, md: 6 },
          py: { xs: 3.5, sm: 6, md: 8 },
          overflowY: 'auto',
          color: 'text.primary',
          bgcolor: 'background.paper',
          borderTop: { xs: '1px solid', md: 0 },
          borderLeft: { xs: 0, md: '1px solid' },
          borderColor: 'divider',
          animation: 'dwp-auth-panel-enter 420ms cubic-bezier(0.2, 0, 0, 1) both',
          '@keyframes dwp-auth-panel-enter': {
            from: { opacity: 0, transform: 'translateX(8px)' },
            to: { opacity: 1, transform: 'translateX(0)' },
          },
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      >
        <Box sx={{ width: 1, maxWidth: 380, alignSelf: 'center' }}>
          <Outlet />
        </Box>
        <Box
          component="footer"
          data-dwp-auth-language-footer
          sx={{
            width: { xs: 1, md: 'auto' },
            mt: { xs: 3, md: 0 },
            display: 'flex',
            justifyContent: 'flex-end',
            justifySelf: 'end',
            alignSelf: 'end',
            position: { xs: 'static', md: 'absolute' },
            right: { md: '24px', lg: '32px' },
            bottom: { md: '24px', lg: '32px' },
          }}
        >
          <LanguageMenu />
        </Box>
      </Box>
    </Box>
  );
}
