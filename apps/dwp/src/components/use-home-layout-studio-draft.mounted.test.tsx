// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useHomeLayoutStudioDraft } from './use-home-layout-studio-draft';

import type { HomeView } from '@dwp-frontend/shared-utils';

const savedView = {
  viewId: 'view-1',
  viewKey: 'default',
  surfaceKey: 'workspace-home',
  modeKey: 'FLOW_V1',
  name: 'My home',
  isDefault: true,
  schemaVersion: 5,
  layout: {
    appLayout: null,
    widgets: [{ widgetKey: 'command-rail', visible: true, size: 'large', height: 'standard' }],
  },
  version: 5,
  createdAt: '2026-09-16T00:00:00Z',
  updatedAt: '2026-09-16T00:01:00Z',
  widgetConfigurations: {},
} as HomeView;

type DraftApi = ReturnType<typeof useHomeLayoutStudioDraft>;
let api: DraftApi;
let root: Root;
let host: HTMLDivElement;

function Probe({
  view,
  catalogRevision = 'catalog-1',
  resetToken = 0,
}: {
  view: HomeView;
  catalogRevision?: string;
  resetToken?: number;
}) {
  api = useHomeLayoutStudioDraft(view, resetToken);
  return createElement('output', {
    'data-catalog-revision': catalogRevision,
    'data-visible': String(api.draft[0]?.visible),
  });
}

describe('mounted Home layout draft lifecycle', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('preserves draft and undo history across catalog and concurrent view refetches', async () => {
    await act(async () => root.render(createElement(Probe, { view: savedView })));
    await act(async () =>
      api.commitDraft(api.draft.map((widget) => ({ ...widget, visible: false })))
    );

    const concurrentView = {
      ...savedView,
      version: 6,
      layout: { ...savedView.layout, presentation: 'focused' as const },
    };
    await act(async () =>
      root.render(
        createElement(Probe, { view: { ...concurrentView }, catalogRevision: 'catalog-2' })
      )
    );

    expect(api.draft[0]?.visible).toBe(false);
    expect(api.dirty).toBe(true);
    expect(api.canUndo).toBe(true);
    expect(api.baseVersion).toBe(5);
  });

  it('rehydrates a clean draft and accepts the saved draft returned by the server', async () => {
    await act(async () => root.render(createElement(Probe, { view: savedView })));
    const refreshed = { ...savedView, version: 6, name: 'Server name' };
    await act(async () => root.render(createElement(Probe, { view: refreshed })));
    expect(api.baseVersion).toBe(6);
    expect(api.dirty).toBe(false);

    await act(async () =>
      api.commitDraft(api.draft.map((widget) => ({ ...widget, visible: false })))
    );
    const savedDraft = {
      ...refreshed,
      version: 7,
      layout: { ...refreshed.layout, widgets: api.draft },
    };
    await act(async () => root.render(createElement(Probe, { view: savedDraft })));
    expect(api.baseVersion).toBe(7);
    expect(api.dirty).toBe(false);
    expect(api.canUndo).toBe(false);
  });

  it('discards a dirty draft only after the explicit reload-latest signal', async () => {
    await act(async () => root.render(createElement(Probe, { view: savedView })));
    await act(async () =>
      api.commitDraft(api.draft.map((widget) => ({ ...widget, visible: false })))
    );
    await act(async () =>
      root.render(createElement(Probe, { view: { ...savedView }, resetToken: 1 }))
    );

    expect(api.draft[0]?.visible).toBe(true);
    expect(api.dirty).toBe(false);
    expect(api.canUndo).toBe(false);
  });
});
