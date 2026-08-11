import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { ActionButton } from '../actions';

export type StatePanelSize = 'compact' | 'standard' | 'page';

const MIN_HEIGHT: Record<StatePanelSize, number> = { compact: 120, standard: 200, page: 320 };

type StatePanelProps = {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  size?: StatePanelSize;
  role?: 'status' | 'alert';
};

function StatePanel({
  icon,
  title,
  description,
  action,
  size = 'standard',
  role,
}: StatePanelProps) {
  return (
    <Stack
      role={role}
      aria-live={role === 'alert' ? 'assertive' : role ? 'polite' : undefined}
      alignItems="center"
      justifyContent="center"
      textAlign="center"
      gap={1}
      sx={{ minHeight: MIN_HEIGHT[size], px: 3, py: 4, color: 'text.secondary' }}
    >
      <Box
        aria-hidden="true"
        sx={{ display: 'grid', placeItems: 'center', color: 'text.disabled' }}
      >
        {icon}
      </Box>
      <Typography component="h2" variant="subtitle1" color="text.primary">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ maxWidth: 560 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Stack>
  );
}

export type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: React.ReactNode;
  size?: StatePanelSize;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  action,
  size,
}: EmptyStateProps) {
  const resolvedAction =
    action ??
    (actionLabel && onAction ? (
      <ActionButton intent="secondary" onClick={onAction}>
        {actionLabel}
      </ActionButton>
    ) : undefined);
  return (
    <StatePanel
      icon={<Inbox size={28} strokeWidth={1.7} />}
      title={title}
      description={description}
      action={resolvedAction}
      size={size}
    />
  );
}

export type ErrorStateProps = {
  title: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  retrying?: boolean;
  size?: StatePanelSize;
};

export function ErrorState({
  title,
  description,
  retryLabel,
  onRetry,
  retrying = false,
  size,
}: ErrorStateProps) {
  return (
    <StatePanel
      role="alert"
      icon={<AlertCircle size={28} strokeWidth={1.7} />}
      title={title}
      description={description}
      action={
        retryLabel && onRetry ? (
          <ActionButton intent="secondary" onClick={onRetry} loading={retrying}>
            {retryLabel}
          </ActionButton>
        ) : undefined
      }
      size={size}
    />
  );
}

export type LoadingStateProps = {
  label: string;
  description?: string;
  variant?: 'spinner' | 'skeleton';
  skeletonRows?: number;
  size?: StatePanelSize;
};

export function LoadingState({
  label,
  description,
  variant = 'spinner',
  skeletonRows = 3,
  size = 'standard',
}: LoadingStateProps) {
  if (variant === 'skeleton') {
    return (
      <Box
        role="status"
        aria-label={label}
        aria-live="polite"
        sx={{ minHeight: MIN_HEIGHT[size], px: 3, py: 4 }}
      >
        <Typography variant="subtitle2" sx={{ mb: 2 }}>
          {label}
        </Typography>
        <Stack gap={1.25} aria-hidden="true">
          {Array.from({ length: Math.max(1, skeletonRows) }, (_, index) => (
            <Skeleton key={index} variant="rounded" height={36} />
          ))}
        </Stack>
      </Box>
    );
  }

  return (
    <StatePanel
      role="status"
      icon={
        <Box sx={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
          <LoaderCircle size={28} strokeWidth={1.5} />
          <CircularProgress size={32} sx={{ position: 'absolute' }} />
        </Box>
      }
      title={label}
      description={description}
      size={size}
    />
  );
}
