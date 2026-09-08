// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { WorkMobileNavigation } from './work-mobile-navigation';

const access = vi.hoisted(() => ({ allowAssist: false }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@mui/material/useMediaQuery', () => ({ default: () => true }));
vi.mock('@dwp-frontend/shared-utils/auth/use-permissions', () => ({
  usePermissions: () => ({
    permissions: access.allowAssist
      ? [{ resourceType: 'APP', resourceKey: 'APP.ASK', permissionCode: 'VIEW', effect: 'ALLOW' }]
      : [],
  }),
}));

let host: HTMLDivElement;
let root: Root;
function CurrentLocation() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
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

describe('Work mobile navigation', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    access.allowAssist = false;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    document.body.replaceChildren();
  });

  it('exposes five tabs and permits AI navigation only with its read grant', async () => {
    await renderAt('/work/queue');
    const tabs = host.querySelectorAll('nav button');
    expect(tabs).toHaveLength(5);
    expect(tabs[0].getAttribute('aria-current')).toBe('page');
    expect((tabs[3] as HTMLButtonElement).disabled).toBe(true);
  });

  it('opens all three remaining states and keeps refinements when navigating', async () => {
    await renderAt('/work/queue?q=budget&work=old-selection');
    const more = host.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
    await act(async () => more.click());
    const dialog = document.querySelector('[role="dialog"]')!;
    for (const view of ['in-progress', 'awaiting-response', 'completed']) {
      expect(dialog.textContent).toContain(`work:navigation.items.work.${view}.label`);
    }
    const completed = [...dialog.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.includes('work:navigation.items.work.completed.label')
    )!;
    await act(async () => completed.click());
    expect(host.querySelector('[data-testid="location"]')?.textContent).toBe(
      '/work/completed?q=budget'
    );
    expect(more.getAttribute('aria-current')).toBe('page');
  });
});
