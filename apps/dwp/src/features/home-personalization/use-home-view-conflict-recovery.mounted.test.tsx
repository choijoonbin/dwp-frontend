// @vitest-environment jsdom
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as SharedUtils from '@dwp-frontend/shared-utils';

const feedback = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedUtils>()),
  useToast: () => feedback,
}));

import { HttpError } from '@dwp-frontend/shared-utils';
import { useHomeViewConflictRecovery } from './use-home-view-conflict-recovery';

import type { HomeView } from '@dwp-frontend/shared-utils';

const latestView = {
  viewId: 'view-1',
  viewKey: 'default',
  surfaceKey: 'workspace-home',
  modeKey: 'CLASSIC',
  name: 'Latest server view',
  isDefault: true,
  schemaVersion: 4,
  layout: { appLayout: null, presentation: 'focused', widgets: [] },
  version: 8,
  createdAt: '2026-09-16T00:00:00Z',
  updatedAt: '2026-09-16T00:01:00Z',
  widgetConfigurations: {},
} as HomeView;

type ConflictDialogProps = Readonly<{
  open: boolean;
  canReapply: boolean;
  onClose: () => void;
  onReloadLatest: () => void;
  onReapply: () => void;
}>;

type Recovery = ReturnType<typeof useHomeViewConflictRecovery>;
let client: QueryClient;
let host: HTMLDivElement;
let root: Root;
let recovery: Recovery;

function Probe() {
  recovery = useHomeViewConflictRecovery({
    viewQueryKey: ['home-personalization', 'views'],
    selectedView: { ...latestView, version: 7 },
  });
  return null;
}

function dialogProps(): ConflictDialogProps {
  return (recovery.conflictDialog as ReactElement<ConflictDialogProps>).props;
}

function conflictError() {
  return new HttpError('Home view changed.', 409, {
    errorCode: 'HOME_VIEW_VERSION_CONFLICT',
    data: {
      operation: 'UPDATE_DEVICE_LAYOUT',
      expectedVersion: 7,
      actualVersion: 8,
      expectedDeviceVersion: null,
      actualDeviceVersion: null,
      submittedDraft: { layout: { widgets: [] } },
      latestView,
      latestDeviceLayout: null,
      changedFields: ['layout.presentation'],
    },
  });
}

describe('mounted home view conflict recovery', () => {
  beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    feedback.error.mockReset();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root.render(createElement(QueryClientProvider, { client }, createElement(Probe)));
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
  });

  it('does not offer reapply for an unrelated mutation without a registered draft', async () => {
    await act(async () => recovery.handleMutationError(conflictError()));

    expect(dialogProps().open).toBe(false);
    expect(dialogProps().canReapply).toBe(false);
  });

  it('clears the saved retry on close so a later conflict cannot replay stale work', async () => {
    const retry = vi.fn();
    recovery.rememberMutation(retry, 2, 7);
    await act(async () => recovery.handleMutationError(conflictError()));
    expect(dialogProps().open).toBe(true);

    await act(async () => dialogProps().onClose());
    await act(async () => recovery.handleMutationError(conflictError()));

    expect(dialogProps().open).toBe(false);
    expect(dialogProps().canReapply).toBe(false);
    expect(retry).not.toHaveBeenCalled();
  });

  it('reapplies the preserved draft with exact latest view and nullable device versions', async () => {
    const retry = vi.fn();
    recovery.rememberMutation(retry, 1, 7);
    await act(async () => recovery.handleMutationError(conflictError()));
    await act(async () => dialogProps().onReapply());

    expect(retry).toHaveBeenCalledWith({ viewVersion: 8, deviceVersion: null });
    expect(client.getQueryData<HomeView[]>(['home-personalization', 'views'])).toEqual([
      latestView,
    ]);
  });
});
