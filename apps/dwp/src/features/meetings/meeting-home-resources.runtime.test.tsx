// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SharedUtils from '@dwp-frontend/shared-utils';
import { HttpError } from '@dwp-frontend/shared-utils';
import type { VideoMeetingTemplatePage } from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';

const runtime = vi.hoisted(() => ({
  authenticated: true,
  user: { userId: 7, tenantId: 1, identityPlane: 'TENANT' },
  read: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<typeof SharedUtils>()),
  useAuth: () => ({ isAuthenticated: runtime.authenticated, user: runtime.user }),
}));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-templates-api', () => ({
  getVideoMeetingTemplates: runtime.read,
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => runtime.navigate }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
import { MeetingHomeResources } from './meeting-home-resources';

const templateId = '88000000-0000-4000-8000-000000000001';
const page: VideoMeetingTemplatePage = {
  items: [
    {
      templateId,
      name: 'Private decision template',
      purpose: 'Private preparation notes must not enter the URL.',
      category: 'DECISION',
      durationMinutes: 45,
      agendaItems: [],
      scope: 'PERSONAL',
      favorite: true,
      canEdit: true,
      version: 2,
      updatedAt: '2026-09-04T01:00:00Z',
    },
  ],
  page: 0,
  pageSize: 3,
  total: 1,
};
const empty: VideoMeetingTemplatePage = { ...page, items: [], total: 0 };
let root: Root;
let mount: HTMLDivElement;
let client: QueryClient;
async function render() {
  await act(async () =>
    root.render(createElement(QueryClientProvider, { client }, createElement(MeetingHomeResources)))
  );
}
async function shown(text: string) {
  await act(async () => {
    await vi.waitFor(() => expect(mount.textContent).toContain(text));
  });
}
async function click(text: string) {
  const button = [...mount.querySelectorAll('button')].find((item) =>
    item.textContent?.startsWith(text)
  );
  if (!button) throw new Error('Missing resource action ' + text);
  await act(async () => button.click());
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { resolve, promise };
}

describe('home resources use current authorized workspaces without creating anything', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    runtime.authenticated = true;
    runtime.user = { userId: 7, tenantId: 1, identityPlane: 'TENANT' };
    runtime.read.mockReset().mockResolvedValue(page);
    runtime.navigate.mockReset();
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    mount.remove();
  });

  it('loads only three current-user favorites through an abortable sensitive query', async () => {
    await render();
    await shown(page.items[0].name);
    expect(runtime.read).toHaveBeenCalledOnce();
    expect(runtime.read).toHaveBeenCalledWith(
      { scope: 'ALL', favoritesOnly: true, page: 0, pageSize: 3 },
      expect.any(AbortSignal)
    );
    const query = client.getQueryCache().getAll()[0];
    expect(query.queryKey).toContain(JSON.stringify([true, 'TENANT', 1, 7]));
    expect(query.meta).toMatchObject({ accessSensitive: true });
    expect(query.gcTime).toBe(0);
    expect(runtime.navigate).not.toHaveBeenCalled();
    expect(mount.textContent).not.toContain(page.items[0].purpose);
  });

  it.each(['PERSONAL', 'ORGANIZATION'] as const)(
    'opens the %s template inspector with only scope and opaque reference',
    async (scope) => {
      runtime.read.mockResolvedValue({ ...page, items: [{ ...page.items[0], scope }] });
      await render();
      await shown(page.items[0].name);
      await click(page.items[0].name);
      expect(runtime.navigate).toHaveBeenCalledExactlyOnceWith(
        `/meetings/templates?scope=${scope}&template=${templateId}`
      );
      expect(runtime.navigate.mock.calls[0][0]).not.toContain('Private');
      expect(runtime.read).toHaveBeenCalledOnce();
    }
  );

  it('keeps empty favorites truthful and opens templates, personal room and preferences', async () => {
    runtime.read.mockResolvedValue(empty);
    await render();
    await shown('home.resources.empty');
    await click('home.resources.choose');
    await click('actions.viewAll');
    await click('personalRoom.title');
    await click('context.preferences');
    expect(runtime.navigate.mock.calls.map(([path]) => path)).toEqual([
      '/meetings/templates',
      '/meetings/templates',
      '/meetings/mine?view=personal-room',
      '/meetings/preferences',
    ]);
    expect(runtime.read).toHaveBeenCalledOnce();
  });

  it('retries a local read failure without blocking the other workspace entries', async () => {
    runtime.read.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue(page);
    await render();
    await shown('home.resources.loadError');
    await click('personalRoom.title');
    await click('actions.retry');
    await shown(page.items[0].name);
    expect(runtime.read).toHaveBeenCalledTimes(2);
    expect(runtime.navigate).toHaveBeenCalledExactlyOnceWith('/meetings/mine?view=personal-room');
  });

  it('drops previously loaded template names when a current refetch is denied', async () => {
    await render();
    await shown(page.items[0].name);
    runtime.read.mockRejectedValue(new HttpError('access revoked', 403));
    await act(async () =>
      client.invalidateQueries({ queryKey: ['meetings', 'home', 'resources'] })
    );
    await shown('home.resources.loadError');
    expect(mount.textContent).not.toContain(page.items[0].name);
  });

  it.each([
    { userId: 8, tenantId: 1, identityPlane: 'TENANT' },
    { userId: 7, tenantId: 2, identityPlane: 'TENANT' },
    { userId: 7, tenantId: 1, identityPlane: 'SUPPORT' },
  ])('cancels and isolates a late response after scope changes: %s', async (user) => {
    const old = deferred<VideoMeetingTemplatePage>();
    runtime.read.mockReturnValueOnce(old.promise).mockResolvedValue(empty);
    await render();
    const signal = runtime.read.mock.calls[0][1] as AbortSignal;
    runtime.user = user;
    await render();
    if (user.identityPlane === 'TENANT') await shown('home.resources.empty');
    await act(async () => old.resolve(page));
    expect(signal.aborted).toBe(true);
    expect(mount.textContent).not.toContain(page.items[0].name);
    expect(runtime.read).toHaveBeenCalledTimes(user.identityPlane === 'TENANT' ? 2 : 1);
  });

  it('does not fetch after logout, including an exposed retry action', async () => {
    runtime.authenticated = false;
    await render();
    const retry = [...mount.querySelectorAll('button')].find(
      (item) => item.textContent === 'actions.retry'
    );
    if (retry) await act(async () => retry.click());
    expect(runtime.read).not.toHaveBeenCalled();
    expect(mount.textContent).not.toContain(page.items[0].name);
  });

  it('never reads favorites for an incomplete tenant identity', async () => {
    runtime.user = { userId: 0, tenantId: 0, identityPlane: 'TENANT' };
    await render();
    expect(runtime.read).not.toHaveBeenCalled();
  });
});
