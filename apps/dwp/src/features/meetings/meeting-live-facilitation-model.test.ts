import { describe, expect, it } from 'vitest';

import type { VideoMeetingFacilitationTimer } from '@dwp-frontend/shared-utils/api/video-meeting-facilitation-api';

import {
  countdownParts,
  facilitationPollingInterval,
  facilitationTimerProgress,
  validPollDraft,
} from './meeting-live-facilitation-model';

const timer: VideoMeetingFacilitationTimer = {
  state: 'RUNNING',
  agendaItemId: 'agenda-1',
  agendaItemTitle: 'Decision',
  plannedSeconds: 600,
  elapsedSeconds: 150,
  remainingSeconds: 450,
  runningSince: '2026-09-04T05:00:00Z',
  version: 1,
};

describe('meeting live facilitation model', () => {
  it('bounds server polling and never invents realtime transport', () => {
    expect(facilitationPollingInterval(undefined)).toBe(3_000);
    expect(facilitationPollingInterval({ pollingIntervalMillis: 500 } as never)).toBe(2_000);
    expect(facilitationPollingInterval({ pollingIntervalMillis: 60_000 } as never)).toBe(10_000);
  });

  it('derives accessible countdown and bounded timer progress', () => {
    expect(countdownParts(125)).toEqual({ minutes: 2, seconds: 5 });
    expect(countdownParts(-2)).toEqual({ minutes: 0, seconds: 0 });
    expect(facilitationTimerProgress(timer)).toBe(25);
    expect(facilitationTimerProgress({ ...timer, elapsedSeconds: 900 })).toBe(100);
  });

  it('requires two distinct non-empty options before enabling a poll draft', () => {
    expect(validPollDraft('Decision?', ['Yes', 'No'])).toBe(true);
    expect(validPollDraft('Decision?', ['Yes', ' yes '])).toBe(false);
    expect(validPollDraft(' ', ['Yes', 'No'])).toBe(false);
  });
});
