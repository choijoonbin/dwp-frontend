type Translate = (key: string) => string;

const SUPPORT_SCOPE_LABEL_KEYS: Readonly<Record<string, string>> = {
  TENANT_EXPERIENCE_PREVIEW: 'support.scopes.TENANT_EXPERIENCE_PREVIEW',
  TENANT_CONFIGURATION_READ: 'support.scopes.TENANT_CONFIGURATION_READ',
  TENANT_CONFIGURATION_WRITE: 'support.scopes.TENANT_CONFIGURATION_WRITE',
  TENANT_DIAGNOSTICS_READ: 'support.scopes.TENANT_DIAGNOSTICS_READ',
  WORKFORCE_READ: 'support.scopes.WORKFORCE_READ',
};

const SUPPORT_MODE_LABEL_KEYS: Readonly<Record<string, string>> = {
  STANDARD: 'support.modes.STANDARD',
  BREAK_GLASS: 'support.modes.BREAK_GLASS',
};

const SUPPORT_ANOMALY_LABEL_KEYS: Readonly<Record<string, string>> = {
  DENIED_ATTEMPTS: 'support.postReviewEvidence.anomaly.DENIED_ATTEMPTS',
  MALFORMED_EVIDENCE: 'support.postReviewEvidence.anomaly.MALFORMED_EVIDENCE',
  TENANT_BINDING_MISMATCH: 'support.postReviewEvidence.anomaly.TENANT_BINDING_MISMATCH',
  SESSION_BINDING_MISMATCH: 'support.postReviewEvidence.anomaly.SESSION_BINDING_MISMATCH',
  INVALID_CORRELATION_EVIDENCE: 'support.postReviewEvidence.anomaly.INVALID_CORRELATION_EVIDENCE',
};

const SUPPORT_DECISION_LABEL_KEYS: Readonly<Record<string, string>> = {
  ALLOW: 'support.postReviewEvidence.decision.ALLOW',
  DENY: 'support.postReviewEvidence.decision.DENY',
};

export function hasUnknownProviderSupportScope(scopes: readonly string[]): boolean {
  return scopes.some((scope) => !SUPPORT_SCOPE_LABEL_KEYS[scope]);
}

export function providerSupportScopeLabel(translate: Translate, scope: string): string {
  return translate(SUPPORT_SCOPE_LABEL_KEYS[scope] ?? 'support.scopes.unknown');
}

export function providerSupportModeLabel(translate: Translate, mode: string): string {
  return translate(SUPPORT_MODE_LABEL_KEYS[mode] ?? 'support.modes.unknown');
}

export function providerSupportAnomalyLabel(translate: Translate, anomaly: string): string {
  return translate(
    SUPPORT_ANOMALY_LABEL_KEYS[anomaly] ?? 'support.postReviewEvidence.anomaly.UNKNOWN'
  );
}

export function providerSupportDecisionLabel(translate: Translate, decision: string): string {
  return translate(
    SUPPORT_DECISION_LABEL_KEYS[decision] ?? 'support.postReviewEvidence.decision.UNKNOWN'
  );
}
