// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as IntelligenceApi from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';

const runtime = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-intelligence-api', async (original) => ({
  ...(await original<typeof IntelligenceApi>()),
  downloadVideoMeetingIntelligenceReport: runtime.download,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../../components/use-product-action-mutation', () => ({
  useProductActionMutation:
    () =>
    (execute: (authority: { mode: 'LEGACY_COMPATIBILITY'; rolloutState: '100' }) => unknown) =>
      execute({ mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' }),
}));

import { MeetingRecapDistribution, meetingRecapDeepLink } from './meeting-recap-distribution';

const meetingId = '81000000-0000-4000-8000-000000000301';
const reportId = '88000000-0000-4000-8000-000000000301';
const report: IntelligenceApi.VideoMeetingIntelligenceReport = {
  reportId,
  meetingId,
  runId: '87000000-0000-4000-8000-000000000301',
  state: 'PUBLISHED',
  audience: 'MEETING_PARTICIPANTS',
  schemaVersion: 'meeting-intelligence-v1',
  retentionUntil: '2026-10-01T00:00:00Z',
  legalHold: false,
  approvedAt: '2026-09-01T00:00:00Z',
  publishedAt: '2026-09-01T00:01:00Z',
  version: 4,
  canCurrentViewerReview: false,
  analysis: null,
  reviews: [],
};

let root: Root | undefined;
let mount: HTMLDivElement;

async function render() {
  mount = document.createElement('div');
  document.body.append(mount);
  root = createRoot(mount);
  await act(async () =>
    root?.render(createElement(MeetingRecapDistribution, { meetingId, report }))
  );
}

function button(label: string): HTMLButtonElement {
  const result = [...mount.querySelectorAll('button')].find((entry) =>
    entry.textContent?.includes(label)
  );
  if (!result) throw new Error(`Missing button: ${label}`);
  return result;
}

async function click(label: string) {
  await act(async () => button(label).click());
}

describe('meeting recap distribution', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    root = undefined;
    mount?.remove();
    vi.restoreAllMocks();
  });

  it('creates an identifier-only canonical link and rejects noncanonical references', () => {
    expect(meetingRecapDeepLink('https://dwp.example', meetingId, reportId)).toBe(
      `https://dwp.example/meetings/history?meeting=${meetingId}&reportId=${reportId}`
    );
    expect(() => meetingRecapDeepLink('https://dwp.example', 'private title', reportId)).toThrow(
      'canonical identifiers'
    );
    expect(() => meetingRecapDeepLink('javascript:alert(1)', meetingId, reportId)).toThrow(
      'trusted web origin'
    );
  });

  it('copies a link that grants no access and reports clipboard failure without exporting', async () => {
    await render();
    await click('history.recap.distribution.copyLink');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `${window.location.origin}/meetings/history?meeting=${meetingId}&reportId=${reportId}`
    );
    expect(mount.textContent).toContain('history.recap.distribution.status.COPIED');
    expect(runtime.download).not.toHaveBeenCalled();

    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'));
    await click('history.recap.distribution.copyLink');
    expect(mount.textContent).toContain('history.recap.distribution.status.COPY_FAILED');
  });

  it('downloads only the exact server-verified report version and uses a bounded filename', async () => {
    const blob = new Blob(['{"report":"published"}'], { type: 'application/json' });
    runtime.download.mockResolvedValue(blob);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:meeting-recap'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    const filenames: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      filenames.push(this.download);
    });
    await render();

    await click('history.recap.distribution.exportJson');
    await vi.waitFor(() => expect(runtime.download).toHaveBeenCalledOnce());
    expect(runtime.download).toHaveBeenCalledWith(
      meetingId,
      reportId,
      4,
      'JSON',
      { mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' },
      expect.stringMatching(/^[0-9a-f-]{36}$/u),
      expect.any(AbortSignal)
    );
    expect(filenames).toEqual([`dwp-meeting-recap-${reportId}-v4.json`]);
    expect(mount.textContent).toContain('history.recap.distribution.status.EXPORTED');
  });

  it('preserves the failed format for an explicit retry and never downloads an invalid blob', async () => {
    runtime.download
      .mockRejectedValueOnce(new Error('temporarily unavailable'))
      .mockResolvedValueOnce(new Blob(['recap'], { type: 'text/markdown' }));
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:meeting-recap'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await render();

    await click('history.recap.distribution.exportMarkdown');
    await vi.waitFor(() =>
      expect(mount.textContent).toContain('history.recap.distribution.status.EXPORT_FAILED')
    );
    await click('history.recap.distribution.retry');
    await vi.waitFor(() => expect(runtime.download).toHaveBeenCalledTimes(2));
    expect(runtime.download.mock.calls.map((call) => call[3])).toEqual(['MARKDOWN', 'MARKDOWN']);
    expect(mount.textContent).toContain('history.recap.distribution.status.EXPORTED');
  });

  it('fails closed when a successful HTTP response is not the requested bounded file type', async () => {
    runtime.download.mockResolvedValue(new Blob(['not-json'], { type: 'text/plain' }));
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:should-not-exist'),
    });
    await render();

    await click('history.recap.distribution.exportJson');
    await vi.waitFor(() =>
      expect(mount.textContent).toContain('history.recap.distribution.status.EXPORT_FAILED')
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('aborts an in-flight protected export when its report view is removed', async () => {
    let resolveDownload!: (blob: Blob) => void;
    runtime.download.mockImplementationOnce(
      () => new Promise<Blob>((resolve) => (resolveDownload = resolve))
    );
    await render();

    await click('history.recap.distribution.exportMarkdown');
    await vi.waitFor(() => expect(runtime.download).toHaveBeenCalledOnce());
    const signal = runtime.download.mock.calls[0]?.[6] as AbortSignal;
    expect(signal.aborted).toBe(false);

    await act(async () => root?.unmount());
    root = undefined;
    expect(signal.aborted).toBe(true);
    resolveDownload(new Blob(['late recap'], { type: 'text/markdown' }));
  });
});
