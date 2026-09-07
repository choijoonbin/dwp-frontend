import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import type { SxProps, Theme } from '@mui/material/styles';
import { foundationTokens } from '../../foundation/tokens';

export type InlineFeedbackProps = {
  severity?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: ReactNode;
  sx?: SxProps<Theme>;
} & ({ onClose: () => void; closeLabel: string } | { onClose?: never; closeLabel?: never });

/** Persistent, compact feedback; urgent problems announce without relying on color. */
export function InlineFeedback({
  severity = 'info',
  title,
  children,
  sx,
  onClose,
  closeLabel,
}: InlineFeedbackProps) {
  const urgent = severity === 'warning' || severity === 'error';
  return (
    <Alert
      severity={severity}
      variant="standard"
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? 'assertive' : 'polite'}
      aria-atomic="true"
      closeText={closeLabel}
      onClose={onClose}
      iconMapping={{
        info: <Info size={20} aria-hidden="true" />,
        success: <CircleCheck size={20} aria-hidden="true" />,
        warning: <TriangleAlert size={20} aria-hidden="true" />,
        error: <CircleAlert size={20} aria-hidden="true" />,
      }}
      sx={[
        {
          minWidth: 0,
          borderRadius: foundationTokens.radius.control + 'px',
          '& .MuiAlert-message': { minWidth: 0, overflowWrap: 'anywhere' },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {title && <AlertTitle>{title}</AlertTitle>}
      {children}
    </Alert>
  );
}
