import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  HRM011_API_CONTRACTS,
  HRM011_DEFAULT_GATE,
  HRM011_FEATURE,
  HRM011_ISSUE_ACTION,
  HRM011_QUERY_CONTRACT,
} from '../../contracts-compensation-basis';

const featureRoot = new URL('../../contracts-compensation-basis/', import.meta.url);
const apiSource = readFileSync(new URL('contracts-compensation-basis-api.ts', featureRoot), 'utf8');
const contractSource = readFileSync(
  new URL('contracts-compensation-basis-contract.ts', featureRoot),
  'utf8'
);
const runtimeSource = readFileSync(
  new URL('contracts-compensation-basis-workbench.tsx', featureRoot),
  'utf8'
);

describe('[SLICE:BASE-TFR-HRM-011] governed contract and compensation issuance', () => {
  it('pins IAQ-008 v2 and PEP-HRM-011 to the exact People paths', () => {
    expect(HRM011_API_CONTRACTS).toEqual([
      expect.objectContaining({
        bindingId: 'IAQ-008',
        operationId: 'IAQ.OP.008',
        method: 'GET',
        browserPath: '/api/people/v1/hris/workbench/operations/contracts/compensation/basis',
        ownerPath: '/v1/hris/workbench/operations/contracts/compensation/basis',
      }),
      expect.objectContaining({
        bindingId: 'PEP-HRM-011',
        method: 'POST',
        browserPath: '/api/people/v1/hris/employment-contracts',
        ownerPath: '/v1/hris/employment-contracts',
        successStatus: 202,
        routeContractKey: 'route.hcm.operations.employment-contract-issue.action',
      }),
    ]);
  });

  it('keeps the feature unmounted, default OFF, zero-enrollment, and zero-call compatible', () => {
    expect(HRM011_DEFAULT_GATE).toEqual({
      feature: HRM011_FEATURE,
      enabled: false,
      tenantEnrolled: false,
    });
    expect(Object.isFrozen(HRM011_DEFAULT_GATE)).toBe(true);
    expect(runtimeSource).not.toMatch(/react-router|createBrowserRouter|routeCatalog/iu);
    expect(runtimeSource).toContain('No owner request was sent.');
    expect(runtimeSource.indexOf('if (!rolloutAdmitted)')).toBeLessThan(
      runtimeSource.indexOf('<ActiveWorkbench')
    );
  });

  it('seals exact IAQ-008 fields, filters, sorts, relationship grain, and issuance action', () => {
    expect(HRM011_QUERY_CONTRACT).toEqual(
      expect.objectContaining({
        variantKey: 'CONTRACTS_COMPENSATION_BASIS',
        route: '/hr/operations/people/contracts-compensation-basis',
        pageLimit: 100,
        fieldGroups: ['CONTRACT_METADATA', 'COMPENSATION_BASIS'],
        filters: ['contractMetadata', 'compensationBasis', 'effectiveOn'],
        defaultSort: 'itemPublicId:ASC',
      })
    );
    expect(HRM011_QUERY_CONTRACT.sorts).toEqual([
      'contractMetadata:ASC',
      'compensationBasis:ASC',
      'contractMetadata:DESC',
      'compensationBasis:DESC',
      'itemPublicId:ASC',
      'itemPublicId:DESC',
    ]);
    expect(HRM011_ISSUE_ACTION).toEqual({
      actionKey: 'hris.action.hrm.issue-employment-contract',
      method: 'POST',
      hrefTemplate: '/api/people/v1/hris/employment-contracts',
      idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
      stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
    });
  });

  it('pins the seven-field body, five required headers, trusted purpose, and raw strong version', () => {
    const command = HRM011_API_CONTRACTS[1];
    expect(command.requestFields).toEqual([
      'relationshipPublicId',
      'templatePublicId',
      'templateVersion',
      'locale',
      'effectiveFrom',
      'effectiveTo',
      'snapshotDigest',
    ]);
    expect(command.requiredHeaders).toEqual([
      'Authorization',
      'Idempotency-Key',
      'If-Match',
      'X-Correlation-ID',
      'X-DWP-Expected-Object-Version',
    ]);
    expect(command.optionalHeader).toBe('X-Purpose-Code');
    expect(command.response).toBe('CommandReceiptV1');
    expect(apiSource).toContain('\'If-Match\': `"${command.expectedObjectVersion}"`');
    expect(apiSource).not.toContain("'X-Purpose-Code':");
  });

  it('requires secure HIGH step-up and preserves explicit 409 and 503 recovery semantics', () => {
    expect(apiSource).toContain("authority.mode !== 'SECURE'");
    expect(apiSource).toContain('!authority.stepUp');
    expect(apiSource).toContain('authority.idempotencyKey !== command.idempotencyKey');
    expect(apiSource).toContain('authority.objectVersion !== command.expectedObjectVersion');
    expect(apiSource).toContain('productSurfaceHighRiskMutationConfig');
    expect(runtimeSource).toContain('error.status === 409');
    expect(runtimeSource).toContain('error.status === 503');
    expect(runtimeSource).toContain('Retry same command');
    expect(runtimeSource).toContain('Nothing was automatically retried');
  });

  it('covers all seven states and responsive accessibility without central integration claims', () => {
    for (const state of ['loading', 'empty', 'partial', 'unavailable', 'denied', 'stale']) {
      expect(runtimeSource.toLowerCase()).toContain(state);
    }
    expect(contractSource).toContain("'COMPLETE'");
    expect(HRM011_QUERY_CONTRACT.framing).toEqual(
      expect.objectContaining({
        primaryUser:
          'HR operations specialist with the required workforce population and HRIS_DUTY_CONTRACT_ISSUER responsibility',
        primaryAction:
          'Issue an employment contract for the selected relationship after preview, current-version, authorization, step-up and snapshot-digest validation.',
        archetype: 'list-detail-workflow',
      })
    );
    expect(runtimeSource).toContain("xs: 'minmax(0, 1fr)'");
    expect(runtimeSource).toContain("sm: 'repeat(2, minmax(0, 1fr))'");
    expect(runtimeSource).toContain("'@media (forced-colors: active)'");
    expect(runtimeSource).toContain("'@media (prefers-reduced-motion: reduce)'");
    expect(runtimeSource).toContain('aria-pressed={active}');
    expect(runtimeSource).toContain('aria-live="polite"');
    expect(runtimeSource).toContain("overflowWrap: 'anywhere'");
    expect(contractSource).toContain("projectionVersion: '2'");
  });
});
