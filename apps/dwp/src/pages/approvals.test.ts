import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(new URL('./approvals.tsx', import.meta.url), 'utf8');
const admin = readFileSync(
  new URL('../features/approvals/approval-admin.tsx', import.meta.url),
  'utf8'
);

describe('Approval view loading boundaries', () => {
  it('loads only the selected work or administration area', () => {
    for (const view of ['admin', 'delegations', 'home', 'inbox', 'requests']) {
      expect(page).toContain(`import('../features/approvals/approval-${view}')`);
      expect(page).not.toMatch(
        new RegExp(
          `import\\s+\\{[^}]+\\}\\s+from\\s+['"]\\.\\./features/approvals/approval-${view}['"]`
        )
      );
    }
    expect(page.match(/const Approval\w+ = lazy\(/g)).toHaveLength(5);
  });

  it('preserves the permission check, header, and accessible route fallback', () => {
    const permissionCheck = page.indexOf('!canAccessProductAreaNavigationItem');
    expect(permissionCheck).toBeGreaterThan(-1);
    expect(permissionCheck).toBeLessThan(page.indexOf('<ApprovalHome />'));
    expect(page.match(/<Suspense fallback={<RouteFallback \/>}>/g)).toHaveLength(2);
    expect(page.indexOf('<ApprovalPageHeader')).toBeLessThan(page.lastIndexOf('<Suspense'));
    expect(page).toContain('view="COMPLETED"');
    expect(page).toContain('governed = false');
  });

  it('does not download unrelated administration editors together', () => {
    for (const view of [
      'admin-overview',
      'form-studio',
      'operations-admin',
      'policy-studio',
      'signature-admin',
      'workflow-studio',
      'admin-document-controller',
    ]) {
      expect(admin).toContain(`import('./approval-${view}')`);
      expect(admin).not.toMatch(
        new RegExp(`import\\s+\\{[^}]+\\}\\s+from\\s+['"]\\./approval-${view}['"]`)
      );
    }
    expect(admin.match(/const Approval\w+ = lazy\(/g)).toHaveLength(7);
    expect(admin).toContain('<ApprovalPolicyStudio />');
    expect(admin).toContain('<ApprovalAdminDocumentController />');
  });
});
