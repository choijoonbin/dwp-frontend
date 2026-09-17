// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeetingPrejoinSession } from './use-meeting-prejoin-session';
import type { MeetingPreJoinProps } from './meeting-prejoin';
const state = vi.hoisted(() => ({
  stop: vi.fn(),
  submit: vi.fn(),
  error: vi.fn(),
  requesting: false,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
vi.mock('./use-meeting-prejoin-session', () => ({
  useMeetingPrejoinSession: () =>
    ({
      choices: {
        username: 'Mina',
        audioEnabled: true,
        videoEnabled: false,
        audioDeviceId: 'usb-mic',
        videoDeviceId: 'default',
      },
      username: 'Mina',
      setUsername: vi.fn(),
      requesting: state.requesting,
      stop: state.stop,
      preview: { states: { audio: 'active', video: 'idle' }, error: null },
    }) as unknown as MeetingPrejoinSession,
}));
vi.mock('./meeting-prejoin-devices', () => ({ MeetingPrejoinDevices: () => null }));
vi.mock('./meeting-prejoin-agenda', () => ({ MeetingPrejoinAgenda: () => null }));
vi.mock('./meeting-content-governance', () => ({
  MeetingContentPreJoin: ({ onGuardChange }: { onGuardChange: (blocked: boolean) => void }) =>
    createElement(
      'div',
      null,
      createElement(
        'button',
        { type: 'button', onClick: () => onGuardChange(false) },
        'consent-ready'
      ),
      createElement(
        'button',
        { type: 'button', onClick: () => onGuardChange(true) },
        'consent-revoked'
      )
    ),
}));
import { MeetingPreJoin } from './meeting-prejoin';
let root: Root;
let mount: HTMLDivElement;
const props = (): MeetingPreJoinProps => ({
  meeting: {
    meetingId: 'meeting',
    lifecycleState: 'LIVE',
    title: 'Release review',
    startsAt: '2026-09-07T00:00:00Z',
    timeZone: 'Asia/Seoul',
    organizerName: 'Mina',
    attendeeCount: 1,
    waitingRoomEnabled: true,
    accessScope: 'INVITED',
    canHost: false,
  } as MeetingPreJoinProps['meeting'],
  defaults: {
    username: 'Mina',
    audioEnabled: true,
    videoEnabled: false,
    audioDeviceId: 'usb-mic',
    videoDeviceId: 'default',
    speakerDeviceId: 'default',
    noiseSuppression: false,
    hdVideo: false,
    backgroundMode: 'original',
  },
  busy: false,
  onCancel: vi.fn(),
  onError: state.error,
  onSubmit: state.submit,
  onSpeakerDeviceChange: vi.fn(),
});
const join = () => mount.querySelector<HTMLButtonElement>('.lk-join-button')!;
async function click(text: string) {
  await act(async () =>
    [...mount.querySelectorAll('button')].find((item) => item.textContent === text)!.click()
  );
}
describe('actual prejoin admission form', () => {
  beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    state.requesting = false;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1)
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
    await act(async () => root.render(createElement(MeetingPreJoin, props())));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    mount.remove();
    vi.unstubAllGlobals();
  });
  it('uses the meeting title as its only primary heading and retains the context region', () => {
    expect([...mount.querySelectorAll('h1')].map((heading) => heading.textContent)).toEqual([
      'Release review',
    ]);
    const context = mount.querySelector('[data-testid="meeting-prejoin-context"]')!;
    expect(context.getAttribute('aria-labelledby')).toBe(mount.querySelector('h1')!.id);
    expect(mount.textContent).toContain('room.deviceCheck');
    expect(context.textContent).toContain('room.deviceDescription');
  });
  it('guards both the visible submit control and native form submission before consent and after revocation', async () => {
    expect(join().disabled).toBe(true);
    await act(async () =>
      mount
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    );
    expect(state.submit).not.toHaveBeenCalled();
    await click('consent-ready');
    expect(join().disabled).toBe(false);
    await click('consent-revoked');
    expect(join().disabled).toBe(true);
  });
  it('captures the effective choices once and stops preview before sending entry, ignoring a duplicate submit', async () => {
    let finish!: () => void;
    state.submit.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    await click('consent-ready');
    await act(async () => join().click());
    await act(async () =>
      mount
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    );
    expect(state.submit).toHaveBeenCalledTimes(1);
    expect(state.submit).toHaveBeenCalledWith({
      username: 'Mina',
      audioEnabled: true,
      videoEnabled: false,
      audioDeviceId: 'usb-mic',
      videoDeviceId: 'default',
    });
    expect(state.stop.mock.invocationCallOrder[0]).toBeLessThan(
      state.submit.mock.invocationCallOrder[0]!
    );
    await act(async () => finish());
  });
  it('cannot join while a device permission or replacement request is in flight', async () => {
    await click('consent-ready');
    state.requesting = true;
    await act(async () => root.render(createElement(MeetingPreJoin, props())));
    expect(join().disabled).toBe(true);
  });
});
