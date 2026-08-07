import { it, expect, describe, beforeEach } from 'vitest';

import { getAccessToken, setAccessToken, clearAccessToken } from './token-storage';

describe('token storage', () => {
  beforeEach(() => window.localStorage.clear());

  it('stores and clears the access token', () => {
    setAccessToken('token');
    expect(getAccessToken()).toBe('token');

    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });
});
