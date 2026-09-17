import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ClassicOrganizationResources } from './classic-organization-resources';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(',')}` : key,
  }),
}));

describe('ClassicOrganizationResources governed source states', () => {
  it('renders all four ready resources without a synthetic provider state', () => {
    const markup = renderToStaticMarkup(createElement(ClassicOrganizationResources));

    expect(markup.match(/data-classic-resource-card=/gu)).toHaveLength(4);
    expect(markup).not.toContain('data-classic-resource-state-region');
  });

  it.each(['initial-loading', 'empty', 'forbidden'] as const)(
    'blocks only the knowledge slot for %s while preserving the other organization resources',
    (kind) => {
      const markup = renderToStaticMarkup(
        createElement(ClassicOrganizationResources, { resourceState: { kind } })
      );

      expect(markup).toContain('data-classic-resource-state-region="handbook"');
      expect(markup).toContain('data-classic-resource-source="DWP_KNOWLEDGE"');
      expect(markup).toContain(`data-home-content-state="${kind}"`);
      expect(markup).toContain('data-home-content-blocking="true"');
      expect(markup).not.toContain('data-classic-resource-card="handbook"');
      expect(markup).toContain('data-classic-resource-card="onboarding"');
      expect(markup).toContain(`classic.resources.states.${kind}.title`);
    }
  );

  it.each(['background-refresh', 'partial', 'stale'] as const)(
    'keeps the last verified knowledge card for %s and reports source provenance',
    (kind) => {
      const markup = renderToStaticMarkup(
        createElement(ClassicOrganizationResources, {
          resourceState: { kind, lastSuccessfulAt: '오전 9:24', onRetry: () => undefined },
        })
      );

      expect(markup).toContain(`data-home-content-state="${kind}"`);
      expect(markup).toContain('data-home-content-preserved="true"');
      expect(markup).toContain('data-classic-resource-card="handbook"');
      expect(markup).toContain('DWP_KNOWLEDGE');
      expect(markup).toContain('오전 9:24');
    }
  );

  it('targets the accepted workplace slot without changing sibling resources', () => {
    const markup = renderToStaticMarkup(
      createElement(ClassicOrganizationResources, {
        resourceState: {
          kind: 'stale',
          targetKey: 'workplace',
          source: 'DWP_WORKPLACE',
          lastSuccessfulAt: '오전 9:58',
        },
      })
    );

    expect(markup).toContain('data-classic-resource-state-region="workplace"');
    expect(markup).toContain('data-classic-resource-source="DWP_WORKPLACE"');
    expect(markup).toContain('data-classic-resource-card="workplace"');
    expect(markup).toContain('data-classic-resource-card="handbook"');
    expect(markup).toContain('data-classic-resource-card="it"');
  });

  it('targets only the accepted restricted IT slot', () => {
    const resourceState = {
      kind: 'forbidden' as const,
      targetKey: 'it' as const,
      source: 'DWP_IT_SUPPORT',
    };
    const resources = renderToStaticMarkup(
      createElement(ClassicOrganizationResources, { resourceState })
    );
    expect(resources).toContain('data-classic-resource-state-region="it"');
    expect(resources).toContain('data-classic-resource-source="DWP_IT_SUPPORT"');
    expect(resources).not.toContain('data-classic-resource-card="it"');
    expect(resources).toContain('data-classic-resource-card="handbook"');
  });
});
