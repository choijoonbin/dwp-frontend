import { it, expect, describe } from 'vitest';

import { safeReturnUrl, buildReturnUrl } from './auth-redirect';

describe('auth-redirect', () => {
  describe('safeReturnUrl', () => {
    it('should return null for null or undefined', () => {
      expect(safeReturnUrl(null)).toBeNull();
      expect(safeReturnUrl(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(safeReturnUrl('')).toBeNull();
      expect(safeReturnUrl('   ')).toBeNull();
    });

    it('should reject external URLs (http://)', () => {
      expect(safeReturnUrl('http://evil.com')).toBeNull();
      expect(safeReturnUrl('http://example.com/path')).toBeNull();
    });

    it('should reject external URLs (https://)', () => {
      expect(safeReturnUrl('https://evil.com')).toBeNull();
      expect(safeReturnUrl('https://example.com/path')).toBeNull();
    });

    it('should reject protocol-relative URLs (//)', () => {
      expect(safeReturnUrl('//evil.com')).toBeNull();
      expect(safeReturnUrl('//example.com/path')).toBeNull();
    });

    it('should reject paths with ../', () => {
      expect(safeReturnUrl('/../etc/passwd')).toBeNull();
      expect(safeReturnUrl('/path/../../etc/passwd')).toBeNull();
      expect(safeReturnUrl('/path/../other')).toBeNull();
    });

    it('should reject paths not starting with /', () => {
      expect(safeReturnUrl('relative/path')).toBeNull();
      expect(safeReturnUrl('mail')).toBeNull();
    });

    it('should reject sign-in page as returnUrl', () => {
      expect(safeReturnUrl('/sign-in')).toBeNull();
    });

    it('should reject 403 page as returnUrl', () => {
      expect(safeReturnUrl('/403')).toBeNull();
    });

    it('should reject 404 page as returnUrl', () => {
      expect(safeReturnUrl('/404')).toBeNull();
    });

    it('should accept valid internal paths', () => {
      expect(safeReturnUrl('/')).toBe('/');
      expect(safeReturnUrl('/mail')).toBe('/mail');
      expect(safeReturnUrl('/mail/123')).toBe('/mail/123');
      expect(safeReturnUrl('/chat?tab=active')).toBe('/chat?tab=active');
    });

    it('should trim whitespace', () => {
      expect(safeReturnUrl('  /mail  ')).toBe('/mail');
    });
  });

  describe('buildReturnUrl', () => {
    it('should return / for sign-in page', () => {
      expect(buildReturnUrl({ pathname: '/sign-in' })).toBe('/');
    });

    it('should return / for 403 page', () => {
      expect(buildReturnUrl({ pathname: '/403' })).toBe('/');
    });

    it('should return / for 404 page', () => {
      expect(buildReturnUrl({ pathname: '/404' })).toBe('/');
    });

    it('should return pathname for valid pages', () => {
      expect(buildReturnUrl({ pathname: '/mail' })).toBe('/mail');
      expect(buildReturnUrl({ pathname: '/chat' })).toBe('/chat');
    });

    it('should include search params', () => {
      expect(buildReturnUrl({ pathname: '/mail', search: '?id=123' })).toBe('/mail?id=123');
    });
  });
});
