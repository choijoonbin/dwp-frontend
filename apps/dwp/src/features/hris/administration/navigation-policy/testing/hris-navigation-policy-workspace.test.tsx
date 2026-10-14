import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  HRIS_NAVIGATION_POLICY_RUNTIME_STATE,
  HrisNavigationPolicyWorkspace,
} from '../pages/hris-navigation-policy-workspace';

describe('HrisNavigationPolicyWorkspace', () => {
  it('is default-off until central activation supplies the route and PAGE policy', () => {
    const html = renderToStaticMarkup(createElement(HrisNavigationPolicyWorkspace));
    expect(HRIS_NAVIGATION_POLICY_RUNTIME_STATE).toBe('OFF');
    expect(html).toContain('data-runtime-state="OFF"');
    expect(html).toContain('Activation remains centrally governed');
    expect(html).not.toContain('<button');
  });

  it('refuses to query when the legal-entity selector is missing', () => {
    const html = renderToStaticMarkup(
      createElement(HrisNavigationPolicyWorkspace, {
        runtimeEnabled: true,
        scopeKind: 'LEGAL_ENTITY',
      })
    );
    expect(html).toContain('data-runtime-state="SCOPE_REQUIRED"');
    expect(html).toContain('A legal-entity selector is required');
    expect(html).toContain('No policy data was requested');
  });
});
