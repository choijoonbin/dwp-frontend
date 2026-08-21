import { describe, expect, it } from 'vitest';
import { matchRoutes } from 'react-router-dom';

import { notificationRoutes } from './notification-routes';

function matchedLeaf(pathname: string) {
  return matchRoutes(notificationRoutes, pathname)?.at(-1)?.route;
}

describe('notification route contract', () => {
  it('redirects the product root to its dedicated home', () => {
    expect(matchedLeaf('/notifications')?.index).toBe(true);
    expect(matchedLeaf('/notifications/home')?.path).toBe('home');
  });

  it('keeps the center and detail routes inside the product shell', () => {
    expect(matchedLeaf('/notifications/center')?.path).toBe('center');
    expect(matchedLeaf('/notifications/center/notification-42')?.path).toBe(
      'center/:notificationId'
    );
  });

  it('preserves first-level detail links as compatibility redirects', () => {
    expect(matchedLeaf('/notifications/notification-42')?.path).toBe(':notificationId');
  });

  it('exposes tenant policy governance as a dedicated administration route', () => {
    expect(matchedLeaf('/notifications/admin/policies')?.path).toBe('admin/policies');
    expect(matchedLeaf('/notifications/admin/templates')?.path).toBe('admin/templates');
    expect(matchedLeaf('/notifications/admin/suppressions')?.path).toBe('admin/suppressions');
  });

  it('recovers unsupported nested paths through the notification fallback', () => {
    expect(matchedLeaf('/notifications/unsupported/nested')?.path).toBe('*');
  });
});
