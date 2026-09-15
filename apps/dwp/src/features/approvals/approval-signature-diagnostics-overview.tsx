import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorState, LoadingState, OperationalKpiStrip } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type {
  SignatureProviderCard,
  SignatureProviderOverview,
} from '@dwp-frontend/shared-utils/api/approval-signature-diagnostics-contract';
import { SignatureDiagnosticStatus } from './approval-signature-diagnostics-facts';
import { signatureDiagnosticsVisible } from './approval-signature-diagnostics-model';
import type { SignatureDiagnosticsReadState } from './approval-signature-diagnostics-model';
import { SignatureDiagnosticsProvider } from './approval-signature-diagnostics-provider';
import { SignatureDiagnosticsInspection } from './approval-signature-diagnostics-inspection';

export function SignatureDiagnosticsOverview({
  data,
  readState,
  now,
  providerAction,
  action,
  kmsAction,
  wormAction,
  onRetry,
}: {
  data: SignatureProviderOverview | null;
  readState: SignatureDiagnosticsReadState;
  now: number;
  providerAction?: (provider: SignatureProviderCard) => ReactNode;
  action?: ReactNode;
  kmsAction?: ReactNode;
  wormAction?: ReactNode;
  onRetry?: () => void;
}) {
  const { t, i18n } = useTranslation('approvals');
  const label = (key: string) => t(`admin.signatureDiagnostics.labels.${key}`);
  if (readState === 'LOADING')
    return (
      <LoadingState label={label('title')} variant="skeleton" skeletonRows={3} size="compact" />
    );
  if (!data || !signatureDiagnosticsVisible(readState))
    return (
      <ErrorState
        title={label('title')}
        description={t(`admin.signatureDiagnostics.states.${readState}`)}
        retryLabel={t('actions.retry')}
        onRetry={onRetry}
        size="compact"
      />
    );
  const current = readState === 'CURRENT';
  const { kpis } = data;
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const lastProbe =
    kpis.lastProbeAt === null
      ? label('unknown')
      : formatDate(kpis.lastProbeAt, { dateStyle: 'medium', timeStyle: 'short' }, locale);
  return (
    <Stack gap={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        gap={1}
        sx={{ pb: 1.5 }}
      >
        <Box minWidth={0}>
          <Box component="h2" sx={{ typography: 'subtitle1', m: 0 }}>
            {label('title')}
          </Box>
          <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 0.75 }}>
            <SignatureDiagnosticStatus status={readState} />
            <Box sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}>
              {data.scope.resourceSetKey}
            </Box>
          </Stack>
        </Box>
        {action}
      </Stack>
      <OperationalKpiStrip
        ariaLabel={label('metrics')}
        items={[
          {
            key: 'configured',
            label: label('configured'),
            value: kpis.configuredProviderCount,
            detail: t('admin.signatureDiagnostics.labels.configuredDetail', {
              registered: kpis.registeredProviderCount,
              required: kpis.requiredProviderCount ?? label('unknown'),
            }),
            tone: 'info',
          },
          {
            key: 'production',
            label: label('production'),
            value: current ? kpis.verifiedProductionProviderCount : label('unknown'),
            tone: 'neutral',
          },
          {
            key: 'gate',
            label: label('gate'),
            value: (
              <SignatureDiagnosticStatus
                status={current ? kpis.externalGateState : 'SOURCE_UNAVAILABLE'}
              />
            ),
            detail: data.policy.sourceState === 'AVAILABLE' ? undefined : label('policyUnknown'),
          },
          {
            key: 'lastProbe',
            label: label('lastProbe'),
            value: lastProbe,
            detail:
              kpis.probeIntervalSeconds === null
                ? label('unknown')
                : t('admin.signatureDiagnostics.labels.probeInterval', {
                    seconds: kpis.probeIntervalSeconds,
                  }),
          },
        ]}
      />
      <Box
        component="section"
        aria-label={label('providers')}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0,1fr)', lg: 'repeat(3,minmax(0,1fr))' },
          alignItems: 'stretch',
          gap: 2,
        }}
      >
        {data.providers.map((provider) => (
          <SignatureDiagnosticsProvider
            key={provider.providerId ?? provider.kind}
            provider={provider}
            readState={readState}
            now={now}
            action={providerAction?.(provider)}
          />
        ))}
      </Box>
      <Box
        component="section"
        aria-label={label('phases')}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'repeat(3,minmax(0,1fr))' },
          gap: 2,
          borderTop: 1,
          borderColor: 'divider',
          pt: 2,
        }}
      >
        {data.phases.map((phase) => (
          <Stack key={phase.phaseKind} gap={1}>
            <Box component="h3" sx={{ typography: 'subtitle2', m: 0 }}>
              {t(`admin.signatureDiagnostics.phases.${phase.phaseKind}`)}
            </Box>
            <SignatureDiagnosticStatus status={current ? phase.gateState : 'SOURCE_UNAVAILABLE'} />
            {phase.reasonCodes.length ? (
              <Box
                sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}
              >
                {phase.reasonCodes.join(', ')}
              </Box>
            ) : null}
          </Stack>
        ))}
      </Box>
      <SignatureDiagnosticsInspection
        kms={data.kms}
        worm={data.worm}
        readState={readState}
        now={now}
        kmsAction={kmsAction}
        wormAction={wormAction}
      />
    </Stack>
  );
}
