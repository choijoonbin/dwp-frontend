import { describe, expect, it } from 'vitest';

import {
  LAUNCHPAD_LONG_PRESS_DELAY_MS,
  LAUNCHPAD_LONG_PRESS_MOVE_TOLERANCE,
  launchpadMouseActivationConstraint,
  launchpadTouchActivationConstraint,
} from './app-launchpad-long-press';

describe('launchpad drag activation', () => {
  it('uses a sustained press before starting a drag outside edit mode', () => {
    expect(launchpadMouseActivationConstraint(false)).toEqual({
      delay: LAUNCHPAD_LONG_PRESS_DELAY_MS,
      tolerance: LAUNCHPAD_LONG_PRESS_MOVE_TOLERANCE,
    });
    expect(launchpadTouchActivationConstraint(false)).toEqual({
      delay: LAUNCHPAD_LONG_PRESS_DELAY_MS,
      tolerance: LAUNCHPAD_LONG_PRESS_MOVE_TOLERANCE,
    });
  });

  it('uses direct manipulation constraints in edit mode', () => {
    expect(launchpadMouseActivationConstraint(true)).toEqual({ distance: 8 });
    expect(launchpadTouchActivationConstraint(true)).toEqual({ delay: 420, tolerance: 8 });
  });
});
