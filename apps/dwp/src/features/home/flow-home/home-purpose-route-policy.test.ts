import { describe, expect, it } from 'vitest';

import { homePurposeAllRoute } from './home-purpose-route-policy';

const item = (appKey: string, deepLink: string) => ({ owner: { appKey }, deepLink });

describe('Home purpose all-route policy', () => {
  it('uses the consuming Calendar schedule and safe Calendar aggregate routes', () => {
    expect(
      homePurposeAllRoute('timeline', [item('APP.CALENDAR', '/calendar/schedule?event=event-1')])
    ).toBe('/calendar/schedule');
    expect(homePurposeAllRoute('pulse', [item('APP.CALENDAR', '/calendar/insights')])).toBe(
      '/calendar/home'
    );
    expect(homePurposeAllRoute('pulse', [item('APP.CALENDAR', '/calendar/home')])).toBe(
      '/calendar/home'
    );
  });

  it('keeps read-only Approval tasks out of the administrator destination', () => {
    expect(homePurposeAllRoute('pulse', [item('APP.APPROVALS', '/approvals/inbox?task=1')])).toBe(
      '/approvals/inbox'
    );
    expect(
      homePurposeAllRoute('pulse', [item('APP.APPROVALS', '/approvals/admin/operations')])
    ).toBe('/approvals/admin/operations');
    expect(
      homePurposeAllRoute('pulse', [
        item('APP.APPROVALS', '/approvals/inbox?task=1'),
        item('APP.APPROVALS', '/approvals/admin/operations'),
      ])
    ).toBe('/approvals/home');
  });

  it('uses needs-info for a response and a safe Home route for mixed request states', () => {
    expect(
      homePurposeAllRoute('response', [
        item('APP.APPROVALS', '/approvals/requests/needs-info?request=1'),
      ])
    ).toBe('/approvals/requests/needs-info');
    expect(
      homePurposeAllRoute('request', [
        item('APP.APPROVALS', '/approvals/requests/submitted?request=1'),
        item('APP.APPROVALS', '/approvals/requests/needs-info?request=2'),
      ])
    ).toBe('/approvals/home');
  });

  it('declines to invent a unified destination for mixed app sources', () => {
    expect(
      homePurposeAllRoute('response', [
        item('APP.NOTIFICATIONS', '/notifications/home'),
        item('APP.APPROVALS', '/approvals/requests/needs-info?request=1'),
      ])
    ).toBeUndefined();
  });
});
