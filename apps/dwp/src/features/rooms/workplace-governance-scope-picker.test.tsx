// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScopePicker } from './workplace-governance-scope-picker';
import { workplaceDelegatedTargetAllowed } from './workplace-delegated-target-permission';

const siteId = '10000000-0000-4000-8000-000000000001';
const floorId = '20000000-0000-4000-8000-000000000012';
const resourceId = '30000000-0000-4000-8000-000000000012';
const nativeResource = { resourceId, siteId, floorId, name: 'Canonical desk' };
const mocks = vi.hoisted(() => ({
  authority: 'A:0',
  allowedFloor: '20000000-0000-4000-8000-000000000012',
  resources: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@dwp-frontend/shared-utils', () => ({
  useAuth: () => ({ user: { tenantId: 1, userId: 2 } }),
  usePermissionsStore: (selector: (value: { permissions: never[] }) => unknown) =>
    selector({ permissions: [] }),
  getWorkplaceAdminSites: async () => [{ siteId, name: 'Canonical site' }],
  getWorkplaceAdminFloors: async () => [{ floorId, siteId, name: 'Canonical floor' }],
  getWorkplaceGovernanceZones: async () => [],
  getWorkplaceGovernanceCampuses: async () => [],
  getWorkplaceAdminResources: mocks.resources,
  HttpError: class extends Error {
    status = 403;
  },
}));
vi.mock('./workplace-governance-target-scope', () => ({
  useWorkplaceGovernanceTargetScope: () => ({
    ready: true,
    globalAdministrator: false,
    authorityKey: mocks.authority,
    allowsTarget: (
      permission: Parameters<typeof workplaceDelegatedTargetAllowed>[1],
      site: string,
      floor: string | null = null
    ) =>
      workplaceDelegatedTargetAllowed(
        [
          {
            delegationId: '60000000-0000-4000-8000-000000000001',
            scopeType: 'SITE',
            scopeId: siteId,
            permissions: ['POLICY_MANAGE'],
            floorIds: [mocks.allowedFloor],
            validUntil: null,
          },
        ],
        permission,
        site,
        floor
      ),
  }),
}));
vi.mock('@dwp-frontend/design-system', () => ({
  SelectField: ({
    label,
    value,
    options,
    disabled,
    onValueChange,
  }: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    disabled: boolean;
    onValueChange: (value: string) => void;
  }) => (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      <option value="" />
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
const observed = vi.fn();
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
async function render() {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <ScopePicker
          scopeType="RESOURCE"
          scopeId={resourceId}
          disabled
          targetPermission="POLICY_MANAGE"
          allowedScopeTypes={['FLOOR', 'ZONE', 'RESOURCE']}
          onChange={vi.fn()}
          onTargetChange={observed}
        />
      </QueryClientProvider>
    )
  );
  // Each query is enabled by the preceding native parent response.
  for (let parentStep = 0; parentStep < 6; parentStep += 1) await flush();
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  mocks.authority = 'A:0';
  mocks.allowedFloor = floorId;
  mocks.resources.mockResolvedValue([nativeResource]);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  client.clear();
  vi.clearAllMocks();
});

describe('canonical native policy targets', () => {
  it('maps a resource only through its actual native site and floor', async () => {
    await render();
    expect(observed.mock.lastCall).toEqual([{ siteId, floorId }, true]);
    expect(mocks.resources).toHaveBeenCalledWith(floorId);
  });
  it.each([
    {
      name: 'another site',
      data: [{ ...nativeResource, siteId: '10000000-0000-4000-8000-000000000002' }],
    },
    {
      name: 'another floor',
      data: [{ ...nativeResource, floorId: '20000000-0000-4000-8000-000000000013' }],
    },
    { name: 'duplicate native identifiers', data: [nativeResource, nativeResource] },
  ])('closes a resource producer with $name without a whole-site fallback', async ({ data }) => {
    mocks.resources.mockResolvedValue(data);
    await render();
    expect(observed.mock.lastCall).toEqual([null, false]);
  });
  it('ignores an old resource completion after authority A→B→A', async () => {
    let complete!: (value: (typeof nativeResource)[]) => void;
    mocks.resources.mockImplementationOnce(
      () =>
        new Promise<(typeof nativeResource)[]>((resolve) => {
          complete = resolve;
        })
    );
    await render();
    expect(observed.mock.lastCall?.[1]).toBe(false);
    mocks.authority = 'B:1';
    mocks.allowedFloor = '20000000-0000-4000-8000-000000000013';
    await render();
    expect(observed.mock.lastCall?.[1]).toBe(false);
    mocks.authority = 'A:2';
    mocks.allowedFloor = floorId;
    mocks.resources.mockResolvedValue([{ ...nativeResource, name: 'New canonical desk' }]);
    await render();
    expect(observed.mock.lastCall).toEqual([{ siteId, floorId }, true]);
    await act(async () => complete([{ ...nativeResource, name: 'Old completion' }]));
    await flush();
    expect(document.body.textContent).toContain('New canonical desk');
    expect(document.body.textContent).not.toContain('Old completion');
    expect(observed.mock.lastCall).toEqual([{ siteId, floorId }, true]);
  });
});
