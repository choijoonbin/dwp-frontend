import { describe, expect, it } from 'vitest';
import type { VideoMeetingIntelligenceReport } from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';

import {
  createMeetingIntelligenceAuthorizationFence,
  selectMeetingIntelligenceAuthorizedWriteback,
} from './meeting-intelligence-authorization-fence';

describe('meeting intelligence authorization fence', () => {
  it.each(['review', 'publish'])(
    'blocks a late %s success after an authoritative denial removes the private cache',
    (command) => {
      const fence = createMeetingIntelligenceAuthorizationFence('meeting-1');
      const started = fence.capture();
      let cachedReport: string | null = 'private-draft';

      fence.revoke();
      cachedReport = null;
      const committed = fence.commit(started, () => {
        cachedReport = `${command}-success`;
      });

      expect(committed).toBe(false);
      expect(cachedReport).toBeNull();
      expect(fence.isDenied()).toBe(true);
    }
  );

  it('allows only the newest explicit validation to restore access', () => {
    const fence = createMeetingIntelligenceAuthorizationFence('meeting-1');
    const staleValidation = fence.beginValidation();
    const deniedValidation = fence.beginValidation();

    expect(fence.deny(deniedValidation)).toBe(1);
    expect(fence.authorize(staleValidation)).toBe(false);
    expect(fence.isDenied()).toBe(true);

    const retryValidation = fence.beginValidation();
    expect(fence.authorize(retryValidation)).toBe(true);
    expect(fence.isDenied()).toBe(false);
  });

  it('rejects an old meeting generation after the mounted scope changes', () => {
    const previous = createMeetingIntelligenceAuthorizationFence('meeting-1');
    const started = previous.capture();
    const current = createMeetingIntelligenceAuthorizationFence('meeting-2');

    expect(current.canCommit(started)).toBe(false);
  });

  it('does not let a mismatched or older command response replace the current report', () => {
    const report = (reportId: string, version: number) =>
      ({ reportId, version }) as VideoMeetingIntelligenceReport;
    const cached = report('report-new', 4);

    expect(
      selectMeetingIntelligenceAuthorizedWriteback(
        cached,
        report('report-old', 5),
        report('report-old', 4)
      )
    ).toBe(cached);
    expect(
      selectMeetingIntelligenceAuthorizedWriteback(null, report('report-new', 2), cached)
    ).toBeNull();
  });

  it.each(['review', 'publish'])(
    'keeps a newer same-report cache when a late %s response carries an older version',
    () => {
      const report = (version: number) =>
        ({ reportId: 'report-1', version }) as VideoMeetingIntelligenceReport;
      const cached = report(5);

      expect(selectMeetingIntelligenceAuthorizedWriteback(cached, report(4), report(3))).toBe(
        cached
      );
    }
  );

  it.each(['review', 'publish'])(
    'keeps an authoritative latest null when a late %s response tries to restore a report',
    () => {
      const report = (version: number) =>
        ({ reportId: 'report-1', version }) as VideoMeetingIntelligenceReport;

      expect(selectMeetingIntelligenceAuthorizedWriteback(null, report(4), report(3))).toBeNull();
    }
  );
});
