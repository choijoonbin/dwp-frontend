import { Link } from 'react-router-dom';
import { useToastStore } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';

// ----------------------------------------------------------------------

/** Application-wide feedback surface mounted once by the app shell. */
export const GlobalSnackbar = () => {
  const open = useToastStore((s) => s.open);
  const message = useToastStore((s) => s.message);
  const severity = useToastStore((s) => s.severity);
  const action = useToastStore((s) => s.action);
  const anchorOrigin = useToastStore((s) => s.anchorOrigin);
  const hide = useToastStore((s) => s.hide);

  return (
    <Snackbar
      open={open}
      autoHideDuration={6000}
      onClose={hide}
      anchorOrigin={anchorOrigin}
    >
      <Alert
        onClose={hide}
        severity={severity}
        sx={{ width: '100%' }}
        action={
          action ? (
            <Button
              color="inherit"
              component={Link}
              size="small"
              to={action.href}
              onClick={hide}
            >
              {action.label}
            </Button>
          ) : undefined
        }
      >
        {message}
      </Alert>
    </Snackbar>
  );
};
