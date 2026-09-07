// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivityEventDetail } from './activity-event-detail';

import type { Root } from 'react-dom/client';
import type { UseQueryResult } from '@tanstack/react-query';
import type { WorkspaceActivityEvent } from '@dwp-frontend/shared-utils';

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
    expect(document.body.textContent).not.toContain('approve');
    expect(document.body.textContent).not.toContain('retry execution');
    await act(async () => refresh!.click());
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
