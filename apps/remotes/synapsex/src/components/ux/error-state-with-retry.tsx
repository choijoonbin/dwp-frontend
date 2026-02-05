/**
 * Error State with Retry CTA — 엔터프라이즈급 통일
 * @see SynapseX 운영형 UX 마감 - 전 화면 공통
 */

import { useTranslation } from '@dwp-frontend/shared-i18n';

import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';

type ErrorStateWithRetryProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  is403?: boolean;
};

export const ErrorStateWithRetry = ({
  title,
  message,
  onRetry,
  is403 = false,
}: ErrorStateWithRetryProps) => {
  const { t } = useTranslation('common');
  const displayTitle =
    title ??
    (is403 ? t('error.errorState.forbidden') : t('error.errorState.failedToLoad'));
  const displayMessage =
    message ??
    (is403 ? t('error.errorState.forbiddenMessage') : t('error.errorState.unknownError'));

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Card variant="outlined">
        <CardContent sx={{ p: 6, textAlign: 'center' }}>
          <Iconify
            icon={is403 ? 'solar:lock-bold-duotone' : 'solar:danger-triangle-bold-duotone'}
            width={48}
            sx={{ color: is403 ? 'warning.main' : 'error.main', mb: 2 }}
          />
          <Typography variant="h6" sx={{ mb: 1 }}>
            {displayTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {displayMessage}
          </Typography>
          {onRetry && !is403 && (
            <Button
              variant="outlined"
              onClick={onRetry}
              startIcon={<Iconify icon="solar:refresh-bold" width={18} />}
            >
              {t('error.errorState.retry')}
            </Button>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
