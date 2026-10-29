import { describe, expect, it } from 'vitest';

import { messagingAdaptivePollingInterval } from './messaging-adaptive-polling';

describe('messaging adaptive polling', () => {
  it('stops polling while the SSE stream is live or the browser is offline', () => {
    expect(
      messagingAdaptivePollingInterval({
        state: 'live',
        online: true,
        visible: true,
        activeIntervalMs: 15_000,
      })
    ).toBe(false);
    expect(
      messagingAdaptivePollingInterval({
        state: 'polling',
        online: false,
        visible: true,
        activeIntervalMs: 15_000,
      })
    ).toBe(false);
  });

  it('uses a bounded recovery cadence and backs off in hidden tabs', () => {
    expect(
      messagingAdaptivePollingInterval({
        state: 'reconnecting',
        online: true,
        visible: true,
        activeIntervalMs: 15_000,
      })
    ).toBe(8_000);
    expect(
      messagingAdaptivePollingInterval({
        state: 'polling',
        online: true,
        visible: false,
        activeIntervalMs: 15_000,
      })
    ).toBe(60_000);
    expect(
      messagingAdaptivePollingInterval({
        state: 'polling',
        online: true,
        visible: true,
        activeIntervalMs: 15_000,
      })
    ).toBe(15_000);
  });
});
