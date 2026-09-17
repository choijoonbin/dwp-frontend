export type MailReadinessAction =
  'NONE' | 'RETRY' | 'ACTIVATE_EXTERNALLY' | 'CONTACT_ADMIN' | 'REQUEST_ACCESS';

export type MailAuthorizationEvidence = {
  state: 'NOT_REQUIRED' | 'VERIFIED' | 'UNKNOWN' | 'REQUIRED' | 'EXPIRED';
  source: string;
  observedAt: string;
  expiresAt: string | null;
  errorCode: string | null;
  action: MailReadinessAction;
};

export type MailAccountFeatureKey = 'SEND' | 'BCC' | 'HTML_BODY' | 'ATTACHMENTS' | 'SCHEDULING';

export type MailAccountFeatureReadinessEvidence = {
  state: 'READY' | 'UNAVAILABLE';
  source: string;
  observedAt: string;
  errorCode: string | null;
  lastSuccessfulAt: string | null;
  lastSuccessfulScope: string | null;
  action: MailReadinessAction;
};

export type MailAccountReadinessEvidence = {
  state: 'READY' | 'DEGRADED' | 'UNAVAILABLE';
  source:
    | 'CONNECTOR_RUNTIME'
    | 'PERSISTED_CONNECTION'
    | 'RUNTIME_REGISTRY'
    | 'ACCESS_POLICY'
    | 'NO_RUNTIME_ATTESTATION'
    | 'ACCOUNT_CONFIGURATION'
    | (string & {});
  observedAt: string;
  errorCode: string | null;
  credentialConfigured: boolean;
  lastSuccessfulSyncAt: string | null;
  lastSuccessfulSyncScope: string | null;
  action: MailReadinessAction;
  consentEvidence?: MailAuthorizationEvidence | null;
  tokenEvidence?: MailAuthorizationEvidence | null;
  featureReadiness?: Partial<
    Record<MailAccountFeatureKey, MailAccountFeatureReadinessEvidence>
  > | null;
};

const MAIL_READINESS_ACTIONS = new Set<MailReadinessAction>([
  'NONE',
  'RETRY',
  'ACTIVATE_EXTERNALLY',
  'CONTACT_ADMIN',
  'REQUEST_ACCESS',
]);

const MAIL_ACCOUNT_FEATURE_KEYS: MailAccountFeatureKey[] = [
  'SEND',
  'BCC',
  'HTML_BODY',
  'ATTACHMENTS',
  'SCHEDULING',
];

function readinessRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readinessText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function readinessNullableText(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function readinessAction(value: unknown): MailReadinessAction {
  return MAIL_READINESS_ACTIONS.has(value as MailReadinessAction)
    ? (value as MailReadinessAction)
    : 'CONTACT_ADMIN';
}

function parseMailAuthorizationEvidence(value: unknown): MailAuthorizationEvidence | null {
  if (!readinessRecord(value)) return null;
  const states = new Set<MailAuthorizationEvidence['state']>([
    'NOT_REQUIRED',
    'VERIFIED',
    'UNKNOWN',
    'REQUIRED',
    'EXPIRED',
  ]);
  return {
    state: states.has(value.state as MailAuthorizationEvidence['state'])
      ? (value.state as MailAuthorizationEvidence['state'])
      : 'UNKNOWN',
    source: readinessText(value.source) || 'NO_OAUTH_ATTESTATION',
    observedAt: readinessText(value.observedAt),
    expiresAt: readinessNullableText(value.expiresAt),
    errorCode: readinessNullableText(value.errorCode),
    action: readinessAction(value.action),
  };
}

function parseMailFeatureReadinessEvidence(
  value: unknown
): MailAccountFeatureReadinessEvidence | null {
  if (!readinessRecord(value)) return null;
  return {
    state: value.state === 'READY' ? 'READY' : 'UNAVAILABLE',
    source: readinessText(value.source) || 'NO_RUNTIME_ATTESTATION',
    observedAt: readinessText(value.observedAt),
    errorCode: readinessNullableText(value.errorCode),
    lastSuccessfulAt: readinessNullableText(value.lastSuccessfulAt),
    lastSuccessfulScope: readinessNullableText(value.lastSuccessfulScope),
    action: readinessAction(value.action),
  };
}

export function parseMailAccountReadinessEvidence(
  value: unknown
): MailAccountReadinessEvidence | null {
  if (!readinessRecord(value)) return null;
  const featureSource = readinessRecord(value.featureReadiness) ? value.featureReadiness : {};
  const featureReadiness = Object.fromEntries(
    MAIL_ACCOUNT_FEATURE_KEYS.flatMap((featureKey) => {
      const evidence = parseMailFeatureReadinessEvidence(featureSource[featureKey]);
      return evidence ? [[featureKey, evidence] as const] : [];
    })
  ) as Partial<Record<MailAccountFeatureKey, MailAccountFeatureReadinessEvidence>>;
  return {
    state: value.state === 'READY' || value.state === 'DEGRADED' ? value.state : 'UNAVAILABLE',
    source: readinessText(value.source) || 'NO_RUNTIME_ATTESTATION',
    observedAt: readinessText(value.observedAt),
    errorCode: readinessNullableText(value.errorCode),
    credentialConfigured: value.credentialConfigured === true,
    lastSuccessfulSyncAt: readinessNullableText(value.lastSuccessfulSyncAt),
    lastSuccessfulSyncScope: readinessNullableText(value.lastSuccessfulSyncScope),
    action: readinessAction(value.action),
    consentEvidence: parseMailAuthorizationEvidence(value.consentEvidence),
    tokenEvidence: parseMailAuthorizationEvidence(value.tokenEvidence),
    featureReadiness,
  };
}
