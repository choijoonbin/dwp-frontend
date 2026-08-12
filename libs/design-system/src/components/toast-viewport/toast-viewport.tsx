import { useToastStore } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';

export function ToastViewport() {
  const toast = useToastStore();
  const passiveSuccess = toast.severity === 'success' && !toast.action;

  return (
    <Snackbar
      open={toast.open}
      anchorOrigin={toast.anchorOrigin}
      autoHideDuration={6000}
      onClose={toast.hide}
      sx={{ pointerEvents: 'none' }}
    >
      <Alert
        variant="filled"
        severity={toast.severity}
        onClose={passiveSuccess ? undefined : toast.hide}
        sx={{
          bgcolor: `${toast.severity}.dark`,
          color: 'common.white',
          pointerEvents: passiveSuccess ? 'none' : 'auto',
          '& .MuiAlert-icon, & .MuiAlert-action': { color: 'inherit' },
        }}
        action={
          toast.action ? (
            <Button color="inherit" href={toast.action.href} size="small" onClick={toast.hide}>
              {toast.action.label}
            </Button>
          ) : undefined
        }
      >
        {toast.message}
      </Alert>
    </Snackbar>
  );
}
