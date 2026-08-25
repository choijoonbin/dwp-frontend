import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(file: string): string {
  return fs
    .readFileSync(path.resolve(process.cwd(), 'apps/dwp/src', file), 'utf8')
    .replace(/\s+/gu, ' ');
}

describe('Product Surface query cache discriminator contract', () => {
  it('separates Approval Form reference reads from Workflow Studio reads', () => {
    const formStudio = source('features/approvals/approval-form-studio.tsx');
    const workflowStudio = source('features/approvals/approval-workflow-studio.tsx');

    expect(formStudio).toContain("'workflows', 'view', 'reference'");
    expect(formStudio).toContain('getApprovalFormReferenceWorkflows(');
    expect(formStudio).toContain('getApprovalFormReferenceWorkflow(');
    expect(workflowStudio).toContain("'workflows', 'view', 'absent'");
    expect(workflowStudio).toContain('getApprovalStudioWorkflows(');
    expect(workflowStudio).toContain('getApprovalStudioWorkflow(');
  });

  it('keeps Services home, work lists, details, and management projections isolated', () => {
    const home = source('features/services/services-home.tsx');
    const work = source('pages/services.tsx');
    const management = source('features/services/service-catalog-manager.tsx');

    expect(home).toContain("queryKey: ['services', 'home', 'view', 'absent']");
    expect(work).toContain("queryKey: ['services', 'catalog', 'view', 'discover']");
    expect(work).toContain("queryKey: ['services', 'requests', 'view', drafts ? 'drafts' : 'my']");
    expect(work).toContain(
      "queryKey: ['services', 'request', requestId, 'view', draft ? 'draft' : 'absent']"
    );
    expect(management).toContain(
      "queryKey: ['services', 'catalog', 'view', 'management', ...requestScope.cacheKey]"
    );
  });

  it('keeps HCM service data out of Services Work caches', () => {
    const hcm = source('features/hcm/hr-service-hub.tsx');

    expect(hcm).toContain("queryKey: ['services', 'catalog', 'surface:hcm']");
    expect(hcm).toContain("queryKey: ['services', 'requests', 'surface:hcm']");
  });
});
