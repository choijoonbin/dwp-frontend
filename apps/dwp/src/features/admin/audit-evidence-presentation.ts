export type AuditEvidenceValuePresentation =
  | { kind: 'literal'; value: string }
  | { kind: 'translation'; key: string }
  | {
      kind: 'display';
      domain: 'states' | 'outcomes' | 'authModes' | 'roleNames';
      code: string;
    };

export type AuditEvidenceRow = {
  id: string;
  labelKey: string;
  before: AuditEvidenceValuePresentation;
  after: AuditEvidenceValuePresentation;
};

const FIELD_LABEL_KEYS: Record<string, string> = {
  status: 'auditControl.evidence.fields.status',
  state: 'auditControl.evidence.fields.status',
  lifecycleState: 'auditControl.evidence.fields.lifecycle',
  enabled: 'auditControl.evidence.fields.enabled',
  mfaEnabled: 'auditControl.evidence.fields.mfaEnabled',
  requireMfa: 'auditControl.evidence.fields.requireMfa',
  displayName: 'auditControl.evidence.fields.displayName',
  name: 'auditControl.evidence.fields.name',
  title: 'auditControl.evidence.fields.title',
  defaultLoginType: 'auditControl.evidence.fields.loginType',
  tokenTtlSec: 'auditControl.evidence.fields.tokenLifetime',
  retentionDays: 'auditControl.evidence.fields.retentionDays',
  outcome: 'auditControl.evidence.fields.outcome',
  decision: 'auditControl.evidence.fields.decision',
  roleCode: 'auditControl.evidence.fields.role',
  version: 'auditControl.evidence.fields.version',
};

const BOOLEAN_FIELDS = new Set(['enabled', 'mfaEnabled', 'requireMfa']);
const TEXT_FIELDS = new Set(['displayName', 'name', 'title']);
const NUMBER_FIELDS = new Set(['tokenTtlSec', 'retentionDays', 'version']);
const STATE_FIELDS = new Set(['status', 'state', 'lifecycleState', 'decision']);
const RETENTION_LABEL_KEYS: Record<string, string> = {
  STANDARD: 'auditControl.evidence.retention.STANDARD',
  EXTENDED: 'auditControl.evidence.retention.EXTENDED',
  LEGAL_HOLD: 'auditControl.evidence.retention.LEGAL_HOLD',
};

function unavailable(): AuditEvidenceValuePresentation {
  return { kind: 'translation', key: 'auditControl.evidence.unavailable' };
}

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

export function auditEvidenceFieldLabelKey(field: string): string {
  return FIELD_LABEL_KEYS[field] ?? 'auditControl.evidence.fields.managedField';
}

export function auditRetentionLabelKey(retentionClass: string): string {
  return RETENTION_LABEL_KEYS[retentionClass] ?? 'auditControl.evidence.retention.UNAVAILABLE';
}

export function auditEvidenceValuePresentation(
  field: string,
  value: unknown
): AuditEvidenceValuePresentation {
  if (BOOLEAN_FIELDS.has(field) && typeof value === 'boolean') {
    return {
      kind: 'translation',
      key: value ? 'auditControl.evidence.enabled' : 'auditControl.evidence.disabled',
    };
  }
  if (NUMBER_FIELDS.has(field) && typeof value === 'number' && Number.isFinite(value)) {
    return { kind: 'literal', value: formatNumber(value) };
  }
  if (
    TEXT_FIELDS.has(field) &&
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 160 &&
    !containsControlCharacter(value)
  ) {
    return { kind: 'literal', value };
  }
  if (STATE_FIELDS.has(field) && typeof value === 'string') {
    return { kind: 'display', domain: 'states', code: value };
  }
  if (field === 'outcome' && typeof value === 'string') {
    return { kind: 'display', domain: 'outcomes', code: value };
  }
  if (field === 'defaultLoginType' && typeof value === 'string') {
    return { kind: 'display', domain: 'authModes', code: value };
  }
  if (field === 'roleCode' && typeof value === 'string') {
    return { kind: 'display', domain: 'roleNames', code: value };
  }
  return unavailable();
}

export function auditEvidenceRows(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  changedFields?: string[]
): AuditEvidenceRow[] {
  const requested = changedFields?.length
    ? changedFields
    : [...new Set([...Object.keys(before), ...Object.keys(after)])];
  if (!requested.length) return [];
  return requested.map((field, index) => ({
    id: `${index}`,
    labelKey: auditEvidenceFieldLabelKey(field),
    before: auditEvidenceValuePresentation(field, before[field]),
    after: auditEvidenceValuePresentation(field, after[field]),
  }));
}
import { formatNumber } from '@dwp-frontend/shared-i18n';
