import { describe, expect, it, vi } from 'vitest';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';

import {
  createMeetingHomeManualOutcomesLoader,
  projectMeetingHomeManualOutcome,
} from './meeting-home-manual-outcomes-model';

const ended = {
  meetingId: 'meeting-1',
  title: 'Design review',
  lifecycleState: 'ENDED',
  endedAt: '2026-09-08T01:00:00Z',
  decisions: [{ decision: 'Use the denser home layout', ownerUserId: 7 }],
  followUpActions: [
    { action: 'Private task for another person', ownerUserId: 8 },
    { action: 'Verify the responsive layout', ownerUserId: 7, dueInDays: 2, status: 'OPEN' },
  ],
} as VideoMeetingSummary;

describe('meeting home manual outcome projection', () => {
  it('shows a meeting decision and only the current actor owned follow-up', () => {
    expect(projectMeetingHomeManualOutcome(ended, 7)).toEqual({
      meetingId: 'meeting-1',
      meetingTitle: 'Design review',
      endedAt: '2026-09-08T01:00:00Z',
      decision: 'Use the denser home layout',
      followUp: {
        action: 'Verify the responsive layout',
        dueInDays: 2,
        status: 'OPEN',
      },
    });
    expect(JSON.stringify(projectMeetingHomeManualOutcome(ended, 7))).not.toContain(
      'another person'
    );
  });

  it('rejects non-ended meetings and normalizes unusable content', () => {
    expect(projectMeetingHomeManualOutcome({ ...ended, lifecycleState: 'LIVE' }, 7)).toBeNull();
    expect(
      projectMeetingHomeManualOutcome(
        {
          ...ended,
          decisions: [{ decision: '   ' }],
          followUpActions: [{ action: 'Mine', ownerUserId: 7, dueInDays: -2 }],
        },
        7
      )
    ).toMatchObject({ decision: null, followUp: { action: 'Mine', dueInDays: null } });
  });

  it('keeps safety labels in the UI contract while removing duplicated seed prefixes from titles', () => {
    expect(
      projectMeetingHomeManualOutcome(
        {
          ...ended,
          decisions: [
            { decision: '[화면점검 · 수동 기록 · AI 결과 아님] 승인 기준을 재확인합니다.' },
          ],
          followUpActions: [
            {
              action: '[화면점검 · 수동 후속 초안 · 실제 업무 아님] 넓은 화면을 검토합니다.',
              ownerUserId: 7,
            },
          ],
        },
        7
      )
    ).toMatchObject({
      decision: '승인 기준을 재확인합니다.',
      followUp: { action: '넓은 화면을 검토합니다.' },
    });
  });

  it('bounds detail reads, preserves input order and reports unavailable meetings', async () => {
    const recent = Array.from({ length: 6 }, (_, index) => ({
      ...ended,
      meetingId: `meeting-${index + 1}`,
      title: `Meeting ${index + 1}`,
    }));
    const read = vi.fn(async (meetingId: string) => {
      if (meetingId === 'meeting-2') throw new Error('403');
      return recent.find((meeting) => meeting.meetingId === meetingId)!;
    });
    const result = await createMeetingHomeManualOutcomesLoader('tenant-1', read).load(recent, 7);
    expect(read).toHaveBeenCalledTimes(4);
    expect(result.entries.map((entry) => entry.meetingId)).toEqual([
      'meeting-1',
      'meeting-3',
      'meeting-4',
    ]);
    expect(result.unavailableMeetingIds).toEqual(['meeting-2']);
  });

  it.each(['abort', 'revoke'] as const)('rejects late detail success after %s', async (action) => {
    let finish!: (meeting: VideoMeetingSummary) => void;
    const read = vi.fn(
      () =>
        new Promise<VideoMeetingSummary>((resolve) => {
          finish = resolve;
        })
    );
    const controller = new AbortController();
    const loader = createMeetingHomeManualOutcomesLoader('tenant-1', read);
    const pending = loader.load([ended], 7, controller.signal);
    const rejected = expect(pending).rejects.toThrow();
    if (action === 'abort') controller.abort();
    else loader.revoke();
    finish(ended);
    await rejected;
  });
});
