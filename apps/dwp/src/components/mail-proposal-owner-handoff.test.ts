import { describe, expect, it } from 'vitest';

import {
  hasMailProposalOwnerHandoff,
  mailProposalHandoffIsPending,
  mailProposalOwnerReturnPath,
  readMailProposalOwnerContext,
} from './mail-proposal-owner-handoff';

const proposalId = '50000000-0000-4000-8000-000000000081';
const commandId = '60000000-0000-4000-8000-000000000081';

function params(overrides: Record<string, string> = {}) {
  return new URLSearchParams({
    proposalId,
    commandId,
    returnTo: `/mail/actions?proposalId=${proposalId}`,
    focus: `mail-proposal-${proposalId}`,
    ...overrides,
  });
}

describe('Mail proposal owner handoff boundary', () => {
  it('reads the exact UUID-bound context and restores the Action Center focus', () => {
    const context = readMailProposalOwnerContext(params());
    expect(context).toEqual({
      proposalId,
      commandId,
      returnTo: `/mail/actions?proposalId=${proposalId}`,
      focus: `mail-proposal-${proposalId}`,
    });
    expect(mailProposalOwnerReturnPath(context!)).toBe(
      `/mail/actions?proposalId=${proposalId}&focus=mail-proposal-${proposalId}`
    );
  });

  it('rejects external returns, mismatched focus, and non-UUID command identities', () => {
    expect(readMailProposalOwnerContext(params({ returnTo: '//evil.example/actions' }))).toBeNull();
    expect(readMailProposalOwnerContext(params({ focus: 'another-card' }))).toBeNull();
    expect(readMailProposalOwnerContext(params({ commandId: 'command-1' }))).toBeNull();
  });

  it('detects incomplete handoff parameters so the owner action remains blocked', () => {
    expect(hasMailProposalOwnerHandoff(new URLSearchParams(`proposalId=${proposalId}`))).toBe(true);
    expect(
      readMailProposalOwnerContext(new URLSearchParams(`proposalId=${proposalId}`))
    ).toBeNull();
    expect(hasMailProposalOwnerHandoff(new URLSearchParams('compose=open'))).toBe(false);
  });

  it('keeps an executing reservation pending and reconcile-only', () => {
    expect(mailProposalHandoffIsPending('ACCEPTED')).toBe(true);
    expect(mailProposalHandoffIsPending('EXECUTING')).toBe(true);
    expect(mailProposalHandoffIsPending('UNKNOWN')).toBe(true);
    expect(mailProposalHandoffIsPending('EXECUTED')).toBe(false);
    expect(mailProposalHandoffIsPending('FAILED')).toBe(false);
  });
});
