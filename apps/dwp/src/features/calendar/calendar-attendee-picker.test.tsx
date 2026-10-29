// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CalendarAttendeePicker } from './calendar-attendee-picker';

import type { Root } from 'react-dom/client';
import type { CalendarEditorAttendee } from './calendar-event-editor-model';
import type { PeopleCursorPage, PersonSummary } from '@dwp-frontend/shared-utils';
import type * as SharedUtils from '@dwp-frontend/shared-utils';

const mocks = vi.hoisted(() => ({ listPeople: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtils>()),
  listPeople: mocks.listPeople,
  useAuth: () => ({ user: { tenantId: 7, userId: 9 } }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const SELECTED: CalendarEditorAttendee = {
  personId: '00ba0853-02a8-7499-b6d8-009251e6a464',
  displayName: 'Selected Person',
  workEmail: 'selected@example.com',
  type: 'REQUIRED',
};

function person(personId: string, displayName: string): PersonSummary {
  return {
    personId,
    displayName,
    workEmail: `${displayName.toLowerCase()}@example.com`,
    lifecycleState: 'ACTIVE',
    directReportCount: 0,
    dataAccess: {
      classification: 'DIRECTORY',
      workerNumberMasked: true,
      excludedFieldGroups: [],
    },
  };
}

function page(items: PersonSummary[], nextCursor: string | null = null): PeopleCursorPage {
  return {
    items,
    nextCursor,
    hasMore: Boolean(nextCursor),
    size: items.length,
    asOf: '2026-10-28',
  };
}

function button(container: HTMLElement, label: string) {
  return [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
}

async function flush() {
  for (let index = 0; index < 5; index += 1) {
    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1);
    });
  }
}

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.listPeople.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  vi.useRealTimers();
});

async function render() {
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(CalendarAttendeePicker, {
          scope: 'test',
          type: 'REQUIRED',
          value: [SELECTED],
          externalPolicyState: 'DENIED',
          label: 'Attendees',
          placeholder: 'Search people',
          onChange: vi.fn(),
        })
      )
    );
  });
  await flush();
}

function typeSearch(value: string) {
  const input = container.querySelector('input');
  if (!input) throw new Error('Attendee input was not rendered.');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('CalendarAttendeePicker directory paging', () => {
  it('debounces search, aborts the superseded request, and retains selected chips', async () => {
    let firstSignal: AbortSignal | undefined;
    mocks.listPeople.mockImplementation(
      ({ query, signal }: { query?: string; signal?: AbortSignal }) => {
        if (!query) {
          firstSignal = signal;
          return new Promise<PeopleCursorPage>(() => {});
        }
        return Promise.resolve(
          page([person('11ba0853-02a8-7499-b6d8-009251e6a465', 'Search Result')])
        );
      }
    );

    await render();
    expect(mocks.listPeople).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Selected Person');

    await act(async () => typeSearch('Search'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(274);
    });
    expect(mocks.listPeople).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    await flush();

    expect(mocks.listPeople).toHaveBeenCalledTimes(2);
    expect(mocks.listPeople.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ query: 'Search', cursor: undefined, size: 50 })
    );
    expect(firstSignal?.aborted).toBe(true);
    expect(container.textContent).toContain('Selected Person');
  });

  it('loads the next cursor page without replacing the selected attendee', async () => {
    mocks.listPeople
      .mockResolvedValueOnce(
        page([person('11ba0853-02a8-7499-b6d8-009251e6a465', 'Page One')], 'cursor-2')
      )
      .mockResolvedValueOnce(page([person('22ba0853-02a8-7499-b6d8-009251e6a466', 'Page Two')]));

    await render();
    const loadMore = button(container, 'event.attendeePicker.loadMore');
    expect(loadMore).toBeDefined();

    await act(async () => loadMore?.click());
    await flush();

    expect(mocks.listPeople).toHaveBeenCalledTimes(2);
    expect(mocks.listPeople.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ cursor: 'cursor-2', size: 50 })
    );
    expect(container.textContent).toContain('Selected Person');
  });
});
