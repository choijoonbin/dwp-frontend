import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type DisclosureBinding = Readonly<{
  file: string;
  capability: string;
  expected: string;
}>;

const DISCLOSURE_BINDINGS: readonly DisclosureBinding[] = [
  {
    file: 'features/communications/announcement-manager.tsx',
    capability: 'communications.content.create',
    expected:
      "const canCreate = capabilityAccess.governed ? capabilityAccess.hasWritableCapability('communications.content.create') : legacyCanCreate;",
  },
  {
    file: 'features/communications/announcement-manager.tsx',
    capability: 'communications.content.update',
    expected:
      "const canUpdate = capabilityAccess.governed ? capabilityAccess.hasWritableCapability('communications.content.update') : legacyCanUpdate;",
  },
  {
    file: 'features/communications/announcement-manager.tsx',
    capability: 'communications.content.publish',
    expected:
      "const canPublish = capabilityAccess.governed ? capabilityAccess.hasWritableCapability('communications.content.publish') : legacyCanPublish;",
  },
  {
    file: 'features/communications/announcement-manager.tsx',
    capability: 'communications.content.archive',
    expected:
      "const canArchive = capabilityAccess.governed ? capabilityAccess.hasWritableCapability('communications.content.archive') : legacyCanArchive;",
  },
  {
    file: 'features/services/service-catalog-manager.tsx',
    capability: 'services.catalog.create',
    expected:
      "const canCreate = capabilityAccess.governed ? capabilityAccess.hasWritableCapability('services.catalog.create') : hasPermission('ADMIN.SERVICE_CATALOG', 'CREATE');",
  },
  {
    file: 'features/services/service-catalog-manager.tsx',
    capability: 'services.catalog.update',
    expected:
      "const canUpdate = capabilityAccess.governed ? capabilityAccess.hasWritableCapability('services.catalog.update') : hasPermission('ADMIN.SERVICE_CATALOG', 'UPDATE');",
  },
  {
    file: 'features/services/service-operations-manager.tsx',
    capability: 'services.operations.update',
    expected:
      "const canManage = capabilityAccess.governed ? capabilityAccess.hasWritableCapability('services.operations.update') : hasPermission('ADMIN.SERVICE_OPERATIONS', 'MANAGE');",
  },
  {
    file: 'features/workforce/workforce-export-action-access.ts',
    capability: 'hcm.controlled-export.create',
    expected:
      "create: access.governed ? access.hasWritableCapability('hcm.controlled-export.create') : legacyCanGovern,",
  },
  {
    file: 'features/workforce/workforce-export-action-access.ts',
    capability: 'hcm.controlled-export.cancel',
    expected:
      "cancel: access.governed ? access.hasWritableCapability('hcm.controlled-export.cancel') : legacyCanGovern,",
  },
  {
    file: 'features/workforce/workforce-export-action-access.ts',
    capability: 'hcm.controlled-export.retry',
    expected:
      "retry: access.governed ? access.hasWritableCapability('hcm.controlled-export.retry') : legacyCanGovern,",
  },
] as const;

function source(file: string): string {
  return fs
    .readFileSync(path.resolve(process.cwd(), 'apps/dwp/src', file), 'utf8')
    .replace(/\s+/gu, ' ');
}

