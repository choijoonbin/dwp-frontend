import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  CircleSlash2,
  Clock3,
  ServerCog,
  ShieldAlert,
  TriangleAlert,
  XCircle,
} from 'lucide-react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { messagingRelativeTime } from './messaging-components';
import { messagingVisualTokens } from './messaging-visual-model';

import type { MessagingAdminOverview } from '@dwp-frontend/shared-utils';
import type { ChipProps } from '@mui/material/Chip';
import type { LucideIcon } from 'lucide-react';

type RuntimeReadiness = NonNullable<MessagingAdminOverview['runtimeReadiness']>;
type RuntimeCapability = RuntimeReadiness['capabilities'][number];
type RuntimeState = RuntimeCapability['state'];

const STATE_ICON: Record<RuntimeState, LucideIcon> = {
  READY: CheckCircle2,
  DEGRADED: TriangleAlert,
  BLOCKED: ShieldAlert,
  UNAVAILABLE: XCircle,
  DISABLED: CircleSlash2,
};

const STATE_COLOR: Record<RuntimeState, ChipProps['color']> = {
  READY: 'success',
  DEGRADED: 'warning',
  BLOCKED: 'error',
  UNAVAILABLE: 'error',
  DISABLED: 'default',
};

export function MessagingAdminReadiness({
  readiness,
  generatedAt,
}: {
  readiness: MessagingAdminOverview['runtimeReadiness'];
  generatedAt: string;
}) {
  const { t, i18n } = useTranslation('messaging');
  const locale = i18n.resolvedLanguage ?? i18n.language;

  if (!readiness) {
    return (
      <Box component="section" aria-labelledby="messaging-runtime-readiness-title">
        <Typography id="messaging-runtime-readiness-title" component="h2" variant="h6">
          {t('admin.readiness.title')}
        </Typography>
        <Alert severity="warning" sx={{ mt: 1 }}>
          {t('admin.readiness.contractUnavailable')}
        </Alert>
      </Box>
    );
  }

  const OverallIcon = STATE_ICON[readiness.overallState];
  return (
    <Box component="section" aria-labelledby="messaging-runtime-readiness-title">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
      >
        <Box>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <ServerCog size={18} aria-hidden="true" />
            <Typography id="messaging-runtime-readiness-title" component="h2" variant="h6">
              {t('admin.readiness.title')}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {t('admin.readiness.description')}
          </Typography>
        </Box>
        <Chip
          icon={<OverallIcon size={15} aria-hidden="true" />}
          color={STATE_COLOR[readiness.overallState]}
          label={t(`admin.readiness.states.${readiness.overallState}`)}
          aria-label={t('admin.readiness.overallState', {
            state: t(`admin.readiness.states.${readiness.overallState}`),
          })}
        />
      </Stack>

      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1 }}>
        <Clock3 size={14} aria-hidden="true" />
        <Typography variant="caption" color="text.secondary">
          {t('admin.readiness.evaluated', {
            time: messagingRelativeTime(readiness.evaluatedAt || generatedAt, locale),
          })}
        </Typography>
      </Stack>

      <Box
        component="ul"
        sx={{
          m: 0,
          mt: 1.25,
          p: 0,
          listStyle: 'none',
          border: 1,
          borderColor: 'divider',
          borderRadius: messagingVisualTokens.radius.surface,
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        {readiness.capabilities.map((capability) => (
          <CapabilityRow key={capability.capability} capability={capability} locale={locale} />
        ))}
      </Box>
    </Box>
  );
}

function CapabilityRow({ capability, locale }: { capability: RuntimeCapability; locale: string }) {
  const { t } = useTranslation('messaging');
  const Icon = STATE_ICON[capability.state];
  const labelKey = `admin.readiness.capabilities.${capability.capability}`;
  const label = t(labelKey, { defaultValue: capability.capability.replaceAll('_', ' ') });
  const verified = capability.lastVerifiedAt
    ? messagingRelativeTime(capability.lastVerifiedAt, locale)
    : t('admin.readiness.neverVerified');

  return (
    <Box
      component="li"
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          md: 'minmax(180px, 0.8fr) minmax(0, 1.8fr) auto',
        },
        gap: { xs: 0.75, md: 1.5 },
        alignItems: 'center',
        px: { xs: 1.25, sm: 2 },
        py: 1.4,
        borderBottom: 1,
        borderColor: 'divider',
        '&:last-child': { borderBottom: 0 },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {capability.provider} ·{' '}
          {capability.required ? t('admin.readiness.required') : t('admin.readiness.optional')}
        </Typography>
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary">
          {t('admin.readiness.evidence', {
            configured: capability.configured ? t('admin.readiness.yes') : t('admin.readiness.no'),
            effective: capability.effective ? t('admin.readiness.yes') : t('admin.readiness.no'),
            verified,
            freshness: t(`admin.readiness.freshness.${capability.freshness}`),
          })}
        </Typography>
        {capability.reasonCode && (
          <Typography
            component="code"
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.25, overflowWrap: 'anywhere' }}
          >
            {capability.reasonCode}
          </Typography>
        )}
        {capability.pendingWorkCount !== null && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {t('admin.readiness.pendingWork', { count: capability.pendingWorkCount })}
          </Typography>
        )}
      </Box>
      <Chip
        size="small"
        variant={capability.state === 'READY' ? 'filled' : 'outlined'}
        icon={<Icon size={14} aria-hidden="true" />}
        color={STATE_COLOR[capability.state]}
        label={t(`admin.readiness.states.${capability.state}`)}
        sx={{ justifySelf: { md: 'end' } }}
      />
    </Box>
  );
}
