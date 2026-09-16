import { describe, expect, it } from 'vitest';

import {
  conditionalRequestHeaders,
  resolveConditionalHttpResponse,
  type ConditionalHttpSnapshot,
} from './http-conditional';

const snapshot = (): ConditionalHttpSnapshot<{ value: string }> => ({
  data: { value: 'private-recipient-data' },
  etag: 'W/"recipient-authority-revision-7"',
});

describe('conditional HTTP snapshot contract', () => {
  it('derives the validator only from the caller-owned snapshot', () => {
    const previous = snapshot();
    expect(conditionalRequestHeaders(previous)).toEqual({
      'If-None-Match': 'W/"recipient-authority-revision-7"',
    });
    expect(conditionalRequestHeaders(undefined)).toEqual({});
    expect(conditionalRequestHeaders({ ...previous, etag: null })).toEqual({});
  });

  it.each([
    'recipient-revision-7',
    ' W/"revision-7"',
    'W/"revision-7"\nX-Injected: true',
    `"${'a'.repeat(257)}"`,
  ])('rejects an unsafe entity tag before it can become a request header', (etag) => {
    expect(() => conditionalRequestHeaders({ data: {}, etag })).toThrow(
      'Conditional response contains an invalid ETag.'
    );
  });

  it('creates a fresh snapshot from a valid 200 response', () => {
    const data = { value: 'fresh' };
    expect(
      resolveConditionalHttpResponse(
        {
          data,
          headers: new Headers({ ETag: '"revision-8"' }),
          status: 200,
        },
        snapshot()
      )
    ).toEqual({
      snapshot: { data, etag: '"revision-8"' },
      status: 200,
      notModified: false,
    });
  });

  it('reuses the exact caller-owned snapshot after a matching 304', () => {
    const previous = snapshot();
    const result = resolveConditionalHttpResponse(
      {
        data: undefined,
        headers: new Headers({ ETag: previous.etag! }),
        status: 304,
      },
      previous
    );

    expect(result).toEqual({ snapshot: previous, status: 304, notModified: true });
    expect(result.snapshot).toBe(previous);
    expect(result.snapshot.data).toBe(previous.data);
  });

  it('rejects a 304 without a reusable snapshot or with a changed validator', () => {
    expect(() =>
      resolveConditionalHttpResponse({ data: undefined, status: 304 }, undefined)
    ).toThrow('A 304 response requires a matching local snapshot.');
    expect(() =>
      resolveConditionalHttpResponse(
        {
          data: undefined,
          headers: new Headers({ ETag: '"different-revision"' }),
          status: 304,
        },
        snapshot()
      )
    ).toThrow('A 304 response changed the cached entity tag.');
  });

  it.each([
    { data: undefined, status: 200 },
    { data: { value: 'unexpected' }, status: 204 },
    { data: { value: 'unexpected' }, status: 206 },
  ])('rejects a response that cannot form a complete snapshot', (response) => {
    expect(() => resolveConditionalHttpResponse(response, snapshot())).toThrow(
      'Conditional GET response is invalid.'
    );
  });
});
