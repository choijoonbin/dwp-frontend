// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CalendarSchedulingPollCreator } from './calendar-scheduling-poll-creator';

import type { Root } from 'react-dom/client';
import type { CalendarSchedulingPollDraft } from './calendar-scheduling-poll-model';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      `${key}${values ? JSON.stringify(values) : ''}`,
    i18n: { resolvedLanguage: 'en', language: 'en' },
  }),
}));

vi.mock('./calendar-attendee-picker', () => ({
  CalendarAttendeePicker: ({
    type,
    value,
    externalPolicyState,
    label,
    onChange,
  }: {
    type: 'REQUIRED' | 'OPTIONAL';
    value: Array<{ personId: string; displayName: string; workEmail: string | null; type: string }>;
    externalPolicyState: string;
    label: string;
    onChange: (value: unknown[]) => void;
  }) => (
    <div data-testid={`picker-${type.toLowerCase()}`}>
      <span>{`${label}:${externalPolicyState}`}</span>
      <button
        type="button"
        onClick={() =>
          onChange([
            ...value,
            {
              personId: '00ba0853-02a8-7499-b6d8-009251e6a465',
              displayName: 'Second person',
              workEmail: 'second@example.com',
              type,
            },
          ])
        }
      >
        {`add-${type}`}
      </button>
    </div>
  ),
}));

const NOW = Date.parse('2026-10-28T00:00:00Z');
const ORGANIZER = '00ba0853-02a8-7499-b6d8-009251e6a464';
const CANDIDATE = '019a3d6e-4be8-779c-8a6d-893fe39b74cb';

const draft: CalendarSchedulingPollDraft = {
  title: 'Release planning',
  description: 'Choose a time',
  timeZone: 'Asia/Seoul',
  candidates: [
    {
      candidateId: CANDIDATE,
      startsAt: '2026-11-03T01:00:00Z',
      endsAt: '2026-11-03T01:30:00Z',
      resourceId: null,
    },
  ],
  participants: [
    {
      personPublicId: ORGANIZER,
      externalEmail: null,
      displayName: 'Organizer',
      required: true,
    },
  ],
  expiresAt: '2026-11-02T01:00:00Z',
};

function button(container: HTMLElement, label: string) {
  return [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function renderCreator(initialDraft: CalendarSchedulingPollDraft, onSubmit = vi.fn()) {
  await act(async () => {
    root.render(
      <CalendarSchedulingPollCreator
        organizer={{ personPublicId: ORGANIZER, displayName: 'Organizer' }}
        initialDraft={initialDraft}
        now={NOW}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );
  });
  return onSubmit;
}

describe('CalendarSchedulingPollCreator', () => {
  it('provides the full bounded creator and keeps participant entry internal-only', async () => {
    const onSubmit = await renderCreator(draft);
    expect(container.textContent).toContain('polls.creator.titleLabel');
    expect(container.textContent).toContain('polls.creator.descriptionLabel');
    expect(container.textContent).toContain('polls.creator.timeZoneLabel');
    expect(container.textContent).toContain('polls.creator.expiresAtLabel');
    expect(container.textContent).toContain('polls.creator.candidateStart');
    expect(container.textContent).toContain('polls.creator.candidateEnd');
    expect(container.textContent).toContain('polls.creator.resourceId');
    expect(container.textContent).toContain('polls.creator.externalUnsupported');
    expect(container.textContent).toContain('polls.creator.requiredParticipants:DENIED');
    expect(container.textContent).toContain('polls.creator.optionalParticipants:DENIED');

    await act(async () => button(container, 'add-OPTIONAL')?.click());
    await act(async () => button(container, 'polls.creator.addCandidate')?.click());
    await act(async () => button(container, 'polls.creator.submit')?.click());

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      candidates: [expect.anything(), expect.anything()],
      participants: [
        expect.objectContaining({ personPublicId: ORGANIZER, required: true }),
        expect.objectContaining({
          personPublicId: '00ba0853-02a8-7499-b6d8-009251e6a465',
          externalEmail: null,
          required: false,
        }),
      ],
    });
  });

  it('maps model validation issues into an accessible error summary before transport', async () => {
    const onSubmit = await renderCreator({
      ...draft,
      title: '',
      participants: [],
      expiresAt: '2026-11-04T01:00:00Z',
    });

    await act(async () => button(container, 'polls.creator.submit')?.click());

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('polls.creator.validationTitle');
    expect(alert?.textContent).toContain('polls.validation.TITLE_REQUIRED');
    expect(alert?.textContent).toContain('polls.validation.PARTICIPANT_COUNT');
    expect(alert?.textContent).toContain('polls.validation.REQUIRED_PARTICIPANT_MISSING');
    expect(alert?.textContent).toContain('polls.validation.EXPIRES_AT_RANGE');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
