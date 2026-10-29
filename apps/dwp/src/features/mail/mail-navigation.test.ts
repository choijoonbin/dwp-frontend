import { describe, expect, it } from 'vitest';

import {
  findMailNavigationItem,
  mailNavigationForAccountAvailability,
  MAIL_NAVIGATION,
} from './mail-navigation';
import { MAIL_NAVIGATION_PROJECTION } from './mail-navigation-more';

describe('mail navigation', () => {
  it('owns unique product routes and resolves trailing slashes', () => {
    const items = MAIL_NAVIGATION.flatMap((group) => group.items);
    expect(new Set(items.map((item) => item.path)).size).toBe(items.length);
    expect(findMailNavigationItem('/mail/inbox/')?.view).toBe('inbox');
  });

  it('keeps tenant operations behind delegated mail administration', () => {
    const adminItems = MAIL_NAVIGATION.find((group) => group.id === 'admin')?.items ?? [];
    expect(adminItems.length).toBeGreaterThan(0);
    expect(
      adminItems.every(
        (item) =>
          item.requiredResourceKey === 'ADMIN.MAIL' && item.requiredPermissionCode === 'VIEW'
      )
    ).toBe(true);
  });

  it('collapses only authorized low-frequency mailboxes into the More panel', () => {
    const projected = MAIL_NAVIGATION_PROJECTION.project(
      new Set(['/mail/inbox', '/mail/archive', '/mail/spam'])
    );
    const mailboxItems = projected.find((group) => group.id === 'mailbox')?.items ?? [];
    const more = mailboxItems.find((item) => item.view === 'more');

    expect(mailboxItems.map((item) => item.view)).toEqual(['inbox', 'more']);
    expect(more?.activePathPrefixes).toEqual(['/mail/archive', '/mail/spam']);
    expect(MAIL_NAVIGATION_PROJECTION.resolveSelectedView?.('/mail/spam')).toBe('more');
  });

  it('removes mailbox work destinations when no account can execute them', () => {
    const paths = mailNavigationForAccountAvailability(false).flatMap((group) =>
      group.items.map((item) => item.path)
    );

    expect(paths).not.toContain('/mail/inbox');
    expect(paths).not.toContain('/mail/search');
    expect(paths).not.toContain('/mail/drafts');
    expect(paths).toContain('/mail/home');
    expect(paths).toContain('/mail/accounts');
  });
});
