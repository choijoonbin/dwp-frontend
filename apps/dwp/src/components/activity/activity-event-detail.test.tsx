// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivityEventDetail } from './activity-event-detail';

import type { Root } from 'react-dom/client';
import type { UseQueryResult } from '@tanstack/react-query';
import type { WorkspaceActivityEvent } from '@dwp-frontend/shared-utils';
import type * as ReactRouterModule from 'react-router-dom';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouterModule>()),
  useNavigate: () => navigate,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

const event: WorkspaceActivityEvent = {
  id: 'activity-1',
  occurredAt: '2026-09-04T01:00:00Z',
  sourceObservedAt: '2026-09-04T01:01:00Z',
  actor: 'agent',
  actorName: 'DWAI·ON',
  state: 'unknown',
  title: 'Document review execution',
  summary: 'The latest worker state could not be confirmed.',
  objectType: 'AGENT_RUN',
  objectId: 'run-1',
  objectLabel: 'AI execution',
  source: 'DWAI_ON',
  eventKind: 'EXECUTION_SNAPSHOT',
  executionId: 'run-1',
  attempt: 1,
  executionVersion: 2,
  auditId: null,
  auditStatus: 'NOT_LINKED',
  auditRecordId: null,
};

function queryFor(
  value: WorkspaceActivityEvent,
  refetch = vi.fn(async () => ({ data: value, isError: false }))
) {
  return {
    data: value,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch,
  } as unknown as UseQueryResult<WorkspaceActivityEvent, Error>;
}

function DetailHarness({ variant }: { variant: 'inline' | 'drawer' }) {
  const [selected, setSelected] = useState('');
  return (
    <>
      <button type="button" onClick={() => setSelected(event.id)}>
        Open selected signal
      </button>
      <ActivityEventDetail
        eventId={selected}
        query={queryFor(event)}
        variant={variant}
        showSourceAction={false}
        onClose={() => setSelected('')}
      />
    </>
  );
}

let container: HTMLDivElement;
let root: Root;

