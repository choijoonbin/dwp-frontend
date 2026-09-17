import { describe, expect, it } from 'vitest';

import { mailProposalMutationHeaders } from './mail-proposal-binding';

describe('Mail proposal owner mutation binding', () => {
  it('emits the exact proposal, command, and reviewed version headers', () => {
    expect(
      mailProposalMutationHeaders({
        proposalId: '50000000-0000-4000-8000-000000000081',
        commandId: '60000000-0000-4000-8000-000000000081',
        version: 4,
      })
    ).toEqual({
      'X-DWP-Mail-Proposal-ID': '50000000-0000-4000-8000-000000000081',
      'X-DWP-Mail-Command-ID': '60000000-0000-4000-8000-000000000081',
      'X-DWP-Mail-Proposal-Version': '4',
    });
  });

  it('rejects malformed or incomplete identities before an owner mutation is sent', () => {
    expect(() =>
      mailProposalMutationHeaders({
        proposalId: 'proposal-1',
        commandId: '60000000-0000-4000-8000-000000000081',
        version: 4,
      })
    ).toThrow('valid Mail proposal mutation binding');
    expect(() =>
      mailProposalMutationHeaders({
        proposalId: '50000000-0000-4000-8000-000000000081',
        commandId: '60000000-0000-4000-8000-000000000081',
        version: -1,
      })
    ).toThrow('valid Mail proposal mutation binding');
  });
});
