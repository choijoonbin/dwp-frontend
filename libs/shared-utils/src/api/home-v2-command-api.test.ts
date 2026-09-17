import { afterEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance } from '../axios-instance';
import { executeHomeV2WidgetAction, parseHomeV2WidgetCommandReceipt } from './home-v2-command-api';

const commandId = '11111111-1111-4111-8111-111111111111';
const receiptId = '22222222-2222-4222-8222-222222222222';

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    status: 'SUCCESS',
    data: {
      receiptId,
      commandId,
      commandKey: 'home.recommendation.dismiss',
      status: 'ACCEPTED',
      sourceRoute: '/work',
      acceptedAt: '2026-09-16T01:02:03Z',
      resultVersion: 'recommendation-8',
      ...overrides,
    },
  };
}

describe('Home v2 widget command client', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends the single declared action with a stable UUID and exact parameters', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: envelope() });

    await expect(
      executeHomeV2WidgetAction({
        actionId: 'dismiss-recommendation',
        deviceClass: 'DESKTOP_STANDARD',
        expectedResultVersion: 'recommendation-7',
        expectedDecisionRevision: 'product-surface-revision-17',
        idempotencyKey: commandId,
        instanceId: '33333333-3333-4333-8333-333333333333',
        mode: 'CLASSIC',
        parameters: { recommendationKey: 'daily-focus' },
        timeZone: 'Asia/Seoul',
      })
    ).resolves.toMatchObject({ commandId, receiptId, status: 'ACCEPTED' });

    expect(post).toHaveBeenCalledWith(
      '/api/platform/v2/home/widget-actions:execute?deviceClass=DESKTOP_STANDARD&mode=CLASSIC&timeZone=Asia%2FSeoul',
      {
        instanceId: '33333333-3333-4333-8333-333333333333',
        actionId: 'dismiss-recommendation',
        expectedResultVersion: 'recommendation-7',
        parameters: { recommendationKey: 'daily-focus' },
      },
      expect.objectContaining({
        headers: {
          'Idempotency-Key': commandId,
          'X-DWP-Expected-Decision-Revision': 'product-surface-revision-17',
        },
        timeoutMs: 10_000,
      })
    );
  });

  it.each([
    ['an unknown status', { status: 'REPLAYED' }],
    ['a different command', { commandKey: 'home.recommendation.delete' }],
    ['an external route', { sourceRoute: 'https://example.test' }],
    ['an encoded traversal route', { sourceRoute: '/work/%252e%252e/admin' }],
    ['a trailing field', { providerPayload: { title: 'private' } }],
  ])('rejects %s in a command receipt', (_label, overrides) => {
    expect(() => parseHomeV2WidgetCommandReceipt(envelope(overrides))).toThrow(
      'Home v2 command response is invalid'
    );
  });

  it('rejects any client-selected action or parameter expansion before dispatch', async () => {
    const post = vi.spyOn(axiosInstance, 'post');
    const input = {
      actionId: 'dismiss-recommendation' as const,
      deviceClass: 'DESKTOP_STANDARD' as const,
      expectedResultVersion: 'recommendation-7',
      expectedDecisionRevision: 'product-surface-revision-17',
      idempotencyKey: commandId,
      instanceId: '33333333-3333-4333-8333-333333333333',
      mode: 'CLASSIC' as const,
      parameters: { recommendationKey: 'daily-focus', extra: 'private' },
      timeZone: 'Asia/Seoul',
    };

    await expect(
      executeHomeV2WidgetAction(input as unknown as Parameters<typeof executeHomeV2WidgetAction>[0])
    ).rejects.toThrow('request.parameters');
    expect(post).not.toHaveBeenCalled();
  });
});
