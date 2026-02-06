import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

type ErrorStateProps = {
  message?: string;
  onRetry?: () => void;
};

export const ErrorState = ({ message, onRetry }: ErrorStateProps) => {
  const { t } = useTranslation('common');
  const displayMessage = message ?? t('tenantScope.failedToLoad');
  return (
  <Box sx={{ py: 3 }}>
    <Alert
      severity="error"
      icon={<Iconify icon="solar:danger-triangle-bold" width={24} />}
      action={
        onRetry && (
          <Button color="inherit" size="small" onClick={onRetry}>
            {t('tenantScope.retry')}
          </Button>
        )
      }
    >
      <Typography variant="body2">{displayMessage}</Typography>
    </Alert>
  </Box>
  );
};
