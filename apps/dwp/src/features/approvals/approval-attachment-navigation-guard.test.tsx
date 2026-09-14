// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { ApprovalAttachmentNavigationGuard } from './approval-attachment-navigation-guard';

const OWNER = '11111111-1111-4111-8111-111111111111';
let root: Root;
let container: HTMLDivElement;
let locked = true;
let changeLocked: (value: boolean) => void;
let router: ReturnType<typeof createMemoryRouter>;
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function Guard() {
  const [currentLocked, setLocked] = useState(locked);
  changeLocked = setLocked;
  return <ApprovalAttachmentNavigationGuard locked={currentLocked} ownerId={OWNER} />;
}
const render = () => act(() => root.render(<RouterProvider router={router} />));

describe('attachment navigation while original transfer remains private', () => {
  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    locked = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    router = createMemoryRouter(
      [
        { path: '/approvals/requests/needs-info', element: <Guard /> },
        { path: '/approvals/home', element: <div>Home</div> },
      ],
      { initialEntries: [`/approvals/requests/needs-info?request=${OWNER}`] }
    );
    await render();
  });
  afterEach(async () => {
    await act(() => root.unmount());
    router.dispose();
    container.remove();
    vi.unstubAllGlobals();
  });

  it('blocks real router pathname navigation, then allows it only after the transfer resolves', async () => {
    await act(() => router.navigate('/approvals/home'));
    expect(router.state.location.pathname).toBe('/approvals/requests/needs-info');
    expect(container.textContent).toContain('requests.attachments.navigationBlocked');
    const blocker = Array.from(router.state.blockers.values())[0];
    await act(() => blocker.reset?.());
    await act(() => changeLocked(false));
    await act(() => router.navigate('/approvals/home'));
    expect(router.state.location.pathname).toBe('/approvals/home');
  });

  it('permits close/reopen of only the original document but blocks a different owner on the same pathname', async () => {
    await act(() => router.navigate('/approvals/requests/needs-info'));
    expect(router.state.location.search).toBe('');
    await act(() => router.navigate(`/approvals/requests/needs-info?request=${OWNER}`));
    expect(router.state.location.search).toContain(OWNER);
    await act(() =>
      router.navigate('/approvals/requests/needs-info?request=22222222-2222-4222-8222-222222222222')
    );
    expect(router.state.location.search).toContain(OWNER);
    expect(container.textContent).toContain('requests.attachments.navigationBlocked');
  });

  it('warns on actual beforeunload while locked and removes the warning after unmount', async () => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await act(() => root.unmount());
    const next = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(next);
    expect(next.defaultPrevented).toBe(false);
    root = createRoot(container);
  });
});
