import {
  createHomeView,
  resetHomePreference,
  resetHomeView,
  updateHomePreference,
  updateHomeView,
} from '@dwp-frontend/shared-utils';
import { requireHomeViewMode } from './home-view-query-key';

import type {
  CreateHomeViewRequest,
  HomePreference,
  HomePreferenceLayout,
  HomeView,
} from '@dwp-frontend/shared-utils';

export type HomeEditSession = {
  experienceVariant: 'CLASSIC' | 'FLOW_V1';
  modeScopedViews: boolean;
  store: 'LEGACY' | 'VIEWS';
  viewId: string | null;
  viewName: string | null;
  version: number;
  resetAvailable: boolean;
};

export type HomeSaveMutation = {
  layout: HomePreferenceLayout;
  idempotencyKey: string;
  reset: boolean;
  session: HomeEditSession;
};

export type HomeEditConflictTarget =
  | {
      store: 'VIEWS';
      experienceVariant: 'CLASSIC' | 'FLOW_V1';
      viewId: string;
      viewName: string;
      version: number;
      resetAvailable: boolean;
    }
  | {
      store: 'LEGACY';
      experienceVariant: 'CLASSIC' | 'FLOW_V1';
      viewId: null;
      viewName: null;
      version: number;
      resetAvailable: boolean;
    };

export function createHomeEditConflictTarget(
  session: HomeEditSession,
  source: HomeView | HomePreference | undefined
): HomeEditConflictTarget | null {
  if (session.store === 'VIEWS') {
    if (!source || !('viewId' in source)) return null;
    if (source.modeKey !== session.experienceVariant) return null;
    return {
      store: 'VIEWS',
      experienceVariant: source.modeKey,
      viewId: source.viewId,
      viewName: source.name,
      version: source.version,
      resetAvailable: source.customized ?? true,
    };
  }
  const preference = source && !('viewId' in source) ? source : undefined;
  return {
    store: 'LEGACY',
    experienceVariant: session.experienceVariant,
    viewId: null,
    viewName: null,
    version: preference?.version ?? session.version,
    resetAvailable: preference?.customized ?? session.resetAvailable,
  };
}

export function rebaseHomeEditSession(
  session: HomeEditSession,
  target: HomeEditConflictTarget
): HomeEditSession {
  if (session.store !== target.store || session.experienceVariant !== target.experienceVariant) {
    return session;
  }
  return { ...session, ...target };
}

export function createHomeViewRequest(
  session: HomeEditSession,
  layout: HomePreferenceLayout,
  defaultViewName: string
): CreateHomeViewRequest {
  return {
    viewKey: 'default',
    name: session.viewName ?? defaultViewName,
    ...(session.modeScopedViews ? { modeKey: session.experienceVariant } : {}),
    makeDefault: true,
    layout,
  };
}

export function createHomeEditSessionFromView(
  view: HomeView,
  modeScopedViews: boolean
): HomeEditSession {
  return {
    experienceVariant: view.modeKey,
    modeScopedViews,
    store: 'VIEWS',
    viewId: view.viewId,
    viewName: view.name,
    version: view.version,
    resetAvailable: view.customized ?? true,
  };
}

export async function saveHomeEditSession(request: HomeSaveMutation, defaultViewName: string) {
  const { session } = request;
  if (session.store === 'VIEWS') {
    if (!session.viewId) {
      const view = await createHomeView(
        createHomeViewRequest(session, request.layout, defaultViewName),
        request.idempotencyKey
      );
      return {
        store: 'VIEWS' as const,
        view: requireHomeViewMode(view, session.experienceVariant, !session.modeScopedViews),
        modeScopedViews: session.modeScopedViews,
      };
    }
    const view = request.reset
      ? await resetHomeView(session.viewId, session.version, request.idempotencyKey)
      : await updateHomeView(
          session.viewId,
          {
            name: session.viewName ?? defaultViewName,
            layout: request.layout,
            version: session.version,
          },
          request.idempotencyKey
        );
    return {
      store: 'VIEWS' as const,
      view: requireHomeViewMode(view, session.experienceVariant, !session.modeScopedViews),
      modeScopedViews: session.modeScopedViews,
    };
  }
  const preference = request.reset
    ? await resetHomePreference(session.version)
    : await updateHomePreference(request.layout, session.version);
  return { store: 'LEGACY' as const, preference };
}
