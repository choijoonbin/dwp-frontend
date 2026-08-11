import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';

export function SkipNavigationLink() {
  const { t } = useTranslation('shell');

  return (
    <Box
      component="a"
      href="#dwp-main-content"
      onClick={() => {
        window.requestAnimationFrame(() => document.getElementById('dwp-main-content')?.focus());
      }}
      sx={{
        position: 'fixed',
        zIndex: (theme) => theme.zIndex.tooltip + 1,
        top: 8,
        left: 8,
        px: 1.5,
        py: 1,
        color: 'primary.contrastText',
        bgcolor: 'primary.main',
        borderRadius: 1,
        textDecoration: 'none',
        fontWeight: 700,
        transform: 'translateY(calc(-100% - 16px))',
        transition: (theme) => theme.transitions.create('transform'),
        '&:focus-visible': {
          transform: 'translateY(0)',
          outline: '2px solid',
          outlineColor: 'background.paper',
          outlineOffset: 2,
        },
      }}
    >
      {t('navigation.skipToContent')}
    </Box>
  );
}
