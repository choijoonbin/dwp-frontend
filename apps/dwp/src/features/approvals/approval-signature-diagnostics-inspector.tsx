import { useTranslation } from 'react-i18next';
import { ErrorState, LoadingState } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type { SignatureProviderDiagnostics } from '@dwp-frontend/shared-utils/api/approval-signature-diagnostics-contract';
import type { SignatureProviderPolicyView } from '@dwp-frontend/shared-utils/api/approval-signature-provider-policy-contract';
import { SignatureDiagnosticFacts } from './approval-signature-diagnostics-facts';
import { SignatureDiagnosticsInspection } from './approval-signature-diagnostics-inspection';
import { SignatureDiagnosticsPolicyInspector } from './approval-signature-diagnostics-policy-inspector';
import { signatureDiagnosticsVisible } from './approval-signature-diagnostics-model';
import type { SignatureDiagnosticsReadState } from './approval-signature-diagnostics-model';

export function SignatureDiagnosticsInspector({
  details,
  policy,
  readState,
  policyReadState,
  now,
}: {
  details: SignatureProviderDiagnostics | null;
  policy: SignatureProviderPolicyView | null;
  readState: SignatureDiagnosticsReadState;
  policyReadState: SignatureDiagnosticsReadState;
  now: number;
}) {
  const { t } = useTranslation('approvals');
  const label = (key: string) => t(`admin.signatureDiagnostics.labels.${key}`);
  if (readState === 'LOADING')
    return (
      <LoadingState label={label('settings')} variant="skeleton" skeletonRows={3} size="compact" />
    );
  if (!details || !signatureDiagnosticsVisible(readState))
    return (
      <ErrorState
        title={label('settings')}
        description={t(`admin.signatureDiagnostics.states.${readState}`)}
        size="compact"
      />
    );
  const settings = details.settings;
  return (
    <Stack gap={3}>
      <Stack component="section" aria-label={label('settings')} gap={1.5}>
        <Box component="h2" sx={{ typography: 'subtitle1', m: 0 }}>
          {label('settings')}
        </Box>
        <SignatureDiagnosticFacts
          rows={[
            {
              key: 'configurationOwner',
              label: label('configurationOwner'),
              value: settings.configurationOwner,
            },
            {
              key: 'environment',
              label: label('environment'),
              value: t(`admin.signatureDiagnostics.environments.${settings.environment}`),
            },
            {
              key: 'configurationRevision',
              label: label('configurationRevision'),
              value: settings.configuration?.version ?? label('unknown'),
            },
            {
              key: 'endpointSha',
              label: label('endpointSha'),
              value: settings.endpointOriginSha256 ?? label('unknown'),
            },
            {
              key: 'accountSha',
              label: label('accountSha'),
              value: settings.accountBindingSha256 ?? label('unknown'),
            },
            {
              key: 'credentialRegistered',
              label: label('credentialRegistered'),
              value: label(settings.credentialRegistered ? 'yes' : 'no'),
            },
            {
              key: 'callbackAuthenticationMode',
              label: label('callbackAuthenticationMode'),
              value: settings.callbackAuthenticationMode,
            },
            {
              key: 'sourceRevision',
              label: label('sourceRevision'),
              value: details.scope.sourceRevision,
            },
            { key: 'ownerScope', label: label('ownerScope'), value: details.scope.resourceSetKey },
          ]}
        />
      </Stack>
      <SignatureDiagnosticsInspection
        kms={details.kms}
        worm={details.worm}
        readState={readState}
        now={now}
      />
      <SignatureDiagnosticsPolicyInspector policy={policy} readState={policyReadState} now={now} />
    </Stack>
  );
}
