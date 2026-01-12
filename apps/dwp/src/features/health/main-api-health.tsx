import { useState, useEffect } from 'react';
import { getMainHealth, type ApiResponse, type MainHealthPayload } from '@dwp-frontend/shared-utils';

import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import AlertTitle from '@mui/material/AlertTitle';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

async function fetchMainHealth() {
  return getMainHealth();
}

export const MainApiHealth = () => {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'success'; data: ApiResponse<MainHealthPayload> }
  >({ status: 'loading' });

  useEffect(() => {
    let alive = true;

    fetchMainHealth()
      .then((data) => {
        if (!alive) return;
        setState({ status: 'success', data });
      })
      .catch(() => {
        if (!alive) return;
        setState({ status: 'error' });
      });

    return () => {
      alive = false;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <Alert severity="info" variant="outlined">
        <AlertTitle>Main API Health</AlertTitle>
        Checking gateway… <Chip size="small" label="Loading" />
      </Alert>
    );
  }

  if (state.status === 'error') {
    return (
      <Alert severity="error" variant="outlined">
        <AlertTitle>Main API Health</AlertTitle>
        Failed to reach backend via Gateway. <Chip size="small" color="error" label="ERROR" />
      </Alert>
    );
  }

  const ok = state.data.status === 'SUCCESS';

  return (
    <Alert severity={ok ? 'success' : 'warning'} variant="outlined">
      <AlertTitle>Main API Health</AlertTitle>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Chip size="small" color={ok ? 'success' : 'warning'} label={ok ? 'OK' : 'NOT OK'} />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          status: {state.data.status}
          {state.data.timestamp ? ` • ${state.data.timestamp}` : ''}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {state.data.data}
        </Typography>
        {state.data.message && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {state.data.message}
          </Typography>
        )}
      </Stack>
    </Alert>
  );
};

