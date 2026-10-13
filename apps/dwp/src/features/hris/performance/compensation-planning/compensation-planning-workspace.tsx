import './compensation-planning-workspace.css';

import type {
  CompensationCycle,
  CompensationCycleDetail,
  CompensationProposal,
  CompensationProposalCollection,
  CompensationProposalDetail,
  CompensationCommandResult,
} from './compensation-planning-contract';
import type { PendingCompensationCommand } from './compensation-planning-command';

export type CompensationPlanningWorkspaceStatus =
  | 'LOADING'
  | 'EMPTY'
  | 'READY'
  | 'DENIED'
  | 'STEP_UP_REQUIRED'
  | 'STALE_VERSION'
  | 'RESULT_UNKNOWN'
  | 'ERROR';

export type CompensationPlanningWorkspaceActions = Readonly<{
  canCreate: boolean;
  canRevise: boolean;
  canAllocate: boolean;
  canDraftProposal: boolean;
  canSubmitProposal: boolean;
  canApprove: boolean;
  canPublish: boolean;
  canCancel: boolean;
  onCreate?: () => void;
  onRevise?: () => void;
  onAllocate?: () => void;
  onDraftProposal?: () => void;
  onSubmitProposal?: (proposal: CompensationProposal) => void;
  onApprove?: () => void;
  onPublish?: () => void;
  onCancel?: () => void;
}>;

export type CompensationPlanningWorkspaceProps = Readonly<{
  status: CompensationPlanningWorkspaceStatus;
  cycles: readonly CompensationCycle[];
  selectedCycleId: string | null;
  cycleDetail: CompensationCycleDetail | null;
  proposals: CompensationProposalCollection | null;
  proposalDetail?: CompensationProposalDetail | null;
  selectedProposalId?: string | null;
  actions: CompensationPlanningWorkspaceActions;
  pendingCommand?: PendingCompensationCommand | null;
  lastResult?: CompensationCommandResult | null;
  errorMessage?: string | null;
  onSelectCycle: (cycleId: string) => void;
  onSelectProposal?: (proposalId: string) => void;
  onRefresh: () => void;
  onRetryPending?: () => void;
}>;

const stateCopy: Record<CompensationPlanningWorkspaceStatus, readonly [string, string]> = {
  LOADING: ['Loading compensation plans', 'Revalidating scope and owner data.'],
  EMPTY: ['No compensation cycles yet', 'Create a governed cycle to begin planning.'],
  READY: ['', ''],
  DENIED: ['Access unavailable', 'Your current duty or population scope does not allow this view.'],
  STEP_UP_REQUIRED: ['Verification required', 'Complete fresh verification to continue this high-risk action.'],
  STALE_VERSION: ['This plan changed', 'Refresh the plan before making another change.'],
  RESULT_UNKNOWN: ['Result needs reconciliation', 'Retry the same sealed command to learn its durable result.'],
  ERROR: ['Compensation planning is unavailable', 'Try again or use the correlation reference with support.'],
};

function StatePanel({
  status,
  errorMessage,
  onRefresh,
  onRetryPending,
}: Pick<
  CompensationPlanningWorkspaceProps,
  'status' | 'errorMessage' | 'onRefresh' | 'onRetryPending'
>) {
  const [title, description] = stateCopy[status];
  return (
    <section className="compplan-panel compplan-state" aria-live="polite">
      <h2>{title}</h2>
      <p>{errorMessage || description}</p>
      <div className="compplan-actions" style={{ justifyContent: 'center', marginTop: 18 }}>
        {status === 'RESULT_UNKNOWN' && onRetryPending ? (
          <button className="compplan-button" data-tone="primary" onClick={onRetryPending}>
            Reconcile result
          </button>
        ) : null}
        {status !== 'LOADING' ? (
          <button className="compplan-button" onClick={onRefresh}>
            Refresh
          </button>
        ) : null}
      </div>
    </section>
  );
}

