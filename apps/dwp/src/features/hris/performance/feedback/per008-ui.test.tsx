// @vitest-environment jsdom
import { act, useId } from 'react';
import { fireEvent, getByLabelText } from '@testing-library/dom';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as DesignSystem from '@dwp-frontend/design-system';

import { formatPer008AnonymityMode, formatPer008Instant, Per008RequestComposer } from './per008-ui';

import type { Per008RequestOptions } from './per008-model';

import type { LocalDateTimePickerFieldProps } from '@dwp-frontend/design-system';

// Domain tests exercise civil values and callbacks; the DS suite covers the real picker UI.
vi.mock('@dwp-frontend/design-system', async (importOriginal) => {
  const actual = await importOriginal<typeof DesignSystem>();
  return {
    ...actual,
    LocalDateTimePickerField: function CivilDateTimeField({
      label,
      value,
      onValueChange,
      disabled,
      required,
      supportingText,
      errorMessage,
      minDateTime,
      maxDateTime,
    }: LocalDateTimePickerFieldProps) {
      const id = useId();
      return (
        <div data-testid="civil-date-time-picker">
          <label htmlFor={id}>{label}</label>
          <input
            id={id}
            value={value ?? ''}
            disabled={disabled}
            required={required}
            aria-describedby={`${id}-feedback`}
            aria-invalid={Boolean(errorMessage)}
            data-min={minDateTime?.format('YYYY-MM-DDTHH:mm')}
            data-max={maxDateTime?.format('YYYY-MM-DDTHH:mm')}
            onChange={(event) => onValueChange(event.target.value || null)}
          />
          <span id={`${id}-feedback`}>{errorMessage ?? supportingText}</span>
        </div>
      );
    },
  };
});

const options: Per008RequestOptions = {
  schemaKey: 'Per008FeedbackRequestOptionsV1',
  cycleVersionId: '22222222-2222-4222-8222-222222222222',
  subjectWorkerPublicId: '33333333-3333-4333-8333-333333333333',
  subjectAssignmentPublicId: '44444444-4444-4444-8444-444444444444',
  templates: [
    {
      templateVersionId: '55555555-5555-4555-8555-555555555555',
      label: 'Peer feedback',
      schemaKey: 'dwp.hris.performance.review-form.v1',
      schemaVersion: 1,
      templateContentHash: 'a'.repeat(64),
    },
  ],
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
    expect(formatPer008Instant('2026-10-23T01:00:00Z', 'en', 'UTC')).not.toBe(
      formatPer008Instant('2026-10-23T01:00:00Z', 'en', 'Asia/Seoul')
    );
    expect(formatPer008AnonymityMode('MASKED', 'ko')).toBe('가명 처리');
    expect(formatPer008AnonymityMode('ANONYMOUS_AGGREGATE', 'en')).toBe('Anonymous aggregate');
  });

  it('starts with a maximum-duration-bounded valid window in the explicit display time zone', async () => {
    const submit = vi.fn();
    const staticMarkup = renderToStaticMarkup(
      <Per008RequestComposer
        options={options}
        locale="ko"
        timeZone="Asia/Seoul"
        onCancel={vi.fn()}
        onSubmit={submit}
      />
    );
    const staticRoot = document.createElement('div');
    staticRoot.innerHTML = staticMarkup;
    const initialOpensAt = getByLabelText<HTMLInputElement>(staticRoot, '응답 시작');
    const initialClosesAt = getByLabelText<HTMLInputElement>(staticRoot, '응답 마감');
    expect(initialOpensAt.value).toBe('2026-10-23T10:00');
    expect(initialClosesAt.value).toBe('2026-10-26T10:00');
    expect(initialOpensAt.dataset.min).toBe('2026-10-23T10:00');
    expect(initialClosesAt.dataset.max).toBe('2026-10-30T10:00');
    expect(staticMarkup).toContain('표시 시간대: Asia/Seoul');
    expect(staticMarkup).toContain('가명 처리');

    await act(async () =>
      root.render(
        <Per008RequestComposer
          options={options}
          locale="ko"
          timeZone="Asia/Seoul"
          onCancel={vi.fn()}
          onSubmit={submit}
        />
      )
    );
    await act(async () => (mount.querySelector('form') as HTMLFormElement).requestSubmit());
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        opensAt: '2026-10-23T01:00:00.000Z',
        closesAt: '2026-10-26T01:00:00.000Z',
      })
    );
    const dateInputs = mount.querySelectorAll<HTMLInputElement>(
      '[data-testid="civil-date-time-picker"] input'
    );
    expect(dateInputs).toHaveLength(2);
    for (const input of dateInputs) {
      const descriptionId = input.getAttribute('aria-describedby');
      expect(descriptionId).toBeTruthy();
      expect(document.getElementById(descriptionId!)?.textContent).toBe('표시 시간대: Asia/Seoul');
    }
    await act(async () => {
      fireEvent.change(getByLabelText(mount, '응답 시작'), {
        target: { value: '2026-10-23T11:30' },
      });
      fireEvent.change(getByLabelText(mount, '응답 마감'), {
        target: { value: '2026-10-25T10:45' },
      });
    });
    await act(async () => (mount.querySelector('form') as HTMLFormElement).requestSubmit());
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        opensAt: '2026-10-23T02:30:00.000Z',
        closesAt: '2026-10-25T01:45:00.000Z',
      })
    );
  });
});
