import { keyframes } from '@emotion/react';

export const WORKSPACE_APP_JIGGLE_DURATION_MS = 360;
export const WORKSPACE_WIDGET_JIGGLE_DURATION_MS = 680;
export const WORKSPACE_WIDGET_SETTLE_DURATION_MS = 460;
export const WORKSPACE_WIDGET_READY_PULSE_DURATION_MS = 2400;
export const WORKSPACE_WIDGET_SETTLE_FALLBACK_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';
export const WORKSPACE_WIDGET_SETTLE_SPRING_EASING =
  'linear(0, 0.55 18%, 0.9 34%, 1.03 52%, 0.992 72%, 1)';

export const workspaceAppJiggle = keyframes`
  0%, 100% { transform: translate3d(-0.7px, 0.15px, 0) rotate(-1.55deg); }
  25% { transform: translate3d(0.2px, -0.45px, 0) rotate(0.75deg); }
  50% { transform: translate3d(0.75px, 0, 0) rotate(1.45deg); }
  75% { transform: translate3d(-0.15px, 0.45px, 0) rotate(-0.65deg); }
`;

export const workspaceWidgetJiggle = keyframes`
  0%, 100% { translate: -0.55px 0.12px; rotate: -0.045deg; }
  25% { translate: 0.1px -0.38px; rotate: 0.025deg; }
  50% { translate: 0.55px 0; rotate: 0.05deg; }
  75% { translate: -0.08px 0.38px; rotate: -0.025deg; }
`;

export const workspaceWidgetSettle = keyframes`
  0% { opacity: 0.965; transform: translate3d(0, 3px, 0) scale(0.997); }
  100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
`;

export const workspaceWidgetReadyPulse = keyframes`
  0%, 100% {
    border-color: rgba(37, 99, 235, 0.42);
    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0);
  }
  50% {
    border-color: rgba(37, 99, 235, 0.62);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.055);
  }
`;

export function workspaceWidgetSettleDelayMs(index: number) {
  return Math.min(index, 4) * 45;
}
