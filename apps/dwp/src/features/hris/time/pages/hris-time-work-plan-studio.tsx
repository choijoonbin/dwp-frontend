import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LoadingState, LocalErrorState } from '@dwp-frontend/design-system';
import { useTranslation } from 'react-i18next';

import {
  createWorkPlanSimulationRequest,
  selectWorkPlanSimulationCommand,
  selectWorkPlanStudioDisplay,
} from '../model/hris-time-work-plan-model';
import { HrisTimeWorkPlanStudio } from '../components/hris-time-work-plan-studio';

import type { WorkPlanStudioDataSource, WorkPlanStudioScope } from '../api/hris-time-work-plan-api';
import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type {
  WorkPlanDisplay,
  WorkPlanSimulationCommand,
  WorkPlanStudioDisplay,
} from '../model/hris-time-work-plan-model';

/**
 * A simulation must be evaluated against the exact generated ACTION grant immediately before
 * dispatch. The operations adapter supplies this from `useProductActionMutation`; the studio
 * itself intentionally has no route-contract key to fall back to.
 */
export type HrisTimeWorkPlanSimulationExecutor = <T>(
  execute: (authority: ProductSurfaceGovernedMutationAuthority) => Promise<T>
) => Promise<T>;

export type HrisTimeWorkPlanStudioRuntimeProps = Readonly<{
  requestScope: WorkPlanStudioScope;
  dataSource: WorkPlanStudioDataSource;
  simulationExecutor?: HrisTimeWorkPlanSimulationExecutor;
}>;

function commandMatchesPlan(command: WorkPlanSimulationCommand, plan: WorkPlanDisplay): boolean {
  const result = command.simulation;
  return (
    command.receipt.workPlanId === plan.workPlanId &&
    command.receipt.operation === 'SIMULATE' &&
    (!result ||
      (result.workPlanId === plan.workPlanId &&
        result.baseVersion === plan.version &&
        result.policyRevision === plan.policyPack.revision))
  );
}

export function HrisTimeWorkPlanStudioRuntime({
  requestScope,
  dataSource,
  simulationExecutor,
}: HrisTimeWorkPlanStudioRuntimeProps) {
  const { t } = useTranslation('hcm');
  const stableScope = useMemo<WorkPlanStudioScope>(
    () => ({
      ready: requestScope.ready,
      scopeKey: requestScope.scopeKey,
      decisionRevision: requestScope.decisionRevision,
      effectiveOn: requestScope.effectiveOn,
    }),
    [
      requestScope.decisionRevision,
      requestScope.effectiveOn,
      requestScope.ready,
      requestScope.scopeKey,
    ]
  );
  const [workspace, setWorkspace] = useState<WorkPlanStudioDisplay | null>(null);
  const [selectedWorkPlanId, setSelectedWorkPlanId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [command, setCommand] = useState<WorkPlanSimulationCommand | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [commandBusy, setCommandBusy] = useState(false);
  const readGeneration = useRef(0);
  const commandGeneration = useRef(0);
  const commandAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    const generation = ++readGeneration.current;
    commandGeneration.current += 1;
    commandAbort.current?.abort();
    setWorkspace(null);
    setSelectedWorkPlanId(null);
    setCommand(null);
    setCommandError(null);
    setCommandBusy(false);
    setLoadError(false);
    if (!stableScope.ready) {
      setLoading(false);
      return undefined;
    }
    const abort = new AbortController();
    setLoading(true);
    void dataSource
      .read(stableScope, abort.signal)
      .then((source) => {
        const selected = selectWorkPlanStudioDisplay(source);
        if (abort.signal.aborted || generation !== readGeneration.current) return;
        setWorkspace(selected);
        setSelectedWorkPlanId(selected.workPlans[0]?.workPlanId ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (abort.signal.aborted || generation !== readGeneration.current) return;
        setLoadError(true);
        setLoading(false);
      });
    return () => abort.abort();
  }, [dataSource, reloadToken, stableScope]);

  useEffect(
    () => () => {
      commandGeneration.current += 1;
      commandAbort.current?.abort();
    },
    []
  );

  const runCommand = useCallback(
    async (
      plan: WorkPlanDisplay,
      invoke: (signal: AbortSignal) => Promise<unknown>
    ): Promise<void> => {
      const generation = ++commandGeneration.current;
      commandAbort.current?.abort();
      const abort = new AbortController();
      commandAbort.current = abort;
      setCommandBusy(true);
      setCommandError(null);
      try {
        const next = selectWorkPlanSimulationCommand(await invoke(abort.signal));
        if (
          abort.signal.aborted ||
          generation !== commandGeneration.current ||
          !commandMatchesPlan(next, plan)
        ) {
          if (!abort.signal.aborted && generation === commandGeneration.current) {
            setCommandError(t('hrisTime.workPlanStudio.runtime.responseMismatch'));
          }
          return;
        }
        setCommand(next);
      } catch {
        if (!abort.signal.aborted && generation === commandGeneration.current) {
          setCommandError(t('hrisTime.workPlanStudio.runtime.outcomeNotVerified'));
        }
      } finally {
        if (!abort.signal.aborted && generation === commandGeneration.current) {
          setCommandBusy(false);
        }
      }
    },
    [t]
  );

  const simulate = useCallback(
    (plan: WorkPlanDisplay) => {
      if (!workspace || !simulationExecutor || plan.workPlanId !== selectedWorkPlanId) return;
      const request = createWorkPlanSimulationRequest(workspace, plan);
      if (!request) return;
      void runCommand(plan, (signal) =>
        simulationExecutor((authority) =>
          dataSource.simulate(request, stableScope, signal, authority)
        )
      );
    },
    [dataSource, runCommand, selectedWorkPlanId, simulationExecutor, stableScope, workspace]
  );

  const commandReceipt = command?.receipt;

  const reconcileReceipt = useCallback(
    (receiptId: string) => {
      const plan = workspace?.workPlans.find((item) => item.workPlanId === selectedWorkPlanId);
      if (!plan || commandReceipt?.receiptId !== receiptId) return;
      void runCommand(plan, (signal) =>
        dataSource.reconcileReceipt(commandReceipt, stableScope, signal)
      );
    },
    [commandReceipt, dataSource, runCommand, selectedWorkPlanId, stableScope, workspace]
  );

  const selectWorkPlan = useCallback((workPlanId: string | null) => {
    commandGeneration.current += 1;
    commandAbort.current?.abort();
    setSelectedWorkPlanId(workPlanId);
    setCommand(null);
    setCommandError(null);
    setCommandBusy(false);
  }, []);

  if (!stableScope.ready || loading) {
    return <LoadingState label={t('hrisTime.workPlanStudio.runtime.loading')} size="page" />;
  }
  if (loadError || !workspace) {
    return (
      <LocalErrorState
        title={t('hrisTime.workPlanStudio.runtime.unavailableTitle')}
        description={t('hrisTime.workPlanStudio.runtime.unavailableDescription')}
        retryLabel={t('hrisTime.workPlanStudio.runtime.retry')}
        onRetry={() => setReloadToken((current) => current + 1)}
        size="page"
      />
    );
  }
  return (
    <HrisTimeWorkPlanStudio
      workspace={workspace}
      selectedWorkPlanId={selectedWorkPlanId}
      simulationCommand={command}
      simulationBusy={commandBusy}
      simulationError={commandError}
      onSelect={selectWorkPlan}
      onSimulate={simulationExecutor ? simulate : undefined}
      onReconcileReceipt={reconcileReceipt}
    />
  );
}
