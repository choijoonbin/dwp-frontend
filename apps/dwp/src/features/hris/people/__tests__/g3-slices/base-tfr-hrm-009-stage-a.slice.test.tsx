import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  HRM009_API_CONTRACTS,
  HRM009_DEFAULT_GATE,
  HRM009_FEATURE,
  HRM009_QUERY_CONTRACTS,
  HRM009_REQUEST_CERTIFICATE_ROUTE_CONTRACT,
  HRM009_TEAM_MANAGEMENT_DISPOSITION,
} from '../../../employee-services/certificates';

const featureRoot = new URL('../../../employee-services/certificates/', import.meta.url);
const apiSource = readFileSync(new URL('certificate-api.ts', featureRoot), 'utf8');
const contractSource = readFileSync(new URL('certificate-contract.ts', featureRoot), 'utf8');
const runtimeSource = readFileSync(new URL('certificate-workbench.tsx', featureRoot), 'utf8');

describe('[SLICE:BASE-TFR-HRM-009-STAGE-A] request and issue metadata surfaces', () => {
  it('pins IAQ-003, IAQ-010, and PEP-HRM-012 to the exact People paths', () => {
    expect(HRM009_API_CONTRACTS).toHaveLength(3);
    expect(HRM009_API_CONTRACTS).toEqual([
      expect.objectContaining({
        bindingId: 'IAQ-003',
        method: 'GET',
        browserPath: '/api/people/v1/hris/workbench/self-service/requests',
        ownerPath: '/v1/hris/workbench/self-service/requests',
      }),
      expect.objectContaining({
        bindingId: 'IAQ-010',
        method: 'GET',
        browserPath: '/api/people/v1/hris/workbench/operations/certificates/documents',
        ownerPath: '/v1/hris/workbench/operations/certificates/documents',
      }),
      expect.objectContaining({
        bindingId: 'PEP-HRM-012',
        method: 'POST',
        browserPath: '/api/people/v1/hris/certificates',
        ownerPath: '/v1/hris/certificates',
        successStatus: 202,
        routeContractKey: 'route.hcm.operations.certificate-issue.action',
      }),
    ]);
    expect(HRM009_REQUEST_CERTIFICATE_ROUTE_CONTRACT).toBe(
      'route.hcm.operations.certificate-issue.action'
    );
  });

  it('keeps Stage A unmounted, default-OFF, zero-enrollment, and zero-credit compatible', () => {
    expect(HRM009_DEFAULT_GATE).toEqual({
      feature: HRM009_FEATURE,
      enabled: false,
      tenantEnrolled: false,
    });
    expect(Object.isFrozen(HRM009_DEFAULT_GATE)).toBe(true);
    expect(runtimeSource).not.toMatch(/react-router|createBrowserRouter|routeCatalog/iu);
    expect(runtimeSource).toContain('No owner request was sent.');
  });

  it('seals two metadata-only projections and their exact action allowlists', () => {
    expect(HRM009_QUERY_CONTRACTS['IAQ-003']).toEqual(
      expect.objectContaining({
        variantKey: 'REQUESTS',
        route: '/hr/me/requests',
        fieldGroups: ['REQUEST_SUMMARY', 'REQUEST_STATUS', 'COMMAND_RECEIPT'],
      })
    );
    expect(HRM009_QUERY_CONTRACTS['IAQ-003'].actions.map((action) => action.actionKey)).toEqual([
      'hris.action.hrm.create-employee-change-request',
      'hris.action.hrm.submit-employee-change-request',
      'hris.action.hrm.request-certificate',
    ]);
    expect(HRM009_QUERY_CONTRACTS['IAQ-010']).toEqual(
      expect.objectContaining({
        variantKey: 'CERTIFICATES_DOCUMENTS',
        route: '/hr/operations/people/certificates-documents',
        fieldGroups: ['CERTIFICATE_METADATA', 'DOCUMENT_METADATA'],
      })
    );
    expect(HRM009_QUERY_CONTRACTS['IAQ-010'].actions.map((action) => action.actionKey)).toEqual([
      'hris.action.hrm.request-certificate',
    ]);
    expect(runtimeSource.toLowerCase()).not.toMatch(/download|revoke|verification/iu);
  });

  it('pins the five-field request, required headers, 202 receipt, and TEAM_MANAGEMENT denial', () => {
    const command = HRM009_API_CONTRACTS[2];
    expect(command.requiredHeaders).toEqual([
      'Authorization',
      'Idempotency-Key',
      'If-Match',
      'X-Correlation-ID',
    ]);
    expect(command.requestFields).toEqual([
      'personPublicId',
      'certificateType',
      'purposeCode',
      'locale',
      'asOf',
    ]);
    expect(command.response).toBe('CommandReceiptV1');
    expect(HRM009_TEAM_MANAGEMENT_DISPOSITION).toBe('DENY_DEFER_NO_PROFILE_NO_FALLBACK');
    expect(contractSource).toContain("['EMPLOYEE_SELF_SERVICE', 'HR_OPERATIONS']");
    expect(apiSource.match(/axiosInstance\.post<unknown/u)).toHaveLength(1);
    expect(apiSource).not.toMatch(/axiosInstance\.(?:put|patch|delete)/u);
  });

  it('requires secure high-step-up authority with matching replay and version bindings', () => {
    expect(apiSource).toContain("authority.mode !== 'SECURE'");
    expect(apiSource).toContain('!authority.stepUp');
    expect(apiSource).toContain('authority.idempotencyKey !== command.idempotencyKey');
    expect(apiSource).toContain('authority.objectVersion !== command.expectedObjectVersion');
    expect(apiSource).toContain('productSurfaceHighRiskMutationConfig');
  });

  it('exposes the sealed optional purpose header without adding another action route', () => {
    expect(HRM009_API_CONTRACTS[2]).toEqual(
      expect.objectContaining({ optionalHeader: 'X-Purpose-Code' })
    );
    expect(apiSource.match(/axiosInstance\.post<unknown/u)).toHaveLength(1);
  });

  it('identifies the primary work and carries responsive accessibility evidence', () => {
    expect(HRM009_QUERY_CONTRACTS['IAQ-003'].framing).toEqual(
      expect.objectContaining({
        primaryUser: 'Employee',
        primaryAction: 'Request certificate',
        archetype: 'list-detail',
      })
    );
    expect(HRM009_QUERY_CONTRACTS['IAQ-010'].framing).toEqual(
      expect.objectContaining({
        primaryUser: 'HR operations certificate issuer',
        primaryAction: 'Issue certificate request',
        archetype: 'focus-form',
      })
    );
    expect(runtimeSource).toContain("direction={{ xs: 'column', md: 'row' }}");
    expect(runtimeSource).toContain("xs: 'minmax(0, 1fr)'");
    expect(runtimeSource).toContain("sm: 'repeat(2, minmax(0, 1fr))'");
    expect(runtimeSource).toContain("'@media (forced-colors: active)'");
    expect(runtimeSource).toContain("'@media (prefers-reduced-motion: reduce)'");
    expect(runtimeSource).toContain('aria-pressed={active}');
    expect(runtimeSource).toContain('aria-live="polite"');
    expect(runtimeSource).toContain("overflowWrap: 'anywhere'");
  });
});
