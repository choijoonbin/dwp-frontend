import { describe, expect, it } from 'vitest';

import { auditEvidenceRows, auditEvidenceValuePresentation } from './audit-evidence-presentation';

describe('audit evidence presentation', () => {
  it('presents typed scalar evidence without exposing internal field names', () => {
    expect(auditEvidenceRows({ requireMfa: false }, { requireMfa: true }, ['requireMfa'])).toEqual([
      {
        id: '0',
        labelKey: 'auditControl.evidence.fields.requireMfa',
        before: { kind: 'translation', key: 'auditControl.evidence.disabled' },
        after: { kind: 'translation', key: 'auditControl.evidence.enabled' },
      },
    ]);
  });

  it('fails closed for objects and unknown schema fields', () => {
    const secret = { token: 'never-render-me' };
    const rows = auditEvidenceRows({ internalPayload: secret }, { internalPayload: secret });
    expect(rows[0].labelKey).toBe('auditControl.evidence.fields.managedField');
    expect(auditEvidenceValuePresentation('internalPayload', secret)).toEqual({
      kind: 'translation',
      key: 'auditControl.evidence.unavailable',
    });
    expect(JSON.stringify(rows)).not.toContain('never-render-me');
    expect(JSON.stringify(rows)).not.toContain('internalPayload');
  });
});
