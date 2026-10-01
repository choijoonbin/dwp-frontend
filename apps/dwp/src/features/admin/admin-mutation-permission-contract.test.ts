import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type PermissionContract = Readonly<{
  file: string;
  resource: string;
  codes: readonly ('MANAGE' | 'APPROVE')[];
  guardedHandler: string;
}>;

const PERMISSION_CONTRACTS: readonly PermissionContract[] = [
  {
    file: 'tenant-branding-manager.tsx',
    resource: 'ADMIN.TENANT_BRANDING',
    codes: ['MANAGE'],
    guardedHandler: 'if (!canWrite) return;',
  },
  {
    file: 'preference-exception-manager.tsx',
    resource: 'ADMIN.MANAGED_PREFERENCES',
    codes: ['MANAGE'],
    guardedHandler: 'if (!canManage || !selected || !decision) return;',
  },
  {
    file: 'localization-studio.tsx',
    resource: 'ADMIN.LOCALIZATION',
    codes: ['MANAGE'],
    guardedHandler: 'if (!canManage) return;',
  },
  {
    file: 'access-review-manager.tsx',
    resource: 'ADMIN.ACCESS_REVIEWS',
    codes: ['MANAGE', 'APPROVE'],
    guardedHandler: 'if (!canApprove || !selectedCampaign || !decisionItem) return;',
  },
  {
    file: 'role-governance-manager.tsx',
    resource: 'ADMIN.ACCESS_GOVERNANCE',
    codes: ['MANAGE'],
    guardedHandler: 'if (!canManage) return false;',
  },
  {
    file: 'access-manager.tsx',
    resource: 'ADMIN.IDENTITY_DIRECTORY',
    codes: ['MANAGE'],
    guardedHandler: 'if (!canManage || !selectedUser) return;',
  },
  {
    file: 'catalog-explorer.tsx',
    resource: 'ADMIN.PLATFORM_CATALOG',
    codes: ['MANAGE'],
    guardedHandler: 'if (!canManage) return;',
  },
  {
    file: 'reference-data-manager.tsx',
    resource: 'ADMIN.REFERENCE_DATA',
    codes: ['MANAGE'],
    guardedHandler: 'if (!canManage) return false;',
  },
  {
    file: 'registry-manager.tsx',
    resource: 'ADMIN.PLATFORM_REGISTRY',
    codes: ['MANAGE'],
    guardedHandler: 'if (!canManage) return false;',
  },
  {
    file: 'navigation-studio-manager.tsx',
    resource: 'ADMIN.NAVIGATION',
    codes: ['MANAGE'],
    guardedHandler: 'if (!canManage) return;',
  },
  {
    file: 'privileged-access-manager.tsx',
    resource: 'ADMIN.PRIVILEGED_ACCESS',
    codes: ['MANAGE', 'APPROVE'],
    guardedHandler: 'if (!canApprove) return false;',
  },
] as const;

function source(file: string): string {
  return fs
    .readFileSync(path.resolve(process.cwd(), 'apps/dwp/src/features/admin', file), 'utf8')
    .replace(/\s+/gu, ' ');
}

describe('admin mutation permission contracts', () => {
  it.each(PERMISSION_CONTRACTS)(
    'uses loaded exact permissions and a handler guard in $file',
    ({ file, resource, codes, guardedHandler }) => {
      const contents = source(file);

      expect(contents).toContain('usePermissions');
      expect(contents).toContain('isLoaded: permissionsLoaded');
      for (const code of codes) {
        expect(contents).toContain(`hasPermission('${resource}', '${code}')`);
      }
      expect(contents).toContain(guardedHandler);
      expect(contents).not.toContain('hasFullTenantAdminRole');
    }
  );

  it('propagates the exact decision into nested mutation controls', () => {
    expect(source('localization-studio.tsx')).toContain('editable={canManage}');
    expect(source('localization-studio-components.tsx')).toContain(
      "const editable = editableByPermission && revision.lifecycleState === 'DRAFT';"
    );

    expect(source('role-governance-manager.tsx')).toContain('canManage={canManage}');
    expect(source('role-assignment-columns.tsx')).toContain('disabled={busy || !canManage}');

    expect(source('catalog-explorer.tsx')).toContain('canManage={canManage}');
    expect(source('catalog-assurance-workspace.tsx')).toContain('disabled={!canManage}');

    expect(source('reference-data-manager.tsx')).toContain('canManage={canManage}');
    expect(source('reference-data-manager-view.tsx')).toContain('disabled={!canManage}');
  });
});
