import { useTranslation } from 'react-i18next';
import { CheckSquare2 } from 'lucide-react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function WorkHubNoSelection() {
  const { t } = useTranslation('work');
  return (
    <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 480, p: 3 }}>
      <CheckSquare2 size={30} aria-hidden="true" />
      <Typography component="h2" variant="subtitle1" sx={{ mt: 1.5 }}>
        {t('workHub.detail.selectTitle')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {t('workHub.detail.selectDescription')}
      </Typography>
    </Stack>
  );
}
