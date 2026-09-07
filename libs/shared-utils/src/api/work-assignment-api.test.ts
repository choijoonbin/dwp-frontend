import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import { HttpError, HttpTransportError } from '../http-error';
import {
  createWorkAssignment,
  getWorkAssignment,
  getWorkAssignmentBySource,
  getWorkAssignmentCommand,
  getWorkAssignmentEvents,
  getWorkAssignments,
  reassignWorkAssignment,
  transitionWorkAssignment,
} from './work-assignment-api';
import type {
  WorkAssignmentMutationResult,
  WorkAssignmentScope,
  WorkAssignmentSourceIdentity,
  WorkAssignmentTask,
  WorkAssignmentTransition,
} from './work-assignment-contracts';

const base = '/api/platform/v1/workspace/work-hub/assignments';
const assignmentId = '15537951-2aef-40f4-9de0-52c09af98a42';
const commandId = 'c22577a3-21ef-4e36-bfab-753c2717cc94';
const source: WorkAssignmentSourceIdentity = {
  sourceSystem: 'MEETING_FOLLOWUP',
  meetingId: 'b025c280-47e3-4e06-aeee-47bd4c54ab69',
  reportId: '45b6c289-4cc7-4b53-b5a2-e1d2310cb433',
  candidateId: 'a844c648-0c42-40a9-b7e6-91a2bdb9b60e',
};
const assignment: WorkAssignmentTask = {
  assignmentId,
  createdByUserId: 7,
  assignedByUserId: 7,
  assigneeUserId: 8,
  title: 'Confirmed follow-up',
  description: 'Independent Work task terms',
  priority: 'NORMAL',
  dueAt: null,
  assignmentState: 'ACCEPTED',
  workState: 'WAITING',
  assignmentRevision: 2,
  version: 8,
  source: { availability: 'UNAVAILABLE', reference: null, sourceVersion: null, sourceRoute: null },
  capabilities: {
    canAccept: false,
    canDecline: false,
    canStart: true,
    canWait: false,
    canComplete: true,
    canReassign: false,
    canCancel: false,
  },
  createdAt: '2026-09-04T00:00:00Z',
  updatedAt: '2026-09-04T01:00:00Z',
  acceptedAt: '2026-09-04T00:05:00Z',
  completedAt: null,
};
const result: WorkAssignmentMutationResult = {
  assignment,
  receipt: {
    commandId,
    assignmentId,
    operation: 'ACCEPT',
    appliedVersion: 5,
    appliedAssignmentRevision: 2,
    appliedAt: '2026-09-04T00:05:00Z',
    replayed: true,
  },
};

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubResponse(data: unknown) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) =>
    response(
      url.endsWith('/api/auth/csrf') ? { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } : data
    )
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  resetCsrfToken();
  vi.unstubAllGlobals();
});

