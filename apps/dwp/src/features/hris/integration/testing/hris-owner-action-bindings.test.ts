import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { productActionMutationBinding } from '../../../../components/use-product-action-mutation';
import { PRODUCT_SURFACE_HIGH_RISK_COMMAND_CATALOG } from '../../../../components/product-surface-high-risk-command-catalog';
import { HRIS_PAYROLL_CONFIGURATION_ACTION_CONTRACTS } from '../hris-payroll-configuration-workspace';
import { PAYROLL_FOUNDATION_ACTION_CONTRACTS } from '../../payroll/hooks/use-payroll-foundation-command-executors';
import { PERFORMANCE_CYCLE_ACTION_CONTRACTS } from '../../performance/hooks/use-performance-cycle-command-executors';
import { HRIS_TIME_WORK_PLAN_SIMULATE_ACTION_CONTRACT } from '../../time';

import type { ProductActionRouteContractKey } from '../../../../components/use-product-action-mutation';

function assertExactHcmActions(
  contracts: Record<string, ProductActionRouteContractKey>,
  surfaceKey: 'hcm.operations' | 'hcm.management' = 'hcm.operations'
) {
  expect(new Set(Object.values(contracts)).size).toBe(Object.keys(contracts).length);
  for (const routeContractKey of Object.values(contracts)) {
    expect(productActionMutationBinding(routeContractKey)).toMatchObject({
      productKey: 'hcm',
      surfaceKey,
      routeContractKey,
    });
  }
}

