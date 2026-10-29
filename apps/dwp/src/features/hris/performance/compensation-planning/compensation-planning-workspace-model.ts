import type {
  ApproveCompensationPlanBody,
  CompensationBudgetBody,
  CompensationCommandResult,
  CompensationCycle,
  CompensationCycleAuthoringContext,
  CompensationCycleDetail,
  CompensationProposal,
  CompensationProposalCollection,
  CompensationProposalDetail,
  CreateCompensationCycleBody,
  PublishCompensationSnapshotBody,
  ReviseCompensationCycleBody,
  SubmitCompensationProposalBody,
  UpsertCompensationProposalBody,
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

type ActionResult = void | Promise<unknown>;

export type CompensationPlanningWorkspaceActions = Readonly<{
  canCreate: boolean;
  canRevise: boolean;
  canAllocate: boolean;
  canDraftProposal: boolean;
  canSubmitProposal: boolean;
  canApprove: boolean;
  canPublish: boolean;
  canCancel: boolean;
  onCreate?: (body: CreateCompensationCycleBody) => ActionResult;
  onRevise?: (body: ReviseCompensationCycleBody) => ActionResult;
  onAllocate?: (body: CompensationBudgetBody) => ActionResult;
  onDraftProposal?: (proposalId: string, body: UpsertCompensationProposalBody) => ActionResult;
  onSubmitProposal?: (
    proposal: CompensationProposal,
    body: SubmitCompensationProposalBody
  ) => ActionResult;
  onApprove?: (body: ApproveCompensationPlanBody) => ActionResult;
  onPublish?: (body: PublishCompensationSnapshotBody) => ActionResult;
  onCancel?: () => ActionResult;
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
  cycleAuthoringContext?: CompensationCycleAuthoringContext | null;
  pendingCommand?: PendingCompensationCommand | null;
  lastResult?: CompensationCommandResult | null;
  commandBusy?: boolean;
  errorMessage?: string | null;
  proposalsError?: string | null;
  proposalDetailError?: string | null;
  proposalLoading?: boolean;
  freshnessWatermark?: string | null;
  lastRefreshedAt?: number;
  actorId?: string | null;
  locale?: string;
  showPageHeader?: boolean;
  filter?: string;
  onFilterChange?: (value: string) => void;
  onSelectCycle: (cycleId: string) => void;
  onSelectProposal?: (proposalId: string) => void;
  onRefresh: () => void;
  onRetryProposals?: () => void;
  onRetryProposalDetail?: () => void;
  onRetryPending?: () => void;
}>;

type DialogKind =
  'CREATE' | 'REVISE' | 'BUDGET' | 'PROPOSAL' | 'SUBMIT' | 'APPROVE' | 'PUBLISH' | 'CANCEL';

export type DialogState = Readonly<{ kind: DialogKind; proposal?: CompensationProposal }>;
export type Fields = Record<string, string>;
