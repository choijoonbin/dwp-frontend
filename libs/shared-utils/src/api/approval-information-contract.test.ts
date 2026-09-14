import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import { getApprovalRequestDetail, respondToApprovalInformationRequest } from './approval-api';
import { readApprovalInformationRound } from './approval-information-contract';

const round = {
  roundId: '11111111-1111-4111-8111-111111111111',
  sourceGeneration: 2,
  targetGeneration: 3,
  payloadRevision: 5,
  payloadSha256: 'a'.repeat(64),
  pins: {
    workflowVersionId: '22222222-2222-4222-8222-222222222222',
    workflowVersion: 7,
    workflowDefinitionSha256: 'b'.repeat(64),
    formSchemaSha256: 'c'.repeat(64),
    policyVersion: 3,
    policySha256: 'd'.repeat(64),
  },
};
const response = (data: unknown) =>
  new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
const execution = { mode: 'LEGACY_COMPATIBILITY', rolloutState: '000' } as const;
describe('information round transport evidence', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });
  it('retains legacy absence and deeply freezes exact next-generation evidence', () => {
    expect(readApprovalInformationRound(null)).toBeNull();
    const value = readApprovalInformationRound(round)!;
    expect(value).toEqual(round);
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.pins)).toBe(true);
  });
  it.each([
    { ...round, tenantId: 1 },
    { ...round, roundId: '../round' },
    { ...round, sourceGeneration: 0 },
    { ...round, sourceGeneration: '2' },
    { ...round, targetGeneration: 4 },
    { ...round, targetGeneration: Number.MAX_SAFE_INTEGER + 1 },
    { ...round, payloadRevision: 0 },
    { ...round, payloadSha256: 'A'.repeat(64) },
    { ...round, pins: { ...round.pins, policyVersion: 0 } },
  ])('rejects unbound, malformed or foreign evidence %#', (value) => {
    expect(() => readApprovalInformationRound(value)).toThrow();
  });
  it.each(['GENERATION', 'STATUS', 'FORM_HASH', 'MISSING_ROUND'])(
    'rejects a request detail with inconsistent %s',
    async (defect) => {
      const data = {
        request: { status: defect === 'STATUS' ? 'IN_REVIEW' : 'NEEDS_INFO' },
        informationGeneration: defect === 'GENERATION' ? 3 : 2,
        informationRound: defect === 'MISSING_ROUND' ? null : round,
        formSchemaSha256: defect === 'FORM_HASH' ? 'e'.repeat(64) : round.pins.formSchemaSha256,
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(data)));
      await expect(getApprovalRequestDetail('request-1')).rejects.toThrow('information source');
    }
  );
  it('sends the original generation/key and privately captures the nested payload before CSRF', async () => {
    const payload = { summary: 'Original', repeated: [{ amount: '999999.12345678' }] };
    const original = structuredClone(payload);
    const fetch = vi
      .fn()
      .mockImplementationOnce(async () => {
        payload.repeated[0]!.amount = '1';
        return response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' });
      })
      .mockResolvedValue(response({ requestId: 'request-1' }));
    vi.stubGlobal('fetch', fetch);
    await respondToApprovalInformationRequest(
      'request-1',
      'Original reply',
      payload,
      8,
      execution,
      {
        idempotencyKey: 'reply:original',
        sourceGeneration: 2,
      }
    );
    const [, init] = fetch.mock.calls.find(([, init]) => init.method === 'POST')!;
    expect(init.headers['Idempotency-Key']).toBe('reply:original');
    expect(JSON.parse(init.body)).toEqual({
      message: 'Original reply',
      payload: original,
      expectedVersion: 8,
      sourceGeneration: 2,
    });
  });
  it.each([0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects unsafe generation %s before CSRF or mutation',
    async (sourceGeneration) => {
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      await expect(
        respondToApprovalInformationRequest('request-1', 'Reply', {}, 8, execution, {
          idempotencyKey: 'reply:original',
          sourceGeneration,
        })
      ).rejects.toThrow('generation');
      expect(fetch).not.toHaveBeenCalled();
    }
  );
});
