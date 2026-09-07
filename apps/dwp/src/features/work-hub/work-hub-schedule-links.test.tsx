// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkHubScheduleLinks } from './work-hub-schedule-links';
import { hubItem } from './work-hub.test-support';

import type { CalendarEvent } from '@dwp-frontend/shared-utils/api/calendar-api';
import type { WorkCalendarLink } from '@dwp-frontend/shared-utils/api/work-hub-calendar-api';
import type { ComponentProps } from 'react';
import type { Root } from 'react-dom/client';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const item = hubItem();
const link = {
  linkId: 'secret-link-id',
  work: item.reference,
  eventId: 'secret-event-id',
  state: 'LINKED',
  version: 3,
} as WorkCalendarLink;
const event = {
  eventId: link.eventId,
  title: 'Focus on brief',
  startsAt: '2026-09-04T09:00:00Z',
  endsAt: '2026-09-04T10:00:00Z',
  status: 'CONFIRMED',
} as CalendarEvent;

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;

async function settle() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
}

async function render(props: Partial<ComponentProps<typeof WorkHubScheduleLinks>> = {}) {
  const defaults: ComponentProps<typeof WorkHubScheduleLinks> = {
    item,
    from: '2026-01-01T00:00:00Z',
    to: '2027-01-01T00:00:00Z',
    canUnlink: true,
    loadSchedules: vi.fn().mockResolvedValue({
      state: 'LOADED',
      items: [{ link, event, state: 'AVAILABLE' }],
    }),
    unlinkSchedule: vi.fn().mockResolvedValue({
      link: { ...link, state: 'REMOVED', version: 4 },
      calendarChanged: false,
      sourceChanged: false,
    }),
    onOpenCalendar: vi.fn(),
  };
  const merged = { ...defaults, ...props };
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <WorkHubScheduleLinks {...merged} />
      </QueryClientProvider>
    )
  );
  await settle();
  return merged;
}

function exactButton(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
}

describe('WorkHubScheduleLinks', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
    document.body.replaceChildren();
  });

  it('shows a generic state for inaccessible Calendar data without exposing opaque ids', async () => {
    await render({
      loadSchedules: vi.fn().mockResolvedValue({
        state: 'PARTIAL',
        items: [{ link, event: null, state: 'UNAVAILABLE' }],
      }),
    });

    expect(document.body.textContent).toContain('workHub.scheduleLinks.partial');
    expect(document.body.textContent).toContain('workHub.scheduleLinks.detailsUnavailable');
    expect(document.body.textContent).not.toContain(link.linkId);
    expect(document.body.textContent).not.toContain(link.eventId);
  });

  it('removes only the personal link after confirmation and keeps the confirmed result visible', async () => {
    const unlinkSchedule = vi.fn().mockResolvedValue({
      link: { ...link, state: 'REMOVED', version: 4 },
      calendarChanged: false,
      sourceChanged: false,
    });
    await render({ unlinkSchedule });
    await act(async () => exactButton('workHub.scheduleLinks.unlink')!.click());
    await act(async () => exactButton('workHub.scheduleLinks.confirm')!.click());
    await settle();

    expect(unlinkSchedule).toHaveBeenCalledWith(link);
    expect(document.body.textContent).toContain('workHub.scheduleLinks.unlinked');
    expect(document.body.textContent).not.toContain(event.title);
  });
});
