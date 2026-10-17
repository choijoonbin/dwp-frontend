import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  HRM007_ADAPTER_KIND,
  HRM007_DEFAULT_GATE,
  HRM007_ENTRY_QUERY_API_CONTRACTS,
  HRM007_FEATURE,
  HRM007_QUERY_CONTRACTS,
  createHrm007QueryAdapter,
} from '../../hrm-007-workbench';

const featureRoot = new URL('../../hrm-007-workbench/', import.meta.url);
const apiSource = readFileSync(new URL('hrm-007-api.ts', featureRoot), 'utf8');
const runtimeSource = readFileSync(new URL('hrm-007-workbench.tsx', featureRoot), 'utf8');
const hookSource = readFileSync(new URL('use-hrm-007-workbench.ts', featureRoot), 'utf8');

describe('[SLICE:BASE-TFR-HRM-007] governed IA entry projections', () => {
  it('pins only IAQ-005, IAQ-007, and IAQ-013 to their exact GET browser paths', () => {
    expect(HRM007_ENTRY_QUERY_API_CONTRACTS).toEqual([
      expect.objectContaining({
        bindingId: 'IAQ-005',
        method: 'GET',
        path: '/api/people/v1/hris/workbench/team/people-changes',
      }),
      expect.objectContaining({
        bindingId: 'IAQ-007',
        method: 'GET',
        path: '/api/people/v1/hris/workbench/operations/appointments',
      }),
      expect.objectContaining({
        bindingId: 'IAQ-013',
        method: 'GET',
        path: '/api/people/v1/hris/workbench/configuration/people-employment',
      }),
    ]);
    expect(HRM007_ENTRY_QUERY_API_CONTRACTS).toHaveLength(3);
  });

  it('keeps the rollout default OFF with zero tenant enrollment', () => {
    expect(HRM007_FEATURE).toBe('HRIS_HRM_APPOINTMENT_WORKBENCH');
    expect(HRM007_DEFAULT_GATE).toEqual({
      feature: HRM007_FEATURE,
      enabled: false,
      tenantEnrolled: false,
    });
    expect(Object.isFrozen(HRM007_DEFAULT_GATE)).toBe(true);
  });

  it('seals the adapter as read-only GET and creates no command lifecycle', () => {
    const adapter = createHrm007QueryAdapter();
    expect(adapter.kind).toBe(HRM007_ADAPTER_KIND);
    expect(Object.keys(adapter)).toEqual(['kind', 'query']);
    expect(apiSource).toContain('axiosInstance.get<unknown>');
    expect(apiSource).not.toMatch(/axiosInstance\.(?:post|put|patch|delete)/u);
    expect(hookSource).not.toMatch(/mutation|command|receipt|outbox/u);
  });

  it('pins the three canonical deep links and existing-lifecycle action provenance', () => {
    expect(HRM007_QUERY_CONTRACTS['IAQ-005'].route).toBe('/hr/team/people-changes');
    expect(HRM007_QUERY_CONTRACTS['IAQ-007'].route).toBe('/hr/operations/people/appointments');
    expect(HRM007_QUERY_CONTRACTS['IAQ-013'].route).toBe('/hr/settings/people-employment');
    expect(HRM007_QUERY_CONTRACTS['IAQ-005'].actions.map((action) => action.actionKey)).toEqual([
      'hris.action.hrm.create-employee-change-request',
      'hris.action.hrm.submit-employee-change-request',
    ]);
    expect(HRM007_QUERY_CONTRACTS['IAQ-007'].actions.map((action) => action.actionKey)).toEqual([
      'hris.action.hrm.create-assignment-event',
      'hris.action.hrm.validate-assignment-event',
      'hris.action.hrm.submit-assignment-event',
      'hris.action.hrm.publish-assignment-event',
    ]);
    expect(HRM007_QUERY_CONTRACTS['IAQ-013'].actions).toEqual([]);
  });

  it('keeps EFFECTIVE_ON out of response groups and carries responsive accessibility evidence', () => {
    expect(HRM007_QUERY_CONTRACTS['IAQ-005'].fieldGroups).toHaveLength(3);
    expect(HRM007_QUERY_CONTRACTS['IAQ-007'].fieldGroups).toHaveLength(3);
    expect(HRM007_QUERY_CONTRACTS['IAQ-013'].fieldGroups).toHaveLength(3);
    expect(
      Object.values(HRM007_QUERY_CONTRACTS).flatMap((contract) => contract.fieldGroups)
    ).not.toContain('EFFECTIVE_ON');
    expect(runtimeSource).toContain("direction={{ xs: 'column', md: 'row' }}");
    expect(runtimeSource).toContain('gridTemplateColumns: {\n              xs:');
    expect(runtimeSource).toContain("'@media (forced-colors: active)'");
    expect(runtimeSource).toContain("'@media (prefers-reduced-motion: reduce)'");
    expect(runtimeSource).toContain('aria-pressed={active}');
    expect(runtimeSource).toContain('aria-live="polite"');
  });
});
