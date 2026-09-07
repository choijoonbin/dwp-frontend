// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkHubList } from './work-hub-list';
import { hubItem, NOW } from './work-hub.test-support';

import type { Root } from 'react-dom/client';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let host: HTMLDivElement;
let root: Root;

describe('WorkHubList', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('exposes a stable opener and omits urgency for terminal work', async () => {
    const onOpen = vi.fn();
    const item = hubItem({ lifecycle: 'ARCHIVED', dueAt: '2026-09-05T09:00:00Z' });
    await act(async () =>
      root.render(
        <WorkHubList
          items={[item]}
          selectedKey={null}
          checkedKeys={new Set()}
          now={NOW}
          canCheck={() => false}
          onCheck={vi.fn()}
          onOpen={onOpen}
        />
      )
    );

    expect(host.textContent).toContain('workHub.lifecycle.ARCHIVED');
    expect(host.textContent).not.toContain('workHub.urgency.SCHEDULED');
    const opener = host.querySelector<HTMLButtonElement>('[data-work-open]')!;
    await act(async () => opener.click());
    expect(onOpen).toHaveBeenCalledWith(item);
  });
});
