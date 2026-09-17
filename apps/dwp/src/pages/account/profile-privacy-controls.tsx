import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Archive, CheckCircle2, History, ShieldCheck, Trash2 } from 'lucide-react';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  cancelPersonalPrivacyRequest,
  createPersonalPrivacyRequest,
  getPersonalPrivacyConsentLedger,
  listPersonalPrivacyRequests,
  updateProductAnalyticsConsent,
  useToast,
  type PersonalPrivacyRequest,
} from '@dwp-frontend/shared-utils';
import { ActionButton, ConfirmDialog } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import {
  readProductSurfaceTelemetryConsent,
  writeProductSurfaceTelemetryConsent,
} from '../../observability/product-surface-telemetry-context';

const CONSENT_NOTICE_VERSION = 'product-analytics-2026-09';
const CONSENT_QUERY_KEY = ['account', 'privacy', 'consents'] as const;
const REQUEST_QUERY_KEY = ['account', 'privacy', 'requests'] as const;

function requestIcon(type: PersonalPrivacyRequest['requestType']) {
  return type === 'DATA_EXPORT' ? Archive : Trash2;
}

export function ProfilePrivacyControls({ enabled = true }: { enabled?: boolean }) {
  const { t } = useTranslation('account');
  const queryClient = useQueryClient();
  const toast = useToast();
  const [telemetryConsent, setTelemetryConsent] = useState(() =>
    readProductSurfaceTelemetryConsent(window.localStorage)
  );
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);
  const consentQuery = useQuery({
    queryKey: CONSENT_QUERY_KEY,
    queryFn: getPersonalPrivacyConsentLedger,
    enabled,
    retry: false,
  });
  const requestsQuery = useQuery({
    queryKey: REQUEST_QUERY_KEY,
    queryFn: listPersonalPrivacyRequests,
    enabled,
    retry: false,
  });
  const consentMutation = useMutation({
    mutationFn: (granted: boolean) =>
      updateProductAnalyticsConsent(granted, CONSENT_NOTICE_VERSION),
    onSuccess: async (consent) => {
      const granted = consent.consentState === 'GRANTED';
      writeProductSurfaceTelemetryConsent(window.localStorage, granted);
      setTelemetryConsent(granted);
      await queryClient.invalidateQueries({ queryKey: CONSENT_QUERY_KEY });
      toast.success(t('profile.privacy.telemetry.saved'));
    },
    onError: () => toast.error(t('profile.privacy.telemetry.saveError')),
  });
  const requestMutation = useMutation({
    mutationFn: (type: PersonalPrivacyRequest['requestType']) =>
      createPersonalPrivacyRequest(type, type === 'ACCOUNT_DELETION'),
    onSuccess: async () => {
      setConfirmingDeletion(false);
      await queryClient.invalidateQueries({ queryKey: REQUEST_QUERY_KEY });
      toast.success(t('profile.privacy.requests.received'));
    },
    onError: () => toast.error(t('profile.privacy.requests.error')),
  });
  const cancelMutation = useMutation({
    mutationFn: (request: PersonalPrivacyRequest) =>
      cancelPersonalPrivacyRequest(request.requestId, request.version),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: REQUEST_QUERY_KEY });
      toast.success(t('profile.privacy.requests.cancelled'));
    },
    onError: () => toast.error(t('profile.privacy.requests.error')),
  });

  useEffect(() => {
    if (!consentQuery.isSuccess) return;
    const granted = consentQuery.data.currentProductAnalytics?.consentState === 'GRANTED';
    writeProductSurfaceTelemetryConsent(window.localStorage, granted);
    setTelemetryConsent(granted);
  }, [consentQuery.data, consentQuery.isSuccess]);

  const latestRequests = requestsQuery.data ?? [];

  return (
    <Box component="section" data-testid="profile-privacy-controls" sx={{ mt: 3 }}>
      <Stack direction="row" alignItems="center" gap={1}>
        <ShieldCheck size={20} aria-hidden="true" />
        <Typography component="h2" variant="h6">
          {t('profile.privacy.title')}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {t('profile.privacy.description')}
      </Typography>

      {!enabled && (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          {t('profile.privacy.providerBoundary')}
        </Alert>
      )}
      {enabled && (consentQuery.isError || requestsQuery.isError) && (
        <Alert
          severity="error"
          sx={{ mt: 1.5 }}
          action={
            <ActionButton
              intent="quiet"
              size="small"
              onClick={() => {
                void consentQuery.refetch();
                void requestsQuery.refetch();
              }}
            >
              {t('profile.retry')}
            </ActionButton>
          }
        >
          {t('profile.privacy.loadError')}
        </Alert>
      )}

      <Stack
        divider={<Divider flexItem />}
        sx={{
          mt: 1.5,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '36px minmax(0, 1fr) auto',
            gap: 1.5,
            alignItems: 'start',
            p: 2,
          }}
        >
          <CheckCircle2 size={20} aria-hidden="true" />
          <Box>
            <Typography component="h3" variant="subtitle2">
              {t('profile.privacy.required.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('profile.privacy.required.description')}
            </Typography>
          </Box>
          <Chip size="small" color="success" label={t('profile.privacy.required.badge')} />
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '36px minmax(0, 1fr) auto',
            gap: 1.5,
            alignItems: 'start',
            p: 2,
          }}
        >
          <ShieldCheck size={20} aria-hidden="true" />
          <Box>
            <Typography component="h3" variant="subtitle2">
              {t('profile.privacy.telemetry.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('profile.privacy.telemetry.description')}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.75 }}
            >
              {consentQuery.data?.currentProductAnalytics
                ? t('profile.privacy.telemetry.recorded', {
                    date: formatDate(consentQuery.data.currentProductAnalytics.occurredAt, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }),
                  })
                : t('profile.privacy.telemetry.notRecorded')}
            </Typography>
          </Box>
          {enabled && consentQuery.isPending ? (
            <CircularProgress size={22} aria-label={t('profile.privacy.loading')} />
          ) : (
            <Switch
              checked={telemetryConsent}
              disabled={!enabled || consentQuery.isError || consentMutation.isPending}
              slotProps={{ input: { 'aria-label': t('profile.privacy.telemetry.title') } }}
              onChange={(event) => consentMutation.mutate(event.target.checked)}
            />
          )}
        </Box>

        {(['DATA_EXPORT', 'ACCOUNT_DELETION'] as const).map((type) => {
          const Icon = requestIcon(type);
          const latest = latestRequests.find((request) => request.requestType === type);
          const active = latest?.requestState === 'RECEIVED' ? latest : undefined;
          return (
            <Box
              key={type}
              data-privacy-request-type={type}
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '36px minmax(0, 1fr)',
                  sm: '36px minmax(0, 1fr) auto',
                },
                gap: 1.5,
                alignItems: 'start',
                p: 2,
              }}
            >
              <Icon size={20} aria-hidden="true" />
              <Box>
                <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                  <Typography component="h3" variant="subtitle2">
                    {t(`profile.privacy.requests.types.${type}.title`)}
                  </Typography>
                  {latest && (
                    <Chip
                      size="small"
                      color={latest.requestState === 'RECEIVED' ? 'warning' : 'default'}
                      label={t(`profile.privacy.requests.states.${latest.requestState}`)}
                    />
                  )}
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t(`profile.privacy.requests.types.${type}.description`)}
                </Typography>
                {latest && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.75 }}
                  >
                    {t('profile.privacy.requests.createdAt', {
                      date: formatDate(latest.createdAt, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }),
                    })}
                  </Typography>
                )}
              </Box>
              <ActionButton
                intent={active ? 'quiet' : type === 'ACCOUNT_DELETION' ? 'danger' : 'secondary'}
                size="small"
                disabled={
                  !enabled ||
                  requestsQuery.isPending ||
                  requestsQuery.isError ||
                  requestMutation.isPending ||
                  cancelMutation.isPending
                }
                sx={{ gridColumn: { xs: '2', sm: 'auto' } }}
                onClick={() => {
                  if (active) cancelMutation.mutate(active);
                  else if (type === 'ACCOUNT_DELETION') setConfirmingDeletion(true);
                  else requestMutation.mutate(type);
                }}
              >
                {active
                  ? t('profile.privacy.requests.cancel')
                  : t(`profile.privacy.requests.types.${type}.action`)}
              </ActionButton>
            </Box>
          );
        })}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '36px minmax(0, 1fr)',
            gap: 1.5,
            p: 2,
          }}
        >
          <History size={20} aria-hidden="true" />
          <Box>
            <Typography component="h3" variant="subtitle2">
              {t('profile.privacy.history.title')}
            </Typography>
            {enabled && consentQuery.isPending ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t('profile.privacy.loading')}
              </Typography>
            ) : consentQuery.data?.history.length ? (
              <Stack component="ol" gap={0.75} sx={{ p: 0, mt: 1, mb: 0, listStyle: 'none' }}>
                {consentQuery.data.history.slice(0, 5).map((entry) => (
                  <Typography component="li" variant="body2" key={entry.consentId}>
                    {t(`profile.privacy.history.states.${entry.consentState}`)} ·{' '}
                    {formatDate(entry.occurredAt, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </Typography>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t('profile.privacy.history.empty')}
              </Typography>
            )}
          </Box>
        </Box>
      </Stack>

      <Alert severity="info" sx={{ mt: 1.5 }}>
        {t('profile.privacy.ownerBoundary')}
      </Alert>

      <ConfirmDialog
        open={confirmingDeletion}
        title={t('profile.privacy.requests.deleteDialog.title')}
        description={t('profile.privacy.requests.deleteDialog.description')}
        cancelLabel={t('profile.privacy.requests.deleteDialog.cancel')}
        confirmLabel={t('profile.privacy.requests.deleteDialog.confirm')}
        confirmingLabel={t('profile.privacy.requests.deleteDialog.confirming')}
        intent="danger"
        busy={requestMutation.isPending}
        onClose={() => setConfirmingDeletion(false)}
        onConfirm={async () => {
          await requestMutation.mutateAsync('ACCOUNT_DELETION');
        }}
      />
    </Box>
  );
}
