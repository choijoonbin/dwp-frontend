import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  getDwaionProposalHandoffDraft,
  parseDwaionProposalHandoffDraft,
  saveDwaionProposalHandoffDraft,
} from './agent-proposal-handoff-draft-api';

const HANDOFF_ID = '00000000-0000-4000-8000-000000000910';
const PROPOSAL_ID = '00000000-0000-4000-8000-000000000911';
const DRAFT_ID = '00000000-0000-4000-8000-000000000912';
const COMMAND_ID = '00000000-0000-4000-8000-000000000913';

function draft() {
  return {
    draftId: DRAFT_ID,
    handoffId: HANDOFF_ID,
    proposalId: PROPOSAL_ID,
    handoffVersion: 1,
    revision: 2,
    reviewedInputs: { title: 'Quarterly approval', amount: 1200 },
    contentSha256: 'a'.repeat(64),
    savedAt: '2026-09-17T06:00:00Z',
  };
}

function response(data: unknown) {
  return new Response(JSON.stringify({ status: 'SUCCESS', success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetCsrfToken();
});

describe('proposal handoff server drafts', () => {
  it('strictly validates the persisted draft receipt', () => {
    expect(parseDwaionProposalHandoffDraft(draft()).revision).toBe(2);
    expect(() =>
      parseDwaionProposalHandoffDraft({ ...draft(), contentSha256: 'not-a-digest' })
    ).toThrow('Proposal handoff draft response is invalid.');
    expect(() =>
      parseDwaionProposalHandoffDraft({
        ...draft(),
        reviewedInputs: { unsafe: undefined },
      })
    ).toThrow('Proposal handoff draft response is invalid.');
  });

  it('loads an absent draft without inventing client state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(null)));
    await expect(getDwaionProposalHandoffDraft(HANDOFF_ID)).resolves.toBeNull();
  });

  it('saves to the governed server endpoint with caller-owned retry identity', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response(draft()));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      saveDwaionProposalHandoffDraft(
        HANDOFF_ID,
        1,
        { title: 'Quarterly approval', amount: 1200 },
        COMMAND_ID
      )
    ).resolves.toMatchObject({ draftId: DRAFT_ID, revision: 2 });

    const requestBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(requestBody).toEqual({
      commandId: COMMAND_ID,
      expectedVersion: 1,
      reviewedInputs: { title: 'Quarterly approval', amount: 1200 },
    });
  });
});
