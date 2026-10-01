// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getAllByRole, queryAllByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProviderDataPolicyPartialWarnings } from './provider-data-policy-partial-warnings';

import type { ProviderDataPolicy, ProviderDataPolicyPage } from '@dwp-frontend/shared-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => `${key}:${JSON.stringify(values ?? {})}`,
  }),
}));

const policy = {
  policyId: 'policy-1',
  displayName: 'Retention policy',
  revisionsLimit: 50,
  revisionsHasMore: true,
  revisions: [{ revisionId: 'revision-1' }],
} as ProviderDataPolicy;

let root: Root;
let container: HTMLDivElement;

describe('ProviderDataPolicyPartialWarnings', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('renders separate policy and revision partial-view warnings with server limits', async () => {
    const page: ProviderDataPolicyPage = {
      items: [policy],
      limit: 100,
      hasMore: true,
    };

    await act(async () => {
      root.render(<ProviderDataPolicyPartialWarnings page={page} selectedPolicy={policy} />);
    });

    const alerts = getAllByRole(container, 'alert');
    expect(alerts).toHaveLength(2);
    expect(alerts[0].textContent).toContain('dataGovernance.policy.policyPagePartial');
    expect(alerts[0].textContent).toContain('"limit":100');
    expect(alerts[1].textContent).toContain('dataGovernance.policy.revisionPagePartial');
    expect(alerts[1].textContent).toContain('"limit":50');
    expect(alerts[1].textContent).toContain('Retention policy');
  });

  it('renders no warning when both projections are complete', async () => {
    const completePolicy = { ...policy, revisionsHasMore: false };
    await act(async () => {
      root.render(
        <ProviderDataPolicyPartialWarnings
          page={{ items: [completePolicy], limit: 100, hasMore: false }}
          selectedPolicy={completePolicy}
        />
      );
    });

    expect(queryAllByRole(container, 'alert')).toHaveLength(0);
  });
});
