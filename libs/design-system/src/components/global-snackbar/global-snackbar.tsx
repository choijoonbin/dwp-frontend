import { useToastStore } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';

// ----------------------------------------------------------------------

/**
 * 시스템 공통 안내/에러 메시지용 Snackbar.
 * Host App에 한 번만 마운트하고, showToast()로 메뉴/Remote 구분 없이 호출.
 */
export const GlobalSnackbar = () => {
  const open = useToastStore((s) => s.open);
  const message = useToastStore((s) => s.message);
  const severity = useToastStore((s) => s.severity);
  const hide = useToastStore((s) => s.actions.hide);

  return (
    <Snackbar
      open={open}
      autoHideDuration={6000}
      onClose={hide}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert onClose={hide} severity={severity} sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  );
};
