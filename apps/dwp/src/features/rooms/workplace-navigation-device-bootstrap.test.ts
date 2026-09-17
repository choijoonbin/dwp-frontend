import { describe, expect, it } from 'vitest';

import { consumeWorkplaceDeviceBootstrap } from './workplace-navigation-device-bootstrap';

const DEVICE_ID = '19000000-0000-4000-8000-000000000005';

describe('Workplace device bootstrap', () => {
  it('consumes a matching in-memory assertion exactly once', () => {
    const browser = {
      __DWP_WORKPLACE_DEVICE_BOOTSTRAP__: {
        schemaVersion: 1,
        deviceId: DEVICE_ID,
        credential: 'trusted-device-credential',
      },
    };

    expect(consumeWorkplaceDeviceBootstrap(DEVICE_ID, browser)).toEqual({
      schemaVersion: 1,
      deviceId: DEVICE_ID,
      credential: 'trusted-device-credential',
    });
    expect(browser).not.toHaveProperty('__DWP_WORKPLACE_DEVICE_BOOTSTRAP__');
    expect(consumeWorkplaceDeviceBootstrap(DEVICE_ID, browser)).toBeNull();
  });

  it.each([
    {
      schemaVersion: 1,
      deviceId: '19000000-0000-4000-8000-000000000006',
      credential: 'trusted-device-credential',
    },
    { schemaVersion: 2, deviceId: DEVICE_ID, credential: 'trusted-device-credential' },
    { schemaVersion: 1, deviceId: DEVICE_ID, credential: 'bad\ncredential' },
  ])('fails closed and still deletes an invalid assertion', (assertion) => {
    const browser = { __DWP_WORKPLACE_DEVICE_BOOTSTRAP__: assertion };
    expect(consumeWorkplaceDeviceBootstrap(DEVICE_ID, browser)).toBeNull();
    expect(browser).not.toHaveProperty('__DWP_WORKPLACE_DEVICE_BOOTSTRAP__');
  });

  it('fails closed without exposing or repeatedly returning an assertion that cannot be deleted', () => {
    const credential = 'non-configurable-secret-device-credential';
    const browser = {} as Pick<Window, '__DWP_WORKPLACE_DEVICE_BOOTSTRAP__'>;
    Object.defineProperty(browser, '__DWP_WORKPLACE_DEVICE_BOOTSTRAP__', {
      configurable: false,
      enumerable: true,
      value: { schemaVersion: 1, deviceId: DEVICE_ID, credential },
      writable: false,
    });

    expect(() => consumeWorkplaceDeviceBootstrap(DEVICE_ID, browser)).not.toThrow();
    expect(consumeWorkplaceDeviceBootstrap(DEVICE_ID, browser)).toBeNull();
    expect(String(consumeWorkplaceDeviceBootstrap(DEVICE_ID, browser))).not.toContain(credential);
  });
});
