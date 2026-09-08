// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  MeetingBackgroundOptions,
  MeetingBackgroundState,
} from './meeting-background-processor';

const factory = vi.hoisted(() => vi.fn());
vi.mock('./meeting-background-processor', () => ({ createMeetingBackgroundProcessor: factory }));
import { useMeetingBackgroundPublication } from './use-meeting-background-publication';

type Owner = {
  destroy: ReturnType<typeof vi.fn>;
  event: (state: MeetingBackgroundState) => void;
};
let root: Root;
let mount: HTMLDivElement;
let owners: Owner[];
let publication: ReturnType<typeof useMeetingBackgroundPublication>;
let mounted: boolean;
function Harness({ enabled, scope }: { enabled: boolean; scope: string }) {
  publication = useMeetingBackgroundPublication(enabled, scope);
  return createElement('output', null, publication.state?.state ?? 'none');
}
async function render(enabled: boolean, scope = 'scope-a', strict = false) {
  await act(async () => {
    const element = createElement(Harness, { enabled, scope });
    root.render(strict ? createElement(StrictMode, null, element) : element);
  });
}

describe('background publication lifecycle owner', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    owners = [];
    factory.mockImplementation((options: MeetingBackgroundOptions) => {
      const owner = {
        destroy: vi.fn().mockResolvedValue(undefined),
        event: (state: MeetingBackgroundState) => options.onStateChange?.(state),
      };
      owners.push(owner);
      return owner;
    });
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
    mounted = true;
  });
  afterEach(async () => {
    if (mounted) await act(async () => root.unmount());
    mount.remove();
  });

  it('creates a fail-closed capture owner, stable across same-setting renders', async () => {
    await render(true);
    const owner = publication.processor;
    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({ stopInputOnFailure: true, onStateChange: expect.any(Function) })
    );
    await render(true);
    expect(publication.processor).toBe(owner);
    expect(factory).toHaveBeenCalledOnce();
    await act(async () => owners[0].event({ state: 'ready' }));
    expect(publication.state).toEqual({ state: 'ready' });
  });

  it('does not create a processor for explicitly disabled background blur', async () => {
    await render(false);
    expect(factory).not.toHaveBeenCalled();
    expect(publication.processor).toBeUndefined();
    expect(publication.state).toBeUndefined();
  });

  it('does not destroy the reused active processor during StrictMode effect replay', async () => {
    await render(true, 'scope-a', true);
    const owner = publication.processor as unknown as Owner;
    await act(async () => Promise.resolve());
    expect(owner.destroy).not.toHaveBeenCalled();
    await act(async () => owner.event({ state: 'ready' }));
    expect(publication.state?.state).toBe('ready');
    await act(async () => root.unmount());
    mounted = false;
    expect(owner.destroy).toHaveBeenCalledOnce();
  });

  it('destroys the old owner after true to false and suppresses its late failure', async () => {
    await render(true);
    const owner = owners[0];
    await act(async () => owner.event({ state: 'ready' }));
    await render(false);
    expect(owner.destroy).toHaveBeenCalledOnce();
    await act(async () => owner.event({ state: 'failed', reason: 'PROCESSING_FAILED' }));
    expect(publication.processor).toBeUndefined();
    expect(publication.state).toBeUndefined();
    expect(mount.textContent).toBe('none');
  });

  it('does not let a superseded owner overwrite the new active ready state', async () => {
    await render(true);
    const old = owners[0];
    await render(false);
    await render(true);
    const current = owners[1];
    await act(async () => current.event({ state: 'ready' }));
    await act(async () => old.event({ state: 'failed', reason: 'PROCESSING_FAILED' }));
    expect(publication.state?.state).toBe('ready');
    expect(current.destroy).not.toHaveBeenCalled();
  });

  it('preserves current failure warning when a superseded owner sends a late ready event', async () => {
    await render(true);
    const old = owners[0];
    await render(true, 'scope-b');
    const current = owners[1];
    await act(async () => current.event({ state: 'failed', reason: 'PROCESSING_FAILED' }));
    await act(async () => old.event({ state: 'ready' }));
    expect(publication.state).toEqual({ state: 'failed', reason: 'PROCESSING_FAILED' });
    expect(mount.textContent).toBe('failed');
  });

  it('replaces scope owner in the same mounted tree and blocks prior scope callbacks', async () => {
    await render(true);
    const old = owners[0];
    await render(true, 'scope-b');
    const current = owners[1];
    expect(old.destroy).toHaveBeenCalledOnce();
    await act(async () => current.event({ state: 'ready' }));
    await act(async () => old.event({ state: 'failed', reason: 'PROCESSING_FAILED' }));
    expect(publication.state?.state).toBe('ready');
    expect(current.destroy).not.toHaveBeenCalled();
  });

  it('does not render late callback results after unmount', async () => {
    await render(true);
    const owner = owners[0];
    await act(async () => root.unmount());
    mounted = false;
    await act(async () => owner.event({ state: 'failed', reason: 'PROCESSING_FAILED' }));
    expect(owner.destroy).toHaveBeenCalledOnce();
    expect(mount.childElementCount).toBe(0);
  });
});
