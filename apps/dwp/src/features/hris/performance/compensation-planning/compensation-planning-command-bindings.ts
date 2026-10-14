import { useCallback, useMemo } from 'react';

import { productSurfaceHighRiskCommand } from '../../../../components/product-surface-high-risk-command';
import { useProductActionMutation } from '../../../../components/use-product-action-mutation';
import { useProductSurfaceHighRiskCommandExecutor } from '../../../../components/use-product-surface-high-risk-command-executor';
import {
  allocateCompensationBudget,
  approveCompensationPlan,
  cancelCompensationCycle,
  createCompensationCycle,
  publishCompensationSnapshot,
  reviseCompensationCycle,
  submitCompensationProposal,
  upsertCompensationProposal,
} from './compensation-planning-api';
import {
  COMPENSATION_PLANNING_BASE_PATH,
  parseApproveCompensationPlanBody,
  parseCancelCompensationCycleBody,
  parseCompensationBudgetBody,
  parseCreateCompensationCycleBody,
  parsePublishCompensationSnapshotBody,
  parseReviseCompensationCycleBody,
  parseSubmitCompensationProposalBody,
  parseUpsertCompensationProposalBody,
} from './compensation-planning-contract';
import { validatePendingCompensationCommand } from './compensation-planning-command';

import type { ProductSurfaceHighRiskCommandController } from '../../../../components/product-surface-high-risk-command';
import type { ProductActionRouteContractKey } from '../../../../components/use-product-action-mutation';
import type { CompensationCommandEnvelope } from './compensation-planning-api';
import type {
  CompensationCommandName,
  PendingCompensationCommand,
} from './compensation-planning-command';
import type {
  CompensationPlanningCommandExecutors,
  CompensationPlanningCommandIntents,
} from './use-compensation-planning-workspace';

export const COMPENSATION_PLANNING_ACTION_CONTRACTS = Object.freeze({
  CREATE_CYCLE: 'route.hcm.operations.compensation-cycle-create.action',
  REVISE_CYCLE: 'route.hcm.operations.compensation-cycle-revise.action',
  ALLOCATE_BUDGET: 'route.hcm.operations.compensation-budget-allocate.action',
  UPSERT_PROPOSAL: 'route.hcm.operations.compensation-proposal-upsert.action',
  SUBMIT_PROPOSAL: 'route.hcm.operations.compensation-proposal-submit.action',
  APPROVE_PLAN: 'route.hcm.operations.compensation-plan-approve.action',
  PUBLISH_SNAPSHOT: 'route.hcm.operations.compensation-snapshot-publish.action',
  CANCEL_CYCLE: 'route.hcm.operations.compensation-cycle-cancel.action',
} as const satisfies Record<CompensationCommandName, ProductActionRouteContractKey>);

export const COMPENSATION_PLAN_APPROVE_HIGH_RISK_OPERATION =
  'HCM_COMPENSATION_PLAN_APPROVE' as const;
export const COMPENSATION_SNAPSHOT_PUBLISH_HIGH_RISK_OPERATION =
  'HCM_COMPENSATION_SNAPSHOT_PUBLISH' as const;

type CommandIdFactory = () => string;

function commandId(): string {
  return globalThis.crypto.randomUUID();
}

function envelope<T>(
  body: T,
  idFactory: CommandIdFactory,
  expectedVersion?: number
): CompensationCommandEnvelope<T> {
  return Object.freeze({
    correlationId: idFactory(),
    idempotencyKey: idFactory(),
    ...(expectedVersion === undefined ? {} : { expectedVersion }),
    body,
  });
}

function pending<T>(
  command: CompensationCommandName,
  targetId: string,
  body: T,
  idFactory: CommandIdFactory,
  expectedVersion?: number,
  cycleId?: string
): PendingCompensationCommand<T> {
  return Object.freeze({
    command,
    targetId,
    ...(cycleId === undefined ? {} : { cycleId }),
    envelope: envelope(body, idFactory, expectedVersion),
  });
}

/**
 * Creates fresh immutable command envelopes at the user's action boundary. A retained pending
 * command is replayed as-is; callers never regenerate identity while reconciling an uncertain result.
 */
export function createCompensationPlanningCommandIntents(
  idFactory: CommandIdFactory = commandId
): CompensationPlanningCommandIntents {
  return Object.freeze({
    create: (body) =>
      pending('CREATE_CYCLE', body.cycleCode, parseCreateCompensationCycleBody(body), idFactory),
    revise: (cycleId, version, body) =>
      pending('REVISE_CYCLE', cycleId, parseReviseCompensationCycleBody(body), idFactory, version),
    allocate: (cycleId, version, body) =>
      pending('ALLOCATE_BUDGET', cycleId, parseCompensationBudgetBody(body), idFactory, version),
    draftProposal: (cycleId, version, proposalId, body) =>
      pending(
        'UPSERT_PROPOSAL',
        proposalId,
        parseUpsertCompensationProposalBody(body),
        idFactory,
        version,
        cycleId
      ),
    submitProposal: (cycleId, proposalId, version, body) =>
      pending(
        'SUBMIT_PROPOSAL',
        proposalId,
        parseSubmitCompensationProposalBody(body),
        idFactory,
        version,
        cycleId
      ),
    approve: (cycleId, version, body) =>
      pending('APPROVE_PLAN', cycleId, parseApproveCompensationPlanBody(body), idFactory, version),
    publish: (cycleId, version, body) =>
      pending(
        'PUBLISH_SNAPSHOT',
        cycleId,
        parsePublishCompensationSnapshotBody(body),
        idFactory,
        version
      ),
    cancel: (cycleId, version, body) =>
      pending('CANCEL_CYCLE', cycleId, parseCancelCompensationCycleBody(body), idFactory, version),
  });
}

