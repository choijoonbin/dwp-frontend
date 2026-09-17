import { describe, expect, it, vi } from 'vitest';

import { mailUserPermissionProjection } from './use-mail-user-permissions';

describe('mail user permission projection', () => {
  it.each([
    ['VIEW', { canView: true, canCreate: false, canUpdate: false, canSend: false }],
    ['CREATE', { canView: false, canCreate: true, canUpdate: false, canSend: false }],
    ['UPDATE', { canView: false, canCreate: false, canUpdate: true, canSend: false }],
    ['SEND', { canView: false, canCreate: false, canUpdate: false, canSend: true }],
  ] as const)('keeps %s authority independent', (permissionCode, expected) => {
    const hasPermission = vi.fn(
      (_resource: string, permission?: string) => permission === permissionCode
    );
    expect(mailUserPermissionProjection(true, hasPermission)).toMatchObject({
      ...expected,
      canDelete: false,
      canDecide: false,
    });
  });

  it('fails closed while permission evidence is loading and after authority is revoked', () => {
    const allowAll = vi.fn(() => true);
    expect(mailUserPermissionProjection(false, allowAll)).toMatchObject({
      canView: false,
      canCreate: false,
      canUpdate: false,
      canSend: false,
      canDelete: false,
      canDecide: false,
    });
    expect(allowAll).not.toHaveBeenCalled();

    const revoked = vi.fn(() => false);
    expect(mailUserPermissionProjection(true, revoked)).toMatchObject({
      canView: false,
      canCreate: false,
      canUpdate: false,
      canSend: false,
      canDelete: false,
      canDecide: false,
    });
  });
});
