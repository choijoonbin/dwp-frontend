import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ProductSurfacePolicyLockNotice } from './product-surface-policy-lock-notice';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('ProductSurfacePolicyLockNotice', () => {
  it('renders policy provenance as structured metadata with explicit policy and exception links', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <ProductSurfacePolicyLockNotice
          lock={{
            policyName: 'Approval retention policy',
            owner: 'Compliance Office',
            source: 'Tenant policy set',
            scope: 'All approval workflows',
            effectiveAt: '2026-08-25 09:00 KST',
            policyPath: '/admin/policies/approval-retention',
            exceptionRequestPath: '/requests/policy-exceptions/new',
          }}
        />
      </MemoryRouter>
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('data-testid="product-surface-policy-lock"');
    expect(markup).toContain('<dl');
    expect(markup).toContain('<dt');
    expect(markup).toContain('<dd');
    expect(markup).toContain('Approval retention policy');
    expect(markup).toContain('Compliance Office');
    expect(markup).toContain('href="/admin/policies/approval-retention"');
    expect(markup).toContain('href="/requests/policy-exceptions/new"');
  });
});
