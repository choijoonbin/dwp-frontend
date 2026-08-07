import { useRouteError, isRouteErrorResponse } from 'react-router-dom';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';

export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? String(error.status) + ' ' + error.statusText
    : error instanceof Error
      ? error.message
      : 'Unexpected error';

  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 3 }}>
      <Alert severity="error" sx={{ width: '100%', maxWidth: 560 }}>
        <Typography variant="subtitle1">{message}</Typography>
      </Alert>
    </Box>
  );
}
