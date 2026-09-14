import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth, useProductSurfaceAuthority } from '@dwp-frontend/shared-utils';
import { productSurfaceServerNow } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import { useOptionalAllowedProductSurface } from '../../components/allowed-product-surface-context';
import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../../routes/product-surface-authorization.generated';
import { ApprovalRequestInformationReceiptController } from './approval-request-information-receipt-controller';
import { approvalInformationReceiptEntry } from './approval-request-information-receipt-authority';

import type { ApprovalInformationReceipt } from '@dwp-frontend/shared-utils/api/approval-information-receipt-api';
import type { RequestActionCommand } from './approval-request-action-model';
import type { ApprovalInformationReceiptSource } from './approval-request-information-receipt-authority';

type ReceiptState = Readonly<{
  pending: boolean;
  command?: RequestActionCommand;
  receipt?: ApprovalInformationReceipt;
  error?: Error;
  expiresAt?: number;
  snapshot?: ApprovalInformationReceiptSource['snapshot'];
}>;

export function useApprovalRequestInformationReceipt({
  sourceIsCurrent,
  originalWire,
  isOriginal,
}: {
  sourceIsCurrent: () => boolean;
  originalWire: (command: RequestActionCommand) => string | undefined;
  isOriginal: (command: RequestActionCommand) => boolean;
}) {
  const auth = useAuth();
  const authority = useProductSurfaceAuthority();
  const page = useOptionalAllowedProductSurface();
  const identity = JSON.stringify([
    auth.user?.tenantId,
    auth.user?.userId,
    authority.snapshot?.envelope.activeAccessMode,
    page?.context.contextKey,
    page?.scope.key,
  ]);
  const generation = useRef({ identity, epoch: 0 });
  const controller = useRef(new ApprovalRequestInformationReceiptController()).current;
  const [state, setState] = useState<ReceiptState>({ pending: false });
  if (generation.current.identity !== identity) {
    generation.current = { identity, epoch: generation.current.epoch + 1 };
    controller.cancel();
    setState({ pending: false });
  }
  const source: ApprovalInformationReceiptSource = {
    ready:
      authority.status === 'ready' &&
      page?.context.productKey === 'approvals' &&
      page.context.surfaceKey === 'approvals.work',
    tenantId: String(auth.user?.tenantId ?? ''),
    actorId: String(auth.user?.userId ?? ''),
    epoch: generation.current.epoch,
    snapshot: authority.snapshot,
    contextKey: page?.context.contextKey,
    contextScopeKey: page?.scope.key,
    projections: PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS,
  };
  const live = useRef({ source, sourceIsCurrent, originalWire, isOriginal, authority });
  live.current = { source, sourceIsCurrent, originalWire, isOriginal, authority };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.cancel();
    };
  }, [controller]);
  const currentSource = useCallback(
    () => ({
      ...live.current.source,
      ready: mounted.current && live.current.source.ready && live.current.sourceIsCurrent(),
    }),
    []
  );
  const resultState = useRef(state);
  resultState.current = state;
  const available = Boolean(approvalInformationReceiptEntry(currentSource()));
  const read = useCallback(
    async (command: RequestActionCommand) => {
      if (controller.busy) return;
      const epoch = live.current.source.epoch;
      setState({ pending: true, command });
      try {
        const result = await controller.read(command, {
          source: currentSource,
          originalWire: (original) => live.current.originalWire(original),
          isOriginal: (original) => mounted.current && live.current.isOriginal(original),
          evaluate: (request, options) => live.current.authority.evaluateProduct(request, options),
        });
        if (mounted.current && live.current.source.epoch === epoch)
          setState({ pending: false, ...result });
      } catch (error) {
        if (mounted.current && live.current.source.epoch === epoch)
          setState({
            pending: false,
            command,
            error: error instanceof Error ? error : new Error('Receipt read failed.'),
          });
      }
    },
    [controller, currentSource]
  );
  const stateIsCurrent = Boolean(
    available &&
    state.command &&
    isOriginal(state.command) &&
    originalWire(state.command) &&
    (!state.receipt ||
      (state.snapshot === source.snapshot &&
        state.snapshot &&
        state.expiresAt != null &&
        productSurfaceServerNow(state.snapshot) < state.expiresAt))
  );
  return {
    available,
    pending: controller.busy,
    receipt: stateIsCurrent ? state.receipt : undefined,
    error: stateIsCurrent ? state.error : undefined,
    isCurrent: () => {
      const result = resultState.current;
      const current = live.current;
      return Boolean(
        approvalInformationReceiptEntry(currentSource()) &&
        result.command &&
        result.receipt &&
        current.isOriginal(result.command) &&
        current.originalWire(result.command) &&
        result.snapshot === current.source.snapshot &&
        result.snapshot &&
        result.expiresAt != null &&
        productSurfaceServerNow(result.snapshot) < result.expiresAt
      );
    },
    read,
  };
}
