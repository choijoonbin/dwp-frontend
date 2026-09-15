import { describe, expect, it } from 'vitest';

import {
  createHomeEditConflictTarget,
  createHomeViewRequest,
  rebaseHomeEditSession,
} from './home-edit-session';

import type { HomeEditSession } from './home-edit-session';
import type { HomePreferenceLayout, HomeView } from '@dwp-frontend/shared-utils';

const layout: HomePreferenceLayout = { appLayout: null, widgets: [] };

const emptyViewsSession: HomeEditSession = {
  experienceVariant: 'FLOW_V1',
  modeScopedViews: true,
  store: 'VIEWS',
  viewId: null,
  viewName: 'My work home',
  version: 0,
  resetAvailable: false,
};

const concurrentView = {
  viewId: 'view-concurrent',
  name: 'Concurrent home',
  modeKey: 'FLOW_V1',
  version: 5,
  customized: true,
} as HomeView;

describe('home edit conflict session', () => {
  it('omits modeKey from creates until mode-scoped views are advertised', () => {
    const request = createHomeViewRequest(
      {
        ...emptyViewsSession,
        experienceVariant: 'CLASSIC',
        modeScopedViews: false,
      },
      layout,
      'Default Home'
    );

    expect(request).not.toHaveProperty('modeKey');
    expect(createHomeViewRequest(emptyViewsSession, layout, 'Default Home')).toMatchObject({
      modeKey: 'FLOW_V1',
    });
  });

  it('rebases an empty VIEWS session to the concurrently created view', () => {
    const target = createHomeEditConflictTarget(emptyViewsSession, concurrentView);

    expect(target).toEqual({
      store: 'VIEWS',
      experienceVariant: 'FLOW_V1',
      viewId: 'view-concurrent',
      viewName: 'Concurrent home',
      version: 5,
      resetAvailable: true,
    });
    expect(rebaseHomeEditSession(emptyViewsSession, target!)).toEqual({
      ...emptyViewsSession,
      viewId: 'view-concurrent',
      viewName: 'Concurrent home',
      version: 5,
      resetAvailable: true,
    });
  });

  it('does not cross a pinned store boundary while resolving a conflict', () => {
    const legacyTarget = createHomeEditConflictTarget(
      { ...emptyViewsSession, store: 'LEGACY' },
      undefined
    );

    expect(rebaseHomeEditSession(emptyViewsSession, legacyTarget!)).toBe(emptyViewsSession);
  });

  it('rejects a conflict target from the other Home mode', () => {
    expect(
      createHomeEditConflictTarget(emptyViewsSession, {
        ...concurrentView,
        modeKey: 'CLASSIC',
      })
    ).toBeNull();
  });

  it('preserves LEGACY identity while rebasing its version and reset state', () => {
    const session: HomeEditSession = {
      ...emptyViewsSession,
      store: 'LEGACY',
      viewName: null,
      version: 3,
    };
    const target = createHomeEditConflictTarget(session, {
      schemaVersion: 5,
      surfaceKey: 'workspace-home',
      customized: true,
      layout: { appLayout: null, widgets: [] },
      version: 4,
    });

    expect(rebaseHomeEditSession(session, target!)).toMatchObject({
      store: 'LEGACY',
      viewId: null,
      viewName: null,
      version: 4,
      resetAvailable: true,
    });
  });
});
