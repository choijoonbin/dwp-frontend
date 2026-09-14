import { useTranslation } from 'react-i18next';
import { ErrorState, LoadingState } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type {
  SignatureProviderPolicyView,
  SignatureProviderPolicyDraft,
  SignatureProviderPolicyPublished,
  SignatureProviderPolicyRules,
} from '@dwp-frontend/shared-utils/api/approval-signature-provider-policy-contract';
import {
  SignatureDiagnosticFacts,
  SignatureDiagnosticStatus,
} from './approval-signature-diagnostics-facts';
import { signatureDiagnosticsVisible } from './approval-signature-diagnostics-model';
import type { SignatureDiagnosticsReadState } from './approval-signature-diagnostics-model';

const securityFlags = [
  'requireVerifiedProviderAccount',
  'requireAuthenticatedWebhook',
  'requireTrustedCertificateChain',
  'requireFreshRevocationEvidence',
  'requireTrustedTimestamp',
  'requireComplianceWormStorage',
] as const;
function PolicyVersion({
  version,
  published,
}: {
  version: SignatureProviderPolicyDraft | SignatureProviderPolicyPublished | null;
  published: boolean;
}) {
  const { t } = useTranslation('approvals');
  const label = (key: string) => t(`admin.signatureDiagnostics.labels.${key}`);
  const rules: SignatureProviderPolicyRules | undefined = version?.rules;
  return (
    <Stack
      component="section"
      aria-label={label(published ? 'published' : 'workingDraft')}
      gap={1.5}
      minWidth={0}
    >
      <Box component="h3" sx={{ typography: 'subtitle2', m: 0 }}>
        {label(published ? 'published' : 'workingDraft')}
      </Box>
      {!version || !rules ? (
        <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
          {label(published ? 'noPublished' : 'noWorkingDraft')}
        </Box>
      ) : (
        <>
          <Box sx={{ typography: 'caption' }}>
            {t('admin.signatureDiagnostics.labels.revision', { revision: version.revision })}
          </Box>
          <SignatureDiagnosticFacts
            rows={[
              { key: 'rulesSha', label: label('rulesSha'), value: version.rulesSha256 },
              { key: 'maker', label: label('maker'), value: version.originalMakerPersonPublicId },
              {
                key: 'lastEditor',
                label: label('lastEditor'),
                value: version.lastEditorPersonPublicId,
              },
              ...('checkerPersonPublicId' in version
                ? [
                    {
                      key: 'checker',
                      label: label('checker'),
                      value: version.checkerPersonPublicId,
                    },
                  ]
                : []),
              {
                key: 'signingEnabled',
                label: label('signingEnabled'),
                value: label(rules.signingEnabled ? 'yes' : 'no'),
              },
              {
                key: 'requiredProviderKinds',
                label: label('requiredProviderKinds'),
                value: rules.requiredProviderKinds.length
                  ? rules.requiredProviderKinds
                      .map((kind) => t(`admin.signatureDiagnostics.kinds.${kind}`))
                      .join(', ')
                  : label('none'),
              },
              {
                key: 'allowedClassifications',
                label: label('allowedClassifications'),
                value: rules.allowedClassifications.length
                  ? rules.allowedClassifications
                      .map((classification) => t(`classification.${classification}`))
                      .join(', ')
                  : label('none'),
              },
              ...securityFlags.map((key) => ({
                key,
                label: label(key),
                value: label(rules[key] ? 'yes' : 'no'),
              })),
              {
                key: 'minimumRetentionDays',
                label: label('minimumRetentionDays'),
                value: rules.minimumRetentionDays,
              },
              {
                key: 'probeMaxAgeSeconds',
                label: label('probeMaxAgeSeconds'),
                value: rules.probeMaxAgeSeconds,
              },
              {
                key: 'trustBundleId',
                label: label('trustBundleId'),
                value: rules.trustBundleId ?? label('unknown'),
              },
              {
                key: 'configurationBinding',
                label: label('configurationBinding'),
                value: rules.configurationBinding?.sha256 ?? label('unknown'),
              },
            ]}
          />
        </>
      )}
    </Stack>
  );
}
export function SignatureDiagnosticsPolicyInspector({
  policy,
  readState,
  now,
}: {
  policy: SignatureProviderPolicyView | null;
  readState: SignatureDiagnosticsReadState;
  now: number;
}) {
  const { t } = useTranslation('approvals');
  const label = (key: string) => t(`admin.signatureDiagnostics.labels.${key}`);
  if (readState === 'LOADING')
    return (
      <LoadingState label={label('policy')} variant="skeleton" skeletonRows={3} size="compact" />
    );
  if (!policy || !signatureDiagnosticsVisible(readState))
    return (
      <ErrorState
        title={label('policy')}
        description={t(`admin.signatureDiagnostics.states.${readState}`)}
        size="compact"
      />
    );
  const review = policy.publishReview;
  const status =
    readState !== 'CURRENT'
      ? 'SOURCE_UNAVAILABLE'
      : review === null
        ? 'NOT_EVALUATED'
        : review.validUntil !== null && Date.parse(review.validUntil) <= now
          ? 'EXPIRED'
          : review.eligibility;
  return (
    <Stack
      component="section"
      aria-label={label('policy')}
      gap={2}
      sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        gap={1}
        flexWrap="wrap"
      >
        <Box component="h2" sx={{ typography: 'subtitle1', m: 0 }}>
          {label('policy')}
        </Box>
        <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
          {t('admin.signatureDiagnostics.labels.policyVersion', { version: policy.version })}
        </Box>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'repeat(2,minmax(0,1fr))' },
          gap: 3,
        }}
      >
        <PolicyVersion version={policy.published} published />
        <PolicyVersion version={policy.workingDraft} published={false} />
      </Box>
      <SignatureDiagnosticStatus status={status} />
      {review ? (
        <SignatureDiagnosticFacts
          rows={[
            {
              key: 'reviewDigest',
              label: label('reviewDigest'),
              value: review.reviewContentSha256,
            },
            { key: 'highApproval', label: label('highApproval'), value: label('yes') },
          ]}
        />
      ) : null}
      {review?.reasonCodes.length ? (
        <Box sx={{ typography: 'caption', overflowWrap: 'anywhere', color: 'text.secondary' }}>
          {review.reasonCodes.join(', ')}
        </Box>
      ) : null}
    </Stack>
  );
}
