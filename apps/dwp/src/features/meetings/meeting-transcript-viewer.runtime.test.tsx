// @vitest-environment jsdom
import { act, createElement, useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Shared from '@dwp-frontend/shared-utils';

const runtime = vi.hoisted(() => ({
  query: vi.fn(),
  auth: {
    isAuthenticated: true,
    user: { identityPlane: 'TENANT', tenantId: 1, userId: 42 },
  },
}));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<typeof Shared>()),
  useAuth: () => runtime.auth,
}));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-transcript-api', () => ({
  queryVideoMeetingTranscript: runtime.query,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import type { VideoMeetingArtifact } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import { HttpError } from '@dwp-frontend/shared-utils';
import { MeetingPlaybackSyncProvider, useMeetingPlaybackSync } from './meeting-playback-sync';
import { MeetingTranscriptViewer } from './meeting-transcript-viewer';

const artifact: VideoMeetingArtifact = {
  artifactId: '90000000-0000-4000-8000-000000000004',
  artifactType: 'TRANSCRIPT',
  artifactState: 'AVAILABLE',
  retentionUntil: '2099-01-01T00:00:00Z',
  metadata: {},
  version: 7,
};

function RegisteredMedia() {
  const playback = useMeetingPlaybackSync();
  const registerMedia = playback?.registerMedia;
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    registerMedia?.(ref.current);
    return () => registerMedia?.(null);
  }, [registerMedia]);
  return createElement('audio', { ref });
}

let root: Root;
let mount: HTMLDivElement;

