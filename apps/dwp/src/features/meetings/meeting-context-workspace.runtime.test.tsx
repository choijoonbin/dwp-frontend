// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type * as SharedUtils from '@dwp-frontend/shared-utils';
import type {
  VideoMeetingTemplate,
  VideoMeetingTemplateScheduleDraft,
} from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';

const runtime = vi.hoisted(() => ({
  auth: { isAuthenticated: true, tenantId: 1, userId: 7, identityPlane: 'TENANT' },
  read: vi.fn(),
}));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<typeof SharedUtils>()),
  useAuth: () => ({ isAuthenticated: runtime.auth.isAuthenticated, user: runtime.auth }),
}));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-templates-api', () => ({
  getVideoMeetingTemplate: runtime.read,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
vi.mock('./meeting-schedule-workspace', () => ({
  MeetingScheduleWorkspace: ({
    initialTemplateDraft,
    onCreated,
  }: {
    initialTemplateDraft?: VideoMeetingTemplateScheduleDraft;
    onCreated: (id: string) => void;
  }) =>
    createElement(
      'button',
      { onClick: () => onCreated('81000000-0000-0000-0000-000000000001') },
      'schedule:' + (initialTemplateDraft?.title ?? 'blank')
    ),
}));
vi.mock('./meeting-preparation', () => ({
  MeetingPreparation: ({ meetingId }: { meetingId: string }) =>
    createElement('div', null, 'preparation:' + meetingId),
}));
vi.mock('./my-meetings', () => ({ MyMeetings: () => createElement('div', null, 'my-meetings') }));
vi.mock('./meeting-personal-room', () => ({
  MeetingPersonalRoom: () => createElement('div', null, 'personal-room'),
}));
vi.mock('../../components/product-surface-local-not-found', () => ({
  ProductSurfaceLocalNotFound: () => createElement('div', null, 'local-not-found'),
}));

import { MeetingContextWorkspace } from './meeting-context-workspace';
import { MEETINGS_NAVIGATION } from './meetings-navigation';
import { MEETINGS_PRODUCT_MANIFEST } from './meetings-product-manifest';
const id = '81000000-0000-0000-0000-000000000002';
const template = {
  templateId: id,
  version: 2,
  name: 'Private launch',
  purpose: 'Private goal',
  durationMinutes: 30,
  agendaItems: [],
} as unknown as VideoMeetingTemplate;
let root: Root;
let element: HTMLDivElement;
let client: QueryClient;
let router: ReturnType<typeof createMemoryRouter>;
async function render(search: string) {
  element = document.createElement('div');
  document.body.appendChild(element);
  root = createRoot(element);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  router = createMemoryRouter(
    [{ path: '/meetings/mine', element: createElement(MeetingContextWorkspace) }],
    { initialEntries: ['/meetings/mine' + search] }
  );
  await act(async () =>
    root.render(
      createElement(QueryClientProvider, { client }, createElement(RouterProvider, { router }))
    )
  );
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}
describe('meeting menu and contextual screen integration', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    runtime.auth = { isAuthenticated: true, tenantId: 1, userId: 7, identityPlane: 'TENANT' };
    runtime.read.mockReset().mockResolvedValue(template);
  });
  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    router?.dispose();
    client?.clear();
    element?.remove();
  });
  it('adds only implemented destinations and separates administrator navigation', () => {
    const all = MEETINGS_NAVIGATION.flatMap((group) => group.items);
    expect(all.filter((item) => item.section !== 'admin').map((item) => item.view)).toEqual([
      'home',
      'join',
      'mine',
      'history',
      'follow-ups',
      'templates',
      'preferences',
    ]);
    const user = MEETINGS_PRODUCT_MANIFEST.surfaces.find(
      (surface) => surface.id === 'meetings.work'
    )!;
    expect(user.navigation.flatMap((group) => group.items).map((item) => item.view)).toEqual([
      'home',
      'join',
      'mine',
      'history',
      'follow-ups',
      'templates',
      'preferences',
    ]);
    expect(
      all
        .filter((item) => item.section === 'admin')
        .every((item) => item.requiredResourceKey === 'ADMIN.MEETINGS')
    ).toBe(true);
  });
  it.each([
    ['', 'my-meetings'],
    ['?view=personal-room', 'personal-room'],
    ['?view=unknown', 'local-not-found'],
  ])('resolves a bounded My Meetings context %s', async (search, expected) => {
    await render(search);
    expect(element.textContent).toContain(expected);
    expect(runtime.read).not.toHaveBeenCalled();
  });
  it('opens a blank schedule without fetching or restoring source content', async () => {
    await render('?view=schedule');
    expect(element.textContent).toContain('schedule:blank');
    expect(runtime.read).not.toHaveBeenCalled();
  });
  it('re-reads the selected revision before offering an editable schedule and replaces create with preparation', async () => {
    await render(`?view=schedule&templateId=${id}&templateVersion=2`);
    expect(runtime.read).toHaveBeenCalledWith(id, expect.any(AbortSignal));
    expect(element.textContent).toContain('schedule:Private launch');
    await act(async () => element.querySelector('button')!.click());
    expect(element.textContent).toContain('preparation:81000000-0000-0000-0000-000000000001');
    expect(router.state.location.search).not.toContain('Private');
    expect(router.state.historyAction).toBe('REPLACE');
  });
  it('does not apply stale source content after a concurrent template edit', async () => {
    runtime.read.mockResolvedValue({ ...template, version: 3 });
    await render(`?view=schedule&templateId=${id}&templateVersion=2`);
    expect(element.textContent).toContain('context.templateChanged');
    expect(element.textContent).not.toContain('Private');
    expect(element.textContent).not.toContain('schedule:');
  });
  it('does not start an editable schedule after a denied source read', async () => {
    runtime.read.mockRejectedValue(new Error('403'));
    await render(`?view=schedule&templateId=${id}&templateVersion=2`);
    expect(element.textContent).toContain('context.templateUnavailable');
    expect(element.textContent).not.toContain('schedule:');
  });
  it('aborts a late source read on route departure and cannot restore the old draft', async () => {
    const late = deferred<VideoMeetingTemplate>();
    runtime.read.mockReturnValue(late.promise);
    await render(`?view=schedule&templateId=${id}&templateVersion=2`);
    const signal = runtime.read.mock.calls[0]![1] as AbortSignal;
    await act(async () => {
      await router.navigate('/meetings/mine?view=personal-room');
    });
    expect(signal.aborted).toBe(true);
    await act(async () => late.resolve(template));
    expect(element.textContent).toBe('personal-room');
  });
  it('does not fetch a template when no authenticated actor exists', async () => {
    runtime.auth.isAuthenticated = false;
    await render(`?view=schedule&templateId=${id}&templateVersion=2`);
    expect(runtime.read).not.toHaveBeenCalled();
    expect(element.textContent).toContain('context.accessRequired');
  });
});
