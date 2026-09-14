import { HttpError } from '@dwp-frontend/shared-utils';
import { productSurfaceServerNow } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import {
  APPROVAL_INFORMATION_RECEIPT_ROUTE,
  getApprovalInformationCommandReceipt,
} from '@dwp-frontend/shared-utils/api/approval-information-receipt-api';
import {
  approvalInformationReceiptAuthority,
  approvalInformationReceiptEntry,
} from './approval-request-information-receipt-authority';

import type {
  ProductSurfaceEvaluationData,
  ProductSurfaceEvaluationRequest,
} from '@dwp-frontend/shared-utils';
import type { ApprovalInformationReceipt } from '@dwp-frontend/shared-utils/api/approval-information-receipt-api';
import type { RequestActionCommand } from './approval-request-action-model';
import type { ApprovalInformationReceiptSource } from './approval-request-information-receipt-authority';

export type ApprovalInformationReceiptPorts = Readonly<{
  source: () => ApprovalInformationReceiptSource;
  originalWire: (command: RequestActionCommand) => string | undefined;
  isOriginal: (command: RequestActionCommand) => boolean;
  evaluate: (
    request: ProductSurfaceEvaluationRequest,
    options: { signal: AbortSignal }
  ) => Promise<ProductSurfaceEvaluationData>;
}>;

/** Lookup never retries the command or resolves UNKNOWN on behalf of its lifecycle owner. */
export class ApprovalRequestInformationReceiptController {
  private pending?: AbortController;

  get busy() {
    return Boolean(this.pending);
  }

  cancel() {
    this.pending?.abort();
  }

  async read(
    command: RequestActionCommand,
    ports: ApprovalInformationReceiptPorts
  ): Promise<
    Readonly<{
      command: RequestActionCommand;
      receipt: ApprovalInformationReceipt;
      expiresAt: number;
      snapshot: ApprovalInformationReceiptSource['snapshot'];
    }>
  > {
    if (this.pending) throw new HttpError('An original receipt lookup is already running.', 409);
    const entry = approvalInformationReceiptEntry(ports.source());
    const originalBodyBase64 = ports.originalWire(command);
    const originalKey = command.input.idempotencyKey;
    if (
      !entry ||
      command.input.action.kind !== 'respond' ||
      !originalBodyBase64 ||
      !originalKey ||
      !ports.isOriginal(command)
    )
      throw new HttpError('Current receipt read authority is unavailable.', 409);
    const abort = new AbortController();
    this.pending = abort;
    const assertCurrent = () => {
      const current = approvalInformationReceiptEntry(ports.source());
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
        !ports.isOriginal(command) ||
        command.input.idempotencyKey !== originalKey ||
        ports.originalWire(command) !== originalBodyBase64
      )
        throw new HttpError('Original receipt read source changed.', 409);
    };
    try {
      const evaluation = await ports.evaluate(
        {
          subject: { type: 'PRODUCT', productKey: 'approvals', surfaceKey: 'approvals.work' },
          routeContractKey: APPROVAL_INFORMATION_RECEIPT_ROUTE,
          contextKey: entry.context.contextKey,
          contextScopeKey: entry.scope.key,
        },
        { signal: abort.signal }
      );
      assertCurrent();
      const proof = approvalInformationReceiptAuthority(entry, evaluation);
      if (!proof) throw new HttpError('Fresh receipt DATA authority was not granted.', 403);
      const beforeDispatch = () => {
        assertCurrent();
        if (productSurfaceServerNow(entry.source.snapshot!) >= proof.expiresAt)
          throw new HttpError('Receipt read authority expired.', 409);
      };
      beforeDispatch();
      const receipt = await getApprovalInformationCommandReceipt(
        command.input.action.request.requestId,
        originalKey,
        { operation: 'REPLY', originalBodyBase64 },
        proof.authority,
        { beforeDispatch, signal: abort.signal }
      );
      beforeDispatch();
      const snapshot = command.input.informationSnapshot;
      if (
        snapshot &&
        (receipt.roundId !== snapshot.roundId ||
          receipt.generation !== snapshot.targetGeneration ||
          receipt.payloadRevision !== snapshot.payloadRevision + (receipt.materialChange ? 1 : 0) ||
          (!receipt.materialChange && receipt.payloadSha256 !== snapshot.payloadSha256))
      )
        throw new HttpError('Receipt does not confirm the original information round.', 409);
      return Object.freeze({
        command,
        receipt,
        expiresAt: proof.expiresAt,
        snapshot: entry.source.snapshot,
      });
    } finally {
      if (this.pending === abort) this.pending = undefined;
    }
  }
}
