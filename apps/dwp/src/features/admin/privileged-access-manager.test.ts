import { describe, expect, it, vi } from 'vitest';

import { resolvePrivilegedAccessCapabilities } from './privileged-access-manager';

describe('privileged access manager capabilities', () => {
  it('fails closed until the permission projection is loaded', () => {
    const hasPermission = vi.fn(() => true);

    expect(resolvePrivilegedAccessCapabilities(false, hasPermission)).toEqual({
      canManage: false,
      canApprove: false,
    });
    expect(hasPermission).not.toHaveBeenCalled();
  });

  it('keeps management and approval authority independent', () => {
    const approver = vi.fn(
      (resourceKey: string, permissionCode: string) =>
        resourceKey === 'ADMIN.PRIVILEGED_ACCESS' && permissionCode === 'APPROVE'
    );
    const manager = vi.fn(
      (resourceKey: string, permissionCode: string) =>
        resourceKey === 'ADMIN.PRIVILEGED_ACCESS' && permissionCode === 'MANAGE'
    );

    expect(resolvePrivilegedAccessCapabilities(true, approver)).toEqual({
      canManage: false,
      canApprove: true,
    });
    expect(resolvePrivilegedAccessCapabilities(true, manager)).toEqual({
      canManage: true,
      canApprove: false,
    });

    expect(approver).toHaveBeenCalledWith('ADMIN.PRIVILEGED_ACCESS', 'MANAGE');
    expect(approver).toHaveBeenCalledWith('ADMIN.PRIVILEGED_ACCESS', 'APPROVE');
    expect(manager).toHaveBeenCalledWith('ADMIN.PRIVILEGED_ACCESS', 'MANAGE');
    expect(manager).toHaveBeenCalledWith('ADMIN.PRIVILEGED_ACCESS', 'APPROVE');
  });
});