async function renderHarness(variant: 'inline' | 'drawer') {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <DetailHarness variant={variant} />
      </MemoryRouter>
    );
  });
  const opener = container.querySelector<HTMLButtonElement>('button');
  expect(opener).not.toBeNull();
  opener!.focus();
  await act(async () => {
    opener!.click();
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
  return opener!;
}

describe('ActivityEventDetail inspector contract', () => {
  beforeEach(() => {
    navigate.mockClear();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('closes a desktop inline inspector and restores its opener', async () => {
    const opener = await renderHarness('inline');
    const detail = document.querySelector<HTMLElement>('[aria-label="activityPage.detailTitle"]');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('Document review execution');
    expect(detail!.textContent).toContain('activityFoundation.detail.kind.EXECUTION_SNAPSHOT');

    const close = document.querySelector<HTMLButtonElement>(
      'button[aria-label="activityFoundation.detail.close"]'
    );
    expect(close).not.toBeNull();
    await act(async () => {
      close!.click();
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(document.querySelector('[aria-label="activityPage.detailTitle"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('uses a focus-managed drawer on small screens and closes on Escape', async () => {
    const opener = await renderHarness('drawer');
    const detail = document.querySelector<HTMLElement>('[aria-label="activityPage.detailTitle"]');
    expect(detail).not.toBeNull();
    await vi.waitFor(() => expect(detail!.contains(document.activeElement)).toBe(true));

    await act(async () => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })
      );
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    await vi.waitFor(() =>
      expect(document.querySelector('[aria-label="activityPage.detailTitle"]')).toBeNull()
    );
    await vi.waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('offers only information refresh for UNKNOWN when source navigation is absent', async () => {
    const refetch = vi.fn(async () => ({ data: event, isError: false }));
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ActivityEventDetail
            eventId={event.id}
            query={queryFor(event, refetch)}
            showSourceAction={false}
            variant="inline"
            onClose={() => undefined}
          />
        </MemoryRouter>
      );
    });

    const refresh = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('activityFoundation.detail.refreshInformation')
    );
    expect(refresh).toBeDefined();
    const timeHeading = Array.from(document.querySelectorAll('h3')).find((heading) =>
      heading.textContent?.includes('activityFoundation.detail.sections.time')
    );
    expect(timeHeading).toBeDefined();
    expect(refresh!.compareDocumentPosition(timeHeading!) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(document.body.textContent).not.toContain('approve');
    expect(document.body.textContent).not.toContain('retry execution');
    await act(async () => refresh!.click());
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it.each(['needs-input', 'policy-blocked'] as const)(
    'prioritizes a revalidated owning-app action before metadata for %s, without execution controls',
    async (state) => {
      const selectedEvent: WorkspaceActivityEvent = {
        ...event,
        state,
        sourceAccess: 'AVAILABLE',
        sourceRoute: '/work?selected=one',
      };
      const refetch = vi.fn(async () => ({ data: selectedEvent, isError: false }));
      await act(async () =>
        root.render(
          <MemoryRouter>
            <ActivityEventDetail eventId={event.id} query={queryFor(selectedEvent, refetch)} />
          </MemoryRouter>
        )
      );
      const sourceAction = Array.from(document.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('activityPage.openSource')
      );
      const timeHeading = Array.from(document.querySelectorAll('h3')).find((heading) =>
        heading.textContent?.includes('activityFoundation.detail.sections.time')
      );
      expect(sourceAction).toBeDefined();
      expect(timeHeading).toBeDefined();
      expect(
        sourceAction!.compareDocumentPosition(timeHeading!) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(document.querySelectorAll('button')).toHaveLength(1);
      await act(async () => sourceAction!.click());
      expect(refetch).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith('/work?selected=one');
    }
  );

  it('hides cached identity and status as well as the body after a failed access check', async () => {
    await act(async () =>
      root.render(
        <MemoryRouter>
          <ActivityEventDetail
            eventId={event.id}
            query={
              { ...queryFor(event), isError: true } as UseQueryResult<WorkspaceActivityEvent, Error>
            }
            variant="inline"
            onClose={() => undefined}
          />
        </MemoryRouter>
      )
    );
    expect(document.body.textContent).toContain('activityFoundation.unavailableTitle');
    expect(document.body.textContent).not.toContain(event.title);
    expect(document.body.textContent).not.toContain('activityPage.states.unknown');
    expect(document.body.textContent).not.toContain(
      'activityFoundation.detail.kind.EXECUTION_SNAPSHOT.label'
    );
  });

  it('does not follow a source link after its permission is revoked during revalidation', async () => {
    const sourceEvent: WorkspaceActivityEvent = {
      ...event,
      sourceAccess: 'AVAILABLE',
      sourceRoute: '/work?selected=one',
    };
    const refetch = vi.fn(async () => ({
      data: { ...sourceEvent, sourceAccess: 'FORBIDDEN' as const },
      isError: false,
    }));
    await act(async () =>
      root.render(
        <MemoryRouter>
          <ActivityEventDetail eventId={event.id} query={queryFor(sourceEvent, refetch)} />
        </MemoryRouter>
      )
    );
    const sourceAction = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('activityPage.openSource')
    );
    expect(sourceAction).toBeDefined();
    await act(async () => sourceAction!.click());
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('activityFoundation.sourceUnavailable');
  });

  it('does not navigate from an old source check after another event is selected', async () => {
    const sourceEvent = {
      ...event,
      sourceAccess: 'AVAILABLE' as const,
      sourceRoute: '/work?selected=one',
    };
    let resolveCheck!: (value: { data: WorkspaceActivityEvent; isError: boolean }) => void;
    const refetch = vi.fn(
      () =>
        new Promise<{ data: WorkspaceActivityEvent; isError: boolean }>((resolve) => {
          resolveCheck = resolve;
        })
    );
    const renderDetail = (selectedEvent: WorkspaceActivityEvent) =>
      root.render(
        <MemoryRouter>
          <ActivityEventDetail
            eventId={selectedEvent.id}
            query={queryFor(selectedEvent, refetch)}
            variant="inline"
            onClose={() => undefined}
          />
        </MemoryRouter>
      );
    await act(async () => renderDetail(sourceEvent));
    const open = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('activityPage.openSource')
    );
    expect(open).toBeDefined();
    await act(async () => {
      open!.click();
    });
    await act(async () =>
      renderDetail({ ...sourceEvent, id: 'activity-2', title: 'Another activity' })
    );
    await act(async () => {
      resolveCheck({ data: sourceEvent, isError: false });
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Another activity');
  });
});
