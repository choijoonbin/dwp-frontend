// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({ ticket: vi.fn() }));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-artifact-api', () => ({
  createVideoMeetingArtifactAccessTicket: runtime.ticket,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

import { MeetingArtifactPlayback } from './meeting-artifact-playback';
import { MeetingPlaybackSyncProvider, useMeetingPlaybackSync } from './meeting-playback-sync';
import type { VideoMeetingArtifact } from '@dwp-frontend/shared-utils/api/video-meeting-api';

const meetingId = '90000000-0000-4000-8000-000000000001';
const artifact: VideoMeetingArtifact = {
  artifactId: '90000000-0000-4000-8000-000000000002',
  artifactType: 'RECORDING',
  artifactState: 'AVAILABLE',
  contentType: 'audio/mpeg',
  sizeBytes: 1234,
  retentionUntil: '2099-01-01T00:00:00Z',
  metadata: {},
  version: 4,
};

function SeekTrigger() {
  const playback = useMeetingPlaybackSync();
  return createElement('button', { onClick: () => playback?.seekTo(61_000) }, 'seek');
}

let root: Root;
let mount: HTMLDivElement;

describe('governed inline meeting recording playback', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Element.prototype.scrollIntoView = vi.fn();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    runtime.ticket.mockReset().mockResolvedValue({
      artifactId: artifact.artifactId,
      artifactVersion: artifact.version,
      accessUrl: 'https://media.example.com/playback/opaque-ticket',
      expiresAt: '2098-12-31T23:59:00Z',
      contentType: artifact.contentType,
    });
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    mount.remove();
  });

  it('uses an ephemeral version-bound ticket in an inline player instead of a new window', async () => {
    await act(async () =>
      root.render(createElement(MeetingArtifactPlayback, { meetingId, artifact }))
    );
    const action = mount.querySelector('button');
    expect(action?.textContent).toContain('history.recap.artifacts.access.open.audio');
    await act(async () => action?.click());
    await vi.waitFor(() => expect(mount.querySelector('audio')).not.toBeNull());
    expect(runtime.ticket).toHaveBeenCalledExactlyOnceWith(
      meetingId,
      artifact.artifactId,
      artifact.version,
      artifact.contentType,
      artifact.retentionUntil
    );
    expect(mount.querySelector('audio')?.getAttribute('src')).toBe(
      'https://media.example.com/playback/opaque-ticket'
    );
  });

  it('discards a late ticket after the artifact identity changes', async () => {
    let resolveTicket: ((ticket: unknown) => void) | undefined;
    runtime.ticket.mockReset().mockReturnValue(
      new Promise((resolve) => {
        resolveTicket = resolve;
      })
    );
    await act(async () =>
      root.render(createElement(MeetingArtifactPlayback, { meetingId, artifact }))
    );
    await act(async () => mount.querySelector('button')?.click());

    const replacementArtifact: VideoMeetingArtifact = {
      ...artifact,
      artifactId: '90000000-0000-4000-8000-000000000003',
      version: 5,
    };
    await act(async () =>
      root.render(
        createElement(MeetingArtifactPlayback, { meetingId, artifact: replacementArtifact })
      )
    );
    await act(async () => {
      resolveTicket?.({
        artifactId: artifact.artifactId,
        artifactVersion: artifact.version,
        accessUrl: 'https://media.example.com/playback/stale-ticket',
        expiresAt: '2098-12-31T23:59:00Z',
        contentType: artifact.contentType,
      });
      await Promise.resolve();
    });

    expect(mount.querySelector('audio,video')).toBeNull();
    expect(mount.textContent).toContain('history.recap.artifacts.access.open.audio');
  });

  it('queues a citation seek until the authorized media metadata is ready', async () => {
    await act(async () =>
      root.render(
        createElement(
          MeetingPlaybackSyncProvider,
          null,
          createElement(SeekTrigger),
          createElement(MeetingArtifactPlayback, { meetingId, artifact })
        )
      )
    );
    const seek = [...mount.querySelectorAll('button')].find(
      (button) => button.textContent === 'seek'
    );
    await act(async () => seek?.click());
    await vi.waitFor(() => expect(mount.querySelector('audio')).not.toBeNull());
    const audio = mount.querySelector('audio')!;
    Object.defineProperty(audio, 'readyState', { configurable: true, value: 1 });
    await act(async () => audio.dispatchEvent(new Event('loadedmetadata')));
    expect(audio.currentTime).toBe(61);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledOnce();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
      behavior: 'smooth',
    });
    expect(runtime.ticket).toHaveBeenCalledOnce();
  });

  it('uses immediate scrolling when the user requests reduced motion', async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    await act(async () =>
      root.render(
        createElement(
          MeetingPlaybackSyncProvider,
          null,
          createElement(SeekTrigger),
          createElement(MeetingArtifactPlayback, { meetingId, artifact })
        )
      )
    );
    const seek = [...mount.querySelectorAll('button')].find(
      (button) => button.textContent === 'seek'
    );
    await act(async () => seek?.click());
    await vi.waitFor(() => expect(mount.querySelector('audio')).not.toBeNull());
    const audio = mount.querySelector('audio')!;
    Object.defineProperty(audio, 'readyState', { configurable: true, value: 1 });
    await act(async () => audio.dispatchEvent(new Event('loadedmetadata')));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
      behavior: 'auto',
    });
  });
});
