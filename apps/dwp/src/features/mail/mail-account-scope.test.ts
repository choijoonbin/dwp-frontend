import { describe, expect, it } from 'vitest';

import { mailAccountScopedPath, validMailAccountScope } from './mail-account-scope';

describe('mail account scope', () => {
  it('adds an account without losing filters or anchors', () => {
    expect(mailAccountScopedPath('/mail/inbox?lane=PRIORITY#focus', 'account-1')).toBe(
      '/mail/inbox?lane=PRIORITY&accountId=account-1#focus'
    );
    expect(mailAccountScopedPath('/mail/inbox', null)).toBe('/mail/inbox');
  });

  it('accepts only an account projected by the current home response', () => {
    const accounts = [{ accountId: 'account-1' }];
    expect(validMailAccountScope('account-1', accounts)).toBe('account-1');
    expect(validMailAccountScope('other', accounts)).toBeNull();
  });
});
