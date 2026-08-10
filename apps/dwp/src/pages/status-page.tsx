import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProductMark } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

type StatusPageProps = {
  code: string;
  titleKey: 'accessDenied' | 'notFound';
};

export function StatusPage({ code, titleKey }: StatusPageProps) {
  const { t } = useTranslation('shell');

  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 3 }}>
      <ProductMark
        aria-label={t('brand.productName')}
        sx={{ position: 'fixed', top: 24, left: 24 }}
      />
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h2">{code}</Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          {t(`statusPages.${titleKey}`)}
        </Typography>
        <Button component={Link} to="/" variant="contained">
          {t('statusPages.home')}
        </Button>
      </Box>
    </Box>
  );
}
