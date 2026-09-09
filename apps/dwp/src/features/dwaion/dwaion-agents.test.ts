import { describe, expect, it } from 'vitest';

import type { AgentCatalogSource, PermissionDTO } from '@dwp-frontend/shared-utils';
import { hasSourcePermission } from './dwaion-agents';

const source: AgentCatalogSource = {
  sourceSystem: 'APPROVAL_TASK',
  displayName: { ko: '결재 업무', en: 'Approval tasks' },
  requiredPermissions: ['ACTION.APPROVAL_TASK:VIEW', 'ACTION.APPROVAL_TASK:MANAGE'],
  permissionMatch: 'ANY_OF',
  accessMode: 'READ_ONLY',
};

function grant(permissionCode: string, effect: PermissionDTO['effect'] = 'ALLOW'): PermissionDTO {
  return {
    resourceType: 'ACTION',
    resourceKey: 'ACTION.APPROVAL_TASK',
    permissionCode,
    effect,
  };
}

describe('agent catalog source permissions', () => {
  it('accepts any declared permission and gives an exact deny precedence', () => {
    expect(hasSourcePermission(source, [grant('MANAGE')])).toBe(true);
    expect(hasSourcePermission(source, [grant('VIEW'), grant('VIEW', 'DENY')])).toBe(false);
  });

  it('does not infer access from an unrelated application grant', () => {
    expect(
      hasSourcePermission(source, [
        {
          resourceType: 'APP',
          resourceKey: 'APP.APPROVALS',
          permissionCode: 'VIEW',
          effect: 'ALLOW',
        },
      ])
    ).toBe(false);
  });
});
