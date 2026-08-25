import {
  createHomeView,
  resetHomePreference,
  resetHomeView,
  updateHomePreference,
  updateHomeView,
} from '@dwp-frontend/shared-utils';

import type { HomePreference, HomePreferenceLayout, HomeView } from '@dwp-frontend/shared-utils';

export type HomeEditSession = {
  experienceVariant: 'CLASSIC' | 'FLOW_V1';
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
      viewId: string;
      viewName: string;
      version: number;
      resetAvailable: boolean;
    }
  | {
      store: 'LEGACY';
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
    return {
      store: 'VIEWS',
      viewId: source.viewId,
      viewName: source.name,
      version: source.version,
      resetAvailable: source.customized ?? true,
    };
  }
  const preference = source && !('viewId' in source) ? source : undefined;
  return {
    store: 'LEGACY',
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
  if (session.store !== target.store) return session;
  return { ...session, ...target };
}

export async function saveHomeEditSession(request: HomeSaveMutation, defaultViewName: string) {
  const { session } = request;
  if (session.store === 'VIEWS') {
    if (!session.viewId) {
      const view = await createHomeView(
        {
          viewKey: 'default',
          name: session.viewName ?? defaultViewName,
          makeDefault: true,
          layout: request.layout,
        },
        request.idempotencyKey
      );
      return { store: 'VIEWS' as const, view };
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
    return { store: 'VIEWS' as const, view };
  }
  const preference = request.reset
    ? await resetHomePreference(session.version)
    : await updateHomePreference(request.layout, session.version);
  return { store: 'LEGACY' as const, preference };
}
