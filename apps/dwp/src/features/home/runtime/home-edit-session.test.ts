import { describe, expect, it } from 'vitest';

import { createHomeEditConflictTarget, rebaseHomeEditSession } from './home-edit-session';

import type { HomeEditSession } from './home-edit-session';
import type { HomeView } from '@dwp-frontend/shared-utils';

const emptyViewsSession: HomeEditSession = {
  experienceVariant: 'FLOW_V1',
  store: 'VIEWS',
  viewId: null,
  viewName: 'My work home',
  version: 0,
  resetAvailable: false,
};

const concurrentView = {
  viewId: 'view-concurrent',
  name: 'Concurrent home',
  version: 5,
  customized: true,
} as HomeView;

describe('home edit conflict session', () => {
  it('rebases an empty VIEWS session to the concurrently created view', () => {
    const target = createHomeEditConflictTarget(emptyViewsSession, concurrentView);

    expect(target).toEqual({
      store: 'VIEWS',
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