describe('Work assignment owner API contract', () => {
  it('reads explicit personal scopes without conflating acceptance and execution', async () => {
    const listedAssignment: WorkAssignmentTask = {
      ...assignment,
      source: {
        availability: 'NOT_REQUESTED',
        reference: null,
        sourceVersion: null,
        sourceRoute: null,
      },
      capabilities: { ...assignment.capabilities, canReassign: false },
    };
    const page = { items: [listedAssignment], page: 0, size: 50, totalElements: 1, hasMore: false };
    const fetchMock = stubResponse(page);
    await expect(getWorkAssignments()).resolves.toEqual(page);
    await getWorkAssignments({ scope: 'ASSIGNED_BY_ME', page: 2, size: 100 });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${base}?scope=ASSIGNED_TO_ME&page=0&size=50`,
      `${base}?scope=ASSIGNED_BY_ME&page=2&size=100`,
    ]);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET', credentials: 'include' });
  });

  it('reads task and source identity through their exact owner endpoints', async () => {
    const fetchMock = stubResponse(assignment);
    await expect(getWorkAssignment(assignmentId)).resolves.toEqual(assignment);
    await expect(getWorkAssignmentBySource(source)).resolves.toEqual(assignment);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${base}/${assignmentId}`,
      `${base}/by-source?meetingId=${source.meetingId}&reportId=${source.reportId}&candidateId=${source.candidateId}`,
    ]);
  });

  it('preserves a historical receipt and the current authorized task when resolving a command', async () => {
    const fetchMock = stubResponse(result);
    const received = await getWorkAssignmentCommand(commandId);
    expect(fetchMock.mock.calls[0][0]).toBe(`${base}/commands/${commandId}`);
    expect(received).toEqual(result);
    expect(received.assignment.version).toBe(8);
    expect(received.receipt.appliedVersion).toBe(5);
    expect(received.assignment.source.reference).toBeNull();
    expect(received.assignment.capabilities.canComplete).toBe(true);
  });

  it('preserves the event continuation cursor and requests only events after that version', async () => {
    const events = { items: [], nextAfterVersion: 8, hasMore: true };
    const fetchMock = stubResponse(events);
    await expect(getWorkAssignmentEvents(assignmentId)).resolves.toEqual(events);
    await getWorkAssignmentEvents(assignmentId, { afterVersion: 8, size: 25 });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${base}/${assignmentId}/events?afterVersion=-1&size=100`,
      `${base}/${assignmentId}/events?afterVersion=8&size=25`,
    ]);
  });

  it('creates from the server-issued candidate without forwarding client title or assignee terms', async () => {
    const fetchMock = stubResponse(result);
    const input = {
      source: { ...source, transcript: 'not a creation term' },
      expectedSourceVersion: 3,
      title: 'unconfirmed AI text',
      assigneeUserId: 999,
    };
    await expect(createWorkAssignment(input, commandId)).resolves.toEqual(result);
    expect(fetchMock.mock.calls[1]).toEqual([
      base,
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ source, expectedSourceVersion: 3 }),
        headers: expect.objectContaining({
          'Idempotency-Key': commandId,
          'X-XSRF-TOKEN': 'csrf-token',
        }),
      }),
    ]);
  });

  it('uses distinct acceptance and execution commands with the original assignment revision', async () => {
    const fetchMock = stubResponse(result);
    const input = { version: 4, assignmentRevision: 2, reasonCode: 'USER_CONFIRMED' };
    for (const action of ['accept', 'decline', 'start', 'wait', 'complete', 'cancel'] as const)
      await transitionWorkAssignment(assignmentId, action, input, commandId);
    const requests = fetchMock.mock.calls.filter(([url]) => url.startsWith(base));
    expect(requests.map(([url]) => url)).toEqual([
      `${base}/${assignmentId}/accept`,
      `${base}/${assignmentId}/decline`,
      `${base}/${assignmentId}/start`,
      `${base}/${assignmentId}/wait`,
      `${base}/${assignmentId}/complete`,
      `${base}/${assignmentId}/cancel`,
    ]);
    for (const [, init] of requests) {
      expect(init?.body).toBe(JSON.stringify(input));
      expect(init?.headers).toMatchObject({ 'Idempotency-Key': commandId });
    }
  });

  it('replays an uncertain mutation with identical identity and body without generating a second command', async () => {
    let attempts = 0;
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.endsWith('/api/auth/csrf'))
        return response({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' });
      if (++attempts === 1) throw new TypeError('Response lost after commit');
      return response(result);
    });
    vi.stubGlobal('fetch', fetchMock);
    const input = { version: 4, assignmentRevision: 2 };
    await expect(
      transitionWorkAssignment(assignmentId, 'accept', input, commandId)
    ).rejects.toBeInstanceOf(HttpTransportError);
    await expect(
      transitionWorkAssignment(assignmentId, 'accept', input, commandId)
    ).resolves.toEqual(result);
    expect(fetchMock.mock.calls[2]).toEqual(fetchMock.mock.calls[1]);
    expect(attempts).toBe(2);
  });

  it('reassigns with an explicit reason, assignee and both concurrency fields', async () => {
    const fetchMock = stubResponse(result);
    const input = {
      assigneeUserId: 9,
      version: 8,
      assignmentRevision: 2,
      reasonCode: 'OWNER_CHANGED',
    };
    await expect(reassignWorkAssignment(assignmentId, input, commandId)).resolves.toEqual(result);
    expect(fetchMock.mock.calls[1][0]).toBe(`${base}/${assignmentId}/reassign`);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual(input);
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({ 'Idempotency-Key': commandId });
  });

  it('rejects malformed task, command and candidate identities before making any request', async () => {
    const fetchMock = stubResponse(result);
    for (const invalid of ['', '../other', `${assignmentId}/complete`, 'not-a-uuid']) {
      await expect(getWorkAssignment(invalid)).rejects.toThrow('UUID');
      await expect(getWorkAssignmentCommand(invalid)).rejects.toThrow('UUID');
      await expect(getWorkAssignmentEvents(invalid)).rejects.toThrow('UUID');
      await expect(
        createWorkAssignment(
          { source: { ...source, candidateId: invalid }, expectedSourceVersion: 0 },
          commandId
        )
      ).rejects.toThrow('UUID');
      await expect(
        transitionWorkAssignment(
          assignmentId,
          'accept',
          { version: 0, assignmentRevision: 0 },
          invalid
        )
      ).rejects.toThrow('UUID');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unsafe numbers, unsupported scopes and invalid reasons without sending a command', async () => {
    const fetchMock = stubResponse(result);
    for (const options of [
      { page: -1 },
      { page: 10_001 },
      { page: 0.5 },
      { size: 0 },
      { size: 101 },
    ])
      await expect(getWorkAssignments(options)).rejects.toThrow('range');
    for (const afterVersion of [-2, 0.5, Number.MAX_SAFE_INTEGER + 1])
      await expect(getWorkAssignmentEvents(assignmentId, { afterVersion })).rejects.toThrow(
        'range'
      );
    for (const version of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(
        createWorkAssignment({ source, expectedSourceVersion: version }, commandId)
      ).rejects.toThrow('range');
      await expect(
        transitionWorkAssignment(
          assignmentId,
          'accept',
          { version: 0, assignmentRevision: version },
          commandId
        )
      ).rejects.toThrow('range');
    }
    await expect(getWorkAssignments({ scope: 'ALL' as WorkAssignmentScope })).rejects.toThrow(
      'scope'
    );
    await expect(
      getWorkAssignmentBySource({ ...source, sourceSystem: 'PERSONAL_TASK' as 'MEETING_FOLLOWUP' })
    ).rejects.toThrow('source');
    await expect(
      transitionWorkAssignment(
        assignmentId,
        'reopen' as WorkAssignmentTransition,
        { version: 0, assignmentRevision: 0 },
        commandId
      )
    ).rejects.toThrow('command');
    await expect(
      transitionWorkAssignment(
        assignmentId,
        'decline',
        { version: 0, assignmentRevision: 0, reasonCode: 'no' },
        commandId
      )
    ).rejects.toThrow('reason');
    await expect(
      reassignWorkAssignment(
        assignmentId,
        { version: 0, assignmentRevision: 0, assigneeUserId: 0, reasonCode: 'OWNER_CHANGED' },
        commandId
      )
    ).rejects.toThrow('range');
    await expect(
      reassignWorkAssignment(
        assignmentId,
        { version: 0, assignmentRevision: 0, assigneeUserId: 9, reasonCode: '' },
        commandId
      )
    ).rejects.toThrow('reason');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves owner denial, missing source, conflict and outage errors rather than inventing task state', async () => {
    for (const status of [403, 404, 409, 503]) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => response({ message: 'Owner response' }, status))
      );
      await expect(getWorkAssignmentBySource(source)).rejects.toMatchObject({ status });
      await expect(getWorkAssignment(assignmentId)).rejects.toBeInstanceOf(HttpError);
    }
  });
});
