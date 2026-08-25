// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  WORKSPACE_WIDGET_LONG_PRESS_DELAY_MS,
  WORKSPACE_WIDGET_LONG_PRESS_MOVE_TOLERANCE_PX,
  useReadModeWidgetLongPress,
  workspaceWidgetLongPressMoved,
  workspaceWidgetLongPressStartsOnInteractive,
  workspaceWidgetSettleDelayMs,
} from './workspace-edit-motion';

type LongPressHandlers = ReturnType<typeof useReadModeWidgetLongPress>;

function pointerEvent(overrides: Partial<Parameters<LongPressHandlers['onPointerDown']>[0]> = {}) {
  return {
    button: 0,
    isPrimary: true,
    pointerId: 1,
    clientX: 10,
    clientY: 10,
    ...overrides,
  } as Parameters<LongPressHandlers['onPointerDown']>[0];
}

describe('workspace edit interaction policy', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('requires a 550ms sustained press', () => {
    expect(WORKSPACE_WIDGET_LONG_PRESS_DELAY_MS).toBe(550);
  });

  it('cancels a long press only after movement exceeds the tolerance radius', () => {
    expect(WORKSPACE_WIDGET_LONG_PRESS_MOVE_TOLERANCE_PX).toBe(10);
    expect(workspaceWidgetLongPressMoved({ x: 10, y: 10 }, { x: 16, y: 18 })).toBe(false);
    expect(workspaceWidgetLongPressMoved({ x: 10, y: 10 }, { x: 17, y: 18 })).toBe(true);
  });

  it('keeps the one-time settle stagger short for large dashboards', () => {
    expect(workspaceWidgetSettleDelayMs(0)).toBe(0);
    expect(workspaceWidgetSettleDelayMs(4)).toBe(180);
    expect(workspaceWidgetSettleDelayMs(20)).toBe(180);
  });

  it('does not turn a sustained press on a nested action into edit mode', () => {
    const wrapper = document.createElement('section');
    const action = document.createElement('button');
    wrapper.append(action);
    expect(workspaceWidgetLongPressStartsOnInteractive(action, wrapper)).toBe(true);
    expect(workspaceWidgetLongPressStartsOnInteractive(wrapper, wrapper)).toBe(false);

    const onStartEditing = vi.fn();
    let handlers: LongPressHandlers | undefined;
    const container = document.createElement('div');
    const root = createRoot(container);

    function Harness() {
      handlers = useReadModeWidgetLongPress(onStartEditing);
      return null;
    }

    act(() => root.render(createElement(Harness)));
    act(() =>
      handlers?.onPointerDown(pointerEvent({ target: action, currentTarget: wrapper } as never))
    );
    act(() => vi.advanceTimersByTime(WORKSPACE_WIDGET_LONG_PRESS_DELAY_MS));
    expect(onStartEditing).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('starts editing after a sustained press and suppresses its generated click', () => {
    const onStartEditing = vi.fn();
    let handlers: LongPressHandlers | undefined;
    const container = document.createElement('div');
    const root = createRoot(container);

    function Harness() {
      handlers = useReadModeWidgetLongPress(onStartEditing);
      return null;
    }

    act(() => root.render(createElement(Harness)));
    act(() => handlers?.onPointerDown(pointerEvent()));
    act(() => vi.advanceTimersByTime(WORKSPACE_WIDGET_LONG_PRESS_DELAY_MS - 1));
    expect(onStartEditing).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onStartEditing).toHaveBeenCalledOnce();

    act(() => handlers?.onPointerUp(pointerEvent()));
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    handlers?.onClickCapture({ preventDefault, stopPropagation } as never);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopPropagation).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });

  it('lets pointer movement and cancellation preserve normal scrolling', () => {
    const onStartEditing = vi.fn();
    let handlers: LongPressHandlers | undefined;
    const container = document.createElement('div');
    const root = createRoot(container);

    function Harness() {
      handlers = useReadModeWidgetLongPress(onStartEditing);
      return null;
    }

    act(() => root.render(createElement(Harness)));
    act(() => handlers?.onPointerDown(pointerEvent()));
    act(() => handlers?.onPointerMove(pointerEvent({ clientY: 21 })));
    act(() => vi.advanceTimersByTime(WORKSPACE_WIDGET_LONG_PRESS_DELAY_MS));
    expect(onStartEditing).not.toHaveBeenCalled();

    act(() => handlers?.onPointerDown(pointerEvent({ pointerId: 2 })));
    act(() => handlers?.onPointerCancel());
    act(() => vi.advanceTimersByTime(WORKSPACE_WIDGET_LONG_PRESS_DELAY_MS));
    expect(onStartEditing).not.toHaveBeenCalled();
    act(() => root.unmount());
  });
});
