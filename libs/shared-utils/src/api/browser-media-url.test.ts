import { describe, expect, it } from 'vitest';

import { resolveBrowserMediaUrl } from './browser-media-url';

describe('browser media URL policy', () => {
  it('keeps authenticated gateway media on the application origin', () => {
    expect(resolveBrowserMediaUrl('/api/platform/v1/tenant-branding/logo?v=3')).toBe(
      '/api/platform/v1/tenant-branding/logo?v=3'
    );
    expect(resolveBrowserMediaUrl('api/platform/v1/home-experience/background?v=4')).toBe(
      '/api/platform/v1/home-experience/background?v=4'
    );
  });

  it('preserves explicitly absolute and browser-owned media URLs', () => {
    expect(resolveBrowserMediaUrl('https://cdn.example.com/tenant/logo.svg')).toBe(
      'https://cdn.example.com/tenant/logo.svg'
    );
    expect(resolveBrowserMediaUrl('blob:tenant-logo')).toBe('blob:tenant-logo');
    expect(resolveBrowserMediaUrl('data:image/svg+xml;base64,PHN2Zy8+')).toBe(
      'data:image/svg+xml;base64,PHN2Zy8+'
    );
  });
});
