import { describe, expect, it } from 'vitest';

import { homeNotificationRuntimeAuthorized } from './home-notification-runtime';

describe('Home notification runtime boundary', () => {
  it.each([
    [false, false, false],
    [false, true, false],
    [true, false, false],
    [true, true, true],
  ] as const)(
    'authorizes notification reads only when permission=%s and runtime=%s',
    (hasNotificationPermission, notificationRuntimeEnabled, expected) => {
      expect(
        homeNotificationRuntimeAuthorized(hasNotificationPermission, notificationRuntimeEnabled)
      ).toBe(expected);
    }
  );
});