function requireCommand(
  candidate: PendingCompensationCommand,
  command: CompensationCommandName
): PendingCompensationCommand {
  validatePendingCompensationCommand(candidate);
  if (candidate.command !== command) {
    throw new Error(`Compensation command executor mismatch: ${command}.`);
  }
  return candidate;
}

function requireExpectedVersion(candidate: PendingCompensationCommand): number {
  const version = candidate.envelope.expectedVersion;
  if (version === undefined || !Number.isSafeInteger(version) || version < 0) {
    throw new Error('Compensation command requires a nonnegative object version.');
  }
  return version;
}

function requireProposalCycleId(candidate: PendingCompensationCommand): string {
  if (!candidate.cycleId) {
    throw new Error('Compensation proposal command requires its governed cycle route.');
  }
  return candidate.cycleId;
}

function canonicalEnvelope<T>(
  candidate: PendingCompensationCommand,
  body: T,
  idempotencyKey = candidate.envelope.idempotencyKey
): CompensationCommandEnvelope<T> {
  return Object.freeze({
    correlationId: candidate.envelope.correlationId,
    idempotencyKey,
    ...(candidate.envelope.expectedVersion === undefined
      ? {}
      : { expectedVersion: candidate.envelope.expectedVersion }),
    body,
  });
}

export function compensationPlanApproveHighRiskCommand(candidate: PendingCompensationCommand) {
  requireCommand(candidate, 'APPROVE_PLAN');
  const body = parseApproveCompensationPlanBody(candidate.envelope.body);
  return productSurfaceHighRiskCommand({
    operation: COMPENSATION_PLAN_APPROVE_HIGH_RISK_OPERATION,
    commandMethod: 'POST',
    commandPath: `${COMPENSATION_PLANNING_BASE_PATH}/cycles/${encodeURIComponent(candidate.targetId)}/approve`,
    targetType: 'COMPENSATION_CYCLE',
    targetId: candidate.targetId,
    expectedObjectVersion: requireExpectedVersion(candidate),
    payload: { ...body },
    idempotencyKey: candidate.envelope.idempotencyKey,
  });
}

export function compensationSnapshotPublishHighRiskCommand(candidate: PendingCompensationCommand) {
  requireCommand(candidate, 'PUBLISH_SNAPSHOT');
  const body = parsePublishCompensationSnapshotBody(candidate.envelope.body);
  return productSurfaceHighRiskCommand({
    operation: COMPENSATION_SNAPSHOT_PUBLISH_HIGH_RISK_OPERATION,
    commandMethod: 'POST',
    commandPath: `${COMPENSATION_PLANNING_BASE_PATH}/cycles/${encodeURIComponent(candidate.targetId)}/approved-snapshots`,
    targetType: 'COMPENSATION_CYCLE',
    targetId: candidate.targetId,
    expectedObjectVersion: requireExpectedVersion(candidate),
    payload: { ...body },
    idempotencyKey: candidate.envelope.idempotencyKey,
  });
}

export type CompensationPlanningCommandRuntime = Readonly<{
  commandExecutors: CompensationPlanningCommandExecutors;
  commandIntents: CompensationPlanningCommandIntents;
  approveController: ProductSurfaceHighRiskCommandController;
  publishController: ProductSurfaceHighRiskCommandController;
}>;

