// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PermissionDTO } from '@dwp-frontend/shared-utils';
import {
  createWorkCalendarEventHandoff,
  type WorkCalendarEventHandoffState,
} from '@dwp-frontend/shared-utils/api/work-hub-calendar-api';
import { persistWorkCalendarDocumentHandoff } from '@dwp-frontend/shared-utils/api/work-calendar-document-handoff';
import type * as WorkCalendarApi from '@dwp-frontend/shared-utils/api/work-hub-calendar-api';

import { useCalendarCreateHandoff } from './use-calendar-create-handoff';

const boundary = vi.hoisted(() => ({
  owner: 'current-owner-scope',
  fingerprint: `sha256:${'a'.repeat(64)}`,
}));

vi.mock('../../components/use-work-hub-operation-owner', () => ({
  useWorkHubOperationOwner: () => boundary.owner,
}));
vi.mock('@dwp-frontend/shared-utils/api/work-hub-calendar-api', async (importOriginal) => ({
  ...(await importOriginal<typeof WorkCalendarApi>()),
  workCalendarOwnerFingerprint: () => Promise.resolve(boundary.fingerprint),
}));

const permissions: PermissionDTO[] = [
  { resourceType: 'APP', resourceKey: 'APP.WORK', permissionCode: 'VIEW', effect: 'ALLOW' },
  { resourceType: 'APP', resourceKey: 'APP.WORK', permissionCode: 'UPDATE', effect: 'ALLOW' },
];

function handoffState(now = new Date()): WorkCalendarEventHandoffState {
  return {
    workCalendarEventHandoff: createWorkCalendarEventHandoff(
      {
        ownerFingerprint: boundary.fingerprint,
        work: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task-42' },
        sourceUrl: '/work/queue?work=PERSONAL_TASK%3Atask-42%3A',
        returnTo: '/work/queue?view=mine#task-42',
        title: 'Focus: quarterly report',
        startsAt: new Date(now.getTime() + 60_000).toISOString(),
        endsAt: new Date(now.getTime() + 31 * 60_000).toISOString(),
        timeZone: 'Asia/Seoul',
      },
      now
    ),
  };
}

type Snapshot = Readonly<{
  createState: ReturnType<typeof useCalendarCreateHandoff>['createState'];
  search: string;
  routeState: unknown;
}>;

describe('Calendar create handoff transport selection', () => {
  let container: HTMLDivElement;
  let root: Root;
  let snapshot: Snapshot | null;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    window.sessionStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    snapshot = null;
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    window.sessionStorage.clear();
  });

  function Harness() {
    const location = useLocation();
    const handoff = useCalendarCreateHandoff({
      canCreate: true,
      canCreateGranted: true,
      scheduleWritable: true,
      permissions,
      permissionsLoaded: true,
    });
    snapshot = {
      createState: handoff.createState,
      search: location.search,
      routeState: location.state,
    };
    return null;
  }

  async function render(
    initialEntry: string | { pathname: string; search: string; state: unknown }
  ) {
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={[initialEntry]}>
          <Harness />
        </MemoryRouter>
      )
    );
    await vi.waitFor(() =>
      expect(snapshot?.createState?.workHandoff?.handoffId).toEqual(expect.any(String))
    );
  }

  it('consumes the tab-local document envelope and removes the transport command', async () => {
    const state = handoffState();
    expect(persistWorkCalendarDocumentHandoff(state)).toBe(true);

    await render('/calendar/schedule?date=2026-09-16&create=focus');

    expect(snapshot?.createState?.workHandoff).toEqual(state.workCalendarEventHandoff);
    expect(snapshot?.search).toBe('?date=2026-09-16');
    expect(snapshot?.routeState).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('keeps the legacy same-document router-state handoff compatible', async () => {
    const state = handoffState();

    await render({
      pathname: '/calendar/schedule',
      search: '?date=2026-09-16&create=focus',
      state,
    });

    expect(snapshot?.createState?.workHandoff).toEqual(state.workCalendarEventHandoff);
    expect(snapshot?.search).toBe('?date=2026-09-16');
    expect(snapshot?.routeState).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });
});
