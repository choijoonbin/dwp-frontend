import { describe, expect, it } from 'vitest';

import {
  approvalWorkReturnTarget,
  authorizedApprovalWorkReturnTarget,
} from './approval-return-target';

import type { PermissionDTO } from '@dwp-frontend/shared-utils';

function workPermission(
  effect: PermissionDTO['effect'],
  permissionCode: PermissionDTO['permissionCode'] = 'VIEW'
): PermissionDTO {
  return {
    resourceType: 'APP',
    resourceKey: 'APP.WORK',
    permissionCode,
    effect,
  };
}

describe('approval Work return target', () => {
  it('accepts only canonical internal Work destinations', () => {
    expect(approvalWorkReturnTarget('/work/queue?view=mine#task-42')).toBe(
      '/work/queue?view=mine#task-42'
    );
    expect(approvalWorkReturnTarget('/work')).toBe('/work');

    expect(approvalWorkReturnTarget('https://evil.test/work')).toBeNull();
    expect(approvalWorkReturnTarget('//evil.test/work')).toBeNull();
    expect(approvalWorkReturnTarget('/approvals/inbox')).toBeNull();
    expect(approvalWorkReturnTarget('/work/../admin')).toBeNull();
    expect(approvalWorkReturnTarget('/work\\queue')).toBeNull();
    expect(approvalWorkReturnTarget('/work/%5cadmin')).toBeNull();
    expect(approvalWorkReturnTarget('/work/%2e%2e/admin')).toBeNull();
    expect(approvalWorkReturnTarget('/work/queue\u0000')).toBeNull();
    expect(approvalWorkReturnTarget('/work/queue?filter=%0A')).toBeNull();
    expect(approvalWorkReturnTarget(`/work/${'a'.repeat(2_048)}`)).toBeNull();
  });

  it('requires current Work destination authority in addition to a canonical target', () => {
    expect(authorizedApprovalWorkReturnTarget('/work/queue', [])).toBeNull();
    expect(
      authorizedApprovalWorkReturnTarget('/work/queue', [workPermission('ALLOW', 'MANAGE')])
    ).toBeNull();
    expect(authorizedApprovalWorkReturnTarget('/work/queue', [workPermission('ALLOW')])).toBe(
      '/work/queue'
    );
    expect(
      authorizedApprovalWorkReturnTarget('https://evil.test/work', [workPermission('ALLOW')])
    ).toBeNull();
  });

  it('gives an exact Work VIEW denial precedence over an allow', () => {
    expect(
      authorizedApprovalWorkReturnTarget('/work/queue', [
        workPermission('ALLOW'),
        workPermission('DENY'),
      ])
    ).toBeNull();
  });
});
