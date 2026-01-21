// ----------------------------------------------------------------------

import { memo } from 'react';
import { ApiErrorAlert } from '@dwp-frontend/shared-utils';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';

// ----------------------------------------------------------------------

type ErrorStateProps = {
  error: Error | null;
  onRetry?: () => void;
};

export const ErrorState = memo(({ error, onRetry }: ErrorStateProps) => (
  <Card sx={{ p: 2 }}>
    <Stack spacing={2}>
      <ApiErrorAlert error={error} />
      {onRetry && (
        <Button variant="outlined" onClick={onRetry} fullWidth>
          재시도
        </Button>
      )}
    </Stack>
  </Card>
));

ErrorState.displayName = 'ErrorState';
