import { describe, expect, it } from 'vitest';

import { meetingMobileNavigationVisible } from './meeting-mobile-navigation';

describe('meeting mobile navigation visibility', () => {
  it.each(['home', 'history', 'follow-ups', 'preferences'] as const)(
    'keeps the stable destinations visible on %s',
    (view) => {
      expect(meetingMobileNavigationVisible(view, '')).toBe(true);
    }
  );

  it('shows the navigation on the My meetings list only', () => {
    expect(meetingMobileNavigationVisible('mine', '')).toBe(true);
    expect(meetingMobileNavigationVisible('mine', '?view=preparation&meeting=meeting-1')).toBe(
      false
    );
    expect(meetingMobileNavigationVisible('mine', '?view=schedule')).toBe(false);
    expect(meetingMobileNavigationVisible('mine', '?view=personal-room')).toBe(false);
  });

  it.each([
    'join',
    'templates',
    'admin-operations',
    'admin-policies',
    'admin-intelligence',
  ] as const)('does not overlay focus or administration view %s', (view) => {
    expect(meetingMobileNavigationVisible(view, '')).toBe(false);
  });
});
