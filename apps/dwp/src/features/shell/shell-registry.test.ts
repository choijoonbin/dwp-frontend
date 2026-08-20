import { describe, expect, it } from 'vitest';

import { resolveShellKey, shellRegistry } from './shell-registry';

describe('global shell registry', () => {
  it('resolves every product route to one explicit shell contract', () => {
    expect(resolveShellKey('/')).toBe('home');
    expect(resolveShellKey('/apps')).toBe('catalog');
    expect(resolveShellKey('/work/queue')).toBe('work');
    expect(resolveShellKey('/communications/for-you')).toBe('communications');
    expect(resolveShellKey('/communications/admin/content')).toBe('communications');
    expect(resolveShellKey('/services/discover')).toBe('services');
    expect(resolveShellKey('/services/admin/catalog')).toBe('services');
    expect(resolveShellKey('/work/home')).toBe('work');
    expect(resolveShellKey('/activity/timeline')).toBe('activity');
    expect(resolveShellKey('/hr/directory')).toBe('hcm');
    expect(resolveShellKey('/hr/design/organization')).toBe('hcm');
    expect(resolveShellKey('/calendar/availability')).toBe('calendar');
    expect(resolveShellKey('/rooms/find')).toBe('rooms');
    expect(resolveShellKey('/account/settings')).toBe('account');
    expect(resolveShellKey('/admin/platform/reference-data')).toBe('admin');
    expect(resolveShellKey('/provider/data-governance')).toBe('provider');
    expect(resolveShellKey('/sign-in')).toBeUndefined();
  });

  it('keeps tenant and provider identity boundaries explicit', () => {
    expect(shellRegistry.home.brandMode).toBe('tenant-cobrand');
    expect(shellRegistry.provider.scope).toBe('provider');
    expect(shellRegistry.provider.showWorkspace).toBe(false);
    expect(shellRegistry.admin.scope).toBe('tenant');
    expect(shellRegistry.admin.showWorkspace).toBe(true);
  });

  it('reserves the wider navigation only for control-plane shells', () => {
    expect(shellRegistry.work.desktopNavigationWidth).toBeLessThan(
      shellRegistry.admin.desktopNavigationWidth
    );
    expect(shellRegistry.hcm.desktopNavigationWidth).toBe(
      shellRegistry.work.desktopNavigationWidth
    );
    expect(shellRegistry.communications.desktopNavigationWidth).toBe(
      shellRegistry.work.desktopNavigationWidth
    );
    expect(shellRegistry.services.desktopNavigationWidth).toBe(
      shellRegistry.work.desktopNavigationWidth
    );
    expect(shellRegistry.provider.desktopNavigationWidth).toBe(
      shellRegistry.admin.desktopNavigationWidth
    );
  });
});
