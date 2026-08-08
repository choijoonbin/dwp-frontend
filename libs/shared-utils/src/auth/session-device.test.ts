import { describe, expect, it } from 'vitest';

import { describeSessionDevice } from './session-device';

describe('describeSessionDevice', () => {
  it('identifies desktop Chrome on macOS', () => {
    expect(
      describeSessionDevice(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36'
      )
    ).toEqual({
      browser: 'Chrome',
      platform: 'macOS',
      kind: 'desktop',
      label: 'Chrome on macOS',
    });
  });

  it('identifies mobile Safari on iOS', () => {
    const device = describeSessionDevice(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Version/17.5 Mobile/15E148 Safari/604.1'
    );
    expect(device.label).toBe('Safari on iOS');
    expect(device.kind).toBe('mobile');
  });

  it('provides a stable fallback without a user agent', () => {
    expect(describeSessionDevice(null)).toEqual({
      browser: 'Unknown browser',
      platform: 'Unknown device',
      kind: 'unknown',
      label: 'Unknown device',
    });
  });
});
