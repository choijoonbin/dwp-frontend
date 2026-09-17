import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { ReactNode } from 'react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('./notification-admin', () => ({
  NotificationAdminOverviewPage: () => null,
  NotificationDeliveryOperationsPage: () => null,
  NotificationTypeCatalogPage: () => null,
}));
vi.mock('./notification-preferences', () => ({ NotificationPreferences: () => null }));
vi.mock('./notification-policy-studio', () => ({
  NotificationPolicyStudio: () => createElement('section', { 'data-testid': 'policy-studio' }),
}));
vi.mock('./notification-attention-governance-runtime', () => ({
  NotificationAttentionGovernanceRuntime: () =>
    createElement('section', { 'data-testid': 'attention-governance' }),
}));
vi.mock('./notification-template-studio', () => ({ NotificationTemplateStudio: () => null }));
vi.mock('./notification-suppression-studio', () => ({
  NotificationSuppressionStudio: () => null,
}));
vi.mock('./notification-noise-quality-runtime', () => ({
  NotificationAdminNoiseQualityRuntime: () => null,
}));
vi.mock('./notification-page-frame', () => ({
  NotificationPageFrame: ({ children }: { children: ReactNode }) =>
    createElement('main', null, children),
}));
vi.mock('./notification-ui', () => ({
  NotificationPageHeading: () => createElement('h1', null, 'Policies'),
}));

import { NotificationAdminPolicies } from './notification-product-pages';

describe('NotificationAdminPolicies', () => {
  it('mounts tenant attention governance below the existing policy studio in one page frame', () => {
    const markup = renderToStaticMarkup(createElement(NotificationAdminPolicies));
    const policy = markup.indexOf('data-testid="policy-studio"');
    const attention = markup.indexOf('data-testid="attention-governance"');

    expect(policy).toBeGreaterThan(-1);
    expect(attention).toBeGreaterThan(policy);
    expect(markup.match(/<main/g)).toHaveLength(1);
  });
});
