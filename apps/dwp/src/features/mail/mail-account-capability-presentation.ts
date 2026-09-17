import type {
  MailAccount,
  MailAccountFeatureKey,
  MailAccountFeatureReadinessEvidence,
  MailAccountReadinessEvidence,
  MailComposeCapabilities,
} from '@dwp-frontend/shared-utils';

export type MailAccountCapabilityPresentation = Readonly<{
  key:
    | 'send'
    | 'bcc'
    | 'html'
    | 'attachments'
    | 'scheduling'
    | 'sharedIdentitySendAs'
    | 'sharedIdentityOnBehalf';
  ready: boolean;
}>;

export const MAIL_ACCOUNT_FEATURES = [
  { featureKey: 'SEND', presentationKey: 'send' },
  { featureKey: 'BCC', presentationKey: 'bcc' },
  { featureKey: 'HTML_BODY', presentationKey: 'html' },
  { featureKey: 'ATTACHMENTS', presentationKey: 'attachments' },
  { featureKey: 'SCHEDULING', presentationKey: 'scheduling' },
] as const satisfies ReadonlyArray<{
  featureKey: MailAccountFeatureKey;
  presentationKey: MailAccountCapabilityPresentation['key'];
}>;

export type MailAccountFeatureReadinessPresentation = Readonly<{
  featureKey: MailAccountFeatureKey;
  presentationKey: MailAccountCapabilityPresentation['key'];
  ready: boolean;
  evidence: MailAccountFeatureReadinessEvidence | null;
}>;

export function mailAccountCapabilityPresentation(
  account: Pick<MailAccount, 'accountKind'>,
  capabilities: MailComposeCapabilities | undefined
): MailAccountCapabilityPresentation[] {
  const values: MailAccountCapabilityPresentation[] = [
    { key: 'send', ready: capabilities?.multipleRecipients === true },
    { key: 'bcc', ready: capabilities?.bcc === true },
    { key: 'html', ready: capabilities?.html === true },
    { key: 'attachments', ready: capabilities?.attachments === true },
    { key: 'scheduling', ready: capabilities?.scheduling === true },
  ];
  if (account.accountKind === 'SHARED') {
    values.push(
      { key: 'sharedIdentitySendAs', ready: capabilities?.senderMode === 'SEND_AS' },
      {
        key: 'sharedIdentityOnBehalf',
        ready: capabilities?.senderMode === 'SEND_ON_BEHALF',
      }
    );
  }
  return values;
}

export function mailAccountReadinessIsReady(readiness?: MailAccountReadinessEvidence | null) {
  const authorizationVerified = (state: string | undefined) =>
    state === 'VERIFIED' || state === 'NOT_REQUIRED';
  return Boolean(
    readiness?.state === 'READY' &&
    readiness.credentialConfigured &&
    readiness.observedAt &&
    Number.isFinite(Date.parse(readiness.observedAt)) &&
    authorizationVerified(readiness.consentEvidence?.state) &&
    authorizationVerified(readiness.tokenEvidence?.state)
  );
}

export function mailAccountFeatureReadinessPresentation(
  readiness?: MailAccountReadinessEvidence | null
): MailAccountFeatureReadinessPresentation[] {
  const accountReady = mailAccountReadinessIsReady(readiness);
  return MAIL_ACCOUNT_FEATURES.map(({ featureKey, presentationKey }) => {
    const evidence = readiness?.featureReadiness?.[featureKey] ?? null;
    const observed = Boolean(
      evidence?.observedAt && Number.isFinite(Date.parse(evidence.observedAt))
    );
    return {
      featureKey,
      presentationKey,
      ready: accountReady && evidence?.state === 'READY' && observed,
      evidence,
    };
  });
}

export function mailAccountFeatureIsReady(
  readiness: MailAccountReadinessEvidence | null | undefined,
  featureKey: MailAccountFeatureKey
) {
  return (
    mailAccountFeatureReadinessPresentation(readiness).find(
      (feature) => feature.featureKey === featureKey
    )?.ready === true
  );
}
