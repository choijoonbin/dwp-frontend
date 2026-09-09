import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellOff, Laptop, ShieldCheck, Smartphone, Unplug } from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  ActionButton,
  FormDialog,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { NotificationDeliveryEndpoint } from '@dwp-frontend/shared-utils/api/notification-api';

function EndpointIcon({ platform }: { platform: NotificationDeliveryEndpoint['platform'] }) {
  return platform === 'WEB' ? <Laptop size={18} /> : <Smartphone size={18} />;
}

export function NotificationDeliveryEndpointInventory({
  endpoints,
  loading,
  failed,
  revokingId,
  onRetry,
  onRevoke,
}: {
  endpoints?: NotificationDeliveryEndpoint[];
  loading: boolean;
  failed: boolean;
  revokingId?: string | null;
  onRetry: () => void;
  onRevoke: (endpoint: NotificationDeliveryEndpoint) => Promise<void>;
}) {
  const { t } = useTranslation('notifications');
  const [pendingEndpoint, setPendingEndpoint] = useState<NotificationDeliveryEndpoint | null>(null);
  const activeCount = endpoints?.filter((endpoint) => endpoint.state === 'ACTIVE').length ?? 0;

  return (
    <Box
      component="section"
      aria-labelledby="notification-delivery-endpoints-title"
      data-testid="notification-delivery-endpoint-inventory"
      sx={{ mt: 1.75, pt: 1.75, borderTop: 1, borderColor: 'divider' }}
    >
      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
        <ShieldCheck size={18} />
        <Box minWidth={0}>
          <Typography id="notification-delivery-endpoints-title" component="h3" variant="subtitle2">
            {t('preferences.endpoints.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('preferences.endpoints.description')}
          </Typography>
        </Box>
        <Chip
          size="small"
          variant="outlined"
          label={t('preferences.endpoints.activeCount', { count: activeCount })}
          sx={{ ml: { sm: 'auto' } }}
        />
      </Stack>

      {loading ? (
        <LoadingState
          label={t('preferences.endpoints.loading')}
          variant="skeleton"
          skeletonRows={2}
          skeletonHeight={58}
          embedded
        />
      ) : failed ? (
        <InlineFeedback severity="warning" sx={{ mt: 1.25 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            gap={1}
          >
            <Typography variant="body2" sx={{ flex: 1 }}>
              {t('preferences.endpoints.loadFailed')}
            </Typography>
            <ActionButton intent="quiet" size="small" onClick={onRetry}>
              {t('actions.retry')}
            </ActionButton>
          </Stack>
        </InlineFeedback>
      ) : !endpoints?.length ? (
        <Stack alignItems="center" gap={0.5} sx={{ py: 2.25, color: 'text.secondary' }}>
          <BellOff size={22} />
          <Typography variant="body2">{t('preferences.endpoints.empty')}</Typography>
        </Stack>
      ) : (
        <Stack divider={<Divider flexItem />} sx={{ mt: 1.25 }}>
          {endpoints.map((endpoint) => (
            <Box
              key={endpoint.endpointId}
              data-testid={`notification-delivery-endpoint-${endpoint.endpointId}`}
              sx={{
                py: 1.25,
                display: 'grid',
                gridTemplateColumns: { xs: '32px minmax(0, 1fr)', sm: '32px minmax(0, 1fr) auto' },
                gap: 1,
                alignItems: 'center',
              }}
            >
              <Box
                aria-hidden="true"
                sx={{
                  width: 32,
                  height: 32,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: 'action.hover',
                  color: endpoint.state === 'ACTIVE' ? 'primary.main' : 'text.disabled',
                  borderRadius: 'shape.borderRadius',
                }}
              >
                <EndpointIcon platform={endpoint.platform} />
              </Box>
              <Box minWidth={0}>
                <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                  <Typography variant="body2" fontWeight="fontWeightBold">
                    {endpoint.displayName}
                  </Typography>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={endpoint.state === 'ACTIVE' ? 'success' : 'default'}
                    label={t(`preferences.endpoints.state.${endpoint.state}`)}
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {t('preferences.endpoints.meta', {
                    channel: t(`channels.${endpoint.channel}`),
                    hint: endpoint.endpointHint,
                    time: formatDate(endpoint.lastSeenAt, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }),
                  })}
                </Typography>
              </Box>
              {endpoint.state === 'ACTIVE' && (
                <ActionButton
                  intent="quiet"
                  size="small"
                  startIcon={<Unplug size={16} />}
                  loading={revokingId === endpoint.endpointId}
                  loadingLabel={t('preferences.endpoints.revoking')}
                  onClick={() => setPendingEndpoint(endpoint)}
                  sx={{ gridColumn: { xs: '2', sm: '3' }, justifySelf: 'end' }}
                >
                  {t('preferences.endpoints.revoke')}
                </ActionButton>
              )}
            </Box>
          ))}
        </Stack>
      )}

      <FormDialog
        open={Boolean(pendingEndpoint)}
        title={t('preferences.endpoints.revokeTitle')}
        description={t('preferences.endpoints.revokeDescription', {
          device: pendingEndpoint?.displayName ?? '',
        })}
        cancelLabel={t('actions.cancel')}
        submitLabel={t('preferences.endpoints.revokeConfirm')}
        submittingLabel={t('preferences.endpoints.revoking')}
        busy={revokingId === pendingEndpoint?.endpointId}
        onClose={() => setPendingEndpoint(null)}
        onSubmit={async () => {
          if (!pendingEndpoint) return;
          await onRevoke(pendingEndpoint);
          setPendingEndpoint(null);
        }}
        maxWidth="xs"
      >
        <InlineFeedback severity="warning">
          {t('preferences.endpoints.revokeWarning')}
        </InlineFeedback>
      </FormDialog>
    </Box>
  );
}
