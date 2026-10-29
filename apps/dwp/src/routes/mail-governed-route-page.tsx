import { useMemo } from 'react';
import { MailGovernedAuthorityBoundary } from '@dwp-frontend/shared-utils/api/mail-governed-authority-boundary';
import type {
  MailGovernedRequestAuthority,
  MailProductSurfaceRolloutState,
} from '@dwp-frontend/shared-utils/api/mail-governed-transport';

import { useOptionalAllowedProductSurface } from '../features/shell/allowed-product-surface-context';
import {
  resolveCanaryProductFlags,
  resolveProductSurfaceRolloutMode,
  useProductSurfaceCanaryAuthority,
  type ProductSurfaceRolloutMode,
} from '../features/shell/product-surface-canary-runtime';
import { MailGovernedAuthorityLeaseProvider } from '../features/mail/mail-governed-authority-lease';

import type { ReactNode } from 'react';
import type { AllowedSurfaceDecision } from '../features/shell/product-surface-context';

export function mailRolloutState(
  mode: ProductSurfaceRolloutMode
): MailProductSurfaceRolloutState | null {
  return {
    baseline: '000' as const,
    shadow: '100' as const,
    'enforced-compatibility': '110' as const,
    'surface-ui': '111' as const,
    invalid: null,
  }[mode];
}

export function MailGovernedSurfaceBoundary({
  rolloutMode,
  decision,
  children,
}: {
  rolloutMode: ProductSurfaceRolloutMode;
  decision: AllowedSurfaceDecision | null;
  children: ReactNode;
}) {
  const rolloutState = mailRolloutState(rolloutMode);
  const contextScopeKey = decision?.scope.key;
  const expectedDecisionRevision = decision?.decisionRevision;
  const revalidateAt = decision?.revalidateAt;
  const scopeValidUntil = decision?.scope.validUntil ?? null;
  const eligibleScopeKeysSignature = JSON.stringify(
    decision?.context.scopes.map((scope) => scope.key) ?? []
  );
  const authority = useMemo<MailGovernedRequestAuthority | null>(() => {
    if (!rolloutState) return null;
    if (rolloutState === '000' || rolloutState === '100') {
      return { mode: 'LEGACY_COMPATIBILITY', rolloutState };
    }
    if (!contextScopeKey || !expectedDecisionRevision || !revalidateAt) return null;
    return {
      mode: 'SECURE',
      rolloutState,
      contextScopeKey,
      expectedDecisionRevision,
      revalidateAt,
      scopeValidUntil,
      eligibleContextScopeKeys: JSON.parse(eligibleScopeKeysSignature) as string[],
    };
  }, [
    contextScopeKey,
    eligibleScopeKeysSignature,
    expectedDecisionRevision,
    revalidateAt,
    rolloutState,
    scopeValidUntil,
  ]);

  if (!authority) return null;
  return (
    <MailGovernedAuthorityLeaseProvider authority={authority}>
      <MailGovernedAuthorityBoundary authority={authority}>
        {children}
      </MailGovernedAuthorityBoundary>
    </MailGovernedAuthorityLeaseProvider>
  );
}

export function MailGovernedRoutePage({ children }: { children: ReactNode }) {
  const decision = useOptionalAllowedProductSurface();
  const canaryAuthority = useProductSurfaceCanaryAuthority();
  const rolloutMode = resolveProductSurfaceRolloutMode(
    resolveCanaryProductFlags(canaryAuthority, 'mail')
  );
  return (
    <MailGovernedSurfaceBoundary rolloutMode={rolloutMode} decision={decision}>
      {children}
    </MailGovernedSurfaceBoundary>
  );
}
