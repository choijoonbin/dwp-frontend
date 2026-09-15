import { HttpError } from '@dwp-frontend/shared-utils';
import { productSurfaceServerNow } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import {
  APPROVAL_RETENTION_RECEIPT_BINDINGS,
  getApprovalRetentionCommandReceipt,
} from '@dwp-frontend/shared-utils/api/approval-retention-receipt-api';
import { assertApprovalRetentionReceiptOriginal } from '@dwp-frontend/shared-utils/api/approval-retention-receipt-profile';
import {
  approvalRetentionReceiptAuthority,
  approvalRetentionReceiptEntry,
  approvalRetentionReceiptRouteInstalled,
} from './approval-retention-receipt-authority';

import type {
  ProductSurfaceEvaluationData,
  ProductSurfaceEvaluationRequest,
} from '@dwp-frontend/shared-utils';
import type {
  ApprovalRetentionReceiptMetadata,
  ApprovalRetentionReceiptOriginal,
} from '@dwp-frontend/shared-utils/api/approval-retention-receipt-profile';
import type { ApprovalRetentionReceiptSource } from './approval-retention-receipt-authority';

export type ApprovalRetentionReceiptPorts = Readonly<{
  source: () => ApprovalRetentionReceiptSource;
  isOriginal: (original: ApprovalRetentionReceiptOriginal) => boolean;
  evaluate: (
    request: ProductSurfaceEvaluationRequest,
    options: { signal: AbortSignal }
  ) => Promise<ProductSurfaceEvaluationData>;
}>;

function sourceFingerprint(
  entry: NonNullable<ReturnType<typeof approvalRetentionReceiptEntry>>,
  original: ApprovalRetentionReceiptOriginal
) {
  const routeContractKey =
    APPROVAL_RETENTION_RECEIPT_BINDINGS[original.command.operation].routeContractKey;
  return JSON.stringify({
    decisionRevision: entry.source.snapshot?.envelope.decisionRevision,
    activeAccessMode: entry.source.snapshot?.envelope.activeAccessMode,
    context: entry.context,
    scope: entry.scope,
    rolloutState: entry.rolloutState,
    route: entry.source.projections.filter(
      (candidate) => candidate.routeContractKey === routeContractKey
    ),
  });
}

/** A receipt lookup is DATA-only and never replays or reconstructs the original mutation. */
export class ApprovalRetentionReceiptController {
  private pending?: AbortController;

  get busy() {
    return Boolean(this.pending);
  }

  cancel() {
    this.pending?.abort();
  }

  async read(
    original: ApprovalRetentionReceiptOriginal,
    ports: ApprovalRetentionReceiptPorts
  ): Promise<
    Readonly<{
      original: ApprovalRetentionReceiptOriginal;
      receipt: ApprovalRetentionReceiptMetadata;
      expiresAt: number;
      snapshot: ApprovalRetentionReceiptSource['snapshot'];
    }>
  > {
    assertApprovalRetentionReceiptOriginal(original);
    if (this.pending) throw new HttpError('An original retention receipt lookup is running.', 409);
    const entry = approvalRetentionReceiptEntry(ports.source(), original);
    if (!entry || !ports.isOriginal(original))
      throw new HttpError('Current retention receipt authority is unavailable.', 409);
    const abort = new AbortController();
    this.pending = abort;
    const originalSourceFingerprint = sourceFingerprint(entry, original);
    const assertCurrent = () => {
      const current = approvalRetentionReceiptEntry(ports.source(), original);
      if (
        abort.signal.aborted ||
        !current ||
        current.source.snapshot !== entry.source.snapshot ||
        current.source.epoch !== entry.source.epoch ||
        current.source.tenantId !== entry.source.tenantId ||
        current.source.actorId !== entry.source.actorId ||
        current.context.contextKey !== entry.context.contextKey ||
        current.scope.key !== entry.scope.key ||
        current.rolloutState !== entry.rolloutState ||
        sourceFingerprint(current, original) !== originalSourceFingerprint ||
        !ports.isOriginal(original)
      )
        throw new HttpError('Original retention receipt source changed.', 409);
    };
    try {
      const routeContractKey =
        APPROVAL_RETENTION_RECEIPT_BINDINGS[original.command.operation].routeContractKey;
      const evaluation = await ports.evaluate(
        {
          subject: {
            type: 'PRODUCT',
            productKey: 'approvals',
            surfaceKey: 'approvals.admin',
          },
          routeContractKey,
          contextKey: entry.context.contextKey,
          contextScopeKey: entry.scope.key,
        },
        { signal: abort.signal }
      );
      assertCurrent();
      const proof = approvalRetentionReceiptAuthority(entry, evaluation, original);
      if (!proof || proof.resourceSetKey !== original.resourceSetKey)
        throw new HttpError('Fresh retention receipt DATA authority was not granted.', 403);
      const beforeDispatch = () => {
        assertCurrent();
        if (productSurfaceServerNow(entry.source.snapshot!) >= proof.expiresAt)
          throw new HttpError('Retention receipt authority expired.', 409);
      };
      beforeDispatch();
      const receipt = await getApprovalRetentionCommandReceipt(original, proof.authority, {
        routeInstalled: () =>
          approvalRetentionReceiptRouteInstalled(
            original.command.operation,
            ports.source().projections
          ),
        beforeDispatch,
        signal: abort.signal,
      });
      beforeDispatch();
      return Object.freeze({
        original,
        receipt,
        expiresAt: proof.expiresAt,
        snapshot: entry.source.snapshot,
      });
    } finally {
      if (this.pending === abort) this.pending = undefined;
    }
  }
}
