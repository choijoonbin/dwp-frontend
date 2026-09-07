// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@dwp-frontend/shared-utils', () => ({ recordMessagingReadReceipts: vi.fn() }));
import { messagingReadSurfaceVisible } from './use-messaging-read-observer';

describe('read observation visibility', () => {
  let root: HTMLDivElement;
  let node: HTMLDivElement;
  const rect = (top: number, bottom: number) => ({
    top,
    bottom,
    left: 0,
    right: 300,
    width: 300,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON: () => ({}),
  });
  beforeEach(() => {
    root = document.createElement('div');
    node = document.createElement('div');
    root.append(node);
    document.body.append(root);
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(rect(0, 500));
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(rect(100, 180));
  });
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });
  it('observes a visible message but never a background window', () => {
    expect(messagingReadSurfaceVisible(root, node)).toBe(true);
    vi.mocked(document.hasFocus).mockReturnValue(false);
    expect(messagingReadSurfaceVisible(root, node)).toBe(false);
  });
  it('does not read hidden tabs, offscreen messages or content behind a modal', () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    expect(messagingReadSurfaceVisible(root, node)).toBe(false);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.mocked(node.getBoundingClientRect).mockReturnValue(rect(510, 590));
    expect(messagingReadSurfaceVisible(root, node)).toBe(false);
    vi.mocked(node.getBoundingClientRect).mockReturnValue(rect(100, 180));
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    document.body.append(dialog);
    expect(messagingReadSurfaceVisible(root, node)).toBe(false);
  });
  it('never treats an aria-hidden pane as read', () => {
    root.setAttribute('aria-hidden', 'true');
    expect(messagingReadSurfaceVisible(root, node)).toBe(false);
  });
});
