// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SharedUtils from '@dwp-frontend/shared-utils';
import type * as Api from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';
import { HttpError } from '@dwp-frontend/shared-utils';

const runtime = vi.hoisted(() => ({
  auth: { userId: 7, tenantId: 1, identityPlane: 'TENANT' },
  list: vi.fn(),
  detail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  clone: vi.fn(),
  favorite: vi.fn(),
  remove: vi.fn(),
  apply: vi.fn(),
  applied: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<typeof SharedUtils>()),
  useAuth: () => ({ isAuthenticated: true, user: runtime.auth }),
  useToast: () => ({ success: runtime.success, error: runtime.error }),
}));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-templates-api', async (original) => ({
  ...(await original<typeof Api>()),
  getVideoMeetingTemplates: runtime.list,
  getVideoMeetingTemplate: runtime.detail,
  createVideoMeetingTemplate: runtime.create,
  updateVideoMeetingTemplate: runtime.update,
  cloneVideoMeetingTemplate: runtime.clone,
  favoriteVideoMeetingTemplate: runtime.favorite,
  deleteVideoMeetingTemplate: runtime.remove,
  applyVideoMeetingTemplate: runtime.apply,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

import { MeetingTemplates } from './meeting-templates';
const id = '88000000-0000-4000-8000-000000000001';
const template: Api.VideoMeetingTemplate = {
  templateId: id,
  scope: 'PERSONAL',
  name: 'Release decision',
  purpose: 'Choose a release date',
  category: 'DECISION',
  durationMinutes: 30,
  agendaItems: [{ title: 'Review risks', description: '', role: 'Host', durationMinutes: 20 }],
  favorite: false,
  canEdit: true,
  version: 3,
  updatedAt: '2026-09-04T00:00:00Z',
};
let root: Root;
let mount: HTMLDivElement;
let client: QueryClient;
let router: ReturnType<typeof createMemoryRouter>;
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}
async function render(path = '/meetings/templates') {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  mount = document.createElement('div');
  document.body.append(mount);
  root = createRoot(mount);
  router = createMemoryRouter(
    [
      {
        path: '/meetings/templates',
        element: createElement(MeetingTemplates, { onApplyDraft: runtime.applied }),
      },
    ],
    { initialEntries: [path] }
  );
  await act(async () =>
    root.render(
      createElement(QueryClientProvider, { client }, createElement(RouterProvider, { router }))
    )
  );
  await settle();
}
function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find(
    (element) => element.getAttribute('aria-label') === label || element.textContent === label
  );
  if (!found) throw new Error('Missing test button: ' + label);
  return found;
}
async function click(label: string) {
  await act(async () => button(label).click());
  await settle();
}
describe('template workspace runtime boundaries', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    runtime.auth = { userId: 7, tenantId: 1, identityPlane: 'TENANT' };
    runtime.list.mockResolvedValue({ items: [template], total: 1, page: 0, pageSize: 30 });
    runtime.detail.mockResolvedValue(template);
    runtime.favorite.mockResolvedValue({ ...template, favorite: true });
  });
  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    router?.dispose();
    client?.clear();
    mount?.remove();
  });
  it('renders real metadata, ordered agenda and separate selected preview', async () => {
    await render();
    expect(mount.textContent).toContain('Release decision');
    expect(mount.textContent).toContain('Review risks');
    expect(mount.querySelector('[data-testid="template-list"]')).not.toBeNull();
    expect(mount.querySelector('[data-testid="template-preview"]')).not.toBeNull();
    expect(runtime.list).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'PERSONAL', page: 0 }),
      expect.any(AbortSignal)
    );
    expect(runtime.apply).not.toHaveBeenCalled();
    expect(runtime.create).not.toHaveBeenCalled();
  });
  it('keeps the desktop apply action before the full ordered agenda', async () => {
    await render();
    const preview = mount.querySelector('[data-testid="template-desktop-preview"]')!;
    const actions = preview.querySelector('[data-testid="template-preview-actions"]')!;
    const agenda = preview.querySelector('ol')!;
    expect(actions.compareDocumentPosition(agenda) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(actions.textContent).toContain('templates.clone');
  });
  it('keeps compact agenda before apply and full preview without duplicating management actions', async () => {
    await render();
    const preview = mount.querySelector('[data-testid="template-mobile-preview"]')!;
    const actions = preview.querySelector('[data-testid="template-preview-actions"]')!;
    const agenda = preview.querySelector('ol')!;
    expect(agenda.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const labels = [...actions.querySelectorAll('button')].map((item) => item.textContent);
    expect(labels).toEqual(['templates.apply', 'templates.fullPreview']);
    expect(preview.textContent).not.toContain('templates.clone');
    expect(preview.textContent).toContain('templates.policyRecheck');
  });
  it('places a truthful mobile intro before search and the two scope tabs', async () => {
    await render();
    const intro = mount.querySelector('[data-testid="template-mobile-intro"]')!;
    const searchScope = mount.querySelector('[data-testid="template-search-scope"]')!;
    expect(intro.textContent).toBe('templates.subtitle');
    expect(
      intro.compareDocumentPosition(searchScope) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      [...searchScope.querySelectorAll('[role="tab"]')].map((item) => item.textContent)
    ).toEqual(['templates.scopes.PERSONAL', 'templates.scopes.ORGANIZATION']);
    expect(searchScope.querySelector('input')?.getAttribute('aria-label')).toBe('templates.search');
  });
  it.each(['ALL', 'ADMIN', 'invalid'])(
    'normalizes legacy or invalid UI scope %s to personal',
    async (scope) => {
      await render('/meetings/templates?scope=' + scope);
      expect(runtime.list.mock.calls.every(([filter]) => filter.scope === 'PERSONAL')).toBe(true);
      expect(new URLSearchParams(router.state.location.search).get('scope')).toBe('PERSONAL');
    }
  );
  it('uses server filters and preserves the selection contract in the URL', async () => {
    await render('/meetings/templates?scope=PERSONAL&category=DECISION&favorites=true&q=release');
    expect(runtime.list).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'PERSONAL',
        category: 'DECISION',
        favoritesOnly: true,
        q: 'release',
      }),
      expect.any(AbortSignal)
    );
  });
  it('does not expose edit/delete controls for a read-only organization template', async () => {
    runtime.list.mockResolvedValue({
      items: [{ ...template, scope: 'ORGANIZATION', canEdit: false }],
      total: 1,
      page: 0,
      pageSize: 30,
    });
    runtime.detail.mockResolvedValue({ ...template, scope: 'ORGANIZATION', canEdit: false });
    await render();
    expect(
      [...mount.querySelectorAll('button')].some((item) => item.textContent === 'templates.edit')
    ).toBe(false);
    expect(
      [...mount.querySelectorAll('button')].some((item) => item.textContent === 'templates.delete')
    ).toBe(false);
    expect(mount.textContent).toContain('templates.clone');
  });
  it('favorites only by an explicit action with a stable command key', async () => {
    await render();
    await click('templates.favorite');
    expect(runtime.favorite).toHaveBeenCalledTimes(1);
    expect(runtime.favorite).toHaveBeenCalledWith(
      id,
      true,
      expect.stringMatching(/^[0-9a-f-]{36}$/u)
    );
  });
  it('hands off a verified draft rather than immediately creating a meeting', async () => {
    const draft = { sourceTemplateId: id, sourceTemplateVersion: 3, title: 'Release decision' };
    runtime.apply.mockResolvedValue(draft);
    await render();
    await click('templates.apply');
    expect(runtime.apply).toHaveBeenCalledWith(id, 3, expect.any(String));
    expect(runtime.applied).toHaveBeenCalledWith(draft);
    expect(runtime.create).not.toHaveBeenCalled();
  });
  it('reuses the key for the same failed apply attempt and never fabricates a draft', async () => {
    runtime.apply.mockRejectedValue(new Error('Temporary failure'));
    await render();
    await click('templates.apply');
    await click('templates.apply');
    expect(runtime.apply).toHaveBeenCalledTimes(2);
    expect(runtime.apply.mock.calls[0][2]).toBe(runtime.apply.mock.calls[1][2]);
    expect(runtime.applied).not.toHaveBeenCalled();
  });
  it('hides cached content when list revalidation fails', async () => {
    await render();
    runtime.list.mockRejectedValue(new HttpError('Not allowed', 403));
    await click('actions.refresh');
    expect(mount.textContent).not.toContain('Release decision');
    expect(mount.textContent).not.toContain('Review risks');
    expect(mount.textContent).toContain('templates.loadError');
  });
  it('discards a late apply success after authority is revoked', async () => {
    let complete!: (value: unknown) => void;
    runtime.apply.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      })
    );
    await render();
    await act(async () => button('templates.apply').click());
    runtime.list.mockRejectedValue(new HttpError('Not allowed', 403));
    await click('actions.refresh');
    await act(async () => complete({ sourceTemplateId: id, sourceTemplateVersion: 3 }));
    await settle();
    expect(runtime.applied).not.toHaveBeenCalled();
    expect(mount.textContent).not.toContain('Release decision');
  });
  it('does not render a fabricated template when the collection is empty', async () => {
    runtime.list.mockResolvedValue({ items: [], total: 0, page: 0, pageSize: 30 });
    await render();
    expect(mount.textContent).toContain('templates.emptyTitle');
    expect(mount.textContent).not.toContain('Release decision');
  });
});
