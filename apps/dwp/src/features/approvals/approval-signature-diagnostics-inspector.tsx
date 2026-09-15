import { useTranslation } from 'react-i18next';
import { ErrorState, LoadingState } from '@dwp-frontend/design-system';
import { ExternalLink } from 'lucide-react';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
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
      <Stack
        component="section"
        aria-label={label('guide')}
        gap={1.5}
        sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}
      >
        <Box component="h2" sx={{ typography: 'subtitle1', m: 0 }}>
          {label('guide')}
        </Box>
        {details.guide.sections.length === 0 ? (
          <Box sx={{ typography: 'caption', color: 'text.secondary' }}>{label('none')}</Box>
        ) : (
          details.guide.sections.map((section) => (
            <Stack key={section.sectionKey} gap={1}>
              <Box component="h3" sx={{ typography: 'subtitle2', m: 0 }}>
                {t(`admin.signatureDiagnostics.guideSections.${section.sectionKey}`, {
                  defaultValue: section.sectionKey,
                })}
              </Box>
              <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                {section.stepKeys.map((step) => (
                  <Box component="li" key={step} sx={{ typography: 'caption', py: 0.35 }}>
                    {t(`admin.signatureDiagnostics.guideSteps.${step}`, {
                      defaultValue: step,
                    })}
                  </Box>
                ))}
              </Box>
              {section.officialDocumentationLinks.map((href) => (
                <Link
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    typography: 'caption',
                    display: 'inline-flex',
                    gap: 0.75,
                    width: 'fit-content',
                  }}
                >
                  {label('officialDocumentation')}
                  <ExternalLink size={14} aria-hidden="true" />
                </Link>
              ))}
            </Stack>
          ))
        )}
      </Stack>
      <SignatureDiagnosticsPolicyInspector policy={policy} readState={policyReadState} now={now} />
    </Stack>
  );
}
