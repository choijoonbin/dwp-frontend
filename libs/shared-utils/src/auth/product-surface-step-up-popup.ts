export const PRODUCT_SURFACE_STEP_UP_COMPLETION_CHANNEL =
  'dwp:product-surface-step-up-completion:v1' as const;
export const PRODUCT_SURFACE_STEP_UP_COMPLETION_TYPE =
  'dwp:product-surface-step-up-oidc-complete' as const;

export type ProductSurfaceStepUpCompletionMessage = Readonly<{
  type: typeof PRODUCT_SURFACE_STEP_UP_COMPLETION_TYPE;
  flowId: string;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function isProductSurfaceStepUpFlowId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

export function parseProductSurfaceStepUpCompletion(
  value: unknown
): ProductSurfaceStepUpCompletionMessage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    Object.keys(candidate).length !== 2 ||
    candidate.type !== PRODUCT_SURFACE_STEP_UP_COMPLETION_TYPE ||
    !isProductSurfaceStepUpFlowId(candidate.flowId)
  ) {
    return null;
  }
  return candidate as ProductSurfaceStepUpCompletionMessage;
}

export function matchesProductSurfaceStepUpCompletion(
  value: unknown,
  expectedFlowRef: string
): value is ProductSurfaceStepUpCompletionMessage {
  const message = parseProductSurfaceStepUpCompletion(value);
  return Boolean(message && message.flowId === expectedFlowRef);
}

export function isTrustedProductSurfaceStepUpWindowCompletion({
  value,
  expectedFlowRef,
  eventOrigin,
  expectedOrigin,
  sourceMatches,
}: {
  value: unknown;
  expectedFlowRef: string;
  eventOrigin: string;
  expectedOrigin: string;
  sourceMatches: boolean;
}): boolean {
  return (
    sourceMatches &&
    eventOrigin === expectedOrigin &&
    matchesProductSurfaceStepUpCompletion(value, expectedFlowRef)
  );
}

export function signalProductSurfaceStepUpCompletion(
  flowId: string,
  targetOrigin: string,
  opener: Pick<Window, 'postMessage'> | null = window.opener
): void {
  if (!isProductSurfaceStepUpFlowId(flowId)) {
    throw new Error('OIDC step-up flow identifier is invalid.');
  }
  const message: ProductSurfaceStepUpCompletionMessage = {
    type: PRODUCT_SURFACE_STEP_UP_COMPLETION_TYPE,
    flowId,
  };
  opener?.postMessage(message, targetOrigin);
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(PRODUCT_SURFACE_STEP_UP_COMPLETION_CHANNEL);
    channel.postMessage(message);
    channel.close();
  }
}
