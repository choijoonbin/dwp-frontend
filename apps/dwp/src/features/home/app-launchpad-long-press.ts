export const LAUNCHPAD_LONG_PRESS_DELAY_MS = 550;
export const LAUNCHPAD_LONG_PRESS_MOVE_TOLERANCE = 10;
export const LAUNCHPAD_POST_DRAG_CLICK_GUARD_MS = 300;

export function launchpadMouseActivationConstraint(editing: boolean) {
  return editing
    ? { distance: 8 as const }
    : {
        delay: LAUNCHPAD_LONG_PRESS_DELAY_MS,
        tolerance: LAUNCHPAD_LONG_PRESS_MOVE_TOLERANCE,
      };
}

export function launchpadTouchActivationConstraint(editing: boolean) {
  return editing
    ? { delay: 420, tolerance: 8 }
    : {
        delay: LAUNCHPAD_LONG_PRESS_DELAY_MS,
        tolerance: LAUNCHPAD_LONG_PRESS_MOVE_TOLERANCE,
      };
}
