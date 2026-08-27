import {
  AlertCircle,
  CircleHelp,
  Inbox,
  LoaderCircle,
  SearchX,
  Settings2,
  ShieldX,
} from 'lucide-react';

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
  titleComponent?: 'h1' | 'h2';
  description?: string;
  action?: React.ReactNode;
  size?: StatePanelSize;
  role?: 'status' | 'alert';
};

function StatePanel({
  icon,
  title,
  titleComponent = 'h2',
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
      <Typography component={titleComponent} variant="subtitle1" color="text.primary">
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
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: React.ReactNode;
  size?: StatePanelSize;
};

export function EmptyState({
  icon,
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
      icon={icon ?? <Inbox size={28} strokeWidth={1.7} />}
      title={title}
      description={description}
      action={resolvedAction}
      size={size}
    />
  );
}

export type GuidedEmptyStateKind = 'first-use' | 'no-results' | 'permission' | 'empty';

export type GuidedEmptyStateProps = {
  kind: GuidedEmptyStateKind;
  title: string;
  description: string;
  /** Page-level empty states may opt into the document's primary heading. */
  titleComponent?: 'h1' | 'h2';
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  size?: StatePanelSize;
};

const guidedEmptyIcons = {
  'first-use': Settings2,
  'no-results': SearchX,
  permission: ShieldX,
  empty: CircleHelp,
} as const;

export function GuidedEmptyState({
  kind,
  title,
  description,
  titleComponent,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  size,
}: GuidedEmptyStateProps) {
  const Icon = guidedEmptyIcons[kind];
  const action =
    actionLabel && onAction ? (
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="center">
        <ActionButton intent="primary" onClick={onAction}>
          {actionLabel}
        </ActionButton>
        {secondaryActionLabel && onSecondaryAction && (
          <ActionButton intent="secondary" onClick={onSecondaryAction}>
            {secondaryActionLabel}
          </ActionButton>
        )}
      </Stack>
    ) : undefined;

  return (
    <StatePanel
      role="status"
      icon={<Icon size={28} strokeWidth={1.7} />}
      title={title}
      titleComponent={titleComponent}
      description={description}
      action={action}
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

export type LocalErrorStateProps = ErrorStateProps & {
  lastSuccessfulLabel?: string;
  requestIdLabel?: string;
  supportLabel?: string;
  onSupport?: () => void;
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

export function LocalErrorState({
  title,
  description,
  retryLabel,
  onRetry,
  retrying = false,
  size,
  lastSuccessfulLabel,
  requestIdLabel,
  supportLabel,
  onSupport,
}: LocalErrorStateProps) {
  return (
    <StatePanel
      role="alert"
      icon={<AlertCircle size={28} strokeWidth={1.7} />}
      title={title}
      description={description}
      size={size}
      action={
        <Stack alignItems="center" gap={1.25}>
          {(lastSuccessfulLabel || requestIdLabel) && (
            <Stack gap={0.25}>
              {lastSuccessfulLabel && (
                <Typography variant="caption">{lastSuccessfulLabel}</Typography>
              )}
              {requestIdLabel && (
                <Typography
                  variant="caption"
                  sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}
                >
                  {requestIdLabel}
                </Typography>
              )}
            </Stack>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            {retryLabel && onRetry && (
              <ActionButton intent="secondary" onClick={onRetry} loading={retrying}>
                {retryLabel}
              </ActionButton>
            )}
            {supportLabel && onSupport && (
              <ActionButton intent="quiet" onClick={onSupport}>
                {supportLabel}
              </ActionButton>
            )}
          </Stack>
        </Stack>
      }
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
