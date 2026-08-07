import { useToastStore } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';

export function ToastViewport() {
  const toast = useToastStore();

  return (
    <Snackbar
      open={toast.open}
      anchorOrigin={toast.anchorOrigin}
      autoHideDuration={6000}
      onClose={toast.hide}
    >
      <Alert
        variant="filled"
        severity={toast.severity}
        onClose={toast.hide}
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
