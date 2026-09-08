// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useWorkHubActivityReturn } from './use-work-hub-activity-return';
import { recordWorkHubActivityReturnIntent } from './work-hub-activity-return';

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
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => mocks.location,
  useNavigate: () => vi.fn(),
}));
vi.mock('@dwp-frontend/shared-utils/auth/use-permissions', () => ({
  usePermissions: () => ({ permissions: mocks.permissions }),
}));
vi.mock('./use-work-hub-operation-owner', () => ({
  useWorkHubOperationOwner: () => mocks.ownerKey,
}));

let host: HTMLDivElement;
let root: Root;

function Harness() {
  useWorkHubActivityReturn({ key: itemKey, version: itemVersion }, true, mocks.refetch);
  return (
    <button type="button" data-work-activity-trigger={itemKey}>
      Activity
    </button>
  );
}

async function render() {
  await act(async () => root.render(<Harness />));
  await act(async () => Promise.resolve());
}

describe('Work Activity return focus hook', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal('crypto', {
      subtle: { digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer) },
    });
    window.sessionStorage.clear();
    mocks.refetch.mockReset();
    mocks.refetch.mockResolvedValue({
      isSuccess: true,
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

  it('does not focus when the fresh snapshot reports a changed item version', async () => {
    mocks.refetch.mockResolvedValue({
      isSuccess: true,
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
