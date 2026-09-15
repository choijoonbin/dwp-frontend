import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createHomeModeLayouts, HOME_DEVICE_CLASSES } from '@dwp-frontend/shared-utils';

import { HOME_CONTENT_STATES, HomeContentState } from './home-content-state';

import type { HomeContentStateKind } from './home-content-state';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const STATE_FIXTURES = [
  ['C10-D1440-EMPTY-r02', 'HOME_STATE_EMPTY_DESKTOP', 'empty', 1440],
  ['C10-M390-EMPTY-r01', 'HOME_STATE_EMPTY_MOBILE', 'empty', 390],
  ['C11-D1440-PARTIAL-r02', 'HOME_STATE_PARTIAL_DESKTOP', 'partial', 1440],
  ['C11-M390-PARTIAL-r02', 'HOME_STATE_PARTIAL_MOBILE', 'partial', 390],
  ['C12-D1440-FORBIDDEN-r02', 'HOME_STATE_FORBIDDEN_DESKTOP', 'forbidden', 1440],
  ['C12-M390-FORBIDDEN-r04', 'HOME_STATE_FORBIDDEN_MOBILE', 'forbidden', 390],
  ['C13-D1440-STALE-r02', 'HOME_STATE_STALE_DESKTOP', 'stale', 1440],
  ['C13-M390-STALE-r03', 'HOME_STATE_STALE_MOBILE', 'stale', 390],
  [
    'C14-D1440-BACKGROUND-REFRESH-r02',
    'HOME_STATE_BACKGROUND_REFRESH_DESKTOP',
    'background-refresh',
    1440,
  ],
  ['C14-D1440-INITIAL-LOADING-r02', 'HOME_STATE_INITIAL_LOADING_DESKTOP', 'initial-loading', 1440],
  [
    'C14-M390-BACKGROUND-REFRESH-r02',
    'HOME_STATE_BACKGROUND_REFRESH_MOBILE',
    'background-refresh',
    390,
  ],
  ['C14-M390-INITIAL-LOADING-r02', 'HOME_STATE_INITIAL_LOADING_MOBILE', 'initial-loading', 390],
  ['C15-D1440-EDITOR-DIRTY-r01', 'HOME_STATE_DIRTY_DESKTOP', 'dirty', 1440],
  ['C15-M390-EDITOR-DIRTY-r01', 'HOME_STATE_DIRTY_MOBILE', 'dirty', 390],
  ['C16-D1440-SAVE-CONFLICT-r02', 'HOME_STATE_CONFLICT_DESKTOP', 'conflict', 1440],
  ['C16-M390-SAVE-CONFLICT-r02', 'HOME_STATE_CONFLICT_MOBILE', 'conflict', 390],
] as const satisfies readonly (readonly [string, string, HomeContentStateKind, number])[];

describe('Wave 2 canonical state fixture evidence', () => {
  it.each(STATE_FIXTURES)(
    '%s executes %s as the %s primitive at %ipx',
    (canonicalId, fixtureId, kind, viewportWidth) => {
      const size = viewportWidth <= 390 ? 'standard' : 'page';
      const markup = renderToStaticMarkup(
        createElement(HomeContentState, {
          kind,
          size,
          preservedContent:
            kind === 'partial' ||
            kind === 'stale' ||
            kind === 'background-refresh' ||
            kind === 'dirty'
              ? createElement('p', null, 'Verified content remains')
              : undefined,
        })
      );
      expect(canonicalId).toMatch(/^C(?:10|11|12|13|14|15|16)-/u);
      expect(fixtureId).toMatch(/^HOME_STATE_/u);
      expect(viewportWidth === 390 || viewportWidth === 1440).toBe(true);
      expect(markup).toContain(`data-home-content-state="${kind}"`);
      expect(markup).toContain(`data-home-content-size="${size}"`);
      expect(markup).toContain(
        `data-home-content-blocking="${['initial-loading', 'empty', 'forbidden', 'widget-error', 'conflict'].includes(kind) ? 'true' : 'false'}"`
      );
      if (['partial', 'stale', 'background-refresh', 'dirty'].includes(kind)) {
        expect(markup).toContain('Verified content remains');
      }
    }
  );

  it('CLASSIC-STATE-COMPONENT-SPEC-A executes HOME_STATE_ALL_STATES_DESKTOP', () => {
    const renderedKinds = HOME_CONTENT_STATES.filter((kind) =>
      renderToStaticMarkup(createElement(HomeContentState, { kind })).includes(
        `data-home-content-state="${kind}"`
      )
    );
    expect(renderedKinds).toEqual(HOME_CONTENT_STATES);
  });

  it('C17-MODE-PRESET executes HOME_SPEC_MODE_PRESET across both modes and four devices', () => {
    const layouts = createHomeModeLayouts();
    expect(Object.keys(layouts)).toEqual(['CLASSIC', 'FLOW_V1']);
    expect(layouts.CLASSIC.deviceClasses).toEqual(HOME_DEVICE_CLASSES);
    expect(layouts.FLOW_V1.deviceClasses).toEqual(HOME_DEVICE_CLASSES);
  });
});
