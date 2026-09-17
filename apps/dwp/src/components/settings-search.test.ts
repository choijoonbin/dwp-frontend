import { describe, expect, it } from 'vitest';

import { filterSettingsDocuments } from './settings-search';

const documents = [
  {
    value: '/account/security',
    fields: ['Security & sessions', '보안 및 세션', 'MFA passkey'],
  },
  {
    value: '/admin/identity/provisioning',
    fields: ['Identity provisioning', 'ID 프로비저닝', 'SCIM account lifecycle'],
  },
  {
    value: '/provider/feature-rollouts',
    fields: ['Feature rollout', '기능 롤아웃', 'staged recovery'],
  },
] as const;

describe('settings search', () => {
  it('matches every normalized term across localized labels and keywords', () => {
    expect(filterSettingsDocuments(documents, '  scim   LIFECYCLE ')).toEqual([
      '/admin/identity/provisioning',
    ]);
    expect(filterSettingsDocuments(documents, '보안 세션')).toEqual(['/account/security']);
  });

  it('returns the complete authorized source when the query is empty', () => {
    expect(filterSettingsDocuments(documents, ' ')).toEqual(documents.map(({ value }) => value));
  });

  it('returns an empty result instead of broadening scope', () => {
    expect(filterSettingsDocuments(documents, 'credential secret value')).toEqual([]);
  });
});
