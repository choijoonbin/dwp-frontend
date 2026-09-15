import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { FLOW_FUTURE_WIDGET_CONTRACTS, FlowFutureWidgetMesh } from './flow-future-widget-mesh';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('Flow personalized projection widget boundary', () => {
  it('keeps the five approved visual prototypes ordered and outside the runtime registry', () => {
    expect(FLOW_FUTURE_WIDGET_CONTRACTS).toEqual([
      expect.objectContaining({ key: 'space-change-feed', permission: 'APP.SPACES:VIEW' }),
      expect.objectContaining({
        key: 'meetings-prep-decisions',
        permission: 'APP.MEETINGS:VIEW',
      }),
      expect.objectContaining({
        key: 'dwaion-artifact',
        permission: 'APP.DWAION_ARTIFACTS:VIEW',
      }),
      expect.objectContaining({ key: 'workplace-booking', permission: 'APP.WORKPLACE:VIEW' }),
      expect.objectContaining({ key: 'learning-progress', permission: 'APP.HCM:VIEW' }),
    ]);
    expect(
      FLOW_FUTURE_WIDGET_CONTRACTS.every(
        ({ owner, source, connection }) =>
          owner.length > 0 && source.length > 0 && connection === 'WAVE4_PROVIDER_PROJECTION'
      )
    ).toBe(true);
    expect(new Set(FLOW_FUTURE_WIDGET_CONTRACTS.map(({ key }) => key)).size).toBe(5);
  });

  it('fails closed before Wave 4 by exposing preview content with every provider action disabled', () => {
    const markup = renderToStaticMarkup(createElement(FlowFutureWidgetMesh));
    expect(markup.match(/data-flow-provider-status="unavailable"/gu)).toHaveLength(5);
    expect(markup.match(/data-flow-projection-kind="preview"/gu)).toHaveLength(5);
    expect(markup.match(/data-integration-boundary="WAVE4_PROVIDER_PROJECTION"/gu)).toHaveLength(5);
    expect(markup.match(/ disabled=""/gu)).toHaveLength(5);
    expect(markup).toContain(
      'data-flow-future-mobile-order="meetings-space-ai-workplace-learning"'
    );
    expect(markup).not.toContain('data-flow-provider-status="ready"');
  });
});
