import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

type ErrorStateProps = {
  message?: string;
  onRetry?: () => void;
};

export const ErrorState = ({
  message = 'Failed to load tenant scope.',
  onRetry,
}: ErrorStateProps) => (
  <Box sx={{ py: 3 }}>
    <Alert
      severity="error"
      icon={<Iconify icon="solar:danger-triangle-bold" width={24} />}
      action={
        onRetry && (
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        )
      }
    >
      <Typography variant="body2">{message}</Typography>
    </Alert>
  </Box>
);
