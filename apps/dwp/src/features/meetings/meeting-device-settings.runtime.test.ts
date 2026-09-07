// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MeetingDeviceSettings } from './meeting-device-settings';
import { DEFAULT_MEETING_DEVICE_PREFERENCES } from './meeting-preferences-model';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

let root: Root;
let container: HTMLDivElement;
const originalDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');

describe('device settings browser-policy boundaries', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    if (originalDevices) Object.defineProperty(navigator, 'mediaDevices', originalDevices);
    else Reflect.deleteProperty(navigator, 'mediaDevices');
    vi.restoreAllMocks();
  });

  it('renders a disabled unsupported preference when capability inspection throws', async () => {
    const getUserMedia = vi.fn();
    const enumerateDevices = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia,
        enumerateDevices,
        getSupportedConstraints: () => {
          throw new DOMException('Denied', 'SecurityError');
        },
      },
    });
    await act(async () =>
      root.render(
        createElement(MeetingDeviceSettings, {
          value: DEFAULT_MEETING_DEVICE_PREFERENCES,
          onChange: vi.fn(),
        })
      )
    );
    const label = [...container.querySelectorAll('label')].find(
      (node) => node.textContent === 'preferences.audio.noiseSuppression'
    );
    expect(label?.querySelector('input')?.disabled).toBe(true);
    expect(container.textContent).toContain('preferences.devices.unsupportedFeature');
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(enumerateDevices).not.toHaveBeenCalled();
  });

  it('survives a denied mediaDevices getter and keeps capture unavailable after a click', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      get: () => {
        throw new DOMException('Denied', 'SecurityError');
      },
    });
    await act(async () =>
      root.render(
        createElement(MeetingDeviceSettings, {
          value: DEFAULT_MEETING_DEVICE_PREFERENCES,
          onChange: vi.fn(),
        })
      )
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'preferences.devices.errors.unsupported'
    );
    const start = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'preferences.video.start'
    );
    expect(start).toBeTruthy();
    await act(async () => start?.click());
    expect(container.textContent).toContain('preferences.devices.errors.unsupported');
  });
});
