// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkHubScheduleDialog } from './work-hub-schedule-dialog';
import { hubItem } from './work-hub.test-support';

import type * as CalendarApi from '@dwp-frontend/shared-utils/api/calendar-api';
import type * as DesignSystem from '@dwp-frontend/design-system';
import type { CalendarSummary } from '@dwp-frontend/shared-utils/api/calendar-api';
import type { WorkScheduleDraftInput } from './work-hub-scheduling';

const { getCalendars } = vi.hoisted(() => ({ getCalendars: vi.fn() }));
vi.mock('@dwp-frontend/shared-utils/api/calendar-api', async (importOriginal) => ({
  ...(await importOriginal<typeof CalendarApi>()),
  getCalendars: (...args: unknown[]) => getCalendars(...args),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      key === 'work:workHub.schedule.defaultTitle'
        ? `집중: ${String(options?.title ?? '')}`
        : ({
            'work:workHub.schedule.serviceCode': 'WRK-C01',
            'work:workHub.schedule.serviceName': 'DWP Calendar Handoff Service',
          }[key] ?? key),
  }),
}));
vi.mock('@dwp-frontend/design-system', async (importOriginal) => ({
  ...(await importOriginal<typeof DesignSystem>()),
  DateTimePickerField: ({
    label,
    value,
    onValueChange,
    disabled,
  }: DesignSystem.DateTimePickerFieldProps) => (
    <input
      aria-label={label}
      value={value ?? ''}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    />
  ),
}));

const calendar = {
  calendarId: 'calendar-one',
  name: 'My calendar',
  type: 'PERSONAL',
  capabilities: { canCreateEvents: true },
} as CalendarSummary;
const ownerFingerprint = 'tenant-1:user-900018';

async function settle() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
}

function exactButton(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
}

describe('WorkHubScheduleDialog Calendar handoff', () => {
  let host: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    getCalendars.mockReset().mockResolvedValue([calendar]);
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

  async function renderDialog({
    onClose = vi.fn(),
    onOpenCalendar = vi.fn(),
    reviewHandoff = vi.fn().mockResolvedValue(true),
  } = {}) {
    const item = hubItem({ displayId: 'NAT-001', title: 'Prepare customer notice' });
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <WorkHubScheduleDialog
            open
            item={item}
            ownerFingerprint={ownerFingerprint}
            canSchedule
            onClose={onClose}
            onOpenCalendar={onOpenCalendar}
            reviewHandoff={reviewHandoff}
            prepare={vi.fn()}
            execute={vi.fn()}
          />
        </QueryClientProvider>
      )
    );
    await settle();
    return { item, onClose, onOpenCalendar, reviewHandoff };
  }

  it('renders the WRK-C01 structure and preserves keyboard dismissal', async () => {
    const { onClose, onOpenCalendar } = await renderDialog();
    const dialog = document.querySelector<HTMLElement>('[data-testid="work-schedule-dialog"]')!;
    expect(dialog.textContent).toContain('WRK-C01');
    expect(dialog.textContent).toContain('DWP Calendar Handoff Service');
    expect(dialog.textContent).toContain('NAT-001');
    expect(dialog.textContent).toContain('Prepare customer notice');
    expect(dialog.textContent).toContain('work:workHub.schedule.independenceTitle');
    expect(dialog.textContent).toContain('work:workHub.schedule.availabilityNotice');
    expect(dialog.textContent).toContain('work:workHub.schedule.privacyTitle');
    expect(dialog.textContent).toContain('work:workHub.schedule.readiness.ready.title');

    await act(async () => exactButton('work:workHub.schedule.openCalendar')!.click());
    await settle();
    const handoff = onOpenCalendar.mock.calls[0]?.[0] as WorkScheduleDraftInput;
    expect(handoff).toEqual(
      expect.objectContaining({
        title: '집중: Prepare customer notice',
        timeZone: expect.any(String),
      })
    );
    expect(Date.parse(handoff.endsAt) - Date.parse(handoff.startsAt)).toBe(30 * 60_000);

    const close = document.querySelector<HTMLButtonElement>(
      'button[aria-label="common:actions.close"]'
    )!;
    close.focus();
    await act(async () =>
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each([
    ['no editable personal calendar', () => Promise.resolve([])],
    ['calendar list outage', () => Promise.reject(new Error('calendar unavailable'))],
  ])('keeps the reviewed handoff available during %s', async (_label, result) => {
    getCalendars.mockImplementationOnce(result);
    const { onOpenCalendar } = await renderDialog();
    expect(exactButton('work:workHub.schedule.create')?.disabled).toBe(true);
    expect(exactButton('work:workHub.schedule.openCalendar')?.disabled).toBe(false);
    await act(async () => exactButton('work:workHub.schedule.openCalendar')!.click());
    await settle();
    expect(onOpenCalendar).toHaveBeenCalledOnce();
  });

  it('blocks handoff when the fresh exact Work receipt is no longer ready', async () => {
    const reviewHandoff = vi.fn().mockResolvedValue(false);
    const { item, onOpenCalendar } = await renderDialog({ reviewHandoff });
    await act(async () => exactButton('work:workHub.schedule.openCalendar')!.click());
    await settle();
    expect(reviewHandoff).toHaveBeenCalledWith(
      item,
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        canContinue: expect.any(Function),
      })
    );
    expect(onOpenCalendar).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('work:workHub.schedule.results.workChanged');
  });
});