describe('Product action disclosure contracts', () => {
  it.each(DISCLOSURE_BINDINGS)(
    'gates $capability independently in $file',
    ({ file, capability, expected }) => {
      const contents = source(file);
      expect(contents).toContain(expected);
      expect(contents.split(`'${capability}'`)).toHaveLength(2);
    }
  );

  it('binds each computed authority to its own action control', () => {
    const communications = source('features/communications/announcement-manager.tsx');
    expect(communications).toContain('disabled={!canCreate}');
    expect(communications).toContain('disabled={!canUpdate || busy');
    expect(communications).toContain('disabled={!canPublish || busy}');
    expect(communications).toContain('disabled={!canArchive || busy}');

    const catalog = source('features/services/service-catalog-manager.tsx');
    expect(catalog).toContain('disabled={!canCreate}');
    expect(catalog).toContain('disabled={!canUpdate}');

    const operations = source('features/services/service-operations-manager.tsx');
    expect(operations).toContain('disabled={!canManage || !targetStatus || mutation.isPending}');

    const exports = source('features/workforce/workforce-export-center.tsx');
    expect(exports).toContain('disabled={!preview || !actionAccess.create}');
    expect(exports).toContain('onCancel && CANCELLABLE_STATES.includes(request.lifecycleState)');
    expect(exports).toContain('selected && actionAccess.retry &&');
  });

  it('binds management GET URLs and React Query caches to the selected scope', () => {
    const communications = source('features/communications/announcement-manager.tsx');
    expect(communications).toContain(
      "queryKey: ['admin', 'announcements', ...requestScope.cacheKey]"
    );
    expect(communications).toContain(
      'listAdminAnnouncements(requestScope.contextScopeKey, signal)'
    );
    expect(communications).toContain('enabled: requestScope.ready');
    expect(communications).toContain('meta: requestScope.queryMeta');

    const catalog = source('features/services/service-catalog-manager.tsx');
    expect(catalog).toContain(
      "queryKey: ['admin', 'services', 'catalog', ...requestScope.cacheKey]"
    );
    expect(catalog).toContain('getAdminServiceCatalog(requestScope.contextScopeKey, signal)');
    expect(catalog).toContain(
      "queryKey: ['services', 'catalog', 'view', 'management', ...requestScope.cacheKey]"
    );
    expect(catalog).toContain('getServiceManagementCatalog(requestScope.contextScopeKey, signal)');
    expect(catalog).toContain('enabled: requestScope.ready');
    expect(catalog.match(/meta: requestScope\.queryMeta/gu)).toHaveLength(2);

    const operations = source('features/services/service-operations-manager.tsx');
    expect(operations).toContain(
      "queryKey: ['admin', 'services', 'requests', status, ...requestScope.cacheKey]"
    );
    expect(operations).toContain(
      "queryKey: ['admin', 'services', 'request', selectedId, ...requestScope.cacheKey]"
    );
    expect(operations).toContain('requestScope.contextScopeKey, signal');
    expect(operations).toContain('enabled: Boolean(selectedId) && requestScope.ready');
    expect(operations.match(/meta: requestScope\.queryMeta/gu)).toHaveLength(2);
  });

  it('keeps the HCM personal Work home free of management modes, data, and tools', () => {
    const home = source('features/hcm/hcm-home.tsx');
    expect(home).toContain("type HomeMode = 'personal' | 'team';");
    expect(home).not.toContain('experience.canOperate');
    expect(home).not.toContain('listHrisSyncRuns');
    expect(home).not.toContain("surface: 'workforce'");
    expect(home).not.toContain('/hr/operations');
    expect(home).not.toContain('/hr/data/');
    expect(home).not.toContain('value="operations"');

    const registry = source('features/hcm/hcm-home-widget-registry.ts');
    expect(registry).not.toContain("key: 'operations'");
    expect(registry).not.toContain("audience: 'operator'");
  });

  it('binds cross-PAGE shortcuts to their exact target PAGE decisions', () => {
    const organization = source('features/people/organization/organization-chart-manager.tsx');
    expect(organization).toContain('PRODUCT_PAGE_SHORTCUT_TARGETS.hcmControlledExport');
    expect(organization).toContain('controlledExportShortcut.disclosed');
    expect(organization).toContain(
      'appendProductPageShortcutScope( `/hr/data/exports?${params.toString()}`, controlledExportShortcut )'
    );

    const people = source('features/people/directory/people-directory.tsx');
    expect(people).toContain('PRODUCT_PAGE_SHORTCUT_TARGETS.hcmOrganizationDesign');
    expect(people).toContain("experience !== 'workforce' || organizationDesignShortcut.disclosed");
    expect(people).toContain('appendProductPageShortcutScope(href, organizationDesignShortcut)');

    const approvals = source('features/approvals/approval-admin.tsx');
    expect(approvals).toContain('PRODUCT_PAGE_SHORTCUT_TARGETS.approvalWorkflows');
    expect(approvals).toContain('PRODUCT_PAGE_SHORTCUT_TARGETS.approvalOperations');
    expect(approvals).toContain('if (!shortcut.disclosed) return null;');
    expect(approvals).toContain('route={appendProductPageShortcutScope(');
  });
});
