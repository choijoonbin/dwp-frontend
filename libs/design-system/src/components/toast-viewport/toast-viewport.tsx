import { useToastStore } from '@dwp-frontend/shared-utils/toast/toast-store';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import { getContrastRatio } from '@mui/material/styles';

export function ToastViewport() {
  const toast = useToastStore();
  const passiveSuccess = toast.severity === 'success' && !toast.action;

  return (
    <Snackbar
      open={toast.open}
      anchorOrigin={toast.anchorOrigin}
      autoHideDuration={6000}
      onClose={toast.hide}
      sx={{
        pointerEvents: 'none',
        bottom: {
          xs: 'calc(8px + var(--dwp-mobile-fixed-footer-offset, 0px))',
          sm: 'calc(24px + var(--dwp-mobile-fixed-footer-offset, 0px))',
        },
      }}
    >
      <Alert
        variant="filled"
        severity={toast.severity}
        onClose={passiveSuccess ? undefined : toast.hide}
        sx={(theme) => {
          const background = theme.palette[toast.severity].dark;
          const { black, white } = theme.palette.common;
          return {
            bgcolor: background,
            color:
              getContrastRatio(background, black) > getContrastRatio(background, white)
                ? black
                : white,
            pointerEvents: passiveSuccess ? 'none' : 'auto',
            '& .MuiAlert-icon, & .MuiAlert-action': { color: 'inherit' },
          };
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
