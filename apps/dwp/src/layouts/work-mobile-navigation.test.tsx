// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { WorkMobileNavigation } from './work-mobile-navigation';

const access = vi.hoisted(() => ({ calendar: false, notifications: false }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@mui/material/useMediaQuery', () => ({ default: () => true }));
vi.mock('@dwp-frontend/shared-utils/auth/use-permissions', () => ({
  usePermissions: () => ({
    permissions: [
      ...(access.calendar
        ? [
            {
              resourceType: 'APP',
              resourceKey: 'APP.CALENDAR',
              permissionCode: 'VIEW',
              effect: 'ALLOW',
            },
          ]
        : []),
      ...(access.notifications
        ? [
            {
              resourceType: 'APP',
              resourceKey: 'APP.NOTIFICATIONS',
              permissionCode: 'VIEW',
              effect: 'ALLOW',
            },
          ]
        : []),
    ],
  }),
}));

let host: HTMLDivElement;
let root: Root;

function CurrentLocation() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

async function renderAt(path: string) {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <WorkMobileNavigation />
        <CurrentLocation />
      </MemoryRouter>
    )
  );
}

function tab(key: string) {
  const match = [...host.querySelectorAll<HTMLButtonElement>('nav button')].find((button) =>
    button.textContent?.includes(`workHub.mobileNavigation.${key}`)
  );
  expect(match).toBeDefined();
  return match!;
}

describe('Work mobile navigation', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    access.calendar = false;
    access.notifications = false;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    document.body.replaceChildren();
  });

  it('matches the five Stitch destinations and disables governed apps without read grants', async () => {
    await renderAt('/work/queue');

    expect(host.querySelectorAll('nav button')).toHaveLength(5);
    expect(tab('work').getAttribute('aria-current')).toBe('page');
    expect(tab('home').disabled).toBe(false);
    expect(tab('calendar').disabled).toBe(true);
    expect(tab('notifications').disabled).toBe(true);
    expect(tab('profile').disabled).toBe(false);
  });

  it('routes every granted tab to a real product destination', async () => {
    access.calendar = true;
    access.notifications = true;
    await renderAt('/work/queue?work=selection');

    for (const [key, path] of [
      ['home', '/'],
      ['work', '/work/queue'],
      ['calendar', '/calendar/home'],
      ['notifications', '/notifications/home'],
      ['profile', '/account/profile'],
    ] as const) {
      await act(async () => tab(key).click());
      expect(host.querySelector('[data-testid="location"]')?.textContent).toBe(path);
    }
  });
});
