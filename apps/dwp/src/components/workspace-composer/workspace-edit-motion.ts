import { keyframes } from '@emotion/react';
import { useEffect, useRef } from 'react';

import type { MouseEvent, PointerEvent } from 'react';

export const WORKSPACE_WIDGET_SETTLE_DURATION_MS = 460;
export const WORKSPACE_WIDGET_LONG_PRESS_DELAY_MS = 550;
export const WORKSPACE_WIDGET_LONG_PRESS_MOVE_TOLERANCE_PX = 10;
export const WORKSPACE_WIDGET_SETTLE_FALLBACK_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';
export const WORKSPACE_WIDGET_SETTLE_SPRING_EASING =
  'linear(0, 0.55 18%, 0.9 34%, 1.03 52%, 0.992 72%, 1)';

type WidgetLongPressState = {
  timer: number;
  pointerId: number;
  startX: number;
  startY: number;
  activated: boolean;
};

const WORKSPACE_WIDGET_POST_LONG_PRESS_CLICK_GUARD_MS = 800;
const WORKSPACE_WIDGET_INTERACTIVE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[contenteditable="true"]',
  '[data-workspace-long-press-ignore]',
].join(',');

export const workspaceWidgetSettle = keyframes`
  0% { opacity: 0.965; transform: translate3d(0, 3px, 0) scale(0.997); }
  100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
`;

export function workspaceWidgetLongPressMoved(
  start: Readonly<{ x: number; y: number }>,
  current: Readonly<{ x: number; y: number }>
) {
  const deltaX = current.x - start.x;
  const deltaY = current.y - start.y;
  return (
    deltaX * deltaX + deltaY * deltaY >
    WORKSPACE_WIDGET_LONG_PRESS_MOVE_TOLERANCE_PX * WORKSPACE_WIDGET_LONG_PRESS_MOVE_TOLERANCE_PX
  );
}

export function workspaceWidgetLongPressStartsOnInteractive(
  target: EventTarget | null,
  boundary: EventTarget | null
) {
  if (!(target instanceof Element) || !(boundary instanceof Element)) return false;
  const interactive = target.closest(WORKSPACE_WIDGET_INTERACTIVE_SELECTOR);
  return Boolean(interactive && interactive !== boundary && boundary.contains(interactive));
}

export function useReadModeWidgetLongPress(onStartEditing?: () => void) {
  const pressRef = useRef<WidgetLongPressState | null>(null);
  const suppressClickRef = useRef(false);
  const clickGuardTimerRef = useRef<number | null>(null);

  const clearPress = () => {
    const press = pressRef.current;
    if (!press) return;
    window.clearTimeout(press.timer);
    pressRef.current = null;
  };

  const clearClickGuard = () => {
    suppressClickRef.current = false;
    if (clickGuardTimerRef.current !== null) {
      window.clearTimeout(clickGuardTimerRef.current);
      clickGuardTimerRef.current = null;
    }
  };

  const armClickGuard = () => {
    suppressClickRef.current = true;
    if (clickGuardTimerRef.current !== null) {
      window.clearTimeout(clickGuardTimerRef.current);
    }
    clickGuardTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      clickGuardTimerRef.current = null;
    }, WORKSPACE_WIDGET_POST_LONG_PRESS_CLICK_GUARD_MS);
  };

  useEffect(
    () => () => {
      const press = pressRef.current;
      if (press) window.clearTimeout(press.timer);
      if (clickGuardTimerRef.current !== null) {
        window.clearTimeout(clickGuardTimerRef.current);
      }
    },
    []
  );

  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (!onStartEditing || event.button !== 0 || !event.isPrimary) return;
      if (workspaceWidgetLongPressStartsOnInteractive(event.target, event.currentTarget)) return;
      clearPress();
      clearClickGuard();
      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      const timer = window.setTimeout(() => {
        const press = pressRef.current;
        if (!press || press.pointerId !== pointerId) return;
        press.activated = true;
        armClickGuard();
        onStartEditing();
      }, WORKSPACE_WIDGET_LONG_PRESS_DELAY_MS);
      pressRef.current = { timer, pointerId, startX, startY, activated: false };
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const press = pressRef.current;
      if (!press || press.pointerId !== event.pointerId || press.activated) return;
      if (
        workspaceWidgetLongPressMoved(
          { x: press.startX, y: press.startY },
          { x: event.clientX, y: event.clientY }
        )
      ) {
        clearPress();
      }
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const press = pressRef.current;
      if (!press || press.pointerId !== event.pointerId) return;
      if (press.activated) armClickGuard();
      clearPress();
    },
    onPointerCancel: clearPress,
    onPointerLeave: clearPress,
    onClickCapture: (event: MouseEvent<HTMLElement>) => {
      if (!suppressClickRef.current) return;
      clearClickGuard();
      event.preventDefault();
      event.stopPropagation();
    },
  };
}

export function workspaceWidgetSettleDelayMs(index: number) {
  return Math.min(index, 4) * 45;
}
