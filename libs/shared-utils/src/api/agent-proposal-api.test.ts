import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  analyzeDwaionProposals,
  clearDwaionProposalInbox,
  decideDwaionProposal,
  getDwaionProposalAnalysisPreference,
  getDwaionProposals,
  updateDwaionProposalAnalysisPreference,
} from './agent-proposal-api';

const PROPOSAL_ID = '00000000-0000-4000-8000-000000000201';

function proposal() {
  return {
    proposalId: PROPOSAL_ID,
    kind: 'RISK',
    priority: 'HIGH',
    state: 'PENDING',
    revision: 1,
    agentKey: 'DWP_ASSISTANT',
    actionKey: 'SERVICE.REQUEST.CREATE',
    content: {
      title: 'Review delivery risk',
      summary: 'Two work items need attention.',
      rationale: 'Deadline and completion signals were evaluated together.',
      actionInputs: {},
      evidence: [
        {
          sourceType: 'WORK_ITEM',
          referenceId: 'work-100',
          label: 'Customer migration plan',
          occurredAt: null,
        },
      ],
    },
    proposedAt: '2026-08-27T01:00:00Z',
    availableAt: '2026-08-27T01:00:00Z',
    expiresAt: '2026-08-29T01:00:00Z',
    snoozedUntil: null,
    decidedAt: null,
  };
}

function response(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
    headers: new Headers(),
  } as Response;
}

describe('Agent proposal API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('loads a validated and bounded user proposal inbox', async () => {
    const page = {
      items: [proposal()],
      summary: { active: 1, highPriority: 1, snoozed: 0, handled: 0 },
      nextCursor: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(response({ success: true, data: page }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDwaionProposals('ACTIVE', 200)).resolves.toEqual(page);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/agent/v1/proposals?view=ACTIVE&limit=100',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it('records an explicit decision with a generated idempotency command', async () => {
    const receipt = {
      proposal: { ...proposal(), state: 'ACCEPTED', revision: 2 },
      actionReviewRequired: true,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({ data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(response({ success: true, data: receipt }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(decideDwaionProposal(PROPOSAL_ID, 'ACCEPT', 1)).resolves.toEqual(receipt);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/agent/v1/proposals/${PROPOSAL_ID}/decisions`,
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"decision":"ACCEPT"'),
      })
    );
  });

  it('fails closed for malformed proposal payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          success: true,
          data: {
            items: [{ ...proposal(), content: { title: 'missing contract' } }],
            summary: { active: 1, highPriority: 1, snoozed: 0, handled: 0 },
            nextCursor: null,
          },
        })
      )
    );
    await expect(getDwaionProposals()).rejects.toMatchObject({ status: 502 });
  });

  it('runs an explicit analysis with an idempotency command and validates the receipt', async () => {
    const receipt = {
      analyzedAt: '2026-08-28T02:00:00Z',
      sourcesAnalyzed: 3,
      actionableProposals: 1,
      attemptedSources: ['WORK_ITEM', 'MAIL', 'CALENDAR'],
      unavailableSources: [],
      proposals: [proposal()],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({ data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(response({ success: true, data: receipt }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(analyzeDwaionProposals()).resolves.toEqual(receipt);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/agent/v1/proposals/analyze',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringMatching(/"commandId":"[0-9a-f-]{36}"/u),
      })
    );
  });

  it('loads and updates the user-controlled analysis preference', async () => {
    const current = { proactiveAnalysisEnabled: true, revision: 2, updatedAt: null };
    const updated = {
      proactiveAnalysisEnabled: false,
      revision: 3,
      updatedAt: '2026-08-28T02:01:00Z',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ success: true, data: current }))
      .mockResolvedValueOnce(
        response({ data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(response({ success: true, data: updated }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDwaionProposalAnalysisPreference()).resolves.toEqual(current);
    await expect(updateDwaionProposalAnalysisPreference(2, false)).resolves.toEqual(updated);
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/agent/v1/proposals/preferences',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"expectedRevision":2'),
      })
    );
  });

  it('clears the inbox through an explicit privacy command', async () => {
    const receipt = { hiddenCount: 4, clearedAt: '2026-08-28T02:02:00Z' };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({ data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(response({ success: true, data: receipt }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(clearDwaionProposalInbox()).resolves.toEqual(receipt);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/agent/v1/proposals/clear',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
