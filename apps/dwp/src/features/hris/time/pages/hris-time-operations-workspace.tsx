import { useMemo } from 'react';
import { LocalErrorState } from '@dwp-frontend/design-system';
import { readRegionalPreference } from '@dwp-frontend/shared-utils';
import { resolveSystemTimeZone } from '@dwp-frontend/shared-i18n';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { useProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import { HrisTimeWorkPlanStudioRuntime } from './hris-time-work-plan-studio';
import {
  resolveHrisTimeWorkPlanOperationsScope,
  resolveWorkPlanOperationsEffectiveOn,
  workPlanOperationsToday,
} from '../model/hris-time-work-plan-operations-scope';

import type { ProductSurfaceRequestScope } from '../../../../components/use-product-surface-request-scope';
import type { WorkPlanStudioDataSource } from '../api/hris-time-work-plan-api';
import type { HrisTimeWorkPlanSimulationExecutor } from './hris-time-work-plan-studio';

/**
 * This binding is intentionally injected only after the owner API's exact DATA and ACTION
 * contracts are registered. The existing `time-approve` action cannot be reused: it governs a
 * card decision endpoint, not a work-plan simulation.
 */
export type HrisTimeWorkPlanOperationsOwnerBinding = Readonly<{
  dataSource: WorkPlanStudioDataSource;
  simulationExecutor: HrisTimeWorkPlanSimulationExecutor;
}>;

export type HrisTimeOperationsWorkspaceProps = Readonly<{
  ownerBinding?: HrisTimeWorkPlanOperationsOwnerBinding;
}>;

export type HrisTimeOperationsWorkspaceRuntimeProps = HrisTimeOperationsWorkspaceProps &
  Readonly<{
    requestScope: ProductSurfaceRequestScope;
    effectiveOn: string;
  }>;

function effectiveTimeZone() {
  const preference = readRegionalPreference().timeZone;
  return preference === 'system' ? resolveSystemTimeZone('UTC') : preference;
}

function ClosedWorkPlanOperations({ reason }: { reason: 'scope' | 'owner-contract' }) {
  const { t } = useTranslation('hcm');
  const content =
    reason === 'scope'
      ? {
          title: t('hrisTime.operationsAdapter.scope.title'),
          description: t('hrisTime.operationsAdapter.scope.description'),
        }
      : {
          title: t('hrisTime.operationsAdapter.ownerContract.title'),
          description: t('hrisTime.operationsAdapter.ownerContract.description'),
        };
  return (
    <div data-testid={`hris-time-operations-closed-${reason}`}>
      <LocalErrorState title={content.title} description={content.description} size="page" />
    </div>
  );
}

export function useHrisTimeOperationsRequestScope() {
  return useProductSurfaceRequestScope({
    productKey: 'hcm',
    surfaceKey: 'hcm.operations',
  });
}

/**
 * Runtime split makes the tenant/decision/effective-date binding directly testable and prevents
 * owner I/O before every required identity field is available.
 */
export function HrisTimeOperationsWorkspaceRuntime({
  requestScope,
  effectiveOn,
  ownerBinding,
}: HrisTimeOperationsWorkspaceRuntimeProps) {
  const workPlanScope = useMemo(
    () => resolveHrisTimeWorkPlanOperationsScope(requestScope, effectiveOn),
    [effectiveOn, requestScope]
  );

  if (!workPlanScope) return <ClosedWorkPlanOperations reason="scope" />;
  if (!ownerBinding) return <ClosedWorkPlanOperations reason="owner-contract" />;

  return (
    <HrisTimeWorkPlanStudioRuntime
      requestScope={workPlanScope}
      dataSource={ownerBinding.dataSource}
      simulationExecutor={ownerBinding.simulationExecutor}
    />
  );
}

/**
 * Canonical mount candidate for `/hr/operations/time`. It is closed by default until the owner
 * gateway binding and its matching generated route contracts are present.
 */
export function HrisTimeOperationsWorkspace({ ownerBinding }: HrisTimeOperationsWorkspaceProps) {
  const requestScope = useHrisTimeOperationsRequestScope();
  const [searchParams] = useSearchParams();
  const currentDate = useMemo(() => workPlanOperationsToday(effectiveTimeZone()), []);
  const effectiveOn = resolveWorkPlanOperationsEffectiveOn(
    searchParams.get('effectiveOn'),
    currentDate
  );
  return (
    <HrisTimeOperationsWorkspaceRuntime
      requestScope={requestScope}
      effectiveOn={effectiveOn}
      ownerBinding={ownerBinding}
    />
  );
}
