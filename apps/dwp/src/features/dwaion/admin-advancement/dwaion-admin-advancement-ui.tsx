import { AlertTriangle, CheckCircle2, CircleDashed } from 'lucide-react';
import {
  ErrorState,
  InlineFeedback,
  LiveStatus,
  LoadingState,
  foundationTokens,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  DwaionControlPlaneCapability,
  DwaionOperationalHealth,
} from '@dwp-frontend/shared-utils';
import type { ReactNode } from 'react';

import { useDwaionAdminAdvancementCopy } from './dwaion-admin-advancement-copy';

export function DwaionAdminSection({
  title,
  description,
  actions,
  children,
  id,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  const headingId = id ?? `admin-section-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <Box
      component="section"
      aria-labelledby={headingId}
      sx={{
        minWidth: 0,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: `${foundationTokens.radius.surface}px`,
        overflow: 'hidden',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        gap={1.25}
        sx={{ px: { xs: 1.75, md: 2.25 }, py: 1.75, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography id={headingId} component="h2" variant="h6">
            {title}
          </Typography>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {description}
            </Typography>
          )}
        </Box>
        {actions && <Box sx={{ flexShrink: 0 }}>{actions}</Box>}
      </Stack>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

export function DwaionCapabilityNotice({
  capability,
}: {
  capability: DwaionControlPlaneCapability;
}) {
  const copy = useDwaionAdminAdvancementCopy();
  if (capability.status === 'AVAILABLE' && capability.configured) return null;
  const severity = capability.status === 'PARTIAL' ? 'warning' : 'error';
  const label =
    capability.status === 'PARTIAL'
      ? copy.partial
      : capability.status === 'NOT_CONFIGURED'
        ? copy.notConfigured
        : copy.unavailable;
  return (
    <InlineFeedback severity={severity} sx={{ mb: 2 }}>
      <Typography component="span" variant="subtitle2">
        {label}
      </Typography>{' '}
      {capability.reason}
      {capability.recoveryHint ? ` · ${capability.recoveryHint}` : ''}
    </InlineFeedback>
  );
}

export function DwaionAdminQueryBoundary({
  loading,
  error,
  fetching,
  onRetry,
  children,
}: {
  loading: boolean;
  error: boolean;
  fetching: boolean;
  onRetry: () => void;
  children: ReactNode;
}) {
  const copy = useDwaionAdminAdvancementCopy();
  if (loading) return <LoadingState label={copy.loading} variant="skeleton" />;
  if (error) {
    return (
      <ErrorState
        title={copy.unavailableTitle}
        description={copy.unavailableDescription}
        retryLabel={copy.retry}
        retrying={fetching}
        onRetry={onRetry}
      />
    );
  }
  return <>{children}</>;
}

export function DwaionFreshness({
  generatedAt,
  fetching,
  onRefresh,
}: {
  generatedAt: string;
  fetching: boolean;
  onRefresh: () => void;
}) {
  const copy = useDwaionAdminAdvancementCopy();
  return (
    <LiveStatus
      state={fetching ? 'syncing' : 'live'}
      label={copy.live}
      detail={`${copy.generatedAt} ${formatDate(generatedAt, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })}`}
      refreshLabel={copy.refresh}
      refreshing={fetching}
      onRefresh={onRefresh}
    />
  );
}

export function DwaionHealthChip({ health }: { health: DwaionOperationalHealth }) {
  const color: 'success' | 'warning' | 'error' | 'default' =
    health === 'HEALTHY'
      ? 'success'
      : health === 'DEGRADED'
        ? 'warning'
        : health === 'FAILED'
          ? 'error'
          : 'default';
  const icon =
    health === 'HEALTHY' ? (
      <CheckCircle2 size={14} />
    ) : health === 'UNKNOWN' ? (
      <CircleDashed size={14} />
    ) : (
      <AlertTriangle size={14} />
    );
  return <Chip size="small" variant="outlined" color={color} icon={icon} label={health} />;
}
