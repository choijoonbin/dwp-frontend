// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type {
  WorkplaceGovernanceEffectiveDelegatedScope,
  WorkplaceResource,
} from '@dwp-frontend/shared-utils';
import { useWorkplaceGovernanceCapabilities } from './rooms-capabilities';
import { WorkplaceResourceClosurePanel } from './workplace-resource-closure-panel';

const api = vi.hoisted(() => ({
  effective: vi.fn(),
  resources: vi.fn(),
  closures: vi.fn(),
  impact: vi.fn(),
  create: vi.fn(),
}));
const principal = vi.hoisted(() => ({ roles: ['SITE_ADMIN'] }));
const controls = vi.hoisted(() => ({
  reason: (_event: { target: { value: string } }) => {},
  confirm: (_event: { target: { checked: boolean } }) => {},
}));
vi.mock('@dwp-frontend/shared-utils', async () => ({
  HttpError: (await import('@dwp-frontend/shared-utils/http-error')).HttpError,
  hasFullTenantAdminRole: (await import('@dwp-frontend/shared-utils/auth/control-plane-access'))
    .hasFullTenantAdminRole,
  useAuth: () => ({ user: { tenantId: 1, userId: 900018, roles: principal.roles } }),
  usePermissions: () => ({
    isLoaded: true,
    hasPermission: (key: string) => key === 'ADMIN.WORKPLACE',
  }),
  getWorkplaceGovernanceEffectiveDelegatedScopes: api.effective,
  getWorkplaceAdminResources: api.resources,
  getWorkplaceResourceClosures: api.closures,
  getWorkplaceFutureBookingImpact: api.impact,
  createWorkplaceResourceClosure: api.create,
  getWorkplaceResourceClosure: vi.fn(),
  getWorkplaceRoomBookingImpact: vi.fn(),
  cancelWorkplaceResourceClosure: vi.fn(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'en' } }),
}));
vi.mock('./workplace-experience-authority', () => ({
  useWorkplaceExperienceAuthority: () => 'trusted-principal',
}));
vi.mock('./workplace-admin-experience-ui', () => ({
  WorkplaceAdminSection: ({ children }: { children: ReactNode }) =>
    createElement('section', null, children),
}));
vi.mock('./workplace-experience-booking-inspector', () => ({
  WorkplaceExperienceBookingInspector: () => null,
}));
vi.mock('./workplace-experience-ui', () => ({
  WorkplaceExperienceQueryError: () => createElement('div', null, 'source-error'),
}));
vi.mock('@mui/material/Checkbox', () => ({
  default: (props: { checked: boolean; disabled: boolean; onChange: typeof controls.confirm }) => {
    controls.confirm = props.onChange;
    return createElement('input', { type: 'checkbox', ...props });
  },
}));
vi.mock('@dwp-frontend/design-system', () => ({
  DwpDateTimeProvider: ({ children }: { children: ReactNode }) => children,
  InlineFeedback: ({ children }: { children: ReactNode }) => createElement('div', null, children),
  DateTimePickerField: ({
    value,
    label,
    disabled,
  }: {
    value: string | null;
    label: string;
    disabled: boolean;
  }) =>
    createElement('input', { value: value ?? '', 'aria-label': label, disabled, readOnly: true }),
  FormField: (props: {
    label: string;
    value: string;
    disabled: boolean;
    onChange: typeof controls.reason;
  }) => {
    controls.reason = props.onChange;
    return createElement('input', {
      'aria-label': props.label,
      value: props.value,
      disabled: props.disabled,
      onChange: props.onChange,
    });
  },
  ActionButton: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick: () => void;
    disabled: boolean;
  }) => createElement('button', { onClick, disabled }, children),
}));

const siteId = '10000000-0000-4000-8000-000000000001';
const floorId = '20000000-0000-4000-8000-000000000001';
const otherFloorId = '20000000-0000-4000-8000-000000000002';
const resourceId = '30000000-0000-4000-8000-000000000001';
const resource = {
  siteId,
  floorId,
  resourceId,
  name: 'Canonical desk',
  type: 'DESK',
  calendarResourceId: null,
  version: 5,
} as WorkplaceResource;
const epoch = Date.parse('2026-09-14T00:00:00Z');
const scope = (
  id: string,
  permission: 'CATALOG_VIEW' | 'CATALOG_MANAGE',
  floor: string,
  validUntil: string | null = null
): WorkplaceGovernanceEffectiveDelegatedScope => ({
  delegationId: id,
  scopeType: 'SITE',
  scopeId: siteId,
  permissions: [permission],
  floorIds: [floor],
  validUntil,
});
const retained = () => [
  scope('view-first', 'CATALOG_VIEW', floorId),
  scope('manage-second', 'CATALOG_MANAGE', otherFloorId),
];
const page = () => ({
  content: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
  generatedAt: '2026-09-14T00:00:00Z',
  countsScope: 'FLOORS',
  allowedFloorIds: [floorId],
});
let root: Root, container: HTMLDivElement, client: QueryClient;
let observed: ReturnType<typeof useWorkplaceGovernanceCapabilities>;
function Probe() {
  observed = useWorkplaceGovernanceCapabilities();
  return null;
}
const advance = async (milliseconds: number) => {
  await act(async () => vi.advanceTimersByTimeAsync(milliseconds));
};
const settle = async () => {
  for (let index = 0; index < 8; index += 1) await advance(1);
};
const render = async (withPanel = true) => {
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(Probe),
        withPanel
          ? createElement(WorkplaceResourceClosurePanel, { resource, timeZone: 'Asia/Seoul' })
          : null
      )
    )
  );
  await settle();
};
const action = () =>
  [...container.querySelectorAll('button')].find(
    (button) => button.textContent === 'workplace.experience.closureCreate'
  )!;
