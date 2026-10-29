// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import {
  captureMessagingTimelineScrollAnchor,
  restoreMessagingTimelineScrollAnchor,
  stabilizeMessagingTimelineScrollAnchor,
} from './messaging-history-scroll-anchor';

function rect(top: number, height: number): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    right: 300,
    bottom: top + height,
    left: 0,
    width: 300,
    height,
    toJSON: () => ({}),
  };
}

describe('messaging history scroll anchor', () => {
  it('compensates from the retained message position instead of an unstable height estimate', () => {
    const scroller = document.createElement('div');
    const retained = document.createElement('article');
    retained.dataset.msgReceiptId = 'history-026';
    scroller.append(retained);
    scroller.getBoundingClientRect = () => rect(0, 300);
    retained.getBoundingClientRect = () => rect(48, 76);
    Object.defineProperties(scroller, {
      scrollHeight: { configurable: true, value: 800 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });

    const anchor = captureMessagingTimelineScrollAnchor(scroller);
    retained.getBoundingClientRect = () => rect(172.8, 76);
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 949.6 });

    expect(restoreMessagingTimelineScrollAnchor(scroller, anchor)).toBeCloseTo(124.8);
    expect(scroller.scrollTop).toBeCloseTo(124.8);
  });

  it('reapplies the anchor after content-visibility settles on the following paint', () => {
    const callbacks: FrameRequestCallback[] = [];
    const requestFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => callbacks.push(callback));
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const scroller = document.createElement('div');
    const retained = document.createElement('article');
    retained.dataset.msgReceiptId = 'history-026';
    scroller.append(retained);
    scroller.getBoundingClientRect = () => rect(0, 300);
    let settledTop = 48;
    retained.getBoundingClientRect = () => rect(settledTop - scroller.scrollTop, 76);
    Object.defineProperties(scroller, {
      scrollHeight: { configurable: true, value: 800 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });

    const anchor = captureMessagingTimelineScrollAnchor(scroller);
    const stop = stabilizeMessagingTimelineScrollAnchor(scroller, anchor);
    settledTop = 103.796875;
    callbacks.shift()?.(16);
    callbacks.shift()?.(32);

    expect(scroller.scrollTop).toBeCloseTo(55.796875);
    stop();
    expect(requestFrame).toHaveBeenCalledTimes(2);
    expect(cancelFrame).toHaveBeenCalledTimes(2);
  });

  it('preserves the message body when prepend changes the row grouping layout', () => {
    const scroller = document.createElement('div');
    const retained = document.createElement('article');
    const body = document.createElement('div');
    retained.dataset.msgReceiptId = 'history-026';
    body.dataset.msgScrollAnchor = 'history-026';
    retained.append(body);
    scroller.append(retained);
    scroller.getBoundingClientRect = () => rect(0, 300);
    retained.getBoundingClientRect = () => rect(48, 76);
    body.getBoundingClientRect = () => rect(78.796875, 24);
    Object.defineProperties(scroller, {
      scrollHeight: { configurable: true, value: 800 },
      scrollTop: { configurable: true, writable: true, value: 100 },
    });

    const anchor = captureMessagingTimelineScrollAnchor(scroller);
    body.getBoundingClientRect = () => rect(48, 24);

    expect(restoreMessagingTimelineScrollAnchor(scroller, anchor)).toBeCloseTo(-30.796875);
    expect(scroller.scrollTop).toBeCloseTo(69.203125);
  });
});