function Badge({ status }: Readonly<{ status: string }>) {
  return (
    <span className="compplan-badge" data-status={status}>
      {status.replaceAll('_', ' ')}
    </span>
  );
}

function Proposals({
  values,
  proposalDetail,
  selectedProposalId,
  onSelectProposal,
  onSubmit,
  canSubmit,
}: Readonly<{
  values: readonly CompensationProposal[];
  proposalDetail?: CompensationProposalDetail | null;
  selectedProposalId?: string | null;
  onSelectProposal?: (proposalId: string) => void;
  onSubmit?: (proposal: CompensationProposal) => void;
  canSubmit: boolean;
}>) {
  if (values.length === 0) return <p className="compplan-meta">No proposals in this cycle.</p>;
  return (
    <div className="compplan-table-wrap">
      <table className="compplan-table">
        <thead>
          <tr>
            <th>Component</th>
            <th>Worker / assignment</th>
            <th>Amount</th>
            <th>Status</th>
            <th aria-label="Proposal action" />
          </tr>
        </thead>
        <tbody>
          {values.map((proposal) => {
            const detail =
              proposalDetail?.item.proposalId === proposal.proposalId
                ? proposalDetail.item
                : null;
            const amount = proposal.amount ?? detail?.amount;
            return (
            <tr key={proposal.proposalId} aria-selected={selectedProposalId === proposal.proposalId}>
              <td>{proposal.componentCode}</td>
              <td>
                {proposal.workerId}
                <br />
                {proposal.assignmentId}
              </td>
              <td>
                {detail?.amountMasked ? (
                  'Restricted'
                ) : amount ? (
                  `${amount} ${proposal.currency}`
                ) : onSelectProposal ? (
                  <button
                    className="compplan-button"
                    onClick={() => onSelectProposal(proposal.proposalId)}
                  >
                    View amount
                  </button>
                ) : (
                  'Open detail'
                )}
              </td>
              <td><Badge status={proposal.status} /></td>
              <td>
                <button
                  className="compplan-button"
                  disabled={!canSubmit || proposal.status !== 'DRAFT' || !onSubmit}
                  onClick={() => onSubmit?.(proposal)}
                >
                  Submit
                </button>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CompensationPlanningWorkspace({
  status,
  cycles,
  selectedCycleId,
  cycleDetail,
  proposals,
  proposalDetail,
  selectedProposalId,
  actions,
  pendingCommand,
  lastResult,
  errorMessage,
  onSelectCycle,
  onSelectProposal,
  onRefresh,
  onRetryPending,
}: CompensationPlanningWorkspaceProps) {
  const selected = cycleDetail?.item ?? cycles.find((item) => item.cycleId === selectedCycleId);
  const blocking = status !== 'READY' && status !== 'EMPTY';

  return (
    <main className="compplan-shell" data-route="/hr/operations/performance/compensation-planning">
      <header className="compplan-header">
        <div>
          <p className="compplan-eyebrow">Performance · Compensation</p>
          <h1>Compensation planning studio</h1>
          <p className="compplan-subtitle">
            Keep budgets, eligible proposals, independent approval, and the payroll snapshot in one governed flow.
          </p>
        </div>
        <div className="compplan-toolbar">
          <button className="compplan-button" onClick={onRefresh}>Refresh</button>
          <button
            className="compplan-button"
            data-tone="primary"
            disabled={!actions.canCreate || !actions.onCreate}
            onClick={actions.onCreate}
          >
            New cycle
          </button>
        </div>
      </header>

      {blocking ? (
        <StatePanel
          status={status}
          errorMessage={errorMessage}
          onRefresh={onRefresh}
          onRetryPending={onRetryPending}
        />
      ) : status === 'EMPTY' ? (
        <StatePanel status={status} onRefresh={onRefresh} />
      ) : (
        <div className="compplan-layout">
          <section className="compplan-panel" aria-labelledby="compplan-cycles-title">
            <div className="compplan-panel-header">
              <h2 id="compplan-cycles-title">Cycles</h2>
              <span className="compplan-meta">{cycles.length}</span>
            </div>
            <ul className="compplan-list">
              {cycles.map((cycle) => (
                <li key={cycle.cycleId}>
                  <button
                    className="compplan-cycle-row"
                    aria-current={cycle.cycleId === selectedCycleId ? 'true' : undefined}
                    onClick={() => onSelectCycle(cycle.cycleId)}
                  >
                    <span>
                      <strong>{cycle.cycleCode}</strong>
                      <small>{cycle.effectiveFrom} · v{cycle.aggregateVersion}</small>
                    </span>
                    <Badge status={cycle.status} />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="compplan-panel" aria-labelledby="compplan-detail-title">
            <div className="compplan-panel-header">
              <h2 id="compplan-detail-title">Plan readiness</h2>
              {selected ? <Badge status={selected.status} /> : null}
            </div>
            <div className="compplan-body">
              {!selected ? (
                <div className="compplan-state"><p>Select a cycle to inspect its readiness.</p></div>
              ) : (
                <>
                  <dl className="compplan-metric-row">
                    <div className="compplan-metric">
                      <dt>Cycle</dt><dd>{selected.cycleCode}</dd>
                    </div>
                    <div className="compplan-metric">
                      <dt>Budget visibility</dt><dd>{selected.budgetMasked ? 'Restricted' : 'Available'}</dd>
                    </div>
                    <div className="compplan-metric">
                      <dt>Proposal count</dt><dd>{proposals?.items.length ?? '—'}</dd>
                    </div>
                  </dl>

                  {pendingCommand ? (
                    <div className="compplan-callout" data-tone="danger" role="status">
                      <strong>Command awaiting a durable result</strong>
                      <p>{pendingCommand.command} will be replayed with the same idempotency identity.</p>
                    </div>
                  ) : null}

                  {lastResult && 'payloadDigest' in lastResult ? (
                    <div className="compplan-callout" role="status">
                      <strong>Latest command recorded</strong>
                      <p>Digest {lastResult.payloadDigest}</p>
                    </div>
                  ) : null}

                  <section className="compplan-section" aria-labelledby="compplan-proposals-title">
                    <h3 id="compplan-proposals-title">Proposals</h3>
                    <Proposals
                      values={proposals?.items ?? []}
                      proposalDetail={proposalDetail}
                      selectedProposalId={selectedProposalId}
                      onSelectProposal={onSelectProposal}
                      canSubmit={actions.canSubmitProposal}
                      onSubmit={actions.onSubmitProposal}
                    />
                  </section>
                </>
              )}
            </div>
          </section>

          <aside className="compplan-panel compplan-actions-panel" aria-labelledby="compplan-actions-title">
            <div className="compplan-panel-header"><h2 id="compplan-actions-title">Next actions</h2></div>
            <div className="compplan-body">
              <div className="compplan-actions">
                <button className="compplan-button" disabled={!actions.canRevise || !actions.onRevise} onClick={actions.onRevise}>Revise setup</button>
                <button className="compplan-button" disabled={!actions.canAllocate || !actions.onAllocate} onClick={actions.onAllocate}>Allocate budget</button>
                <button className="compplan-button" disabled={!actions.canDraftProposal || !actions.onDraftProposal} onClick={actions.onDraftProposal}>Draft proposal</button>
                <button className="compplan-button" data-tone="primary" disabled={!actions.canApprove || !actions.onApprove} onClick={actions.onApprove}>Approve plan</button>
                <button className="compplan-button" data-tone="primary" disabled={!actions.canPublish || !actions.onPublish} onClick={actions.onPublish}>Publish snapshot</button>
                <button className="compplan-button" data-tone="danger" disabled={!actions.canCancel || !actions.onCancel} onClick={actions.onCancel}>Cancel cycle</button>
              </div>
              <div className="compplan-callout">
                <strong>Hard-cap policy</strong>
                <p>Every submitted amount must remain within its organization and currency budget before approval.</p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

export default CompensationPlanningWorkspace;