const checkbox = () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
const reason = () =>
  container.querySelector<HTMLInputElement>(
    'input[aria-label="workplace.experience.closureReason"]'
  )!;
const confirm = async () => {
  await act(async () =>
    controls.reason({ target: { value: 'Maintenance inside the current delegated floor' } })
  );
  await act(async () => controls.confirm({ target: { checked: true } }));
  expect(action().disabled).toBe(false);
  expect(checkbox().checked).toBe(true);
};
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.setSystemTime(epoch);
  vi.clearAllMocks();
  principal.roles = ['SITE_ADMIN'];
  api.resources.mockResolvedValue([resource]);
  api.closures.mockResolvedValue(page());
  api.impact.mockImplementation(
    async (_site: string, _resource: string, from: string, to: string) => ({
      siteId,
      resourceId,
      from,
      to,
      metadata: { availability: 'EMPTY' },
      affectedBookings: page(),
    })
  );
  api.effective.mockResolvedValue([
    scope('manage-first', 'CATALOG_MANAGE', floorId),
    ...retained(),
  ]);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  vi.useRealTimers();
});

it('closes the actual idle floor action and confirmation at validUntil without a click, focus or poll', async () => {
  api.effective.mockResolvedValue([
    scope('manage-first', 'CATALOG_MANAGE', floorId, new Date(epoch + 5_000).toISOString()),
    ...retained(),
  ]);
  await render();
  await confirm();
  expect(api.effective).toHaveBeenCalledTimes(1);
  await advance(epoch + 4_999 - Date.now());
  expect(action().disabled).toBe(false);
  expect(checkbox().checked).toBe(true);
  await advance(1);
  expect(observed.effectiveScopes.map((item) => item.delegationId)).toEqual([
    'view-first',
    'manage-second',
  ]);
  expect(observed.allowsTarget('CATALOG_VIEW', siteId, floorId)).toBe(true);
  expect(observed.allowsTarget('CATALOG_MANAGE', siteId, floorId)).toBe(false);
  expect(observed.allowsTarget('CATALOG_MANAGE', siteId, otherFloorId)).toBe(true);
  expect(action().disabled).toBe(true);
  expect(checkbox().checked).toBe(false);
  expect(reason().value).toBe('');
  expect(api.effective).toHaveBeenCalledTimes(1);
  expect(api.create).not.toHaveBeenCalled();
});

it('observes out-of-band revocation on the 10s poll and clears the stale actual action and confirmation', async () => {
  await render();
  await confirm();
  api.effective.mockResolvedValue(retained());
  await advance(epoch + 9_999 - Date.now());
  expect(api.effective).toHaveBeenCalledTimes(1);
  expect(action().disabled).toBe(false);
  expect(checkbox().checked).toBe(true);
  await advance(1);
  await settle();
  expect(api.effective).toHaveBeenCalledTimes(2);
  expect(observed.hierarchy.canManage).toBe(true);
  expect(observed.allowsTarget('CATALOG_MANAGE', siteId, floorId)).toBe(false);
  expect(observed.allowsTarget('CATALOG_MANAGE', siteId, otherFloorId)).toBe(true);
  expect(action().disabled).toBe(true);
  expect(checkbox().checked).toBe(false);
  expect(reason().value).toBe('');
  expect(api.create).not.toHaveBeenCalled();
});

it('keeps idle permission-specific floor unions separate and never promotes them to site-wide authority', async () => {
  api.effective.mockResolvedValue(retained());
  await render(false);
  expect(observed.allowsTarget('CATALOG_VIEW', siteId, floorId)).toBe(true);
  expect(observed.allowsTarget('CATALOG_VIEW', siteId, otherFloorId)).toBe(true);
  expect(observed.allowsTarget('CATALOG_MANAGE', siteId, floorId)).toBe(false);
  expect(observed.allowsTarget('CATALOG_MANAGE', siteId, otherFloorId)).toBe(true);
  expect(observed.allowsTarget('CATALOG_VIEW', siteId, null)).toBe(false);
  expect(observed.allowsTarget('CATALOG_MANAGE', siteId, null)).toBe(false);
});

it('never queries or polls effective delegated scopes for a native global administrator', async () => {
  principal.roles = ['TENANT_ADMIN'];
  await render(false);
  await advance(60_000);
  expect(observed.isLoaded).toBe(true);
  expect(observed.globalAdministrator).toBe(true);
  expect(api.effective).not.toHaveBeenCalled();
});
