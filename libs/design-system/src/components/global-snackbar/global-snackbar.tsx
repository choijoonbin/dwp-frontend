import { Link } from 'react-router-dom';
import { useToastStore } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';

// ----------------------------------------------------------------------

/**
 * 시스템 공통 안내/에러 메시지용 Snackbar.
 * Host App에 한 번만 마운트하고, showToast()로 메뉴/Remote 구분 없이 호출.
 * action이 있으면 "Audit 상세 보기" 등 링크 버튼 표시.
 */
export const GlobalSnackbar = () => {
  const open = useToastStore((s) => s.open);
  const message = useToastStore((s) => s.message);
  const severity = useToastStore((s) => s.severity);
  const action = useToastStore((s) => s.action);
  const anchorOrigin = useToastStore((s) => s.anchorOrigin);
  const hide = useToastStore((s) => s.actions.hide);

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
