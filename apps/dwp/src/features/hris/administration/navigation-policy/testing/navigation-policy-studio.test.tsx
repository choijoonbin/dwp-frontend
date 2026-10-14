import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { NavigationPolicyStudio } from '../components/navigation-policy-studio';

import type { NavigationPolicyWorkspace } from '../model/navigation-policy-model';

describe('NavigationPolicyStudio', () => {
  it('renders the 7-group, 17-node studio with impact, approval, recovery and audit context', () => {
    const html = render('EMPTY', workspace('EMPTY', 'CURRENT'));
    expect(html).toContain('data-testid="navigation-policy-studio"');
    expect(html).toContain('HRIS navigation policy');
    expect(html).toContain('7 groups · 17 canonical nodes');
    expect(html).toContain('Effective = canonical IA');
    expect(html).toContain('Visibility never grants authority');
    expect(html).toContain('Restore creates a new revision');
    expect(html).toContain('CREATE DRAFT');
    expect(html).toContain('Governed commands unavailable');
    expect(html).toContain('disabled=""');
  });

  it('keeps denied, unavailable, stale and partial states materially distinct', () => {
    expect(render('DENIED')).toContain('Navigation-policy access is restricted');
    expect(render('UNAVAILABLE')).toContain('Navigation-policy service is unavailable');
    expect(render('STALE', workspace('COMPLETE', 'STALE'))).toContain('Policy evidence is stale');
    expect(render('PARTIAL', workspace('PARTIAL', 'CURRENT'))).toContain(
      'Some policy evidence is unavailable'
    );
  });

  it('does not disclose scope identity on denied or unavailable surfaces', () => {
    expect(render('DENIED')).not.toContain('SKAX Korea');
    expect(render('UNAVAILABLE')).not.toContain('SKAX Korea');
  });
});

function render(
  state: Parameters<typeof NavigationPolicyStudio>[0]['state'],
  value?: NavigationPolicyWorkspace
) {
  return renderToStaticMarkup(
    createElement(NavigationPolicyStudio, {
      state,
      workspace: value,
      locale: 'en',
      onRefresh: vi.fn(),
    })
  );
}

function workspace(
  state: 'COMPLETE' | 'EMPTY' | 'PARTIAL',
  freshness: 'CURRENT' | 'STALE'
): NavigationPolicyWorkspace {
  return {
    projectionVersion: '1',
    asOf: '2026-10-14T03:00:00Z',
    queryState: {
      state,
      freshness,
      scopeDecisionRevision: 'decision-9',
      partialFailures:
        state === 'PARTIAL'
          ? [
              {
                componentKey: 'legal-overlay',
                errorCode: 'OWNER_TIMEOUT',
                correlationId: '10000000-0000-4000-8000-000000000001',
                retryable: true,
              },
            ]
          : [],
    },
    scope: {
      scopeKind: 'TENANT',
      scopePublicId: '20000000-0000-4000-8000-000000000001',
      displayName: 'SKAX Korea',
    },
    tenantBaseline: null,
    activeRevision: null,
    draft: null,
  };
}
