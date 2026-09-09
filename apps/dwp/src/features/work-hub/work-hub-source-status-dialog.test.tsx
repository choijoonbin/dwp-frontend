// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkHubSourceStatusDialog } from './work-hub-source-status-dialog';
import { NOW } from './work-hub.test-support';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let host: HTMLDivElement;
let root: Root;

describe('WorkHubSourceStatusDialog', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  it('refreshes one source without hiding full refresh and exposes only allowed owner routes', async () => {
    const retrySource = vi.fn();
    await act(async () =>
      root.render(
        <MemoryRouter>
          <WorkHubSourceStatusDialog
            open
            sources={[
              {
                sourceId: 'services',
                state: 'UNAVAILABLE',
                items: [],
                receivedAt: null,
                generatedAt: null,
                hasMore: false,
              },
              {
                sourceId: 'approval-inbox',
                state: 'FORBIDDEN',
                items: [],
                receivedAt: null,
                generatedAt: null,
                hasMore: false,
              },
              {
                sourceId: 'personal',
                state: 'READY',
                items: [],
                receivedAt: new Date(NOW).toISOString(),
                generatedAt: null,
                hasMore: false,
              },
            ]}
            onClose={vi.fn()}
            onRetry={vi.fn()}
            onRetrySource={retrySource}
            retrying={false}
          />
        </MemoryRouter>
      )
    );

    const scoped = document.querySelectorAll<HTMLButtonElement>(
      '[aria-label^="work:workHub.sourcesDialog.retrySourceLabel"]'
    );
    expect(scoped).toHaveLength(3);
    await act(async () => scoped[0]?.click());
    expect(retrySource).toHaveBeenCalledWith('services');
    expect(document.querySelector('a[href="/services/my"]')).not.toBeNull();
    expect(document.querySelector('a[href="/approvals/inbox"]')).toBeNull();
    expect(document.body.textContent).toContain('work:workHub.sourcesDialog.retry');
  });
});
