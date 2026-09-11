// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Track } from 'livekit-client';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import {
  isLocalScreenShareTrack,
  MEETING_SCREEN_SHARE_CAPTURE_OPTIONS,
  MeetingLocalScreenShareNotice,
} from './meeting-screen-share';

function screenTrack({ local, muted = false }: { local: boolean; muted?: boolean }) {
  return {
    participant: { isLocal: local },
    publication: { source: Track.Source.ScreenShare, isMuted: muted },
  };
}

describe('meeting screen-share recursion guard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('asks the browser to avoid the meeting tab and prefer a separate window', () => {
    expect(MEETING_SCREEN_SHARE_CAPTURE_OPTIONS).toMatchObject({
      audio: true,
      video: { displaySurface: 'window' },
      selfBrowserSurface: 'exclude',
      surfaceSwitching: 'include',
      preferCurrentTab: false,
    });
  });

  it('identifies only the published local screen-share preview for suppression', () => {
    expect(isLocalScreenShareTrack(screenTrack({ local: true }))).toBe(true);
    // A temporarily muted display surface is still being shared and must remain fenced.
    expect(isLocalScreenShareTrack(screenTrack({ local: true, muted: true }))).toBe(true);
    expect(isLocalScreenShareTrack(screenTrack({ local: false }))).toBe(false);
    expect(
      isLocalScreenShareTrack({
        participant: { isLocal: true },
        publication: { source: Track.Source.Camera },
      })
    ).toBe(false);
  });

  it('renders an announced explanation while the local preview is hidden', () => {
    const markup = renderToStaticMarkup(createElement(MeetingLocalScreenShareNotice));
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('room.controls.screenShareSelfTitle');
    expect(markup).toContain('room.controls.screenShareSelfDescription');
  });
});
