// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MeetingDeviceSettings } from './meeting-device-settings';
import { DEFAULT_MEETING_DEVICE_PREFERENCES } from './meeting-preferences-model';
import { MeetingDeviceSettingsDiagnostics } from './meeting-device-settings-diagnostics';
import * as Background from './meeting-background-processor';

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

  it('reports idle local diagnostics without acquiring media and preserves unavailable design controls', async () => {
    const getUserMedia = vi.fn();
    const enumerateDevices = vi.fn();
    const onDiagnostics = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia, enumerateDevices, getSupportedConstraints: () => ({}) },
    });
    await act(async () =>
      root.render(
        createElement(MeetingDeviceSettings, {
          value: DEFAULT_MEETING_DEVICE_PREFERENCES,
          onChange: vi.fn(),
          onDiagnostics,
        })
      )
    );
    expect(onDiagnostics).toHaveBeenLastCalledWith({
      audio: 'idle',
      video: 'idle',
      failure: false,
    });
    expect(container.querySelector('[role="meter"]')?.getAttribute('aria-valuenow')).toBe('0');
    expect(
      container.querySelectorAll('[data-testid="meeting-background-options"] button')
    ).toHaveLength(4);
    for (const key of ['blur', 'office', 'image']) {
      const option = container.querySelector<HTMLButtonElement>(
        `button[aria-label="stitch.devices.${key}"]`
      );
      expect(option?.disabled).toBe(true);
    }
    expect(
      container.querySelector<HTMLInputElement>('input[aria-label="stitch.devices.hd"]')?.disabled
    ).toBe(true);
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(enumerateDevices).not.toHaveBeenCalled();
  });

  it('keeps office unavailable when a mobile browser lacks its image pipeline while original remains usable', async () => {
    vi.spyOn(Background, 'isMeetingBackgroundSupported').mockImplementation(
      (mode) => mode === 'blur'
    );
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(),
        enumerateDevices: vi.fn(),
        getSupportedConstraints: () => ({}),
      },
    });
    await act(async () =>
      root.render(
        createElement(MeetingDeviceSettings, {
          value: { ...DEFAULT_MEETING_DEVICE_PREFERENCES, backgroundMode: 'office' },
          onChange: vi.fn(),
        })
      )
    );
    expect(
      container.querySelector<HTMLButtonElement>('button[aria-label="stitch.devices.office"]')
        ?.disabled
    ).toBe(true);
    expect(
      container.querySelector<HTMLButtonElement>('button[aria-label="stitch.devices.none"]')
        ?.disabled
    ).toBe(false);
    expect(container.textContent).toContain('preferences.video.backgroundUnsupported');
  });

  it('never equates local media preview success with measured network quality', async () => {
    await act(async () =>
      root.render(
        createElement(MeetingDeviceSettingsDiagnostics, {
          value: { audio: 'active', video: 'active', failure: false },
        })
      )
    );
    expect(container.textContent).toContain('stitch.devices.localChecked');
    expect(container.textContent?.match(/stitch.devices.unmeasured/g)).toHaveLength(2);
    await act(async () =>
      root.render(
        createElement(MeetingDeviceSettingsDiagnostics, {
          value: { audio: 'active', video: 'idle', failure: true },
        })
      )
    );
    expect(container.textContent).toContain('stitch.devices.checkFailed');
    expect(container.textContent).not.toContain('stitch.devices.localChecked');
  });

  it('saves blur and curated office without turning on an idle camera and keeps upload unavailable', async () => {
    vi.spyOn(Background, 'isMeetingBackgroundSupported').mockReturnValue(true);
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia, enumerateDevices: vi.fn(), getSupportedConstraints: () => ({}) },
    });
    const onChange = vi.fn();
    const render = (backgroundMode: 'original' | 'blur' | 'office') =>
      act(async () =>
        root.render(
          createElement(MeetingDeviceSettings, {
            value: { ...DEFAULT_MEETING_DEVICE_PREFERENCES, backgroundMode },
            onChange,
          })
        )
      );
    await render('original');
    const blur = container.querySelector<HTMLButtonElement>(
      'button[aria-label="stitch.devices.blur"]'
    )!;
    expect(blur.disabled).toBe(false);
    await act(async () => blur.click());
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_MEETING_DEVICE_PREFERENCES,
      backgroundMode: 'blur',
    });
    expect(getUserMedia).not.toHaveBeenCalled();
    await render('blur');
    expect(blur.getAttribute('aria-pressed')).toBe('true');
    const office = container.querySelector<HTMLButtonElement>(
      'button[aria-label="stitch.devices.office"]'
    )!;
    expect(office.disabled).toBe(false);
    await act(async () => office.click());
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_MEETING_DEVICE_PREFERENCES,
      backgroundMode: 'office',
    });
    await render('office');
    expect(office.getAttribute('aria-pressed')).toBe('true');
    const original = container.querySelector<HTMLButtonElement>(
      'button[aria-label="stitch.devices.none"]'
    )!;
    await act(async () => original.click());
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_MEETING_DEVICE_PREFERENCES,
      backgroundMode: 'original',
    });
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(
      container.querySelector<HTMLButtonElement>('button[aria-label="stitch.devices.image"]')!
        .disabled
    ).toBe(true);
  });
});
