// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkHubBatchDialog } from './work-hub-batch-dialog';
import { hubItem, workspace } from './work-hub.test-support';

import type { Root } from 'react-dom/client';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let host: HTMLDivElement;
let root: Root;
const item = hubItem({
  title: 'Verify the source result',
  legacyItem: workspace({ workItemId: 'work-1' }),
});

describe('WorkHubBatchDialog', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    document.body.replaceChildren();
  });

  it('shows reviewed targets before execution and item-level receipts afterward', async () => {
    await act(async () =>
      root.render(
        <WorkHubBatchDialog
          target="COMPLETED"
          selectedCount={1}
          items={[item]}
          outcome={null}
          busy={false}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />
      )
    );
    expect(document.body.textContent).toContain('Verify the source result');
    expect(document.body.textContent).toContain('work:workHub.batch.atomicNotice');

    await act(async () =>
      root.render(
        <WorkHubBatchDialog
          target="COMPLETED"
          selectedCount={1}
          items={[item]}
          outcome="UNKNOWN"
          busy={false}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />
      )
    );
    expect(document.querySelector('[aria-label="work:workHub.batch.resultList"]')).not.toBeNull();
    expect(document.body.textContent).toContain('work:workHub.batch.results.unknown');
    expect(document.body.textContent).toContain('work:workHub.batch.noBlindRetry');
  });
});
