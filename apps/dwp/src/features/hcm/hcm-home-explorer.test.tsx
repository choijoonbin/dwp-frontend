import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { resolveWorkExplorerShortcutAccess } from '../../components/work-explorer-shortcut-access';

import type { ProductSurfaceCanaryAuthority } from '../../components/product-surface-canary-runtime';
import type { AllowedSurfaceDecision } from '../../components/product-surface-context';

const NOW = Date.parse('2029-01-01T00:00:00Z');
const FUTURE = '2030-01-01T00:00:00Z';
const ROUTE = 'route.hcm.utility.explorer.page';

function allowedDecision(): AllowedSurfaceDecision {
  return {
    state: 'allowed',
    routeGrantRef: 'route-grant:work-explorer',
    decisionRevision: 'decision:explorer:9',
    effectiveReadOnly: false,
    revalidateAt: FUTURE,
    scope: {
      key: 'scope:self:explorer',
      kind: 'SELF',
      displayName: 'My HRIS work',
      isDefault: true,
      readOnly: false,
      validUntil: FUTURE,
    },
    context: {
      contextKey: 'context:hcm-utility',
      productKey: 'hcm',
      surfaceKey: 'hcm.utility',
      plane: 'work',
      accessMode: 'NORMAL',
      accessSource: 'ENTITLEMENT',
      appResourceKey: 'APP.HCM',
      effectiveGrants: [],
      scopes: [
        {
          key: 'scope:self:explorer',
          kind: 'SELF',
          displayName: 'My HRIS work',
          isDefault: true,
          readOnly: false,
          validUntil: FUTURE,
        },
      ],
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

describe('HCM Home Work Explorer secondary action', () => {
  it.each(['000', '100'] as const)(
    'does not disclose the Explorer shortcut without exact-route enforcement in rollout %s',
    (bits) => {
      expect(resolveWorkExplorerShortcutAccess(authority(bits))).toEqual({
        disclosed: false,
        href: '/hr/explore',
      });
    }
  );

  it.each(['110', '111'] as const)(
    'discloses only the trusted exact PAGE and carries its canonical scope in rollout %s',
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

  it('fails closed while the exact Explorer decision is pending', () => {
    const pending = authority('111');
    pending.pendingRoutes = { [ROUTE]: true };
    expect(resolveWorkExplorerShortcutAccess(pending).disclosed).toBe(false);
  });

  it('adds one secondary action without changing the Home primary workspace behavior', () => {
    const source = readFileSync(new URL('./hcm-home.tsx', import.meta.url), 'utf8');
    expect(source.match(/useWorkExplorerShortcutAccess\(/g)).toHaveLength(1);
    expect(source.match(/hris\.explorer\.homeAction/g)).toHaveLength(1);
    expect(source).toContain('intent="secondary"');
    expect(source).toContain('flexWrap="wrap"');
    expect(source).toContain("justifyContent={{ xs: 'flex-start', lg: 'flex-end' }}");
  });
});
