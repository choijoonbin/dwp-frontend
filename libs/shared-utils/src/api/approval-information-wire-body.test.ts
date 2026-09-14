import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { respondToApprovalInformationRequest } from './approval-api';
import { approvalInformationWireBody } from './approval-information-wire-body';

function decode(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

describe('original approval information wire body', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('retains exactly the immutable UTF-8 JSON bytes, not a later payload reconstruction', async () => {
    let original = '';
    const input = { message: '보완 답변', payload: { note: '원래 자료' }, expectedVersion: 8 };
    const body = approvalInformationWireBody(input, (value) => {
      original = value;
      input.payload.note = '바뀐 자료';
    });
    expect(new Uint8Array(await body.arrayBuffer())).toEqual(decode(original));
    expect(await body.text()).toBe(
      JSON.stringify({ message: '보완 답변', payload: { note: '원래 자료' }, expectedVersion: 8 })
    );
    expect(body.type).toBe('application/json');
  });

  it('permits exactly the byte limit without a large argument-list overflow', () => {
    const overhead = new TextEncoder().encode(JSON.stringify({ message: '' })).byteLength;
    const capture = vi.fn();
    const body = approvalInformationWireBody({ message: 'a'.repeat(262144 - overhead) }, capture);
    expect(body.size).toBe(262144);
    expect(decode(capture.mock.calls[0][0])).toHaveLength(262144);
  });

  it('bounds UTF-8 bytes rather than character count before capturing a descriptor', () => {
    const capture = vi.fn();
    expect(() => approvalInformationWireBody({ message: '가'.repeat(87382) }, capture)).toThrow(
      'too large'
    );
    expect(capture).not.toHaveBeenCalled();
  });

  it('rejects asynchronous capture before any transport', () => {
    expect(() => approvalInformationWireBody({ message: 'Reply' }, async () => {})).toThrow(
      'synchronous'
    );
  });

  it('sends the same captured bytes through the actual CSRF and fetch adapter', async () => {
    const calls: Array<{ url: string; body?: BodyInit | null; headers: Record<string, string> }> =
      [];
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: init.body, headers: init.headers as Record<string, string> });
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: url.includes('/csrf')
              ? { token: 'csrf', headerName: 'X-XSRF-TOKEN' }
              : { requestId: 'request-1' },
          }),
      } as Response;
    });
    vi.stubGlobal('fetch', fetch);
    let original = '';
    await respondToApprovalInformationRequest(
      'request-1',
      '보완',
      { amount: 7 },
      8,
      { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' },
      {
        idempotencyKey: 'reply:original',
        sourceGeneration: 2,
        onOriginalWireBody: (value) => {
          original = value;
        },
      }
    );
    const command = calls.find((call) => !call.url.includes('/csrf'))!;
    expect(command.body).toBeInstanceOf(Blob);
    expect(new Uint8Array(await (command.body as Blob).arrayBuffer())).toEqual(decode(original));
    expect(command.headers['Content-Type']).toBe('application/json');
    expect(command.headers['Idempotency-Key']).toBe('reply:original');
    expect(command.headers['X-XSRF-TOKEN']).toBe('csrf');
  });

  it('does not capture or send an invalid command identity', async () => {
    const fetch = vi.fn();
    const capture = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(
      respondToApprovalInformationRequest(
        'request-1',
        'Reply',
        {},
        8,
        { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' },
        {
          idempotencyKey: 'bad key',
          onOriginalWireBody: capture,
        }
      )
    ).rejects.toThrow('command identity');
    expect(capture).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not classify a rejected private capture as a sent command', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(
      respondToApprovalInformationRequest(
        'request-1',
        'Reply',
        {},
        8,
        { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' },
        {
          idempotencyKey: 'reply:original',
          onOriginalWireBody: () => {
            throw new Error('original body mismatch');
          },
        }
      )
    ).rejects.toThrow('original body mismatch');
    expect(fetch).not.toHaveBeenCalled();
  });
});
