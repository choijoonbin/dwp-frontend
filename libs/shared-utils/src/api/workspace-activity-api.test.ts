import { afterEach, describe, expect, it, vi } from 'vitest';
import { axiosInstance } from '../axios-instance';
import {
  getWorkspaceActivity,
  getWorkspaceActivityEvent,
  getWorkspaceActivityExecutionSummary,
  normalizeWorkspaceActivityFeed,
} from './workspace-api';
import type { RawWorkspaceActivityEvent } from './workspace-api';

const event: RawWorkspaceActivityEvent = {
  id: 'event-old',
  occurredAt: '2026-09-01T09:00:00Z',
  actor: 'PERSON',
  actorName: 'Member',
  state: 'COMPLETED',
  title: 'Work changed',
  objectType: 'WORK_ITEM',
  objectLabel: 'Work 1',
  objectId: 'work-1',
  source: 'DWP',
  auditId: null,
  eventKind: 'CHANGE',
  dataProvenance: 'LIVE',
  sourceAccess: 'AVAILABLE',
  sourceRoute: '/work/item/work-1',
};

describe('workspace activity API foundation', () => {
  afterEach(() => vi.restoreAllMocks());

  it('passes scoped filters, opaque cursor and cancellation to the server', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({
      data: {
        data: {
          events: [event],
          generatedAt: '2026-09-04T09:00:00Z',
          nextCursor: 'next',
          hasMore: true,
        },
      },
    });
    const signal = new AbortController().signal;
    const result = await getWorkspaceActivity(
      {
        actor: 'person',
        state: 'needs-input',
        query: 'A & B',
        source: 'DWP',
        objectType: 'WORK_ITEM',
        objectId: 'work-1',
        executionId: 'execution-1',
        from: '2026-09-01T00:00:00Z',
        to: '2026-09-05T00:00:00Z',
        cursor: 'opaque+/=',
        limit: 50,
        includeUsage: true,
      },
      signal
    );
    const url = new URL(String(get.mock.calls[0]?.[0]), 'https://dwp.invalid');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      actor: 'PERSON',
      state: 'NEEDS_INPUT',
      query: 'A & B',
      source: 'DWP',
      objectType: 'WORK_ITEM',
      objectId: 'work-1',
      executionId: 'execution-1',
      from: '2026-09-01T00:00:00Z',
      to: '2026-09-05T00:00:00Z',
      cursor: 'opaque+/=',
      limit: '50',
      includeUsage: 'true',
    });
    expect(get.mock.calls[0]?.[1]).toEqual({ timeoutMs: 8000, signal });
    expect(result.events[0]).toMatchObject({
      actor: 'person',
      state: 'completed',
      objectId: 'work-1',
    });
    expect(result.nextCursor).toBe('next');
  });

  it('defaults to safe usage exclusion while preserving the no-argument API', async () => {
    const get = vi
      .spyOn(axiosInstance, 'get')
      .mockResolvedValue({ data: { data: { events: [], generatedAt: '' } } });
    await getWorkspaceActivity();
    expect(get.mock.calls[0]?.[0]).toBe('/api/platform/v1/workspace/activity');
  });

  it('fetches an event by ID independently of the current page', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: event } });
    const result = await getWorkspaceActivityEvent('event/old');
    expect(get.mock.calls[0]?.[0]).toBe('/api/platform/v1/workspace/activity/events/event%2Fold');
    expect(result.id).toBe('event-old');
  });

  it('never converts event counts into the current execution summary', async () => {
    const current = {
      total: 1,
      running: 0,
      completed: 1,
      needsInput: 0,
      policyBlocked: 0,
      failed: 0,
      cancelled: 0,
      generatedAt: '',
      coverage: { supportedObjectTypes: [] },
    };
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: current } });
    expect(await getWorkspaceActivityExecutionSummary()).toEqual(current);
    expect(get.mock.calls[0]?.[0]).toBe('/api/platform/v1/workspace/activity/executions/summary');
  });

  it.each(['FAILED', 'CANCELLED', 'UNKNOWN'] as const)(
    'normalizes terminal/unverified state %s',
    (state) => {
      expect(
        normalizeWorkspaceActivityFeed({ events: [{ ...event, state }], generatedAt: '' }).events[0]
          ?.state
      ).toBe(state.toLowerCase());
    }
  );

  it('does not invent source authorization or audit linkage for legacy payloads', () => {
    const result = normalizeWorkspaceActivityFeed({
      events: [{ ...event, sourceAccess: undefined, auditStatus: undefined }],
      generatedAt: '',
    });
    expect(result.events[0]?.sourceAccess).toBeUndefined();
    expect(result.events[0]?.auditStatus).toBeUndefined();
  });
});
