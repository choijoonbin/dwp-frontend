import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { findHcmNavigationItem } from '../../../../hcm/hcm-navigation';
import {
  HRIS_EMPLOYEE_CHANGE_RUNTIME_STATE,
  HrisEmployeeChangeWorkspace,
} from '../pages/hris-employee-change-workspace';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));

describe('HrisEmployeeChangeWorkspace', () => {
  it('exposes a dedicated default-off boundary without owner queries or commands', () => {
    const html = renderToStaticMarkup(createElement(HrisEmployeeChangeWorkspace));

    expect(HRIS_EMPLOYEE_CHANGE_RUNTIME_STATE).toBe('OFF');
    expect(html).toContain('data-testid="hris-employee-change-workspace"');
    expect(html).toContain('data-runtime-state="OFF"');
    expect(html).toContain('data-surface-family="employee-change"');
    expect(html).toContain('Employee-change lifecycle is unavailable');
    expect(html).toContain('Feature state: OFF');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<form');
  });

  it('mounts the governed route without reusing People 360 or assignment proposals', () => {
    const hcmPage = readFileSync(new URL('../../../../../pages/hcm.tsx', import.meta.url), 'utf8');
    const workspace = readFileSync(
      new URL('../pages/hris-employee-change-workspace.tsx', import.meta.url),
      'utf8'
    );

    expect(findHcmNavigationItem('/hr/operations/people/employee-change-requests')).toMatchObject({
      view: 'employee-change-requests',
      governedOnly: true,
      requiredResourceKey: 'DATA.HRIS_WORKFORCE',
      requiredPermissionCode: 'VIEW',
    });
    expect(findHcmNavigationItem('/hr/operations/people')).toMatchObject({
      view: 'people',
      path: '/hr/operations/people',
    });
    expect(findHcmNavigationItem('/hr/operations/assignments')).toMatchObject({
      view: 'assignments',
      path: '/hr/operations/assignments',
    });
    expect(hcmPage).toContain("import('../features/hris/employee-services/employee-change')");
    expect(hcmPage).toContain("'employee-change-requests': <HrisEmployeeChangeWorkspace />");
    expect(hcmPage).toContain('people: <HrisPeople360Workspace />');
    expect(hcmPage).toContain(
      'assignments: <AssignmentRegister assignmentProposal={assignmentProposalPort} />'
    );
    expect(workspace).not.toContain('features/hris/people');
    expect(workspace).not.toContain('AssignmentProposal');
    expect(workspace).not.toMatch(/\bfetch\s*\(/);
    expect(workspace).not.toMatch(/\b(useQuery|useMutation|httpClient|apiClient|axios)\b/);
  });
});
