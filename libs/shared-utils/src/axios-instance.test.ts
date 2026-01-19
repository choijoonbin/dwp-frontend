import { it, vi, expect, describe, beforeEach } from 'vitest';

import { HttpError } from './http-error';
import { axiosInstance, setUnauthorizedHandler } from './axios-instance';

// Mock fetch
global.fetch = vi.fn();

// Mock getAccessToken and getTenantId
vi.mock('./auth/token-storage', () => ({
  getAccessToken: () => 'mock-token',
}));

vi.mock('./tenant-util', () => ({
  getTenantId: () => 'mock-tenant',
}));

vi.mock('./env', () => ({
  NX_API_URL: 'http://localhost:8080',
}));

describe('axios-instance 401/403 handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUnauthorizedHandler(null);
    // Reset window.location.pathname mock
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/mail',
      },
      writable: true,
    });
  });

  describe('401 handling', () => {
    it('should call unauthorized handler once for 401', async () => {
      const handler = vi.fn();
      setUnauthorizedHandler(handler);

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({}),
      } as Response);

      await expect(axiosInstance.get('/api/test')).rejects.toThrow(HttpError);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(401);
    });

    it('should not call handler if already on /sign-in page', async () => {
      const handler = vi.fn();
      setUnauthorizedHandler(handler);

      Object.defineProperty(window, 'location', {
        value: { pathname: '/sign-in' },
        writable: true,
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({}),
      } as Response);

      await expect(axiosInstance.get('/api/test')).rejects.toThrow(HttpError);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should prevent infinite loop (multiple 401s)', async () => {
      const handler = vi.fn();
      setUnauthorizedHandler(handler);

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({}),
      } as Response);

      // Simulate multiple requests
      const promises = [
        axiosInstance.get('/api/test1'),
        axiosInstance.get('/api/test2'),
        axiosInstance.get('/api/test3'),
      ];

      await Promise.allSettled(promises);

      // Handler should be called, but not infinitely
      // Exact count depends on implementation, but should be limited
      expect(handler).toHaveBeenCalled();
      // Should not exceed reasonable limit (e.g., 10)
      expect(handler.mock.calls.length).toBeLessThanOrEqual(10);
    });
  });

  describe('403 handling', () => {
    it('should call unauthorized handler for 403', async () => {
      const handler = vi.fn();
      setUnauthorizedHandler(handler);

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({}),
      } as Response);

      await expect(axiosInstance.get('/api/test')).rejects.toThrow(HttpError);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(403);
    });

    it('should not call handler if already on /403 page', async () => {
      const handler = vi.fn();
      setUnauthorizedHandler(handler);

      Object.defineProperty(window, 'location', {
        value: { pathname: '/403' },
        writable: true,
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({}),
      } as Response);

      await expect(axiosInstance.get('/api/test')).rejects.toThrow(HttpError);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('other status codes', () => {
    it('should not call handler for 404', async () => {
      const handler = vi.fn();
      setUnauthorizedHandler(handler);

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({}),
      } as Response);

      await expect(axiosInstance.get('/api/test')).rejects.toThrow(HttpError);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should not call handler for 500', async () => {
      const handler = vi.fn();
      setUnauthorizedHandler(handler);

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({}),
      } as Response);

      await expect(axiosInstance.get('/api/test')).rejects.toThrow(HttpError);
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
