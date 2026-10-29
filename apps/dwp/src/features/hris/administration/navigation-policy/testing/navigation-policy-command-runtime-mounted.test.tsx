import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', async () => {
  const { hcmTestUseTranslation } = await import('../../../../../test-utils/hcm-i18n-test-stub');
  return { useTranslation: hcmTestUseTranslation };
});

const observed = vi.hoisted(() => ({ workspaceProps: undefined as unknown }));

vi.mock('../pages/hris-navigation-policy-workspace', () => ({
  HrisNavigationPolicyWorkspace: (props: unknown) => {
    observed.workspaceProps = props;
    return createElement('div', { 'data-testid': 'workspace-probe' });
  },
}));

vi.mock('../../../../../components/use-product-action-mutation', () => ({
  useProductActionMutation: () => vi.fn(),
}));

vi.mock('../../../../../components/use-product-surface-high-risk-command-executor', () => ({
  useProductSurfaceHighRiskCommandExecutor: () => ({
    execute: vi.fn(),
    controller: {},
  }),
}));

vi.mock('../../../../../components/product-surface-high-risk-command', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ProductSurfaceHighRiskCommandDialog: () => null,
}));

import { HrisNavigationPolicyCommandRuntime } from '../navigation-policy-command-runtime';

const LEGAL_ENTITY_ID = '6d07e952-2f5f-4dc1-8be7-6d7e210d23af';

describe('mounted navigation-policy command runtime', () => {
  beforeEach(() => {
    observed.workspaceProps = undefined;
  });

  it('keeps the tenant default and does not bypass the centrally owned runtime flag', () => {
    renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/hr/settings/navigation-policy'] },
        createElement(HrisNavigationPolicyCommandRuntime)
      )
    );

    expect(observed.workspaceProps).toMatchObject({
      scopeKind: 'TENANT',
      scopePublicId: null,
    });
    expect(observed.workspaceProps).not.toHaveProperty('runtimeEnabled');
  });

  it('routes one legal-entity UUID into the management workspace as an untrusted selector', () => {
    renderToStaticMarkup(
      createElement(
        MemoryRouter,
        {
          initialEntries: [`/hr/settings/navigation-policy?legalEntityPublicId=${LEGAL_ENTITY_ID}`],
        },
        createElement(HrisNavigationPolicyCommandRuntime)
      )
    );

    expect(observed.workspaceProps).toMatchObject({
      scopeKind: 'LEGAL_ENTITY',
      scopePublicId: LEGAL_ENTITY_ID,
    });
  });

  it('does not request workspace data for a malformed legal-entity selector', () => {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/hr/settings/navigation-policy?legalEntityPublicId=not-a-uuid'] },
        createElement(HrisNavigationPolicyCommandRuntime)
      )
    );

    expect(observed.workspaceProps).toBeUndefined();
    expect(html).toContain('Invalid legal-entity selector');
    expect(html).toContain('No policy data was requested');
  });
});
