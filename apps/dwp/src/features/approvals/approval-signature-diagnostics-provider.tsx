import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type { SignatureProviderCard } from '@dwp-frontend/shared-utils/api/approval-signature-diagnostics-contract';
import {
  SignatureDiagnosticChecks,
  SignatureDiagnosticFacts,
  SignatureDiagnosticStatus,
} from './approval-signature-diagnostics-facts';
import type { SignatureDiagnosticsReadState } from './approval-signature-diagnostics-model';

export function SignatureDiagnosticsProvider({
  provider,
  readState,
  now,
  action,
}: {
  provider: SignatureProviderCard;
  readState: SignatureDiagnosticsReadState;
  now: number;
  action?: ReactNode;
}) {
  const { t } = useTranslation('approvals');
  const label = (key: string) => t(`admin.signatureDiagnostics.labels.${key}`);
  const boolean = (value: boolean | null) =>
    label(value === null ? 'unknown' : value ? 'yes' : 'no');
  return (
    <Box
      component="article"
      aria-label={provider.displayName}
      style={{ borderRadius: foundationTokens.radius.surface }}
      sx={{
        minWidth: 0,
        p: 2,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
        <Box minWidth={0}>
          <Box component="h2" sx={{ typography: 'subtitle2', m: 0, overflowWrap: 'anywhere' }}>
            {provider.displayName}
          </Box>
          <Box sx={{ typography: 'caption', color: 'text.secondary', mt: 0.5 }}>
            {t(`admin.signatureDiagnostics.kinds.${provider.kind}`)}
          </Box>
        </Box>
        <SignatureDiagnosticStatus
          status={readState === 'CURRENT' ? provider.readiness : 'SOURCE_UNAVAILABLE'}
        />
      </Stack>
      <SignatureDiagnosticFacts
        rows={[
          {
            key: 'environment',
            label: label('environment'),
            value: t(`admin.signatureDiagnostics.environments.${provider.environment}`),
          },
          {
            key: 'adapterInstalled',
            label: label('adapterInstalled'),
            value: boolean(provider.adapterInstalled),
          },
          {
            key: 'configurationRegistered',
            label: label('configurationRegistered'),
            value: boolean(provider.configurationRegistered),
          },
          {
            key: 'credentialRegistered',
            label: label('credentialRegistered'),
            value: boolean(provider.credentialRegistered),
          },
          {
            key: 'credentialVerified',
            label: label('credentialVerified'),
            value: boolean(provider.credentialVerified),
          },
          {
            key: 'requiredByPolicy',
            label: label('requiredByPolicy'),
            value: boolean(provider.requiredByPolicy),
          },
        ]}
      />
      <SignatureDiagnosticChecks checks={provider.checks} readState={readState} now={now} />
      {provider.gateReasonCodes.length > 0 ? (
        <Box sx={{ typography: 'caption', overflowWrap: 'anywhere', color: 'text.secondary' }}>
          {provider.gateReasonCodes.join(', ')}
        </Box>
      ) : null}
      {action ? <Box sx={{ mt: 'auto', pt: 1 }}>{action}</Box> : null}
    </Box>
  );
}
