import { describe, expect, it } from 'vitest';
import { matchRoutes } from 'react-router-dom';

import { notificationRoutes } from './notification-routes';

function matchedLeaf(pathname: string) {
  return matchRoutes(notificationRoutes, pathname)?.at(-1)?.route;
}

describe('notification route contract', () => {
  it('renders the notification center at the product root', () => {
    expect(matchedLeaf('/notifications')?.index).toBe(true);
  });

  it('renders notification details as first-level deep links', () => {
    expect(matchedLeaf('/notifications/notification-42')?.path).toBe(':notificationId');
  });

  it('recovers unsupported nested paths through the notification fallback', () => {
    expect(matchedLeaf('/notifications/unsupported/nested')?.path).toBe('*');
  });
});
