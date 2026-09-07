// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({ preparation: vi.fn() }));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-preparation-api', () => ({
  getVideoMeetingPreparation: runtime.preparation,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${JSON.stringify(values)}` : key,
  }),
}));

import { MeetingRoomContextPanel, MeetingRoomRailNavigation } from './meeting-room-context-panel';

const meetingId = '90000000-0000-4000-8000-000000000101';
let root: Root;
let mount: HTMLDivElement;
let client: QueryClient;

async function render(node: ReactNode) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mount = document.createElement('div');
  document.body.append(mount);
  root = createRoot(mount);
  await act(async () => root.render(createElement(QueryClientProvider, { client }, node)));
}

describe('meeting room governed context rail', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    runtime.preparation.mockReset().mockResolvedValue({
      meetingId,
      meetingVersion: 4,
      agendaVersion: 2,
      materialsVersion: 1,
      invitationRevision: 1,
      agendaItems: [
        {
          itemId: '90000000-0000-4000-8000-000000000102',
          position: 0,
          title: 'Approve release evidence',
          objective: 'Confirm the governed go/no-go decision.',
          ownerUserId: 42,
          ownerDisplayName: 'Mina Kim',
          plannedMinutes: 15,
        },
      ],
      materials: [
        {
          materialId: '90000000-0000-4000-8000-000000000103',
          opaqueReference: 'must-not-enter-room-rail',
        },
      ],
      myResponse: null,
      invitationResponses: [],
      invitationCounts: { accepted: 1, tentative: 0, declined: 0, pending: 0 },
      canEditAgenda: true,
      canManageMaterials: true,
      canRespond: false,
      observedAt: '2026-09-04T09:00:00Z',
    });
  });

  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    client?.clear();
    mount?.remove();
  });

  it('projects only the current governed agenda and links the verified live tools', async () => {
    await render(
      createElement(MeetingRoomContextPanel, {
        meetingId,
        kind: 'agenda',
        onClose: vi.fn(),
      })
    );

    await vi.waitFor(() => expect(mount.textContent).toContain('Approve release evidence'));
    expect(runtime.preparation).toHaveBeenCalledOnce();
    expect(runtime.preparation.mock.calls[0]?.[0]).toBe(meetingId);
    expect(runtime.preparation.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal);
    expect(mount.textContent).toContain('room.rail.agenda.capabilities.facilitation.label');
    expect(mount.textContent).toContain('room.rail.agenda.capabilities.qa.label');
    expect(mount.textContent).toContain('room.rail.agenda.capabilities.polls.label');
    expect(mount.textContent).toContain('room.rail.agenda.openFacilitation');
    expect(mount.textContent).not.toContain('must-not-enter-room-rail');
  });

  it('does not fetch transcript or agenda content for the blocked live AI panel', async () => {
    await render(
      createElement(MeetingRoomContextPanel, {
        meetingId,
        kind: 'ai',
        onClose: vi.fn(),
      })
    );

    expect(mount.textContent).toContain('room.rail.ai.unavailableTitle');
    expect(mount.textContent).toContain('room.rail.ai.boundary');
    expect(runtime.preparation).not.toHaveBeenCalled();
  });

  it('supports roving keyboard navigation across all five rail destinations', async () => {
    const onSelect = vi.fn();
    await render(createElement(MeetingRoomRailNavigation, { activePanel: 'agenda', onSelect }));
    const tabs = [...mount.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs).toHaveLength(5);

    await act(async () =>
      tabs[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    );
    expect(onSelect).toHaveBeenCalledWith('chat');
    expect(document.activeElement).toBe(tabs[1]);
  });
});
