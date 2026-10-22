/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  PAY004_API_CONTRACTS,
  PAY004_DATA_ROUTE_CONTRACT_KEY,
  PAY004_DEFAULT_ROLLOUT,
  PAY004_FIELD_GROUPS,
  PAY004_PAGE_ROUTE_CONTRACT_KEY,
  PAY004_QUERY_CONTRACT,
  createPay004QueryRequest,
  selectPay004Projection,
} from '../../retirement';
import {
  PAY004_TEST_ADMISSION,
  PAY004_TEST_SCOPE,
  pay004ProjectionWire,
} from '../../retirement/testing/retirement-fixtures.test-support';

const AC = Object.freeze(
  Array.from({ length: 12 }, (_, index) => `PAY004-AC-${String(index + 1).padStart(2, '0')}`)
);
const testDirectory = dirname(fileURLToPath(import.meta.url));
const retirementRoot = join(testDirectory, '../../retirement');

describe('BASE-TFR-PAY-004 bounded frontend slice', () => {
  it('tracks the sealed twelve-condition acceptance set', () => {
    expect(AC).toEqual([
      'PAY004-AC-01',
      'PAY004-AC-02',
      'PAY004-AC-03',
      'PAY004-AC-04',
      'PAY004-AC-05',
      'PAY004-AC-06',
      'PAY004-AC-07',
      'PAY004-AC-08',
      'PAY004-AC-09',
      'PAY004-AC-10',
      'PAY004-AC-11',
      'PAY004-AC-12',
    ]);
  });

  it('pins AC-01 through AC-03 to exact IAQ-049 read and projection semantics', () => {
    expect(PAY004_API_CONTRACTS).toEqual([
      expect.objectContaining({
        bindingId: 'IAQ-049',
        method: 'GET',
        browserPath: '/api/payroll/v1/workbench/pay-retirement',
        ownerPath: '/v1/workbench/pay-retirement',
      }),
    ]);
    expect(PAY004_QUERY_CONTRACT).toEqual(
      expect.objectContaining({
        variantKey: 'RETIREMENT',
        route: '/hr/operations/payroll/retirement',
        pageLimit: 100,
        defaultSort: 'itemPublicId:ASC',
        resolvedCapability: 'DATA.HRIS_PAYROLL_STATUS:VIEW',
        purpose: 'PAYROLL_OPERATIONS',
        scopeResolver: 'PAY_TARGET_POPULATION',
        projectionPolicyKey: 'pay004.iaq-049.fields.v1',
        availableActions: [],
      })
    );
    expect(PAY004_QUERY_CONTRACT.filters).toHaveLength(4);
    expect(PAY004_QUERY_CONTRACT.sorts).toHaveLength(8);
    expect(PAY004_FIELD_GROUPS).toEqual(['RETIREMENT_RESULT', 'POLICY_VERSION', 'CASE_STATUS']);
    const projection = selectPay004Projection(pay004ProjectionWire());
    expect(projection.items[0]?.availableActions).toEqual([]);
    expect(projection.items[0]?.deepLink.resourcePublicId).toBe(projection.items[0]?.itemPublicId);
  });

  it('keeps stable ordering, trusted route admission and revision-bound scope explicit', () => {
    expect(PAY004_PAGE_ROUTE_CONTRACT_KEY).toBe('route.hcm.operations.pay-retirement.page');
    expect(PAY004_DATA_ROUTE_CONTRACT_KEY).toBe('route.hcm.operations.pay-retirement.data');
    expect(createPay004QueryRequest(PAY004_TEST_SCOPE).sort).toEqual(['itemPublicId:ASC']);
    expect(PAY004_TEST_ADMISSION.decisionRevision).toBe('authorization-revision-58');
  });

  it('keeps AC-04 through AC-11 owner-only and introduces no frontend command transport', () => {
    const apiSource = readFileSync(join(retirementRoot, 'retirement-api.ts'), 'utf8');
    const contractSource = readFileSync(join(retirementRoot, 'retirement-contract.ts'), 'utf8');
    expect(apiSource).not.toMatch(/axiosInstance\.(post|put|patch|delete)/u);
    expect(apiSource).not.toContain('/runs/');
    expect(apiSource).not.toContain('/country-packs/');
    expect(contractSource).not.toContain('runId');
    expect(contractSource).not.toContain('packId');
    expect(contractSource).not.toContain('workerResultId');
  });

  it('keeps AC-12 unmounted, default OFF, zero-enrollment and zero-call guarded', () => {
    expect(PAY004_DEFAULT_ROLLOUT).toEqual({
      feature: 'HRIS_PAY_RETIREMENT_WORKBENCH',
      enabled: false,
      enrolledTenantIds: [],
    });
    const workbenchSource = readFileSync(join(retirementRoot, 'retirement-workbench.tsx'), 'utf8');
    const responsiveSource = readFileSync(
      join(retirementRoot, 'components/retirement-command-center.tsx'),
      'utf8'
    );
    const toolbarSource = readFileSync(
      join(retirementRoot, 'components/retirement-query-toolbar.tsx'),
      'utf8'
    );
    const hookSource = readFileSync(join(retirementRoot, 'use-retirement-workbench.ts'), 'utf8');
    const workbenchTestSource = readFileSync(
      join(retirementRoot, 'testing/retirement-workbench.test.tsx'),
      'utf8'
    );
    expect(workbenchSource.indexOf('pay004EnabledForTenant')).toBeLessThan(
      workbenchSource.indexOf('<ActiveWorkbench')
    );
    expect(workbenchSource).toContain('data-owner-calls="0"');
    expect(responsiveSource).toContain("theme.breakpoints.down('sm')");
    expect(responsiveSource).toContain('(forced-colors: active)');
    expect(responsiveSource).toContain('(prefers-reduced-motion: reduce)');
    expect(responsiveSource).toContain('data-focus-ring="keyboard-visible"');
    expect(responsiveSource).toContain('onRowSelectionModelChange');
    expect(responsiveSource).toContain('onCellKeyDown');
    expect(toolbarSource.match(/data-filter-key=/gu)).toHaveLength(4);
    expect(toolbarSource).toContain('PAY004_QUERY_CONTRACT.sorts.map');
    expect(toolbarSource).toContain('data-session-storage="tab"');
    expect(hookSource).toContain('encodeURIComponent(tenantId)');
    expect(hookSource).toContain("Pay004ContractError('response.asOf snapshot binding')");
    expect(workbenchTestSource).toContain('1440px at 200% zoom');
    expect(workbenchTestSource).toContain('1280px at 200% zoom');
    expect(workbenchTestSource).toContain("it.each(['Enter', ' '])");
    expect(workbenchTestSource).toContain('very long English label');
  });
});
