import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { resolveWorkExplorerShortcutAccess } from './work-explorer-access';

import type { ProductSurfaceCanaryAuthority } from '../../../components/product-surface-canary-runtime';
import type { AllowedSurfaceDecision } from '../../shell/product-surface-context';

const NOW = Date.parse('2029-01-01T00:00:00Z');
const FUTURE = '2030-01-01T00:00:00Z';
const ROUTE = 'route.hcm.utility.explorer.page';

function allowedDecision(): AllowedSurfaceDecision {
  const scope = {
    key: 'scope:self:explorer',
    kind: 'SELF' as const,
    displayName: 'My HRIS work',
    isDefault: true,
    readOnly: false,
    validUntil: FUTURE,
  };
  return {
    state: 'allowed',
    routeGrantRef: 'route-grant:work-explorer',
    decisionRevision: 'decision:explorer:9',
    effectiveReadOnly: false,
    revalidateAt: FUTURE,
    scope,
    context: {
      contextKey: 'context:hcm-utility',
      productKey: 'hcm',
      surfaceKey: 'hcm.utility',
      plane: 'work',
      accessMode: 'NORMAL',
      accessSource: 'ENTITLEMENT',
      appResourceKey: 'APP.HCM',
      effectiveGrants: [],
      scopes: [scope],
      revalidateAt: FUTURE,
    },
  };
}

function authority(
  bits: '000' | '100' | '110' | '111',
  decision: AllowedSurfaceDecision | { state: 'route-denied' } = allowedDecision()
): ProductSurfaceCanaryAuthority {
  const allowed = decision.state === 'allowed' ? decision : undefined;
  return {
    flags: {
      contextShadow: bits[0] === '1',
      capabilityEnforcement: bits[1] === '1',
      surfaceUi: bits[2] === '1',
      surfaceUiEvaluation: 'resolved',
    },
    serverNowMs: NOW,
    envelope: allowed
      ? {
          contractVersion: '3',
          decisionRevision: 'envelope:explorer:9',
          sourceRevisions: { auth: 'auth-9' },
          activeAccessMode: 'NORMAL',
          generatedAt: '2029-01-01T00:00:00Z',
          contexts: [allowed.context],
        }
      : undefined,
    routeDecisions: { [ROUTE]: decision },
  };
}

describe('Home Work Explorer exact shortcut', () => {
  it.each(['000', '100'] as const)('stays hidden in rollout %s', (bits) => {
    expect(resolveWorkExplorerShortcutAccess(authority(bits))).toEqual({
      disclosed: false,
      href: '/hr/explore',
    });
  });

  it.each(['110', '111'] as const)(
    'discloses only an allowed exact PAGE and preserves its scope in rollout %s',
    (bits) => {
      expect(resolveWorkExplorerShortcutAccess(authority(bits))).toEqual({
        disclosed: true,
        href: '/hr/explore?scope=scope%3Aself%3Aexplorer',
      });
      expect(resolveWorkExplorerShortcutAccess(authority(bits, { state: 'route-denied' }))).toEqual(
        { disclosed: false, href: '/hr/explore' }
      );
    }
  );

  it('fails closed while the exact decision is pending', () => {
    const pending = authority('111');
    pending.pendingRoutes = { [ROUTE]: true };
    expect(resolveWorkExplorerShortcutAccess(pending).disclosed).toBe(false);
  });

  it('keeps one secondary Explorer action on Home', () => {
    const source = readFileSync(new URL('../../hcm/hcm-home.tsx', import.meta.url), 'utf8');
    expect(source.match(/useWorkExplorerShortcutAccess\(/g)).toHaveLength(1);
    expect(source.match(/hris\.explorer\.homeAction/g)).toHaveLength(1);
    expect(source).toContain('intent="secondary"');
  });

  it('marks the Explorer projection cache as governed and authority-purgeable', () => {
    const source = readFileSync(new URL('./work-explorer.tsx', import.meta.url), 'utf8');
    expect(source).toContain('queryKey: [WORK_EXPLORER_QUERY_KEY, ...requestScope.cacheKey]');
    expect(source.match(/meta: requestScope\.queryMeta/g)).toHaveLength(1);
    expect(source).toContain('enabled: requestScope.ready');
  });

  it('retains only non-denied successful data after refresh failure and binds reconciliation', () => {
    const source = readFileSync(new URL('./work-explorer.tsx', import.meta.url), 'utf8');
    expect(source).toContain('data && explorerQuery.isError && !denied');
    expect(source).toContain("data-refresh-state={retainedAfterRefreshFailure ? 'FAILED_RETAINED'");
    expect(source).toContain('data && !denied && !labelContractInvalid');
    expect(source.match(/hrisReceiptProjectionsShareImmutableContext\(/g)).toHaveLength(2);
    expect(source).toContain('queryWorkExplorerActivityReceipt(');
  });

  it('holds one command lifecycle across rapid input, retry, and receipt reconciliation', () => {
    const source = readFileSync(new URL('./work-explorer.tsx', import.meta.url), 'utf8');
    expect(source).toContain('const commandBusy =');
    expect(source).toContain("commandMessage?.kind === 'retry'");
    expect(source).toContain('preferencesMutation.isPending ||');
    expect(source).toContain('recentMutation.isPending ||');
    expect(source).toContain('reconcileMutation.isPending');
    expect(source.match(/commandBusy \|\| commandLatch\.current/g)).toHaveLength(3);
    expect(source.match(/commandStartBlocked=\{commandBusy\}/g)).toHaveLength(2);
    expect(source).toContain('busy={commandBusy}');
    expect(source).toContain(
      "current?.kind === 'reconcile' ? { ...current, reconcileError: true }"
    );
    expect(source).toContain('idempotencyKey: command.idempotencyKey');
    expect(source).toContain('favoriteLimitReached && !favorite');
    expect(source).toContain('nextExplorerFavoriteRouteKeys(');
    expect(source).toContain("activity.sourceKind !== 'COMMAND_RECEIPT'");
  });
});