describe('bounded synchronized meeting transcript', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Element.prototype.scrollIntoView = vi.fn();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    runtime.auth = {
      isAuthenticated: true,
      user: { identityPlane: 'TENANT', tenantId: 1, userId: 42 },
    };
    runtime.query.mockReset().mockResolvedValue({
      artifactId: artifact.artifactId,
      artifactVersion: artifact.version,
      segments: [
        { segmentId: 'segment-1', startMillis: 5_000, endMillis: 8_000, text: '결정 사항' },
      ],
      nextCursor: null,
      hasMore: false,
      queryApplied: false,
      retentionUntil: artifact.retentionUntil,
    });
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    mount.remove();
  });

  it('loads a bounded page and seeks the recording while marking the active segment', async () => {
    await act(async () =>
      root.render(
        createElement(
          MeetingPlaybackSyncProvider,
          null,
          createElement(RegisteredMedia),
          createElement(MeetingTranscriptViewer, { meetingId: 'meeting-1', artifact })
        )
      )
    );
    const open = [...mount.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('history.recap.transcript.open')
    );
    await act(async () => open?.click());
    await vi.waitFor(() => expect(mount.textContent).toContain('결정 사항'));
    const audio = mount.querySelector('audio')!;
    Object.defineProperty(audio, 'readyState', { configurable: true, value: 1 });
    const timestamp = [...mount.querySelectorAll('button')].find(
      (button) => button.textContent === '0:05'
    );

    await act(async () => timestamp?.click());
    expect(audio.currentTime).toBe(5);
    await act(async () => audio.dispatchEvent(new Event('seeked')));

    expect(mount.querySelector('li')?.getAttribute('aria-current')).toBe('true');
    expect(runtime.query).toHaveBeenCalledWith('meeting-1', artifact, {
      cursor: 0,
      pageSize: 25,
      query: undefined,
    });
  });

  it('keeps a one-character abusive query client-side', async () => {
    await act(async () =>
      root.render(
        createElement(
          MeetingPlaybackSyncProvider,
          null,
          createElement(MeetingTranscriptViewer, { meetingId: 'meeting-1', artifact })
        )
      )
    );
    const open = [...mount.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('history.recap.transcript.open')
    );
    await act(async () => open?.click());
    await vi.waitFor(() => expect(runtime.query).toHaveBeenCalledOnce());
    const input = mount.querySelector('input')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'a');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const form = mount.querySelector('form')!;
    await act(async () =>
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    );

    expect(runtime.query).toHaveBeenCalledOnce();
    expect(mount.textContent).toContain('history.recap.transcript.searchMinimum');
  });

  it('removes a previously displayed transcript when a later page is no longer authorized', async () => {
    runtime.query
      .mockResolvedValueOnce({
        artifactId: artifact.artifactId,
        artifactVersion: artifact.version,
        segments: [
          {
            segmentId: 'sensitive-segment',
            startMillis: 1_000,
            endMillis: 2_000,
            text: 'Confidential transcript evidence',
          },
        ],
        nextCursor: 25,
        hasMore: true,
        queryApplied: false,
        retentionUntil: artifact.retentionUntil,
      })
      .mockRejectedValueOnce(new HttpError('Forbidden', 403));

    await act(async () =>
      root.render(
        createElement(
          MeetingPlaybackSyncProvider,
          null,
          createElement(MeetingTranscriptViewer, { meetingId: 'meeting-1', artifact })
        )
      )
    );
    const open = [...mount.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('history.recap.transcript.open')
    );
    await act(async () => open?.click());
    await vi.waitFor(() => expect(mount.textContent).toContain('Confidential transcript evidence'));
    const loadMore = [...mount.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('history.recap.transcript.loadMore')
    );
    await act(async () => loadMore?.click());

    await vi.waitFor(() =>
      expect(mount.textContent).toContain('history.recap.transcript.accessRevoked')
    );
    expect(mount.textContent).not.toContain('Confidential transcript evidence');
    expect(mount.querySelector('form')).toBeNull();
    expect(mount.querySelector('ol')).toBeNull();
  });

  it('ignores a late transcript page after the authenticated identity changes', async () => {
    let resolveLate!: (value: Awaited<ReturnType<typeof runtime.query>>) => void;
    const latePage = new Promise<Awaited<ReturnType<typeof runtime.query>>>((resolve) => {
      resolveLate = resolve;
    });
    runtime.query
      .mockResolvedValueOnce({
        artifactId: artifact.artifactId,
        artifactVersion: artifact.version,
        segments: [
          { segmentId: 'old-segment', startMillis: 0, endMillis: 1_000, text: 'Old identity' },
        ],
        nextCursor: 25,
        hasMore: true,
        queryApplied: false,
        retentionUntil: artifact.retentionUntil,
      })
      .mockReturnValueOnce(latePage);
    const renderViewer = () =>
      root.render(
        createElement(
          MeetingPlaybackSyncProvider,
          null,
          createElement(MeetingTranscriptViewer, { meetingId: 'meeting-1', artifact })
        )
      );
    await act(async () => renderViewer());
    const open = [...mount.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('history.recap.transcript.open')
    );
    await act(async () => open?.click());
    await vi.waitFor(() => expect(mount.textContent).toContain('Old identity'));
    const loadMore = [...mount.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('history.recap.transcript.loadMore')
    );
    await act(async () => loadMore?.click());

    runtime.auth = {
      isAuthenticated: true,
      user: { identityPlane: 'TENANT', tenantId: 1, userId: 43 },
    };
    await act(async () => renderViewer());
    await act(async () =>
      resolveLate({
        artifactId: artifact.artifactId,
        artifactVersion: artifact.version,
        segments: [
          {
            segmentId: 'late-sensitive-segment',
            startMillis: 1_000,
            endMillis: 2_000,
            text: 'Late prior identity transcript',
          },
        ],
        nextCursor: null,
        hasMore: false,
        queryApplied: false,
        retentionUntil: artifact.retentionUntil,
      })
    );

    expect(mount.textContent).not.toContain('Old identity');
    expect(mount.textContent).not.toContain('Late prior identity transcript');
    expect(mount.textContent).toContain('history.recap.transcript.open');
  });
});
