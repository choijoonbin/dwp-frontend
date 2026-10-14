import { ProductSurfaceHighRiskCommandDialog } from '../../../../components/product-surface-high-risk-command';
import { useCompensationPlanningCommandRuntime } from './compensation-planning-command-bindings';
import { CompensationPlanningWorkspace } from './compensation-planning-workspace';
import {
  useCompensationPlanningRequestScope,
  useCompensationPlanningRuntime,
} from './use-compensation-planning-workspace';

import type { CompensationPlanningDataSource } from './compensation-planning-api';
import type { CompensationCycleAuthoringContext } from './compensation-planning-contract';
import type {
  CompensationPlanningCommandExecutors,
  CompensationPlanningCommandIntents,
} from './use-compensation-planning-workspace';

export type HrisCompensationPlanningOperationsRuntimeProps = Readonly<{
  dataSource?: CompensationPlanningDataSource;
  commandExecutors?: CompensationPlanningCommandExecutors;
  commandIntents?: CompensationPlanningCommandIntents;
  cycleAuthoringContext?: CompensationCycleAuthoringContext | null;
}>;

function CompensationPlanningRuntimeView({
  dataSource,
  commandExecutors,
  commandIntents,
  cycleAuthoringContext,
}: HrisCompensationPlanningOperationsRuntimeProps) {
  const requestScope = useCompensationPlanningRequestScope();
  const runtime = useCompensationPlanningRuntime({
    requestScope,
    dataSource,
    commandExecutors,
    commandIntents,
    cycleAuthoringContext,
  });
  return (
    <CompensationPlanningWorkspace
      status={runtime.status}
      cycles={runtime.cycles}
      selectedCycleId={runtime.selectedCycleId}
      cycleDetail={runtime.cycleDetail}
      proposals={runtime.proposals}
      proposalDetail={runtime.proposalDetail}
      selectedProposalId={runtime.selectedProposalId}
      actions={runtime.actions}
      cycleAuthoringContext={runtime.cycleAuthoringContext}
      commandBusy={runtime.commandBusy}
      pendingCommand={runtime.pendingCommand}
      lastResult={runtime.lastResult}
      errorMessage={runtime.errorMessage}
      proposalsError={runtime.proposalsError}
      proposalDetailError={runtime.proposalDetailError}
      proposalLoading={runtime.proposalLoading}
      freshnessWatermark={runtime.freshnessWatermark}
      lastRefreshedAt={runtime.lastRefreshedAt}
      actorId={requestScope.queryMeta.actorId}
      locale={typeof navigator === 'undefined' ? 'en' : navigator.language}
      filter={runtime.filter}
      onFilterChange={runtime.setFilter}
      onSelectCycle={runtime.selectCycle}
      onSelectProposal={runtime.selectProposal}
      onRefresh={runtime.refresh}
      onRetryProposals={runtime.retryProposals}
      onRetryProposalDetail={runtime.retryProposalDetail}
      onRetryPending={runtime.retryPending}
      showPageHeader={false}
    />
  );
}

function GovernedCompensationPlanningRuntime({
  dataSource,
  cycleAuthoringContext,
}: Pick<HrisCompensationPlanningOperationsRuntimeProps, 'dataSource' | 'cycleAuthoringContext'>) {
  const commands = useCompensationPlanningCommandRuntime();
  return (
    <>
      <CompensationPlanningRuntimeView
        dataSource={dataSource}
        commandExecutors={commands.commandExecutors}
        commandIntents={commands.commandIntents}
        cycleAuthoringContext={cycleAuthoringContext}
      />
      <ProductSurfaceHighRiskCommandDialog controller={commands.approveController} />
      <ProductSurfaceHighRiskCommandDialog controller={commands.publishController} />
    </>
  );
}

/**
 * Production mounts resolve all commands through Central's exact ACTION registry. Supplying either
 * injectable command seam selects the isolated runtime and never mixes test authority with
 * production authority.
 */
export function HrisCompensationPlanningOperationsRuntime(
  props: HrisCompensationPlanningOperationsRuntimeProps
) {
  if (props.commandExecutors !== undefined || props.commandIntents !== undefined) {
    return <CompensationPlanningRuntimeView {...props} />;
  }
  return (
    <GovernedCompensationPlanningRuntime
      dataSource={props.dataSource}
      cycleAuthoringContext={props.cycleAuthoringContext}
    />
  );
}

export default HrisCompensationPlanningOperationsRuntime;