/** Resolves every mutation through one exact generated ACTION contract. */
export function useCompensationPlanningCommandRuntime(): CompensationPlanningCommandRuntime {
  const createAuthority = useProductActionMutation(
    COMPENSATION_PLANNING_ACTION_CONTRACTS.CREATE_CYCLE
  );
  const reviseAuthority = useProductActionMutation(
    COMPENSATION_PLANNING_ACTION_CONTRACTS.REVISE_CYCLE
  );
  const budgetAuthority = useProductActionMutation(
    COMPENSATION_PLANNING_ACTION_CONTRACTS.ALLOCATE_BUDGET
  );
  const upsertAuthority = useProductActionMutation(
    COMPENSATION_PLANNING_ACTION_CONTRACTS.UPSERT_PROPOSAL
  );
  const submitAuthority = useProductActionMutation(
    COMPENSATION_PLANNING_ACTION_CONTRACTS.SUBMIT_PROPOSAL
  );
  const cancelAuthority = useProductActionMutation(
    COMPENSATION_PLANNING_ACTION_CONTRACTS.CANCEL_CYCLE
  );
  const approveAuthority = useProductSurfaceHighRiskCommandExecutor({
    operation: COMPENSATION_PLAN_APPROVE_HIGH_RISK_OPERATION,
    buildCommand: compensationPlanApproveHighRiskCommand,
  });
  const publishAuthority = useProductSurfaceHighRiskCommandExecutor({
    operation: COMPENSATION_SNAPSHOT_PUBLISH_HIGH_RISK_OPERATION,
    buildCommand: compensationSnapshotPublishHighRiskCommand,
  });

  const create = useCallback(
    (candidate: PendingCompensationCommand) => {
      requireCommand(candidate, 'CREATE_CYCLE');
      const body = parseCreateCompensationCycleBody(candidate.envelope.body);
      return createAuthority((authority) =>
        createCompensationCycle(canonicalEnvelope(candidate, body), authority)
      );
    },
    [createAuthority]
  );
  const revise = useCallback(
    (candidate: PendingCompensationCommand) => {
      requireCommand(candidate, 'REVISE_CYCLE');
      const body = parseReviseCompensationCycleBody(candidate.envelope.body);
      return reviseAuthority((authority) =>
        reviseCompensationCycle(candidate.targetId, canonicalEnvelope(candidate, body), authority)
      );
    },
    [reviseAuthority]
  );
  const allocate = useCallback(
    (candidate: PendingCompensationCommand) => {
      requireCommand(candidate, 'ALLOCATE_BUDGET');
      const body = parseCompensationBudgetBody(candidate.envelope.body);
      return budgetAuthority((authority) =>
        allocateCompensationBudget(
          candidate.targetId,
          canonicalEnvelope(candidate, body),
          authority
        )
      );
    },
    [budgetAuthority]
  );
  const upsert = useCallback(
    (candidate: PendingCompensationCommand) => {
      requireCommand(candidate, 'UPSERT_PROPOSAL');
      const cycleId = requireProposalCycleId(candidate);
      const body = parseUpsertCompensationProposalBody(candidate.envelope.body);
      if (body.content.cyclePublicId !== cycleId) {
        throw new Error('Compensation proposal route does not match its sealed cycle identity.');
      }
      return upsertAuthority((authority) =>
        upsertCompensationProposal(
          cycleId,
          candidate.targetId,
          canonicalEnvelope(candidate, body),
          authority
        )
      );
    },
    [upsertAuthority]
  );
  const submit = useCallback(
    (candidate: PendingCompensationCommand) => {
      requireCommand(candidate, 'SUBMIT_PROPOSAL');
      const body = parseSubmitCompensationProposalBody(candidate.envelope.body);
      return submitAuthority((authority) =>
        submitCompensationProposal(
          requireProposalCycleId(candidate),
          candidate.targetId,
          canonicalEnvelope(candidate, body),
          authority
        )
      );
    },
    [submitAuthority]
  );
  const approve = useCallback(
    (candidate: PendingCompensationCommand) => {
      requireCommand(candidate, 'APPROVE_PLAN');
      return approveAuthority.execute((authority, descriptor) => {
        const body = parseApproveCompensationPlanBody(candidate.envelope.body);
        return approveCompensationPlan(
          candidate.targetId,
          canonicalEnvelope(
            candidate,
            body,
            descriptor?.idempotencyKey ?? candidate.envelope.idempotencyKey
          ),
          authority
        );
      }, candidate);
    },
    [approveAuthority]
  );
  const publish = useCallback(
    (candidate: PendingCompensationCommand) => {
      requireCommand(candidate, 'PUBLISH_SNAPSHOT');
      return publishAuthority.execute((authority, descriptor) => {
        const body = parsePublishCompensationSnapshotBody(candidate.envelope.body);
        return publishCompensationSnapshot(
          candidate.targetId,
          canonicalEnvelope(
            candidate,
            body,
            descriptor?.idempotencyKey ?? candidate.envelope.idempotencyKey
          ),
          authority
        );
      }, candidate);
    },
    [publishAuthority]
  );
  const cancel = useCallback(
    (candidate: PendingCompensationCommand) => {
      requireCommand(candidate, 'CANCEL_CYCLE');
      const body = parseCancelCompensationCycleBody(candidate.envelope.body);
      return cancelAuthority((authority) =>
        cancelCompensationCycle(candidate.targetId, canonicalEnvelope(candidate, body), authority)
      );
    },
    [cancelAuthority]
  );
  const commandIntents = useMemo(() => createCompensationPlanningCommandIntents(), []);

  return useMemo(
    () => ({
      commandExecutors: {
        CREATE_CYCLE: create,
        REVISE_CYCLE: revise,
        ALLOCATE_BUDGET: allocate,
        UPSERT_PROPOSAL: upsert,
        SUBMIT_PROPOSAL: submit,
        APPROVE_PLAN: approve,
        PUBLISH_SNAPSHOT: publish,
        CANCEL_CYCLE: cancel,
      },
      commandIntents,
      approveController: approveAuthority.controller,
      publishController: publishAuthority.controller,
    }),
    [
      allocate,
      approve,
      approveAuthority.controller,
      cancel,
      commandIntents,
      create,
      publish,
      publishAuthority.controller,
      revise,
      submit,
      upsert,
    ]
  );
}
