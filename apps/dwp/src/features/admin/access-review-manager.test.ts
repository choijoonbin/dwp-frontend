import { describe, expect, it, vi } from 'vitest';

import { resolveAccessReviewCapabilities } from './access-review-manager';

describe('access review manager capabilities', () => {
  it('fails closed until exact permissions are loaded', () => {
    const hasPermission = vi.fn(() => true);

    expect(resolveAccessReviewCapabilities(false, hasPermission)).toEqual({
      canManage: false,
      canApprove: false,
    });
    expect(hasPermission).not.toHaveBeenCalled();
  });

  it('keeps campaign management and item approval independent', () => {
    const approver = vi.fn(
      (resourceKey: string, permissionCode: string) =>
        resourceKey === 'ADMIN.ACCESS_REVIEWS' && permissionCode === 'APPROVE'
    );
    const manager = vi.fn(
      (resourceKey: string, permissionCode: string) =>
        resourceKey === 'ADMIN.ACCESS_REVIEWS' && permissionCode === 'MANAGE'
    );

    expect(resolveAccessReviewCapabilities(true, approver)).toEqual({
      canManage: false,
      canApprove: true,
    });
    expect(resolveAccessReviewCapabilities(true, manager)).toEqual({
      canManage: true,
      canApprove: false,
    });
  });
});
