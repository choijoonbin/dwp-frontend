import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { applyMailLifecycle, createMailFolder, createMailRule, getMailThreads } from './mail-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('mail organization API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('queries a custom folder by opaque folder id without putting message data in the URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [], total: 0 }));
    vi.stubGlobal('fetch', fetchMock);

    await getMailThreads({
      folderId: 'folder/customer-success',
      state: 'OPEN',
      query: 'launch review',
      page: 2,
      pageSize: 30,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/platform/v1/mail/threads?state=OPEN&folderId=folder%2Fcustomer-success&query=launch+review&page=2&pageSize=30',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it('creates a personal folder with its account and hierarchy contract intact', async () => {
    const input = {
      accountId: 'account-1',
      parentFolderId: 'folder-1',
      displayName: 'Customer launch',
      color: 'TEAL' as const,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ folderId: 'folder-2', ...input }));
    vi.stubGlobal('fetch', fetchMock);

    await createMailFolder(input);

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/platform/v1/mail/organization/folders');
    expect(request.method).toBe('POST');
    expect(request.headers).toEqual(expect.objectContaining({ 'X-XSRF-TOKEN': 'csrf-token' }));
    expect(JSON.parse(String(request.body))).toEqual(input);
  });

  it('preserves typed sender rules and optimistic lifecycle requests', async () => {
    const rule = {
      accountId: 'account-1',
      displayName: 'Partner mail',
      priority: 100,
      matchMode: 'ALL' as const,
      conditions: [
        { field: 'SENDER' as const, operator: 'ENDS_WITH' as const, value: '@partner.example' },
      ],
      actions: [{ type: 'MOVE_TO_FOLDER' as const, folderId: 'folder-2' }],
      stopProcessing: true,
      enabled: true,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ ruleId: 'rule-1', ...rule }))
      .mockResolvedValueOnce(jsonResponse({ thread: null, deleted: false }));
    vi.stubGlobal('fetch', fetchMock);

    await createMailRule(rule);
    await applyMailLifecycle('thread/1', 'MOVE', 7, 'folder-2');

    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual(rule);
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/platform/v1/mail/threads/thread%2F1/lifecycle');
    expect(JSON.parse(String((fetchMock.mock.calls[2]?.[1] as RequestInit).body))).toEqual({
      action: 'MOVE',
      version: 7,
      targetFolderId: 'folder-2',
    });
  });
});
