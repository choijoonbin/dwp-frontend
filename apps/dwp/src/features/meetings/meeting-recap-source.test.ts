import { beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ exact: vi.fn(), latest: vi.fn() }));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-intelligence-api', () => ({
  getVideoMeetingIntelligenceReport: api.exact,
  getLatestPublishedVideoMeetingIntelligenceReport: api.latest,
}));
import { loadMeetingRecapReport, meetingRecapReference } from './meeting-recap-source';
const meetingId = '81000000-0000-0000-0000-000000000001';
const reportId = '82000000-0000-0000-0000-000000000001';
describe('exact meeting source report binding', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  it('preserves normal history and validates exact source identity', () => {
    expect(meetingRecapReference('?page=2')).toBeNull();
    expect(meetingRecapReference('?meeting=' + meetingId)).toEqual({ meetingId });
    expect(meetingRecapReference(`?meeting=${meetingId}&reportId=${reportId}`)).toEqual({
      meetingId,
      reportId,
    });
    expect(
      meetingRecapReference(`?meeting=${meetingId}&reportId=${reportId}&intent=review`)
    ).toEqual({ meetingId, reportId, intent: 'review' });
  });
  it.each([
    `?reportId=${reportId}`,
    '?meeting=../../admin',
    `?meeting=${meetingId}&reportId=latest`,
    `?meeting=${meetingId}&reportId=${reportId}&reportId=${reportId}`,
    `?meeting=${meetingId}&meeting=${meetingId}`,
    `?meeting=${meetingId}&intent=review`,
    `?meeting=${meetingId}&reportId=${reportId}&intent=review&intent=review`,
    `?meeting=${meetingId}&reportId=${reportId}&intent=publish`,
  ])('rejects malformed or ambiguous source %s', (value) =>
    expect(meetingRecapReference(value)).toBe('invalid')
  );
  it('reads only the exact source and never substitutes latest', async () => {
    const report = { meetingId, reportId };
    api.exact.mockResolvedValue(report);
    expect(await loadMeetingRecapReport(meetingId, reportId)).toBe(report);
    expect(api.exact).toHaveBeenCalledWith(meetingId, reportId);
    expect(api.latest).not.toHaveBeenCalled();
  });
  it.each([403, 404, 410, 503])(
    'does not fall back to latest for source failure %s',
    async (status) => {
      api.exact.mockRejectedValue({ status });
      await expect(loadMeetingRecapReport(meetingId, reportId)).rejects.toEqual({ status });
      expect(api.latest).not.toHaveBeenCalled();
    }
  );
  it.each([
    { meetingId: reportId, reportId },
    { meetingId, reportId: meetingId },
  ])('rejects a response for another source', async (report) => {
    api.exact.mockResolvedValue(report);
    await expect(loadMeetingRecapReport(meetingId, reportId)).rejects.toThrow('binding');
  });
  it('keeps latest-published as an explicit choice only without a source report', async () => {
    api.latest.mockResolvedValue(null);
    expect(await loadMeetingRecapReport(meetingId)).toBeNull();
    expect(api.exact).not.toHaveBeenCalled();
  });
});
