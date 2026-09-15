import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth, useProductSurfaceAuthority } from '@dwp-frontend/shared-utils';
import { productSurfaceServerNow } from '@dwp-frontend/shared-utils/auth/product-surface-authority-model';
import { useOptionalAllowedProductSurface } from '../../components/allowed-product-surface-context';
import { PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS } from '../../routes/product-surface-authorization.generated';
import { ApprovalRetentionReceiptController } from './approval-retention-receipt-controller';
import { approvalRetentionReceiptEntry } from './approval-retention-receipt-authority';

import type {
  ApprovalRetentionReceiptMetadata,
  ApprovalRetentionReceiptOriginal,
} from '@dwp-frontend/shared-utils/api/approval-retention-receipt-profile';
import type { ApprovalRetentionReceiptSource } from './approval-retention-receipt-authority';

type ReceiptState = Readonly<{
  pending: boolean;
  original?: ApprovalRetentionReceiptOriginal;
  receipt?: ApprovalRetentionReceiptMetadata;
  error?: Error;
  expiresAt?: number;
  snapshot?: ApprovalRetentionReceiptSource['snapshot'];
}>;

export function useApprovalRetentionReceipt({
  original,
  sourceIsCurrent,
  isOriginal,
}: {
  original: ApprovalRetentionReceiptOriginal;
  sourceIsCurrent: () => boolean;
  isOriginal: (candidate: ApprovalRetentionReceiptOriginal) => boolean;
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
  const controller = useRef(new ApprovalRetentionReceiptController()).current;
  const [state, setState] = useState<ReceiptState>({ pending: false });
  if (generation.current.identity !== identity) {
    generation.current = { identity, epoch: generation.current.epoch + 1 };
    controller.cancel();
  }
  const source: ApprovalRetentionReceiptSource = {
    ready:
      authority.status === 'ready' &&
      page?.context.productKey === 'approvals' &&
      page.context.surfaceKey === 'approvals.admin',
    tenantId: String(auth.user?.tenantId ?? ''),
    actorId: String(auth.user?.userId ?? ''),
    epoch: generation.current.epoch,
    snapshot: authority.snapshot,
    contextKey: page?.context.contextKey,
    contextScopeKey: page?.scope.key,
    projections: PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS,
  };
  const live = useRef({ source, original, sourceIsCurrent, isOriginal, authority });
  live.current = { source, original, sourceIsCurrent, isOriginal, authority };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.cancel();
    };
  }, [controller]);
  useEffect(() => {
    controller.cancel();
    setState({ pending: false });
  }, [controller, original]);
  const currentSource = useCallback(
    () => ({
      ...live.current.source,
      ready:
        mounted.current &&
        live.current.source.ready &&
        live.current.sourceIsCurrent() &&
        live.current.isOriginal(live.current.original),
    }),
    []
  );
  const resultState = useRef(state);
  resultState.current = state;
  const available = Boolean(approvalRetentionReceiptEntry(currentSource(), original));
  const read = useCallback(async () => {
    if (controller.busy) return;
    const candidate = live.current.original;
    const epoch = live.current.source.epoch;
    setState({ pending: true, original: candidate });
    try {
      const result = await controller.read(candidate, {
        source: currentSource,
        isOriginal: (value) => mounted.current && live.current.isOriginal(value),
        evaluate: (request, options) => live.current.authority.evaluateProduct(request, options),
      });
      if (mounted.current && live.current.source.epoch === epoch)
        setState({ pending: false, ...result });
    } catch (error) {
      if (mounted.current && live.current.source.epoch === epoch)
        setState({
          pending: false,
          original: candidate,
          error: error instanceof Error ? error : new Error('Retention receipt read failed.'),
        });
    }
  }, [controller, currentSource]);
  const stateIsCurrent = Boolean(
    available &&
    state.original === original &&
    isOriginal(original) &&
    sourceIsCurrent() &&
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
        approvalRetentionReceiptEntry(currentSource(), current.original) &&
        result.original === current.original &&
        result.receipt &&
        current.isOriginal(current.original) &&
        current.sourceIsCurrent() &&
        result.snapshot === current.source.snapshot &&
        result.snapshot &&
        result.expiresAt != null &&
        productSurfaceServerNow(result.snapshot) < result.expiresAt
      );
    },
    read,
  };
}
