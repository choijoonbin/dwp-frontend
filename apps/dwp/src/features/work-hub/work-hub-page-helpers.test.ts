import { beforeEach, describe, expect, it, vi } from 'vitest';
import { askSelectedWorkStream } from '@dwp-frontend/shared-utils/api/agent-selected-work-api';
import type { AskDwpResponse } from '@dwp-frontend/shared-utils/api/agent-runtime-api';
import { submitWorkHubAssist } from './work-hub-page-helpers';
import type { WorkHubItem, WorkHubSnapshot } from './work-hub-contracts';

vi.mock('@dwp-frontend/shared-utils/api/agent-selected-work-api', () => ({
  askSelectedWorkStream: vi.fn(),
}));

const receivedAt = new Date().toISOString();
const item: WorkHubItem = {
  key: 'PERSONAL_TASK:b1111111-1111-4111-8111-111111111111:',
  reference: {
    sourceSystem: 'PERSONAL_TASK',
    sourceReference: 'b1111111-1111-4111-8111-111111111111',
  },
  sourceId: 'personal',
  title: 'Current work',
  summary: null,
  lifecycle: 'OPEN',
  sourceStatus: 'OPEN',
  originSystem: 'PERSONAL_TASK',
  priority: 'NORMAL',
  dueAt: null,
  waitingFor: 'ME',
  sourceRoute: null,
  version: 3,
  updatedAt: receivedAt,
  reason: null,
  dataClassification: 'INTERNAL',
  actions: [],
};
const snapshot: WorkHubSnapshot = {
  items: [item],
  sources: [
    {
      sourceId: 'personal',
      state: 'READY',
      items: [item],
      receivedAt,
      generatedAt: receivedAt,
      hasMore: false,
    },
  ],
  completeness: 'COMPLETE',
  receivedAt,
};

function response(statusCode: string): AskDwpResponse {
  return { state: 'ABSTAINED', statusCode } as AskDwpResponse;
}

describe('selected work AI page recovery', () => {
  beforeEach(() => vi.mocked(askSelectedWorkStream).mockReset());

  it.each([
    'SELECTED_WORK_FORBIDDEN',
    'SELECTED_WORK_NOT_FOUND',
    'SELECTED_WORK_STALE',
    'SELECTED_WORK_INVALID_SOURCE',
  ])('resets the selected panel and refreshes the queue for %s', async (statusCode) => {
    const result = response(statusCode);
    vi.mocked(askSelectedWorkStream).mockResolvedValue(result);
    const resetSelection = vi.fn();
    const refetch = vi.fn().mockResolvedValue(undefined);

    await expect(
      submitWorkHubAssist({
        item,
        question: 'Review the current evidence',
        options: {},
        locale: 'en',
        route: '/work/queue',
        refresh: vi.fn().mockResolvedValue(snapshot),
        refetch,
        resetSelection,
      })
    ).resolves.toBe(result);
    expect(resetSelection).toHaveBeenCalledOnce();
    expect(refetch).toHaveBeenCalledOnce();
  });

  it.each([
    'SELECTED_WORK_UNAVAILABLE',
    'SELECTED_WORK_AUTHORIZATION_REQUIRED',
    'SELECTED_WORK_RESTRICTED',
    'SELECTED_WORK_UNSUPPORTED',
  ])('keeps the current item available for guided recovery from %s', async (statusCode) => {
    const result = response(statusCode);
    vi.mocked(askSelectedWorkStream).mockResolvedValue(result);
    const resetSelection = vi.fn();
    const refetch = vi.fn().mockResolvedValue(undefined);

    await expect(
      submitWorkHubAssist({
        item,
        question: 'Keep this question for a retry',
        options: {},
        locale: 'en',
        route: '/work/queue',
        refresh: vi.fn().mockResolvedValue(snapshot),
        refetch,
        resetSelection,
      })
    ).resolves.toBe(result);
    expect(resetSelection).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
  });

  it('purges a selection whose version changed during preflight', async () => {
    const resetSelection = vi.fn();
    const refetch = vi.fn().mockResolvedValue(undefined);
    await expect(
      submitWorkHubAssist({
        item,
        question: 'Review the current evidence',
        options: {},
        locale: 'en',
        route: '/work/queue',
        refresh: vi.fn().mockResolvedValue({
          ...snapshot,
          items: [{ ...item, version: 4 }],
        }),
        refetch,
        resetSelection,
      })
    ).rejects.toThrow('context changed');
    expect(resetSelection).toHaveBeenCalledOnce();
    expect(refetch).toHaveBeenCalledOnce();
    expect(askSelectedWorkStream).not.toHaveBeenCalled();
  });
});
