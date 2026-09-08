// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkHubSourceOwnedDetail } from './work-hub-source-owned-detail';
import { hubItem } from './work-hub.test-support';

import type { Root } from 'react-dom/client';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let host: HTMLDivElement;
let root: Root;

describe('WorkHubSourceOwnedDetail', () => {
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

  it.each([
    ['APPROVAL_TASK', 'approval'],
    ['SERVICE_REQUEST', 'service'],
  ] as const)(
    'keeps %s detail read-only and hands execution back to its owner',
    async (sourceSystem, kind) => {
      await act(async () =>
        root.render(
          <WorkHubSourceOwnedDetail
            item={hubItem({
              reference: { sourceSystem, sourceReference: 'source-1' },
              sourceStatus: 'PENDING',
              waitingFor: 'ME',
            })}
          />
        )
      );

      expect(document.body.textContent).toContain(`workHub.sourceDetail.${kind}.title`);
      expect(document.body.textContent).toContain(`workHub.sourceDetail.${kind}.handoffNotice`);
      expect(document.body.textContent).toContain(
        sourceSystem === 'APPROVAL_TASK'
          ? 'workHub.statusLabels.approvalPending'
          : 'workHub.lifecycle.OPEN'
      );
      expect(document.querySelector('button')).toBeNull();
      expect(document.querySelector('form')).toBeNull();
    }
  );
});
