import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { CalendarWorkspaceRail } from './calendar-workspace-rail';
import { CalendarHomeShortcuts } from './calendar-home-shortcuts';

import type { ComponentProps } from 'react';
import type { CalendarHome } from '@dwp-frontend/shared-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      `${key}${values ? JSON.stringify(values) : ''}`,
  }),
}));
vi.mock('./calendar-home-team-panel', () => ({ CalendarHomeTeamPanel: () => null }));

const data: CalendarHome = {
  date: '2026-09-04',
  timeZone: 'Asia/Seoul',
  generatedAt: '2026-09-04T00:40:00Z',
  today: [],
  metrics: {
    eventCount: 1,
    meetingMinutes: 60,
    focusMinutes: 90,
    focusTargetMinutes: 600,
    conflictCount: 0,
    awaitingResponseCount: 0,
    availableRoomCount: 2,
  },
  weekLoad: [],
  attention: [
    {
      key: 'focus',
      severity: 'MEDIUM',
      title: 'Focus shortage',
      description: 'Protect a free window before the next meeting.',
      eventId: 'event-1',
      actionPath: '/calendar/focus',
    },
  ],
};

function renderRail(props: Partial<ComponentProps<typeof CalendarWorkspaceRail>> = {}) {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(CalendarWorkspaceRail, {
        data,
        state: 'READY',
        isFetching: false,
        language: 'en',
        currentSearch: '?tz=Asia%2FSeoul',
        onRetry: vi.fn(),
        ...props,
      })
    )
  );
}

describe('CalendarWorkspaceRail card contract', () => {
  it('retains the public rail, priority label, event target and focus plan', () => {
    const html = renderRail();
    expect(html).toContain('data-testid="calendar-workspace-rail"');
    expect(html).toContain('workspace.railTitle');
    expect(html).toContain('workspace.severity.MEDIUM');
    expect(html).toContain('event=event-1');
    expect(html).toContain('workspace.openFocusPlan');
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-valuenow="15"');
    expect(html).toContain('stroke-dasharray="15 100"');
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'never invents a percentage for invalid target %s',
    (target) => {
      const html = renderRail({
        data: { ...data, metrics: { ...data.metrics, focusTargetMinutes: target } },
      });
      expect(html).not.toContain('role="meter"');
      expect(html).toContain('workspace.focusTargetUnavailable');
    }
  );

  it('clamps the ring but reports a genuine over-target value', () => {
    const html = renderRail({ data: { ...data, metrics: { ...data.metrics, focusMinutes: 900 } } });
    expect(html).toContain('aria-valuenow="100"');
    expect(html).toContain('&quot;value&quot;:150');
    expect(html).toContain('stroke-dasharray="100 100"');
  });

  it('does not show a meter for missing focus minutes', () => {
    const html = renderRail({
      data: { ...data, metrics: { ...data.metrics, focusMinutes: Number.NaN } },
    });
    expect(html).not.toContain('role="meter"');
    expect(html).not.toContain('NaN');
  });

  it('keeps creation opt-in and gates it on READY', () => {
    expect(renderRail({ onCreateFocus: vi.fn() })).not.toContain('actions.addFocus');
    expect(renderRail({ canCreate: true, onCreateFocus: vi.fn() })).toContain('actions.addFocus');
    const stale = renderRail({
      state: 'STALE',
      canCreate: true,
      onCreateFocus: vi.fn(),
      onOpenCommands: vi.fn(),
    });
    expect(stale).not.toContain('actions.addFocus');
    expect(stale).not.toContain('calendar-home-shortcuts');
    expect(stale).toContain('Focus shortage');
    expect(stale).toContain('readState.stale');
  });

  it.each(['DENIED', 'UNAVAILABLE', 'LOADING'] as const)(
    'discards all supplied data in %s',
    (state) => {
      const html = renderRail({ state });
      expect(html).not.toContain('Focus shortage');
      expect(html).not.toContain('role="meter"');
      expect(html).not.toContain('calendar-home-shortcuts');
    }
  );

  it('retains permission-gated room navigation and drawer close name', () => {
    expect(renderRail()).not.toContain('workspace.openRooms');
    const html = renderRail({ roomsPath: '/workplace/rooms', onClose: vi.fn() });
    expect(html).toContain('workspace.openRooms');
    expect(html).toContain('workspace.closeRail');
    expect(html).toContain('safe-area-inset-bottom');
  });

  it('uses real command shortcut metadata and hides the trigger when no callback exists', () => {
    const render = (onOpenCommands?: () => void) =>
      renderToStaticMarkup(
        createElement(
          MemoryRouter,
          null,
          createElement(CalendarHomeShortcuts, { currentSearch: '?tz=UTC', onOpenCommands })
        )
      );
    expect(render()).not.toContain('aria-keyshortcuts');
    const html = render(vi.fn());
    expect(html).toContain('aria-keyshortcuts="Meta+/ Control+/"');
    expect(html).toContain('workspace.shortcuts.commandKeys');
    expect(html).toContain('/calendar/availability');
    expect(html).toContain('/calendar/schedule');
    expect(html).not.toContain('Control+k');
  });
});
