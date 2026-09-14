// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkplaceSiteDialog, WorkplaceFloorDialog } from './workplace-admin-dialogs';
import { workplaceDelegatedTargetAllowed } from './workplace-delegated-target-permission';
import type {
  WorkplaceSite,
  WorkplaceFloor,
  WorkplaceGovernanceEffectiveDelegatedScope,
} from '@dwp-frontend/shared-utils';

const mocks = vi.hoisted(() => ({
  identity: 1,
  global: true,
  canWrite: true,
  scopes: [] as WorkplaceGovernanceEffectiveDelegatedScope[],
  floorSave: vi.fn(),
  save: vi.fn(),
  close: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./rooms-capabilities', () => ({
  useRoomsCapabilities: () => ({
    isLoaded: true,
    canViewWorkplaceAdmin: true,
    canCreateWorkplaceAdmin: mocks.canWrite,
    canUpdateWorkplaceAdmin: mocks.canWrite,
  }),
  useWorkplaceGovernanceCapabilities: () => ({
    isLoaded: true,
    isError: false,
    globalAdministrator: mocks.global,
    effectiveScopes: mocks.scopes,
    hierarchy: { canView: true, canManage: mocks.canWrite },
    floorPlans: { canView: true, canManage: mocks.canWrite },
    allowsTarget: (
      permission: Parameters<typeof workplaceDelegatedTargetAllowed>[1],
      siteId: string,
      floorId: string | null = null
    ) => mocks.global || workplaceDelegatedTargetAllowed(mocks.scopes, permission, siteId, floorId),
  }),
}));
vi.mock('@dwp-frontend/shared-utils', () => ({
  useAuth: () => ({ user: { tenantId: 1, userId: mocks.identity } }),
  useToast: () => ({ success: mocks.success, error: mocks.error }),
  saveWorkplaceSite: mocks.save,
  saveWorkplaceFloor: mocks.floorSave,
  saveWorkplaceResource: vi.fn(),
  listPeople: vi.fn(),
  HttpError: class extends Error {
    status = 500;
  },
}));
const site: WorkplaceSite = {
  siteId: '10000000-0000-4000-8000-000000000001',
  code: 'PANGYO',
  name: 'Pangyo',
  nameKo: '판교',
  nameEn: 'Pangyo',
  type: 'HEADQUARTERS',
  address: null,
  timeZone: 'Asia/Seoul',
  totalFloorCount: 1,
  configuredFloorCount: 1,
  resourceCount: 0,
  state: 'ACTIVE',
  version: 3,
};
const dialog = (client: QueryClient, open: boolean) => (
  <QueryClientProvider client={client}>
    <WorkplaceSiteDialog open={open} site={site} commandSourceReady onClose={mocks.close} />
  </QueryClientProvider>
);
let root: Root;
let container: HTMLDivElement;
const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};
const render = async (client: QueryClient, open: boolean) => {
  await act(async () => root.render(dialog(client, open)));
  await flush();
};
function nameField() {
  const label = Array.from(document.querySelectorAll('label')).find((item) =>
    item.textContent?.startsWith('workplace.admin.locations.nameKo')
  );
  const input = label && document.getElementById(label.htmlFor);
  if (!(input instanceof HTMLInputElement)) throw new Error('Name field is unavailable');
  return input;
}
function saveButton() {
  const button = Array.from(document.querySelectorAll('button')).find(
    (item) => item.textContent === 'actions.save'
  );
  if (!button) throw new Error('Save action is unavailable');
  return button;
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllMocks();
  mocks.identity = 1;
  mocks.global = true;
  mocks.canWrite = true;
  mocks.scopes = [];
});

async function pendingSave() {
  let complete!: (value: WorkplaceSite) => void;
  mocks.save.mockImplementationOnce(
    () =>
      new Promise<WorkplaceSite>((resolve) => {
        complete = resolve;
      })
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await render(client, true);
  expect(nameField().value).toBe('판교');
  await act(async () => saveButton().click());
  await flush();
  expect(mocks.save).toHaveBeenCalledTimes(1);
  return { client, complete };
}

describe('catalog dialog command scopes', () => {
  it('closes the saved draft before query refresh can temporarily withdraw its source', async () => {
    const { client, complete } = await pendingSave();
    let finishRefresh!: () => void;
    vi.spyOn(client, 'invalidateQueries').mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishRefresh = resolve;
        })
    );
    await act(async () => complete({ ...site, version: 4 }));
    await flush();
    expect(mocks.save.mock.calls[0][1]).toMatchObject({ version: 3, nameKo: '판교' });
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.success).toHaveBeenCalledTimes(1);
    await render(client, false);
    await act(async () => finishRefresh());
    await flush();
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });
  it('does not close or replace a newly reopened draft when an earlier save completes', async () => {
    const { client, complete } = await pendingSave();
    await render(client, false);
    await render(client, true);
    expect(nameField().value).toBe('판교');
    // The new draft is independent; the old pending command keeps its controls closed until settlement.
    await act(async () => complete({ ...site, nameKo: '이전 저장', version: 4 }));
    await flush();
    expect(saveButton().disabled).toBe(false);
    expect(nameField().value).toBe('판교');
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
  it('ignores a save result after the active identity changes', async () => {
    const { client, complete } = await pendingSave();
    mocks.identity = 2;
    await render(client, true);
    await act(async () => complete({ ...site, nameKo: '이전 사용자 저장', version: 4 }));
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(nameField().value).toBe('판교');
  });
});

