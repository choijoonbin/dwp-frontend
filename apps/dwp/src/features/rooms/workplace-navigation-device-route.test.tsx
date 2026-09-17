// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkplaceDeviceDisplayRoute } from './workplace-navigation-device-route';

const surfaceRender = vi.hoisted(() => vi.fn());

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

vi.mock('./workplace-navigation-device-surfaces', () => ({
  WorkplaceDeviceSurface: (props: unknown) => {
    surfaceRender(props);
    return null;
  },
}));

const DEVICE_A = '19000000-0000-4000-8000-000000000005';
const DEVICE_B = '19000000-0000-4000-8000-000000000006';

function installBootstrap(deviceId: string, credential: string) {
  window.__DWP_WORKPLACE_DEVICE_BOOTSTRAP__ = {
    schemaVersion: 1,
    deviceId,
    credential,
  };
}

describe('Workplace device display route', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    surfaceRender.mockReset();
    Reflect.deleteProperty(window, '__DWP_WORKPLACE_DEVICE_BOOTSTRAP__');
    host = document.createElement('div');
    document.body.append(host);
  });

  afterEach(() => {
    Reflect.deleteProperty(window, '__DWP_WORKPLACE_DEVICE_BOOTSTRAP__');
    host.remove();
  });

  it('remounts on a device id change and never reuses the previous credential', async () => {
    installBootstrap(DEVICE_A, 'credential-for-device-a');
    const router = createMemoryRouter(
      [
        {
          path: '/device/:deviceId',
          element: <WorkplaceDeviceDisplayRoute />,
        },
      ],
      { initialEntries: [`/device/${DEVICE_A}`] }
    );
    const root = createRoot(host);

    await act(async () => root.render(<RouterProvider router={router} />));
    expect(surfaceRender).toHaveBeenLastCalledWith(
      expect.objectContaining({
        deviceId: DEVICE_A,
        deviceCredential: 'credential-for-device-a',
      })
    );

    await act(async () => router.navigate(`/device/${DEVICE_B}`));
    expect(surfaceRender).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('screen19.devices.displayAssertionRequired');

    await act(async () => root.unmount());
  });
});
