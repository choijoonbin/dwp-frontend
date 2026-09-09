import { afterEach, describe, expect, it, vi } from 'vitest';
import { axiosInstance } from '../axios-instance';
import {
  getWorkspaceActivity,
  getWorkspaceActivityEvent,
  getWorkspaceActivityExecutionSummary,
  normalizeWorkspaceActivityEvent,
  normalizeWorkspaceActivityFeed,
} from './workspace-api';
import type { RawWorkspaceActivityEvent } from './workspace-api';

const UUID_FOR_OTHER_TASK = 'e5555555-5555-4555-8555-555555555555';

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
      .mockResolvedValue({ data: { data: { events: [], generatedAt: '2026-09-04T09:00:00Z' } } });
    await getWorkspaceActivity();
    expect(get.mock.calls[0]?.[0]).toBe('/api/platform/v1/workspace/activity');
  });

  it('fetches an event by ID independently of the current page', async () => {
    const get = vi.spyOn(axiosInstance, 'get').mockResolvedValue({ data: { data: event } });
    const result = await getWorkspaceActivityEvent('event/old');
    expect(get.mock.calls[0]?.[0]).toBe('/api/platform/v1/workspace/activity/events/event%2Fold');
    expect(result.id).toBe('event-old');
  });

  it('validates a detail event without inventing a feed timestamp', () => {
    expect(normalizeWorkspaceActivityEvent(event)).toMatchObject({
      id: 'event-old',
      actor: 'person',
      state: 'completed',
    });
    expect(() => normalizeWorkspaceActivityEvent({ ...event, title: '' })).toThrow(
      'Activity response is invalid.'
    );
  });

  it('accepts only an exactly bound personal Work command projection', () => {
    const taskId = 'b1111111-1111-4111-8111-111111111111';
    const commandId = 'c2222222-2222-4222-8222-222222222222';
    const personal: RawWorkspaceActivityEvent = {
      ...event,
      id: 'a3333333-3333-4333-8333-333333333333',
      source: 'PERSONAL_TASK',
      sourceEventId: `personal-work-command:900018:${commandId}`,
      objectId: taskId,
      sourceReference: taskId,
      resourceVersion: 3,
      idempotencyKey: commandId,
      resultState: 'COMPLETED',
      workStatus: 'COMPLETED',
      sourceRoute: `/work/queue?work=PERSONAL_TASK%3A${taskId}%3A`,
      auditId: 'd4444444-4444-4444-8444-444444444444',
      auditRecordId: 'd4444444-4444-4444-8444-444444444444',
      auditStatus: 'VERIFIED',
      auditAccess: 'RESTRICTED',
    };

    expect(normalizeWorkspaceActivityEvent(personal)).toMatchObject({
      actor: 'person',
      source: 'PERSONAL_TASK',
      sourceReference: taskId,
      resourceVersion: 3,
      idempotencyKey: commandId,
      resultState: 'COMPLETED',
    });
    for (const invalid of [
      { ...personal, sourceReference: UUID_FOR_OTHER_TASK },
      { ...personal, sourceEventId: `personal-work-command:900018:${UUID_FOR_OTHER_TASK}` },
      { ...personal, resourceVersion: -1 },
      { ...personal, workStatus: 'WAITING' },
      { ...personal, sourceRoute: `/work/queue?work=PERSONAL_TASK%3A${UUID_FOR_OTHER_TASK}%3A` },
    ]) {
      expect(() => normalizeWorkspaceActivityEvent(invalid)).toThrow(
        'Activity response is invalid.'
      );
    }
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
        normalizeWorkspaceActivityFeed({
          events: [{ ...event, state }],
          generatedAt: '2026-09-04T09:00:00Z',
        }).events[0]?.state
      ).toBe(state.toLowerCase());
    }
  );

  it('does not invent source authorization or audit linkage for legacy payloads', () => {
    const result = normalizeWorkspaceActivityFeed({
      events: [{ ...event, sourceAccess: undefined, auditStatus: undefined }],
      generatedAt: '2026-09-04T09:00:00Z',
    });
    expect(result.events[0]?.sourceAccess).toBeUndefined();
    expect(result.events[0]?.auditStatus).toBeUndefined();
  });

  it.each([
    { label: 'missing title', value: { ...event, title: '' } },
    { label: 'unknown actor', value: { ...event, actor: 'ROBOT' } },
    { label: 'out-of-range progress', value: { ...event, progress: 101 } },
    { label: 'invented verified audit', value: { ...event, auditStatus: 'VERIFIED' } },
    { label: 'unexpected sensitive field', value: { ...event, prompt: 'private question' } },
  ])('rejects a malformed $label event before it reaches the UI', ({ value }) => {
    expect(() =>
      normalizeWorkspaceActivityFeed({
        events: [value as RawWorkspaceActivityEvent],
        generatedAt: '2026-09-04T09:00:00Z',
      })
    ).toThrow('Activity response is invalid.');
  });

  it('rejects a feed without an observable server timestamp', () => {
    expect(() =>
      normalizeWorkspaceActivityFeed({ events: [event], generatedAt: 'invalid' })
    ).toThrow('Activity response is invalid.');
  });
});