describe('HRIS owner action bindings', () => {
  it('binds every PER command to a distinct exact ACTION route', () => {
    expect(Object.keys(PERFORMANCE_CYCLE_ACTION_CONTRACTS)).toEqual([
      'create',
      'update',
      'validate',
      'preview',
      'publish',
    ]);
    assertExactHcmActions(PERFORMANCE_CYCLE_ACTION_CONTRACTS);
  });

  it('binds every PAY command and reconciliation to a distinct exact ACTION route', () => {
    expect(Object.keys(PAYROLL_FOUNDATION_ACTION_CONTRACTS)).toEqual([
      'create',
      'update',
      'simulate',
      'publish',
      'reverse',
      'reconcile',
    ]);
    assertExactHcmActions(PAYROLL_FOUNDATION_ACTION_CONTRACTS);
  });

  it('binds PAY settings commands to exact configuration ACTIONs and keeps publish HIGH', () => {
    expect(HRIS_PAYROLL_CONFIGURATION_ACTION_CONTRACTS).toEqual({
      validate: 'route.hcm.configuration.payroll-formula-validate.action',
      simulate: 'route.hcm.configuration.payroll-formula-simulate.action',
      publish: 'route.hcm.configuration.payroll-formula-publish.action',
    });
    assertExactHcmActions(
      {
        validate: HRIS_PAYROLL_CONFIGURATION_ACTION_CONTRACTS.validate,
        simulate: HRIS_PAYROLL_CONFIGURATION_ACTION_CONTRACTS.simulate,
      },
      'hcm.management'
    );
  });

  it('mounts TIM operations with its real owner adapter and exact simulation ACTION', () => {
    assertExactHcmActions({ simulate: HRIS_TIME_WORK_PLAN_SIMULATE_ACTION_CONTRACT });
    const adapter = readFileSync(
      resolve(
        process.cwd(),
        'apps/dwp/src/features/hris/time/pages/hris-time-operations-workspace.tsx'
      ),
      'utf8'
    );
    expect(adapter).toContain('createHrisTimeWorkPlanDataSource(hrisTimeWorkPlanHttpClient)');
    expect(adapter).toMatch(
      /useProductActionMutation\(\s*HRIS_TIME_WORK_PLAN_SIMULATE_ACTION_CONTRACT\s*\)/
    );
    expect(adapter).toContain('ownerBinding={ownerBinding ?? defaultOwnerBinding}');
  });

  it('mounts only the route adapters that inject those exact bindings', () => {
    const page = readFileSync(resolve(process.cwd(), 'apps/dwp/src/pages/hcm.tsx'), 'utf8');
    expect(page).toContain("'employment-documents': <HrisEmploymentDocumentsWorkspace />");
    expect(page).toContain("'employment-assignments': <HrisEmploymentAssignmentsWorkspace />");
    expect(page).toContain("'time-interpretation': <HrisTimeInterpretationOperationsWorkspace />");
    expect(page).toContain("'settings-payroll': <HrisPayrollConfigurationWorkspace />");
    expect(page).toContain("'pay-operations': <HrisPayrollFoundationOperationsWorkspace />");
    expect(page).toContain("'talent-operations': <HrisPerformanceCycleOperationsWorkspace />");
    expect(page).toContain("'time-operations': <HrisTimeOperationsWorkspace />");
    expect(page).not.toContain('\'pay-operations\': <HrDomainOperations domain="PAY" />');
    expect(page).not.toContain('\'talent-operations\': <HrDomainOperations domain="TALENT" />');
  });

  it('keeps PER and PAY HIGH commands out of the generic mutation executor', () => {
    const performance = readFileSync(
      resolve(
        process.cwd(),
        'apps/dwp/src/features/hris/performance/hooks/use-performance-cycle-command-executors.ts'
      ),
      'utf8'
    );
    const payroll = readFileSync(
      resolve(
        process.cwd(),
        'apps/dwp/src/features/hris/payroll/hooks/use-payroll-foundation-command-executors.ts'
      ),
      'utf8'
    );
    const payrollConfiguration = readFileSync(
      resolve(
        process.cwd(),
        'apps/dwp/src/features/hris/integration/hris-payroll-configuration-workspace.tsx'
      ),
      'utf8'
    );

    expect(performance).not.toContain(
      'useProductActionMutation(PERFORMANCE_CYCLE_ACTION_CONTRACTS.publish)'
    );
    expect(performance).toContain("operation: 'HCM_PERFORMANCE_CYCLE_PUBLISH'");
    expect(payroll).not.toContain(
      'useProductActionMutation(PAYROLL_FOUNDATION_ACTION_CONTRACTS.publish)'
    );
    expect(payroll).not.toContain(
      'useProductActionMutation(PAYROLL_FOUNDATION_ACTION_CONTRACTS.reverse)'
    );
    expect(payroll).toContain("operation: 'HCM_PAYROLL_FOUNDATION_PUBLISH'");
    expect(payroll).toContain("operation: 'HCM_PAYROLL_FOUNDATION_REVERSE'");
    expect(payrollConfiguration).not.toMatch(
      /useProductActionMutation\(\s*HRIS_PAYROLL_CONFIGURATION_ACTION_CONTRACTS\.publish/u
    );
    expect(payrollConfiguration).toContain("operation: 'HCM_PAYROLL_FORMULA_PUBLISH'");
    expect(payrollConfiguration).toContain('data-testid="hris-payroll-configuration-workspace"');

    expect(
      PRODUCT_SURFACE_HIGH_RISK_COMMAND_CATALOG.filter(({ operation }) =>
        [
          'HCM_EMPLOYMENT_EVENT_PUBLISH',
          'HCM_PERFORMANCE_CYCLE_PUBLISH',
          'HCM_PAYROLL_FOUNDATION_PUBLISH',
          'HCM_PAYROLL_FOUNDATION_REVERSE',
          'HCM_PAYROLL_FORMULA_PUBLISH',
        ].includes(operation)
      )
    ).toEqual([
      {
        operation: 'HCM_EMPLOYMENT_EVENT_PUBLISH',
        productKey: 'hcm',
        surfaceKey: 'hcm.operations',
        routeContractKey: 'route.hcm.operations.assignment-event-publish.action',
      },
      {
        operation: 'HCM_PERFORMANCE_CYCLE_PUBLISH',
        productKey: 'hcm',
        surfaceKey: 'hcm.operations',
        routeContractKey: 'route.hcm.operations.performance-cycle-publish.action',
      },
      {
        operation: 'HCM_PAYROLL_FOUNDATION_PUBLISH',
        productKey: 'hcm',
        surfaceKey: 'hcm.operations',
        routeContractKey: 'route.hcm.operations.payroll-foundation-publish.action',
      },
      {
        operation: 'HCM_PAYROLL_FOUNDATION_REVERSE',
        productKey: 'hcm',
        surfaceKey: 'hcm.operations',
        routeContractKey: 'route.hcm.operations.payroll-foundation-reverse.action',
      },
      {
        operation: 'HCM_PAYROLL_FORMULA_PUBLISH',
        productKey: 'hcm',
        surfaceKey: 'hcm.management',
        routeContractKey: 'route.hcm.configuration.payroll-formula-publish.action',
      },
    ]);
  });
});
