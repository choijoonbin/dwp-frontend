import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  createApprovalRequest,
  getApprovalDraftReconciliation,
  getApprovalRequestDetail,
  HttpError,
  updateApprovalDraft,
} from '@dwp-frontend/shared-utils';

import {
  ApprovalDraftAutosave,
  approvalDraftFingerprint,
  ApprovalDraftSaveBlockedError,
  ApprovalDraftSaveConflictError,
} from './approval-request-autosave-model';
import {
  approvalRequestDetailSnapshot,
  approvalRequestVerifiedDetailSnapshot,
} from './approval-request-draft-snapshot';
import { useApprovalGovernedMutation } from './use-approval-governed-mutation';

import type { ApprovalRequestDetail } from '@dwp-frontend/shared-utils';
import type {
  ApprovalDraftReceipt,
  ApprovalDraftSaveAttempt,
  ApprovalDraftSnapshot,
} from './approval-request-autosave-model';

export function useApprovalRequestAutosave({
  sessionKey,
  input,
  ready,
  initialDetail,
  contextScopeKey,
  isCurrent,
  canWrite = () => true,
}: {
  sessionKey: string;
  input?: ApprovalDraftSnapshot;
  ready: boolean;
  initialDetail?: ApprovalRequestDetail;
  contextScopeKey?: string;
  isCurrent: () => boolean;
  canWrite?: () => boolean;
}) {
  const runCreate = useApprovalGovernedMutation('route.approvals.work.request-create.action');
  const runUpdate = useApprovalGovernedMutation('route.approvals.work.request-draft-update.action');
  const current = useRef({
    sessionKey,
    ready,
    isCurrent,
    canWrite,
    contextScopeKey,
    runCreate,
    runUpdate,
  });
  current.current = {
    sessionKey,
    ready,
    isCurrent,
    canWrite,
    contextScopeKey,
    runCreate,
    runUpdate,
  };

  const controller = useMemo(() => {
    let dispatched = false;
    let creating = false;
    let checkingReceipt = false;
    const assertCurrent = () => {
      if (
        current.current.sessionKey !== sessionKey ||
        !current.current.ready ||
        !current.current.isCurrent() ||
        !current.current.canWrite()
      ) {
        throw new ApprovalDraftSaveBlockedError();
      }
    };
    const saveAttempt = async (
      attempt: ApprovalDraftSaveAttempt
    ): Promise<ApprovalDraftReceipt> => {
      dispatched = false;
      creating = !attempt.requestId;
      checkingReceipt = false;
      assertCurrent();
      const execute = attempt.requestId ? current.current.runUpdate : current.current.runCreate;
      const receipt = await execute(async (execution) => {
        assertCurrent();
        dispatched = true;
        if (attempt.requestId) {
          const result = await updateApprovalDraft(
            attempt.requestId,
            {
              ...attempt.input,
              payload: structuredClone(attempt.input.payload),
              expectedVersion: attempt.expectedVersion!,
            },
            execution,
            { idempotencyKey: attempt.idempotencyKey }
          );
          return result.request;
        }
        return createApprovalRequest(
          { ...attempt.input, payload: structuredClone(attempt.input.payload) },
          execution,
          { idempotencyKey: attempt.idempotencyKey }
        );
      });
      assertCurrent();
      return receipt;
    };
    return new ApprovalDraftAutosave({
      save: saveAttempt,
      reconcile: async (attempt) => {
        checkingReceipt = true;
        assertCurrent();
        const reconciliation = await getApprovalDraftReconciliation(
          attempt.idempotencyKey,
          current.current.contextScopeKey
        );
        assertCurrent();
        if (
          reconciliation.idempotencyKey !== attempt.idempotencyKey ||
          !Array.isArray(reconciliation.receipts)
        )
          throw new ApprovalDraftSaveBlockedError();
        const route = attempt.requestId
          ? `PUT /v1/requests/${attempt.requestId}/draft`
          : 'POST /v1/requests';
        const receipts = reconciliation.receipts.filter(
          (entry) =>
            entry.route === route && entry.commandType === (attempt.requestId ? 'UPDATE' : 'CREATE')
        );
        // Replaying only the same immutable key cannot allocate a second draft after response loss.
        if (receipts.length === 0) return saveAttempt(attempt);
        if (
          receipts.length !== 1 ||
          receipts[0]!.draft.deletedAt ||
          !Number.isSafeInteger(receipts[0]!.draft.version) ||
          receipts[0]!.draft.version < 0 ||
          (attempt.requestId && receipts[0]!.draft.requestId !== attempt.requestId)
        )
          throw new ApprovalDraftSaveBlockedError();
        const requestId = receipts[0]!.draft.requestId;
        const latest = await getApprovalRequestDetail(requestId, current.current.contextScopeKey);
        assertCurrent();
        const verified = await approvalRequestVerifiedDetailSnapshot(latest);
        assertCurrent();
        if (
          latest.request.requestId !== requestId ||
          latest.request.status !== 'DRAFT' ||
          latest.request.version < receipts[0]!.draft.version ||
          (attempt.expectedVersion !== undefined &&
            latest.request.version <= attempt.expectedVersion) ||
          approvalDraftFingerprint(verified) !== approvalDraftFingerprint(attempt.input)
        ) {
          throw new ApprovalDraftSaveConflictError(latest.request);
        }
        return latest.request;
      },
      classify: (error) => {
        if (error instanceof ApprovalDraftSaveConflictError) return 'CONFLICT';
        if (error instanceof HttpError) {
          if ([401, 403, 404].includes(error.status)) return 'DENIED';
          if (error.status === 409) return checkingReceipt || creating ? 'UNKNOWN' : 'CONFLICT';
          if (error.status < 500) return 'ERROR';
        }
        return dispatched ? 'UNKNOWN' : 'UNAVAILABLE';
      },
    });
  }, [sessionKey]);

  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );

  useEffect(() => {
    controller.activate();
    return () => controller.dispose();
  }, [controller]);

  useEffect(() => {
    if (initialDetail?.request.status === 'DRAFT') {
      controller.hydrate(initialDetail.request, approvalRequestDetailSnapshot(initialDetail));
    }
    controller.update(input, ready);
  }, [controller, initialDetail, input, ready]);

  return {
    ...state,
    controller,
    flush: () => controller.flush(),
    reconcile: () => controller.reconcile(),
    reviewLatest: (receipt: ApprovalDraftReceipt) => controller.reviewLatest(receipt),
    reviewLatestDetail: (detail: ApprovalRequestDetail, currentSchemaHash?: string) =>
      controller.reviewLatest(detail.request, approvalRequestDetailSnapshot(detail), {
        currentSchemaHash,
        serverSchemaHash: detail.formSchemaSha256 ?? undefined,
      }),
    reviewedInput: () => controller.reviewedInput(),
    reapply: () => controller.reapply(),
    resume: () => controller.resume(),
  };
}
