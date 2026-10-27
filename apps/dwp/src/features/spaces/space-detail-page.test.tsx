// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SpaceDetailPage } from './space-detail-page';
import { spaceDetailQueryKeys } from './space-detail-query-keys';

import type { SpaceAccessRequest, SpaceDetail, SpaceSummary } from '@dwp-frontend/shared-utils';

const api = vi.hoisted(() => ({
  getSpace: vi.fn(),
  getSpaceContent: vi.fn(),
  getSpaceMembers: vi.fn(),
  getSpaceOwnerAccessRequests: vi.fn(),
  listPeople: vi.fn(),
  saveSpaceMember: vi.fn(),
  updateSpaceMember: vi.fn(),
  revokeSpaceMember: vi.fn(),
  decideSpaceAccessRequest: vi.fn(),
  getMySpaceAccessRequests: vi.fn(),
  requestSpaceAccess: vi.fn(),
  updateSpacePolicies: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
  user: { tenantId: 1, userId: 42 },
  actions: ['CREATE'],
  permissionsLoaded: true,
}));

vi.mock('@dwp-frontend/shared-utils', () => ({
  ...api,
  useAuth: () => ({ user: api.user }),
  usePermissions: () => ({
    isLoaded: api.permissionsLoaded,
    hasPermission: (resource: string, action: string) =>
      resource === 'ACTION.SPACE_MEMBERSHIP' && api.actions.includes(action),
  }),
  useToast: () => api.toast,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));
vi.mock('@dwp-frontend/shared-i18n', () => ({
  formatDate: () => '2026-10-27',
  formatNumber: String,
}));
vi.mock('./create-space-content-dialog', () => ({ CreateSpaceContentDialog: () => null }));
vi.mock('./space-ui', () => ({
  SpaceGlyph: () => null,
  SpaceStatusChip: () => null,
  getSpaceTone: () => ({ soft: '#fff', strong: '#000' }),
  localizedSpace: (space: SpaceSummary) => ({ name: space.nameEn, summary: space.summaryEn }),
}));
vi.mock('@dwp-frontend/design-system', () => ({
  PageCanvas: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  EmptyState: ({ title }: { title: string }) => <p>{title}</p>,
  LoadingState: ({ label }: { label: string }) => <p role="status">{label}</p>,
  InlineFeedback: ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
    <div role="alert">
      {children}
      {action}
    </div>
  ),
  DatePickerField: () => null,
  ConfirmDialog: ({
    open,
    title,
    busy,
    onConfirm,
  }: {
    open: boolean;
    title: string;
    busy: boolean;
    onConfirm: () => void;
  }) =>
    open ? (
      <section role="dialog" aria-label={title}>
        <button disabled={busy} onClick={onConfirm}>
          Confirm
        </button>
      </section>
    ) : null,
  ActionButton: ({
    children,
    disabled,
    onClick,
  }: {
    children: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  FormField: ({
    label,
    value,
    onChange,
    select,
    children,
    'aria-label': ariaLabel,
  }: {
    label?: string;
    value: string;
    onChange: (event: { target: { value: string } }) => void;
    select?: boolean;
    children?: ReactNode;
    'aria-label'?: string;
  }) => (
    <label>
      {label}
      {select ? (
        <select aria-label={ariaLabel} value={value} onChange={onChange}>
          {children}
        </select>
      ) : (
        <textarea value={value} onChange={onChange} />
      )}
    </label>
  ),
  FormDialog: ({
    open,
    title,
    children,
    busy,
    submitDisabled,
    onSubmit,
  }: {
    open: boolean;
    title: string;
    children: ReactNode;
    busy: boolean;
    submitDisabled: boolean;
    onSubmit: () => void;
  }) =>
    open ? (
      <form
        role="dialog"
        aria-label={title}
        onSubmit={(event) => {
          event.preventDefault();
          // Exercise the caller's guard as well as the disabled button.
          onSubmit();
        }}
      >
        {children}
        <button disabled={busy || submitDisabled} type="submit">
          Submit
        </button>
      </form>
    ) : null,
}));

function detail(overrides: Partial<SpaceSummary> = {}): SpaceDetail {
  return {
    space: {
      spaceId: 'space-1',
      spaceKey: 'test-space',
      nameKo: '테스트',
      nameEn: 'Test space',
      summaryKo: '',
      summaryEn: '',
      purposeType: 'COMMUNITY',
      visibility: 'REQUEST',
      dataClassification: 'INTERNAL',
      memberRole: null,
      memberCount: 0,
      contentCount: 0,
      unreadCount: 0,
      iconKey: 'building-2',
      accentToken: 'cobalt',
      lifecycleState: 'ACTIVE',
      lastActivityAt: '2026-10-27T00:00:00Z',
      version: 1,
      ...overrides,
    },
    contentPolicy: 'OWNER_REVIEW',
    appPolicy: 'OWNER_REVIEW',
    aiPolicy: 'MEMBER_SCOPED',
    canContribute: false,
    canModerate: false,
    canManage: false,
    featuredContent: [],
    apps: [],
    activity: [],
  };
}

const pendingRequest: SpaceAccessRequest = {
  accessRequestId: 'request-1',
  spaceId: 'space-1',
  spaceKey: 'test-space',
  spaceNameKo: '테스트',
  spaceNameEn: 'Test space',
  requesterUserId: 42,
  requestedRole: 'VIEWER',
  justification: 'Review collaboration evidence',
  decisionMode: 'OWNER_REVIEW',
  status: 'PENDING',
  createdAt: '2026-10-27T00:00:00Z',
  version: 1,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('Space detail access and identity boundaries', () => {
  let host: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    api.user = { tenantId: 1, userId: 42 };
    api.actions = ['CREATE'];
    api.permissionsLoaded = true;
    api.getSpace.mockReset().mockResolvedValue(detail());
    api.getMySpaceAccessRequests.mockReset().mockResolvedValue([]);
    api.getSpaceContent.mockReset().mockResolvedValue([]);
    api.getSpaceMembers.mockReset().mockResolvedValue([]);
    api.getSpaceOwnerAccessRequests.mockReset().mockResolvedValue([]);
    api.listPeople.mockReset().mockResolvedValue({ items: [] });
    api.saveSpaceMember.mockReset().mockResolvedValue(undefined);
    api.updateSpaceMember.mockReset().mockResolvedValue(undefined);
    api.revokeSpaceMember.mockReset().mockResolvedValue(undefined);
    api.decideSpaceAccessRequest.mockReset().mockResolvedValue(undefined);
    api.requestSpaceAccess.mockReset().mockResolvedValue(pendingRequest);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
  });

  async function flush() {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
  }

  async function render(tab = 'overview') {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <SpaceDetailPage spaceKey="test-space" tab={tab} />
          </MemoryRouter>
        </QueryClientProvider>
      )
    );
    await flush();
  }

  it.each(['REQUEST', 'PRIVATE', 'HIDDEN'] as const)(
    'distinguishes membership-protected %s content from an empty space',
    async (visibility) => {
      api.getSpace.mockResolvedValue(detail({ visibility }));
      await render();
      expect(host.textContent).toContain('detail.membersOnlyContent');
      expect(host.textContent).not.toContain('detail.noFeaturedTitle');
      expect(host.textContent).not.toContain('detail.noActivityTitle');
    }
  );

  it('keeps actual empty content states for authorized members', async () => {
    api.getSpace.mockResolvedValue(detail({ visibility: 'PRIVATE', memberRole: 'VIEWER' }));
    await render();
    expect(host.textContent).not.toContain('detail.membersOnlyContent');
    expect(host.textContent).toContain('detail.noFeaturedTitle');
    expect(host.textContent).toContain('detail.noActivityTitle');
  });

  function button(text: string) {
    return Array.from(host.querySelectorAll('button')).find((item) => item.textContent === text);
  }

  async function openRequest() {
    await act(async () => button('actions.requestAccess')!.click());
    await fillTextarea('Review collaboration evidence');
  }

  async function fillTextarea(value: string) {
    const input = host.querySelector('textarea')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
        input,
        value
      );
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await flush();
  }

  async function submit() {
    await act(async () => {
      host
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flush();
  }

  it.each(['OPEN', 'REQUEST'] as const)(
    'offers eligible %s nonmembers a request with CREATE or MANAGE only',
    async (visibility) => {
      api.getSpace.mockResolvedValue(detail({ visibility }));
      await render();
      expect(button('actions.requestAccess')?.disabled).toBe(false);
      api.actions = ['MANAGE'];
      await render();
      expect(button('actions.requestAccess')?.disabled).toBe(false);
      api.actions = ['VIEW', 'UPDATE', 'APPROVE'];
      await render();
      expect(button('actions.requestAccess')).toBeUndefined();
      api.actions = ['CREATE'];
      api.permissionsLoaded = false;
      await render();
      expect(button('actions.requestAccess')).toBeUndefined();
    }
  );

  it.each([
    { visibility: 'PRIVATE' },
    { visibility: 'HIDDEN' },
    { lifecycleState: 'DRAFT' },
    { lifecycleState: 'SUSPENDED' },
    { lifecycleState: 'ARCHIVED' },
    { memberRole: 'VIEWER' },
    { memberRole: 'CONTRIBUTOR' },
    { memberRole: 'OWNER' },
  ] satisfies Partial<SpaceSummary>[])(
    'does not query or offer access for %j',
    async (overrides) => {
      api.getSpace.mockResolvedValue(detail(overrides));
      await render();
      expect(button('actions.requestAccess')).toBeUndefined();
      expect(api.getMySpaceAccessRequests).not.toHaveBeenCalled();
      expect(api.requestSpaceAccess).not.toHaveBeenCalled();
    }
  );

  it('waits for pending status and ignores pending requests for other spaces', async () => {
    const status = deferred<SpaceAccessRequest[]>();
    api.getMySpaceAccessRequests.mockReturnValue(status.promise);
    await render();
    expect(button('detail.accessStatusChecking')?.disabled).toBe(true);
    await act(async () => status.resolve([{ ...pendingRequest, spaceKey: 'another-space' }]));
    await flush();
    expect(button('actions.requestAccess')?.disabled).toBe(false);
  });

  it('blocks lookup errors and resolves Retry to an already pending request', async () => {
    api.getMySpaceAccessRequests
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockResolvedValue([pendingRequest]);
    await render();
    expect(host.textContent).toContain('detail.accessStatusError');
    expect(button('actions.requestAccess')?.disabled).toBe(true);
    await act(async () => button('actions.retry')!.click());
    await flush();
    expect(button('actions.accessPending')?.disabled).toBe(true);
    expect(host.textContent).not.toContain('detail.accessStatusError');
    expect(api.requestSpaceAccess).not.toHaveBeenCalled();
  });

  it('blocks the open dialog during refresh and after failure despite a cached empty list', async () => {
    await render();
    await openRequest();
    expect(button('Submit')?.disabled).toBe(false);
    const status = deferred<SpaceAccessRequest[]>();
    api.getMySpaceAccessRequests
      .mockReturnValueOnce(status.promise)
      .mockRejectedValue(new Error('Unavailable'));
    await act(async () => {
      void client.invalidateQueries({ queryKey: spaceDetailQueryKeys.pending(api.user) });
    });
    await flush();
    expect(button('Submit')?.disabled).toBe(true);
    await submit();
    expect(api.requestSpaceAccess).not.toHaveBeenCalled();
    await act(async () => status.resolve([]));
    await flush();
    await act(async () => {
      await client.invalidateQueries({ queryKey: spaceDetailQueryKeys.pending(api.user) });
    });
    await flush();
    expect(client.getQueryData(spaceDetailQueryKeys.pending(api.user))).toEqual([]);
    expect(host.textContent).toContain('detail.accessStatusError');
    expect(button('Submit')?.disabled).toBe(true);
    await submit();
    expect(api.requestSpaceAccess).not.toHaveBeenCalled();
    api.getMySpaceAccessRequests.mockResolvedValue([]);
    await act(async () => button('actions.retry')!.click());
    await flush();
    expect(button('Submit')?.disabled).toBe(false);
  });

  it('records a successful pending request before refetch and prevents repeated submission', async () => {
    await render();
    await openRequest();
    const status = deferred<SpaceAccessRequest[]>();
    api.getMySpaceAccessRequests.mockReturnValue(status.promise);
    await act(async () => {
      const form = host.querySelector('form')!;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flush();
    expect(api.requestSpaceAccess).toHaveBeenCalledTimes(1);
    expect(api.requestSpaceAccess).toHaveBeenCalledWith('test-space', {
      requestedRole: 'VIEWER',
      justification: 'Review collaboration evidence',
    });
    expect(client.getQueryData(spaceDetailQueryKeys.pending(api.user))).toEqual([pendingRequest]);
    expect(button('actions.accessPending')?.disabled).toBe(true);
    await submit();
    expect(api.requestSpaceAccess).toHaveBeenCalledTimes(1);
    await act(async () => status.resolve([pendingRequest]));
    await flush();
    expect(host.querySelector('form')).toBeNull();
  });

  it('rechecks an ambiguous submission failure before allowing retry', async () => {
    client.setDefaultOptions({ queries: { retry: false }, mutations: { retry: 1, retryDelay: 0 } });
    await render();
    await openRequest();
    api.requestSpaceAccess.mockRejectedValue(new Error('Response lost after commit'));
    const status = deferred<SpaceAccessRequest[]>();
    api.getMySpaceAccessRequests.mockReturnValue(status.promise);
    await submit();
    expect(button('Submit')?.disabled).toBe(true);
    expect(api.getMySpaceAccessRequests).toHaveBeenCalledTimes(2);
    await act(async () => status.resolve([pendingRequest]));
    await flush();
    await submit();
    expect(api.requestSpaceAccess).toHaveBeenCalledTimes(1);
    expect(button('actions.accessPending')?.disabled).toBe(true);
    expect(button('Submit')?.disabled).toBe(true);
  });

  it('refreshes effective membership after an auto-approved request without marking it pending', async () => {
    await render();
    await openRequest();
    api.requestSpaceAccess.mockResolvedValue({ ...pendingRequest, status: 'APPROVED' });
    api.getSpace.mockResolvedValue(detail({ visibility: 'OPEN', memberRole: 'VIEWER' }));
    await submit();
    expect(api.requestSpaceAccess).toHaveBeenCalledTimes(1);
    expect(button('actions.requestAccess')).toBeUndefined();
    expect(button('actions.accessPending')).toBeUndefined();
    expect(host.querySelector('form')).toBeNull();
    expect(client.getQueryData(spaceDetailQueryKeys.pending(api.user))).toEqual([]);
    expect(api.toast.success).toHaveBeenCalledWith('access.joined');
  });

  it('writes saved policies only to the current identity detail cache', async () => {
    const next = { ...detail({ memberRole: 'OWNER' }), canManage: true };
    api.getSpace.mockResolvedValue(next);
    api.updateSpacePolicies.mockResolvedValue({ ...next, aiPolicy: 'DISABLED' });
    client.setQueryData(
      spaceDetailQueryKeys.detail('test-space', { tenantId: 2, userId: 42 }),
      detail({ nameEn: 'Other tenant' })
    );
    await render('owner');
    await act(async () => button('actions.savePolicies')!.click());
    await flush();
    expect(client.getQueryData(spaceDetailQueryKeys.detail('test-space', api.user))).toMatchObject({
      aiPolicy: 'DISABLED',
    });
    expect(
      client.getQueryData(spaceDetailQueryKeys.detail('test-space', { tenantId: 2, userId: 42 }))
    ).toMatchObject({ space: { nameEn: 'Other tenant' } });
    expect(client.getQueryData(['spaces', 'detail', 'test-space'])).toBeUndefined();
  });

  it.each([
    { tenantId: 1, userId: 43 },
    { tenantId: 2, userId: 42 },
  ])(
    'isolates detail, pending, content and members after changing identity to %j',
    async (nextIdentity) => {
      await render();
      await openRequest();
      // Legacy unscoped entries must never satisfy the new identity's queries.
      client.setQueryData(['spaces', 'detail', 'test-space'], detail({ nameEn: 'Legacy secret' }));
      client.setQueryData(['spaces', 'access-requests'], []);
      client.setQueryData(
        ['spaces', 'content', 'test-space'],
        [{ contentId: 'old', title: 'Legacy content' }]
      );
      client.setQueryData(
        ['spaces', 'members', 'test-space'],
        [{ membershipId: 'old', principalRef: 'Legacy member' }]
      );
      client.setQueryData(spaceDetailQueryKeys.content('test-space', api.user), [
        { contentId: 'old-scoped', title: 'Previous user content' },
      ]);
      client.setQueryData(spaceDetailQueryKeys.members('test-space', api.user), [
        { membershipId: 'old-scoped', principalRef: 'Previous user member' },
      ]);
      api.user = nextIdentity;
      const nextDetail = deferred<SpaceDetail>();
      const nextPending = deferred<SpaceAccessRequest[]>();
      api.getSpace.mockReturnValue(nextDetail.promise);
      api.getMySpaceAccessRequests.mockReturnValue(nextPending.promise);
      await render();
      expect(host.textContent).not.toContain('Test space');
      expect(host.textContent).not.toContain('Legacy secret');
      expect(host.querySelector('form')).toBeNull();
      await act(async () =>
        nextDetail.resolve({ ...detail({ nameEn: 'Next space' }), canModerate: true })
      );
      await flush();
      expect(host.textContent).toContain('Next space');
      expect(button('detail.accessStatusChecking')?.disabled).toBe(true);
      await act(async () => nextPending.resolve([pendingRequest]));
      await flush();
      expect(button('actions.accessPending')?.disabled).toBe(true);
      // Test the body queries separately with a valid member to expose both tabs.
      await act(async () =>
        client.setQueryData(spaceDetailQueryKeys.detail('test-space', api.user), {
          ...detail({ memberRole: 'MODERATOR' }),
          canModerate: true,
        })
      );
      const content = deferred<never[]>();
      api.getSpaceContent.mockReturnValue(content.promise);
      await render('content');
      expect(host.textContent).not.toContain('Legacy content');
      expect(host.textContent).not.toContain('Previous user content');
      expect(api.getSpaceContent).toHaveBeenCalledTimes(1);
      const members = deferred<never[]>();
      api.getSpaceMembers.mockReturnValue(members.promise);
      await render('people');
      expect(host.textContent).not.toContain('Legacy member');
      expect(host.textContent).not.toContain('Previous user member');
      expect(api.getSpaceMembers).toHaveBeenCalledTimes(1);
      await act(async () => {
        content.resolve([]);
        members.resolve([]);
      });
      expect(
        client.getQueryData(spaceDetailQueryKeys.detail('test-space', { tenantId: 1, userId: 42 }))
      ).toMatchObject({ space: { nameEn: 'Test space' } });
    }
  );

  it.each([
    { tenantId: 1, userId: 43 },
    { tenantId: 2, userId: 42 },
  ])(
    'isolates Owner Studio member, request and people-search data for %j',
    async (nextIdentity) => {
      const previousIdentity = { ...api.user };
      api.getSpace.mockResolvedValue({ ...detail({ memberRole: 'OWNER' }), canManage: true });
      api.getSpaceMembers.mockResolvedValue([
        {
          membershipId: 'member-1',
          principalType: 'USER',
          principalRef: 'Previous member',
          memberRole: 'VIEWER',
          membershipSource: 'DIRECT',
          lifecycleState: 'ACTIVE',
          validFrom: '2026-10-27T00:00:00Z',
          version: 1,
        },
      ]);
      api.getSpaceOwnerAccessRequests.mockResolvedValue([
        { ...pendingRequest, requesterName: 'Previous requester' },
      ]);
      api.listPeople.mockResolvedValue({
        items: [{ personId: 'person-1', displayName: 'Previous person' }],
      });
      await render('owner');
      expect(host.textContent).toContain('Previous member');
      expect(host.textContent).toContain('Previous requester');
      await act(async () => button('actions.addMember')!.click());
      await fillTextarea('Mina');
      expect(host.textContent).toContain('Previous person');

      api.user = nextIdentity;
      const members = deferred<never[]>();
      const requests = deferred<never[]>();
      api.getSpaceMembers.mockReturnValue(members.promise);
      api.getSpaceOwnerAccessRequests.mockReturnValue(requests.promise);
      await render('owner');
      expect(host.textContent).not.toContain('Previous member');
      expect(host.textContent).not.toContain('Previous requester');
      expect(host.textContent).not.toContain('Previous person');
      expect(host.querySelector('form')).toBeNull();
      await act(async () => {
        members.resolve([]);
        requests.resolve([]);
      });
      await flush();
      const people = deferred<{ items: { personId: string; displayName: string }[] }>();
      api.listPeople.mockReturnValue(people.promise);
      await act(async () => button('actions.addMember')!.click());
      await fillTextarea('Mina');
      expect(host.textContent).not.toContain('Previous person');
      expect(api.listPeople).toHaveBeenCalledTimes(2);
      await act(async () =>
        people.resolve({ items: [{ personId: 'person-2', displayName: 'Next person' }] })
      );
      await flush();
      expect(host.textContent).toContain('Next person');
      expect(
        client.getQueryData(spaceDetailQueryKeys.people('Mina', previousIdentity))
      ).toMatchObject({ items: [{ displayName: 'Previous person' }] });
      expect(client.getQueryData(spaceDetailQueryKeys.people('Mina', nextIdentity))).toMatchObject({
        items: [{ displayName: 'Next person' }],
      });
    }
  );

  it.each(['add', 'update', 'revoke', 'approve'] as const)(
    'refreshes the current Owner Studio caches after %s without invalidating another identity',
    async (action) => {
      const member = {
        membershipId: 'member-1',
        principalType: 'USER',
        principalRef: 'Existing member',
        memberRole: 'VIEWER',
        membershipSource: 'DIRECT',
        lifecycleState: 'ACTIVE',
        validFrom: '2026-10-27T00:00:00Z',
        version: 1,
      };
      api.getSpace.mockResolvedValue({ ...detail({ memberRole: 'OWNER' }), canManage: true });
      api.getSpaceMembers.mockResolvedValue([member]);
      api.getSpaceOwnerAccessRequests.mockResolvedValue([pendingRequest]);
      const otherIdentities = [
        { tenantId: 1, userId: 43 },
        { tenantId: 2, userId: 42 },
      ];
      for (const identity of otherIdentities) {
        client.setQueryData(spaceDetailQueryKeys.members('test-space', identity), []);
        client.setQueryData(spaceDetailQueryKeys.ownerRequests('test-space', identity), []);
        client.setQueryData(spaceDetailQueryKeys.detail('test-space', identity), detail());
      }
      await render('owner');
      api.getSpaceMembers.mockResolvedValue([{ ...member, principalRef: 'Refreshed member' }]);
      api.getSpaceOwnerAccessRequests.mockResolvedValue([]);
      if (action === 'add') {
        await act(async () => button('actions.addMember')!.click());
        await act(async () => button('principal.GROUP')!.click());
        await fillTextarea('TEAM_ALPHA');
        await submit();
        expect(api.saveSpaceMember).toHaveBeenCalledWith('test-space', {
          principalType: 'GROUP',
          principalRef: 'TEAM_ALPHA',
          memberRole: 'VIEWER',
          validUntil: null,
        });
      } else if (action === 'update') {
        await act(async () => {
          const role = host.querySelector<HTMLSelectElement>('select[aria-label="members.role"]')!;
          role.value = 'CONTRIBUTOR';
          role.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await act(async () => button('actions.save')!.click());
        expect(api.updateSpaceMember).toHaveBeenCalledWith('test-space', 'member-1', {
          memberRole: 'CONTRIBUTOR',
          validUntil: undefined,
          expectedVersion: 1,
        });
      } else if (action === 'revoke') {
        await act(async () => button('actions.revoke')!.click());
        await act(async () => button('Confirm')!.click());
        expect(api.revokeSpaceMember).toHaveBeenCalledWith('test-space', 'member-1');
      } else {
        await act(async () => button('actions.approve')!.click());
        await fillTextarea('Approved for collaboration');
        await submit();
        expect(api.decideSpaceAccessRequest).toHaveBeenCalledWith('test-space', 'request-1', {
          decision: 'APPROVE',
          note: 'Approved for collaboration',
          expectedVersion: 1,
        });
      }
      await flush();
      expect(api.getSpaceMembers).toHaveBeenCalledTimes(2);
      expect(api.getSpaceOwnerAccessRequests).toHaveBeenCalledTimes(2);
      expect(api.getSpace).toHaveBeenCalledTimes(2);
      expect(host.textContent).toContain('Refreshed member');
      expect(host.textContent).toContain('members.noRequests');
      for (const identity of otherIdentities) {
        expect(
          client.getQueryState(spaceDetailQueryKeys.members('test-space', identity))?.isInvalidated
        ).toBe(false);
        expect(
          client.getQueryState(spaceDetailQueryKeys.ownerRequests('test-space', identity))
            ?.isInvalidated
        ).toBe(false);
        expect(
          client.getQueryState(spaceDetailQueryKeys.detail('test-space', identity))?.isInvalidated
        ).toBe(false);
      }
    }
  );
});
