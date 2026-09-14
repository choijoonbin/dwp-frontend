import { readApprovalWorkflowRuntimePins } from './approval-quorum-contract';
import type { ApprovalWorkflowRuntimePins } from './approval-quorum-contract';

export type ApprovalInformationRound = Readonly<{
  roundId: string;
  sourceGeneration: number;
  targetGeneration: number;
  pins: ApprovalWorkflowRuntimePins;
  payloadRevision: number;
  payloadSha256: string;
}>;

export function readApprovalInformationRound(value: unknown): ApprovalInformationRound | null {
  if (value == null) return null;
  const invalid = () => {
    throw new Error('Invalid approval information round');
  };
  if (typeof value !== 'object' || Array.isArray(value)) return invalid();
  const data = value as Record<string, unknown>;
  const keys = [
    'roundId',
    'sourceGeneration',
    'targetGeneration',
    'pins',
    'payloadRevision',
    'payloadSha256',
  ];
  if (
    Object.keys(data).length !== keys.length ||
    !keys.every((key) => Object.hasOwn(data, key)) ||
    typeof data.roundId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
      data.roundId
    ) ||
    typeof data.sourceGeneration !== 'number' ||
    !Number.isSafeInteger(data.sourceGeneration) ||
    data.sourceGeneration < 1 ||
    typeof data.targetGeneration !== 'number' ||
    !Number.isSafeInteger(data.targetGeneration) ||
    data.targetGeneration !== data.sourceGeneration + 1 ||
    typeof data.payloadRevision !== 'number' ||
    !Number.isSafeInteger(data.payloadRevision) ||
    data.payloadRevision < 1 ||
    typeof data.payloadSha256 !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(data.payloadSha256)
  )
    return invalid();
  return Object.freeze({
    roundId: data.roundId,
    sourceGeneration: data.sourceGeneration,
    targetGeneration: data.targetGeneration,
    payloadRevision: data.payloadRevision,
    payloadSha256: data.payloadSha256,
    pins: readApprovalWorkflowRuntimePins(data.pins),
  });
}