const permittedFloor: WorkplaceFloor = {
  floorId: '20000000-0000-4000-8000-000000000012',
  siteId: site.siteId,
  siteName: site.name,
  floorNumber: 12,
  name: '12F',
  nameKo: '12층',
  nameEn: '12F',
  planWidth: 1200,
  planHeight: 760,
  backgroundAssetPath: null,
  state: 'ACTIVE',
  resourceCount: 1,
  version: 4,
};
const otherFloorId = '20000000-0000-4000-8000-000000000013';
function delegated(floorIds: string[]): WorkplaceGovernanceEffectiveDelegatedScope[] {
  return [
    {
      delegationId: '60000000-0000-4000-8000-000000000001',
      scopeType: 'SITE',
      scopeId: site.siteId,
      permissions: ['CATALOG_MANAGE'],
      validUntil: null,
      floorIds,
    },
  ];
}
async function renderFloor(
  client: QueryClient,
  floor: WorkplaceFloor | null = permittedFloor,
  sourceReady = true
) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <WorkplaceFloorDialog
          open
          siteId={site.siteId}
          floor={floor}
          commandSourceReady={sourceReady}
          onClose={mocks.close}
        />
      </QueryClientProvider>
    )
  );
  await flush();
}
const clientForTarget = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

describe('native floor-restricted catalog targets', () => {
  it('keeps an unknown site total blank and closes site-wide or new-floor mutation', async () => {
    mocks.global = false;
    mocks.scopes = delegated([permittedFloor.floorId]);
    const client = clientForTarget();
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <WorkplaceSiteDialog
            open
            site={{
              ...site,
              totalFloorCount: null,
              countsScope: 'FLOORS',
              allowedFloorIds: [permittedFloor.floorId],
            }}
            commandSourceReady
            onClose={mocks.close}
          />
        </QueryClientProvider>
      )
    );
    await flush();
    const label = Array.from(document.querySelectorAll('label')).find(
      (item) => item.textContent === 'workplace.admin.locations.floorCount'
    );
    const input = label && document.getElementById(label.htmlFor);
    expect(input).toBeInstanceOf(HTMLInputElement);
    expect((input as HTMLInputElement).value).toBe('');
    expect(saveButton().disabled).toBe(true);
    await act(async () => saveButton().click());
    expect(mocks.save).not.toHaveBeenCalled();
    await renderFloor(client, null);
    expect(saveButton().disabled).toBe(true);
    await act(async () => saveButton().click());
    expect(mocks.floorSave).not.toHaveBeenCalled();
  });
  it('allows the canonical permitted floor while closing other floors and unavailable authority', async () => {
    mocks.global = false;
    mocks.scopes = delegated([permittedFloor.floorId]);
    const client = clientForTarget();
    await renderFloor(client, { ...permittedFloor, floorId: otherFloorId });
    expect(saveButton().disabled).toBe(true);
    await renderFloor(client, permittedFloor, false);
    expect(saveButton().disabled).toBe(true);
    await renderFloor(client);
    expect(saveButton().disabled).toBe(false);
    mocks.floorSave.mockResolvedValueOnce({ ...permittedFloor, version: 5 });
    await act(async () => saveButton().click());
    await flush();
    expect(mocks.floorSave).toHaveBeenCalledWith(
      site.siteId,
      permittedFloor.floorId,
      expect.objectContaining({ version: 4, nameKo: '12층' })
    );
  });
  it('does not publish an old completion after delegated floor A→B→A', async () => {
    mocks.global = false;
    mocks.scopes = delegated([permittedFloor.floorId]);
    const client = clientForTarget();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    let complete!: (value: WorkplaceFloor) => void;
    mocks.floorSave.mockImplementationOnce(
      () =>
        new Promise<WorkplaceFloor>((resolve) => {
          complete = resolve;
        })
    );
    await renderFloor(client);
    await act(async () => saveButton().click());
    await flush();
    expect(mocks.floorSave).toHaveBeenCalledTimes(1);
    mocks.scopes = delegated([otherFloorId]);
    await renderFloor(client);
    expect(saveButton().disabled).toBe(true);
    mocks.scopes = delegated([permittedFloor.floorId]);
    await renderFloor(client);
    await act(async () =>
      complete({ ...permittedFloor, nameKo: 'Old completed draft', version: 5 })
    );
    await flush();
    expect(nameField().value).toBe('12층');
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
  it('retains UNKNOWN without a second dispatch and never substitutes target scope for action RBAC', async () => {
    mocks.global = false;
    mocks.scopes = delegated([permittedFloor.floorId]);
    const client = clientForTarget();
    mocks.canWrite = false;
    await renderFloor(client);
    expect(saveButton().disabled).toBe(true);
    mocks.canWrite = true;
    await renderFloor(client);
    mocks.floorSave.mockRejectedValueOnce(new Error('The native response was lost.'));
    await act(async () => saveButton().click());
    await flush();
    expect(saveButton().disabled).toBe(true);
    expect(document.body.textContent).toContain('workplace.experience.changeUnknown');
    await act(async () => saveButton().click());
    await flush();
    expect(mocks.floorSave).toHaveBeenCalledTimes(1);
    expect(mocks.close).not.toHaveBeenCalled();
  });
});
