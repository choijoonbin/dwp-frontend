// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  current: { isLoading: true, isAuthenticated: false, user: null as object | null },
}));
const permissionState = vi.hoisted(() => ({
  loaded: false,
  permissions: [] as unknown[],
}));
const ownerState = vi.hoisted(() => ({ current: null as string | null }));
const boundary = vi.hoisted(() => ({
  clear: vi.fn(),
  read: vi.fn(),
  fingerprint: vi.fn((owner: string) => Promise.resolve(`fingerprint:${owner}`)),
}));

vi.mock('@dwp-frontend/shared-utils/auth/auth-provider', () => ({
  useAuth: () => authState.current,
}));
vi.mock('@dwp-frontend/shared-utils/auth/use-permissions', () => ({
  usePermissions: () => ({
    isLoaded: permissionState.loaded,
    permissions: permissionState.permissions,
  }),
}));
vi.mock('@dwp-frontend/shared-utils/api/work-hub-calendar-api', () => ({
  workCalendarOwnerFingerprint: boundary.fingerprint,
}));
vi.mock('../features/calendar/calendar-work-handoff', () => ({
  readCalendarWorkHandoffRecovery: boundary.read,
}));
vi.mock('../features/calendar/calendar-work-handoff-recovery-storage', () => ({
  clearCalendarWorkHandoffRecovery: boundary.clear,
}));
vi.mock('./use-work-hub-operation-owner', () => ({
  useWorkHubOperationOwner: () => ownerState.current,
}));

import { CalendarWorkHandoffSessionGuard } from './calendar-work-handoff-session-guard';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe('Calendar Work handoff session guard', () => {
  let container: HTMLDivElement;
  let removeSessionItem: ReturnType<typeof vi.spyOn>;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    removeSessionItem = vi.spyOn(Storage.prototype, 'removeItem');
    authState.current = { isLoading: true, isAuthenticated: false, user: null };
    permissionState.loaded = false;
    permissionState.permissions = [];
    ownerState.current = null;
    boundary.clear.mockReset();
    boundary.read.mockReset();
    boundary.fingerprint.mockClear();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    removeSessionItem.mockRestore();
    container.remove();
  });

  async function render() {
    await act(async () => root.render(<CalendarWorkHandoffSessionGuard />));
  }

  it('preserves bootstrap state and revalidates every settled full-owner scope', async () => {
    await render();
    expect(boundary.read).not.toHaveBeenCalled();
    expect(boundary.clear).not.toHaveBeenCalled();
    expect(removeSessionItem).not.toHaveBeenCalled();

    const granted = [{ resourceKey: 'APP.WORK', permissionCode: 'UPDATE' }];
    authState.current = { isLoading: false, isAuthenticated: true, user: {} };
    permissionState.loaded = true;
    permissionState.permissions = granted;
    ownerState.current = 'full-owner-scope-a';
    await render();
    await vi.waitFor(() =>
      expect(boundary.read).toHaveBeenCalledWith(granted, 'fingerprint:full-owner-scope-a', true)
    );

    // The identity is unchanged, but revoked permissions produce a new full Work owner scope.
    permissionState.permissions = [];
    ownerState.current = 'full-owner-scope-b';
    await render();
    await vi.waitFor(() =>
      expect(boundary.read).toHaveBeenLastCalledWith([], 'fingerprint:full-owner-scope-b', true)
    );

    authState.current = { isLoading: false, isAuthenticated: false, user: null };
    ownerState.current = null;
    await render();
    expect(boundary.clear).toHaveBeenCalledOnce();
    expect(removeSessionItem).toHaveBeenCalledWith('dwp.calendar.work-document-handoff.v1');
  });

  it('clears both tab-local receipts when the settled owner cannot be fingerprinted', async () => {
    authState.current = { isLoading: false, isAuthenticated: true, user: {} };
    permissionState.loaded = true;
    permissionState.permissions = [{ resourceKey: 'APP.WORK', permissionCode: 'UPDATE' }];
    ownerState.current = 'unhashable-owner';
    boundary.fingerprint.mockRejectedValueOnce(new Error('crypto unavailable'));

    await render();
    await vi.waitFor(() => expect(boundary.clear).toHaveBeenCalledOnce());
    expect(removeSessionItem).toHaveBeenCalledWith('dwp.calendar.work-document-handoff.v1');
    expect(boundary.read).not.toHaveBeenCalled();
  });
});
