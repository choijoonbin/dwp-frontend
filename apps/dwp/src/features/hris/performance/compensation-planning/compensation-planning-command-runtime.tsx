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

/**
 * Owner runtime. Until Central registers the sealed action and HIGH-risk
 * descriptors, omitted executors leave every mutation visibly fail-closed.
 */
export function HrisCompensationPlanningOperationsRuntime({
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
    />
  );
}

export default HrisCompensationPlanningOperationsRuntime;
