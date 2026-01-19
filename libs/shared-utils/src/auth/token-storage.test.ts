import { it, vi, expect, describe, beforeEach } from 'vitest';

import { getAccessToken, setAccessToken, clearAccessToken } from './token-storage';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

describe('token-storage', () => {
  beforeEach(() => {
    // Reset localStorage mock before each test
    localStorageMock.clear();
    // Mock window.localStorage
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    // Mock window.dispatchEvent
    window.dispatchEvent = vi.fn();
  });

  describe('getAccessToken', () => {
    it('should return null when token does not exist', () => {
      expect(getAccessToken()).toBeNull();
    });

    it('should return token when it exists', () => {
      const token = 'test-token-123';
      localStorageMock.setItem('dwp-access-token', token);
      expect(getAccessToken()).toBe(token);
    });
  });

  describe('setAccessToken', () => {
    it('should store token in localStorage with correct key', () => {
      const token = 'new-token-456';
      setAccessToken(token);
      expect(localStorageMock.getItem('dwp-access-token')).toBe(token);
    });

    it('should dispatch dwp-auth-token event', () => {
      setAccessToken('test-token');
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dwp-auth-token',
        })
      );
    });
  });

  describe('clearAccessToken', () => {
    it('should remove token from localStorage', () => {
      localStorageMock.setItem('dwp-access-token', 'existing-token');
      clearAccessToken();
      expect(localStorageMock.getItem('dwp-access-token')).toBeNull();
    });

    it('should dispatch dwp-auth-token event', () => {
      clearAccessToken();
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dwp-auth-token',
        })
      );
    });
  });
});
