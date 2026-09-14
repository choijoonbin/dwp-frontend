import { useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  getApprovalRequestDetail,
  HttpError,
  respondToApprovalInformationRequest,
  withdrawApprovalRequest,
} from '@dwp-frontend/shared-utils';

import { useApprovalGovernedMutation } from './use-approval-governed-mutation';
import { isApprovalRequestSnapshotCurrent } from './approval-request-model';
import { sameApprovalRequestInformationSnapshot } from './approval-request-information-snapshot';
import {
  compileApprovalTypedForm,
  requireApprovalTypedSummary,
} from './approval-form-typed-compiler';
import { evaluateApprovalTypedForm } from './approval-form-typed-evaluator';
import { approvalRequestSchemaKind } from './approval-request-schema-model';
import { ApprovalRequestInformationWire } from './approval-request-information-wire';

import type { RefObject } from 'react';
import type { ApprovalRequest } from '@dwp-frontend/shared-utils';
import type { useApprovalManagementCommandScope } from './approval-management-command-scope';
import type { ApprovalRequestInformationSnapshot } from './approval-request-information-snapshot';
import type { RequestActionCommand, RequestActionResult } from './approval-request-action-model';

export function useApprovalRequestLifecycleAction({
  contextScopeKey,
  wireOwnerKey,
  commandScope,
  informationSnapshotIsCurrent,
  userSourceIsReady,
  latestAuthority,
  unresolvedResponse,
  onSuccess,
  onError,
  onSettled,
}: {
  contextScopeKey?: string;
  wireOwnerKey?: string;
  commandScope: ReturnType<typeof useApprovalManagementCommandScope>;
  informationSnapshotIsCurrent: (snapshot: ApprovalRequestInformationSnapshot) => boolean;
  userSourceIsReady: () => boolean;
  latestAuthority: RefObject<{ ready: boolean; requests: readonly ApprovalRequest[] | undefined }>;
  unresolvedResponse: RefObject<RequestActionCommand | undefined>;
  onSuccess: (result: RequestActionResult) => Promise<void>;
  onError: (error: Error, command: RequestActionCommand) => void;
  onSettled: (
    result: RequestActionResult | undefined,
    error: Error | null,
    command: RequestActionCommand
  ) => void;
}) {
  const runRespond = useApprovalGovernedMutation(
    'route.approvals.work.request-information-response.action'
  );
  const runWithdraw = useApprovalGovernedMutation('route.approvals.work.request-withdraw.action');
  const wire = useRef(new ApprovalRequestInformationWire()).current;
  wire.configure(commandScope.binding, wireOwnerKey);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      wire.purge();
    };
  }, [wire]);
  const mutation = useMutation({
    retry: false,
    mutationFn: async (command: RequestActionCommand): Promise<RequestActionResult> => {
      const wireGeneration = wire.ownerGeneration;
      const {
        action,
        responseMessage: submittedMessage,
        responsePayload: submittedPayload,
      } = command.input;
      const snapshot = command.input.informationSnapshot;
      const authorityCurrent = () =>
        (action.kind !== 'respond' || wireGeneration === wire.ownerGeneration) &&
        commandScope.isCurrent(command) &&
        (snapshot
          ? informationSnapshotIsCurrent(snapshot)
          : latestAuthority.current.ready &&
            isApprovalRequestSnapshotCurrent(latestAuthority.current.requests, action.request));
      if (!authorityCurrent())
        throw new HttpError('Approval request authority is not current.', 409);
      const latest = await getApprovalRequestDetail(action.request.requestId, contextScopeKey);
      if (
        !commandScope.isCurrent(command) ||
        latest.request.requestId !== action.request.requestId ||
        latest.request.version !== action.request.version ||
        latest.request.status !== action.request.status
      )
        throw new HttpError('Approval request changed before command execution.', 409);
      if (action.kind === 'respond') {
        if (snapshot && !sameApprovalRequestInformationSnapshot(snapshot, latest))
          throw new HttpError('Information response round changed.', 409);
        if (!userSourceIsReady())
          throw new HttpError('Current response user source is unavailable.', 409);
        if (latest.request.status !== 'NEEDS_INFO')
          throw new HttpError('Approval information response is no longer available.', 409);
        const kind = approvalRequestSchemaKind(latest.formSchema);
        if (kind === 'UNSUPPORTED') throw new HttpError('Unsupported response schema.', 409);
        let payload = submittedPayload;
        if (kind === 'TYPED') {
          const compiled = await compileApprovalTypedForm(latest.formSchema);
          requireApprovalTypedSummary(compiled);
          if (
            compiled.schemaSha256 !== command.input.schemaHash ||
            (snapshot && compiled.schemaSha256 !== snapshot.formSchemaSha256)
          )
            throw new HttpError('Response schema changed.', 409);
          payload = evaluateApprovalTypedForm(compiled, submittedPayload, 'SUBMIT').payload;
        } else if (command.input.schemaHash) throw new HttpError('Response schema changed.', 409);
        const result = await runRespond(async (execution) => {
          if (!authorityCurrent() || !userSourceIsReady())
            throw new HttpError('Approval request authority changed before dispatch.', 409);
          const idempotencyKey = command.input.idempotencyKey;
          if (!idempotencyKey)
            throw new HttpError('Original information response key is missing.', 400);
          if (
            execution.mode === 'SECURE' &&
            execution.idempotencyKey &&
            execution.idempotencyKey !== idempotencyKey
          )
            throw new HttpError('Original information response key changed.', 409);
          const previousPending = unresolvedResponse.current;
          let captured = false;
          unresolvedResponse.current = command;
          try {
            return await respondToApprovalInformationRequest(
              latest.request.requestId,
              submittedMessage,
              payload,
              latest.request.version,
              execution,
              {
                idempotencyKey,
                onOriginalWireBody: (originalBodyBase64) => {
                  if (!authorityCurrent() || !userSourceIsReady())
                    throw new HttpError('Original information authority changed.', 409);
                  wire.capture(command, originalBodyBase64, wireGeneration);
                  captured = true;
                },
                ...(snapshot
                  ? {
                      sourceGeneration: snapshot.sourceGeneration,
                      beforeDispatch: () => {
                        if (!authorityCurrent() || !userSourceIsReady())
                          throw new HttpError(
                            'Information response authority changed during preparation.',
                            409
                          );
                      },
                    }
                  : {}),
              }
            );
          } catch (error) {
            if (!captured && previousPending !== command) {
              if (unresolvedResponse.current === command)
                unresolvedResponse.current = previousPending;
              throw new HttpError('Original information capture failed before dispatch.', 409);
            }
            throw error;
          }
        });
        if (
          snapshot &&
          (!authorityCurrent() ||
            result.requestId !== snapshot.requestId ||
            result.version <= snapshot.requestVersion)
        )
          throw new HttpError('Information response result authority is unavailable.', 503);
        return { result, command };
      }
      if (!['SUBMITTED', 'IN_REVIEW'].includes(latest.request.status))
        throw new HttpError('Approval withdrawal is no longer available.', 409);
      const result = await runWithdraw((execution) => {
        if (
          !commandScope.isCurrent(command) ||
          !latestAuthority.current.ready ||
          !isApprovalRequestSnapshotCurrent(latestAuthority.current.requests, action.request)
        )
          throw new HttpError('Approval request authority changed before dispatch.', 409);
        return withdrawApprovalRequest(latest.request.requestId, latest.request.version, execution);
      });
      return { result, command };
    },
    onSuccess: async (result) => {
      wire.clear(result.command);
      await onSuccess(result);
    },
    onError: (error, command) => {
      onError(error, command);
      if (unresolvedResponse.current !== command) wire.clear(command);
    },
    onSettled,
  });
  return {
    ...mutation,
    readOriginalInformationWire: (command: RequestActionCommand) =>
      mounted.current && commandScope.isCurrent(command) ? wire.read(command) : undefined,
    clearOriginalInformationWire: (command: RequestActionCommand) => {
      if (!mounted.current || !commandScope.isCurrent(command) || !wire.read(command)) return false;
      wire.clear(command);
      return true;
    },
  };
}
