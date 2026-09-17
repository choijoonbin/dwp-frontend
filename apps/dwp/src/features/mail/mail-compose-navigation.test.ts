import { describe, expect, it } from 'vitest';

import {
  mailComposeNavigationState,
  parseMailComposeNavigationState,
  safeMailReturnPath,
} from './mail-compose-navigation';

describe('mail compose navigation state', () => {
  it('accepts only local mail return paths', () => {
    expect(safeMailReturnPath('/mail/contacts?contact=1')).toBe('/mail/contacts?contact=1');
    expect(safeMailReturnPath('https://evil.example/mail')).toBeNull();
    expect(safeMailReturnPath('//evil.example/mail')).toBeNull();
    expect(safeMailReturnPath('/approvals')).toBeNull();
  });

  it('round trips a bounded compose seed', () => {
    const state = mailComposeNavigationState(
      { toEmail: 'alex@example.com', subject: 'Hello', body: 'Review this' },
      '/mail/contacts?contact=42'
    );
    expect(parseMailComposeNavigationState(state)).toEqual({
      seed: { toEmail: 'alex@example.com', subject: 'Hello', body: 'Review this' },
      returnTo: '/mail/contacts?contact=42',
    });
  });
});
