// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  formatPer008AnonymityMode,
  formatPer008Instant,
  Per008RequestComposer,
} from './per008-ui';

import type { Per008RequestOptions } from './per008-model';

const options: Per008RequestOptions = {
  schemaKey: 'Per008FeedbackRequestOptionsV1',
  cycleVersionId: '22222222-2222-4222-8222-222222222222',
  subjectWorkerPublicId: '33333333-3333-4333-8333-333333333333',
  subjectAssignmentPublicId: '44444444-4444-4444-8444-444444444444',
  templates: [{
    templateVersionId: '55555555-5555-4555-8555-555555555555',
    label: 'Peer feedback',
    schemaKey: 'dwp.hris.performance.review-form.v1',
    schemaVersion: 1,
    templateContentHash: 'a'.repeat(64),
  }],
  anonymityModes: ['MASKED'],
  thresholdLimits: { minimum: 2, maximum: 10 },
  windowLimits: {
    earliestOpensAt: '2026-10-23T01:00:00Z',
    latestClosesAt: '2026-10-30T01:00:00Z',
    maximumDurationDays: 3,
  },
  correlationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

describe('PER-008 explicit time-zone UI utilities', () => {
  let mount: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    mount.remove();
  });

  it('formats instants and privacy modes with the explicit locale and display time zone', () => {
    expect(formatPer008Instant('2026-10-23T01:00:00Z', 'en', 'UTC'))
      .not.toBe(formatPer008Instant('2026-10-23T01:00:00Z', 'en', 'Asia/Seoul'));
    expect(formatPer008AnonymityMode('MASKED', 'ko')).toBe('가명 처리');
    expect(formatPer008AnonymityMode('ANONYMOUS_AGGREGATE', 'en')).toBe('Anonymous aggregate');
  });

  it('starts with a maximum-duration-bounded valid window in the explicit display time zone', async () => {
    const submit = vi.fn();
    const staticMarkup = renderToStaticMarkup(<Per008RequestComposer options={options} locale="ko"
      timeZone="Asia/Seoul" onCancel={vi.fn()} onSubmit={submit} />);
    expect(staticMarkup).toContain('value="2026-10-23T10:00"');
    expect(staticMarkup).toContain('value="2026-10-26T10:00"');
    expect(staticMarkup).toContain('표시 시간대: Asia/Seoul');
    expect(staticMarkup).toContain('가명 처리');

    await act(async () => root.render(<Per008RequestComposer options={options} locale="ko"
      timeZone="Asia/Seoul" onCancel={vi.fn()} onSubmit={submit} />));
    await act(async () => (mount.querySelector('form') as HTMLFormElement).requestSubmit());
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      opensAt: '2026-10-23T01:00:00.000Z',
      closesAt: '2026-10-26T01:00:00.000Z',
    }));
    const dateInputs = mount.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]');
    expect([...dateInputs].every((input) => Boolean(input.getAttribute('aria-describedby')))).toBe(true);
  });
});
