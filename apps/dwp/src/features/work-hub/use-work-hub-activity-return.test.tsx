// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useWorkHubActivityReturn } from './use-work-hub-activity-return';
import { recordWorkHubActivityReturnIntent } from './work-hub-activity-return';
import { hubItem } from './work-hub.test-support';

const itemKey = 'WORKSPACE:10420000-0000-0000-0000-000000000001:';
const itemVersion = 7;
const activityRoute =
  '/activity/timeline?objectType=WORK_ITEM&objectId=10420000-0000-0000-0000-000000000001';
const returnTo = `/work/queue?work=${encodeURIComponent(itemKey)}`;
const ownerFingerprint = `sha256:${'0'.repeat(64)}`;

const mocks = vi.hoisted(() => ({
  location: {
    pathname: '/work/queue',
    search: `?work=${encodeURIComponent('WORKSPACE:10420000-0000-0000-0000-000000000001:')}`,
    hash: '',
  },
  ownerKey: 'tenant:1:user:7:APP.ACTIVITY',
  permissions: [
    {
      resourceType: 'APP',
      resourceKey: 'APP.ACTIVITY',
      permissionCode: 'VIEW',
      effect: 'ALLOW',
    },
  ],
  refetch: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => mocks.location,
  useNavigate: () => mocks.navigate,
}));
vi.mock('@dwp-frontend/shared-utils/auth/use-permissions', () => ({
  usePermissions: () => ({ permissions: mocks.permissions }),
}));
vi.mock('./use-work-hub-operation-owner', () => ({
  useWorkHubOperationOwner: () => mocks.ownerKey,
}));

let host: HTMLDivElement;
let root: Root;

function Harness({ personal = false }: { personal?: boolean }) {
  const item = personal ? hubItem() : hubItem({ key: itemKey, version: itemVersion });
  const open = useWorkHubActivityReturn(item, true, mocks.refetch);
  return (
    <button
      type="button"
      data-work-activity-trigger={item.key}
      disabled={personal && !open}
      onClick={open}
    >
      Activity
    </button>
  );
}

async function render(personal = false) {
  await act(async () => root.render(<Harness personal={personal} />));
  await act(async () => Promise.resolve());
}

describe('Work Activity return focus hook', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal('crypto', {
      subtle: { digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer) },
    });
    window.sessionStorage.clear();
    mocks.navigate.mockReset();
    mocks.location = {
      pathname: '/work/queue',
      search: `?work=${encodeURIComponent(itemKey)}`,
      hash: '',
    };
    mocks.permissions[0]!.effect = 'ALLOW';
    window.history.replaceState({}, '', '/work/queue');
    mocks.refetch.mockReset();
    mocks.refetch.mockResolvedValue({
      isSuccess: true,
      isRefetchError: false,
      data: { snapshot: { items: [{ key: itemKey, version: itemVersion }] } },
    });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  it('focuses the exact trigger after a fresh snapshot confirms the same item version', async () => {
    expect(
      recordWorkHubActivityReturnIntent(
        { activityRoute, itemKey, itemVersion, ownerFingerprint, returnTo },
        window.sessionStorage
      )
    ).toBe(true);

    await render();

    expect(mocks.refetch).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(host.querySelector('[data-work-activity-trigger]'));
  });

  it('offers a Personal Work Activity action and restores its exact trigger after return', async () => {
    const item = hubItem();
    const personalReturn = `/work/queue?work=${encodeURIComponent(item.key)}`;
    window.history.replaceState({}, '', personalReturn);
    mocks.location.search = `?work=${encodeURIComponent(item.key)}`;
    await render(true);
    const button = host.querySelector('button')!;
    expect(button.disabled).toBe(false);
    await act(async () => button.click());
    expect(mocks.navigate).toHaveBeenCalledWith(
      `/activity/timeline?objectType=WORK_ITEM&objectId=${item.reference.sourceReference}&source=PERSONAL_TASK`
    );
    await act(async () => root.unmount());
    root = createRoot(host);
    mocks.refetch.mockResolvedValue({
      isSuccess: true,
      isRefetchError: false,
      data: { snapshot: { items: [item] } },
    });
    await render(true);
    expect(document.activeElement).toBe(host.querySelector('button'));
  });

  it('does not offer a Personal Work Activity action after an exact entitlement denial', async () => {
    mocks.permissions[0]!.effect = 'DENY';
    await render(true);
    const button = host.querySelector('button')!;
    expect(button.disabled).toBe(true);
    await act(async () => button.click());
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('does not restore focus from cached success data when the network refetch failed', async () => {
    mocks.refetch.mockResolvedValue({
      isSuccess: true,
      isRefetchError: true,
      data: { snapshot: { items: [{ key: itemKey, version: itemVersion }] } },
    });
    expect(
      recordWorkHubActivityReturnIntent({
        activityRoute,
        itemKey,
        itemVersion,
        ownerFingerprint,
        returnTo,
      })
    ).toBe(true);
    await render();
    expect(document.activeElement).not.toBe(host.querySelector('button'));
  });

  it('does not focus when the fresh snapshot reports a changed item version', async () => {
    mocks.refetch.mockResolvedValue({
      isSuccess: true,
      isRefetchError: false,
      data: { snapshot: { items: [{ key: itemKey, version: itemVersion + 1 }] } },
    });
    expect(
      recordWorkHubActivityReturnIntent(
        { activityRoute, itemKey, itemVersion, ownerFingerprint, returnTo },
        window.sessionStorage
      )
    ).toBe(true);

    await render();

    expect(mocks.refetch).toHaveBeenCalledTimes(1);
    expect(document.activeElement).not.toBe(host.querySelector('[data-work-activity-trigger]'));
  });
});
