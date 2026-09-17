import { useTranslation } from 'react-i18next';
import Typography from '@mui/material/Typography';

export function NotificationResultCount({
  visible,
  total,
}: {
  visible: number;
  total: number | null | undefined;
}) {
  const { t } = useTranslation('notifications');
  if (typeof total !== 'number') return null;
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      aria-live="polite"
      sx={{ display: 'block', mb: 0.75, fontVariantNumeric: 'tabular-nums' }}
    >
      {t('center.resultCount', {
        visible,
        total,
      })}
    </Typography>
  );
}
