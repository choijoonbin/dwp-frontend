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

export const MAIL_ACCOUNT_READINESS_EVIDENCE_MAX_AGE_MS = 5 * 60 * 1_000;

export function mailReadinessObservationIsCurrent(
  observedAt: string | null | undefined,
  now = Date.now(),
  maxAgeMs = MAIL_ACCOUNT_READINESS_EVIDENCE_MAX_AGE_MS
) {
  if (!observedAt) return false;
  const observedAtMs = Date.parse(observedAt);
  return Number.isFinite(observedAtMs) && observedAtMs <= now && now - observedAtMs <= maxAgeMs;
}

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

export function mailAccountReadinessIsReady(
  readiness?: MailAccountReadinessEvidence | null,
  now = Date.now(),
  maxAgeMs = MAIL_ACCOUNT_READINESS_EVIDENCE_MAX_AGE_MS
) {
  const authorizationVerified = (
    evidence: MailAccountReadinessEvidence['consentEvidence'],
    tokenEvidence: boolean
  ) => {
    if (!evidence || (evidence.state !== 'VERIFIED' && evidence.state !== 'NOT_REQUIRED')) {
      return false;
    }
    if (!mailReadinessObservationIsCurrent(evidence.observedAt, now, maxAgeMs)) return false;
    if (tokenEvidence && evidence.state === 'VERIFIED' && evidence.expiresAt === null) return false;
    if (evidence.expiresAt === null) return true;
    const expiresAt = Date.parse(evidence.expiresAt);
    return Number.isFinite(expiresAt) && expiresAt > now;
  };
  return Boolean(
    readiness?.state === 'READY' &&
    readiness.credentialConfigured &&
    mailReadinessObservationIsCurrent(readiness.observedAt, now, maxAgeMs) &&
    authorizationVerified(readiness.consentEvidence, false) &&
    authorizationVerified(readiness.tokenEvidence, true)
  );
}

export function mailAccountFeatureReadinessPresentation(
  readiness?: MailAccountReadinessEvidence | null,
  now = Date.now(),
  maxAgeMs = MAIL_ACCOUNT_READINESS_EVIDENCE_MAX_AGE_MS
): MailAccountFeatureReadinessPresentation[] {
  const accountReady = mailAccountReadinessIsReady(readiness, now, maxAgeMs);
  return MAIL_ACCOUNT_FEATURES.map(({ featureKey, presentationKey }) => {
    const evidence = readiness?.featureReadiness?.[featureKey] ?? null;
    const observed = mailReadinessObservationIsCurrent(evidence?.observedAt, now, maxAgeMs);
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
  featureKey: MailAccountFeatureKey,
  now = Date.now(),
  maxAgeMs = MAIL_ACCOUNT_READINESS_EVIDENCE_MAX_AGE_MS
) {
  return (
    mailAccountFeatureReadinessPresentation(readiness, now, maxAgeMs).find(
      (feature) => feature.featureKey === featureKey
    )?.ready === true
  );
}
