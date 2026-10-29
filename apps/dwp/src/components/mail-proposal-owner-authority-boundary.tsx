import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MailGovernedAuthorityBoundary,
  type MailGovernedRequestAuthority,
  type MailProductSurfaceRolloutState,
} from '@dwp-frontend/shared-utils';

import {
  resolveCanaryProductFlags,
  resolveCanarySurfaceDecision,
  resolveProductSurfaceRolloutMode,
  useProductSurfaceCanaryAuthority,
  type ProductSurfaceRolloutMode,
} from './product-surface-canary-runtime';
import { hasMailProposalOwnerHandoff } from './mail-proposal-owner-handoff';

import type { ReactNode } from 'react';
import type { AllowedSurfaceDecision } from '../features/shell/product-surface-context';

function rolloutState(mode: ProductSurfaceRolloutMode): MailProductSurfaceRolloutState | null {
  return {
    baseline: '000' as const,
    shadow: '100' as const,
    'enforced-compatibility': '110' as const,
    'surface-ui': '111' as const,
    invalid: null,
  }[mode];
}

export function mailProposalOwnerRequestAuthority(
  mode: ProductSurfaceRolloutMode,
  decision: AllowedSurfaceDecision | null
): MailGovernedRequestAuthority | null {
  const state = rolloutState(mode);
  if (!state) return null;
  if (state === '000' || state === '100') {
    return { mode: 'LEGACY_COMPATIBILITY', rolloutState: state };
  }
  if (!decision?.scope.key || !decision.decisionRevision || !decision.revalidateAt) return null;
  return {
    mode: 'SECURE',
    rolloutState: state,
    contextScopeKey: decision.scope.key,
    expectedDecisionRevision: decision.decisionRevision,
    revalidateAt: decision.revalidateAt,
    scopeValidUntil: decision.scope.validUntil ?? null,
    eligibleContextScopeKeys: decision.context.scopes.map((scope) => scope.key),
  };
}

/**
 * Cross-product proposal owners make a narrowly scoped Mail receipt read/cancel call. Register
 * Mail authority only while a verified handoff URL is present; ordinary Calendar, HCM, and Work
 * routes remain free of Mail transport authority.
 */
export function MailProposalOwnerAuthorityBoundary({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams();
  const requested = hasMailProposalOwnerHandoff(searchParams);
  const canaryAuthority = useProductSurfaceCanaryAuthority();
  const mode = resolveProductSurfaceRolloutMode(resolveCanaryProductFlags(canaryAuthority, 'mail'));
  const surfaceDecision = resolveCanarySurfaceDecision(canaryAuthority, {
    productId: 'mail',
    surfaceId: 'mail.work',
  });
  const decision = surfaceDecision.state === 'allowed' ? surfaceDecision : null;
  const scopeKey = decision?.scope.key;
  const revision = decision?.decisionRevision;
  const revalidateAt = decision?.revalidateAt;
  const validUntil = decision?.scope.validUntil ?? null;
  const scopeKeys = JSON.stringify(decision?.context.scopes.map((scope) => scope.key) ?? []);
  const authority = useMemo(
    () => mailProposalOwnerRequestAuthority(mode, decision),
    // The decision object can be recreated by authority refreshes; primitive evidence controls
    // registration so an equivalent projection does not churn the global stack.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, revalidateAt, revision, scopeKey, scopeKeys, validUntil]
  );

  if (!requested || !authority) return children;
  return (
    <MailGovernedAuthorityBoundary authority={authority}>{children}</MailGovernedAuthorityBoundary>
  );
}
