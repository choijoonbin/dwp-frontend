// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkHubSourceStatusDialog } from './work-hub-source-status-dialog';
import { hubItem, NOW } from './work-hub.test-support';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let host: HTMLDivElement;
let root: Root;

function sourceTabs() {
  const tabs = document.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  expect(tabs).toHaveLength(2);
  return { sourceTab: tabs[0]!, resultTab: tabs[1]! };
}

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
    const { sourceTab } = sourceTabs();
    const resultsPanel = document.querySelector<HTMLElement>(
      '[role="tabpanel"][id$="results-panel"]'
    );
    expect(sourceTab.getAttribute('aria-selected')).toBe('true');
    expect(resultsPanel?.hidden).toBe(true);
    expect(scoped).toHaveLength(3);
    await act(async () => scoped[0]?.click());
    expect(retrySource).toHaveBeenCalledWith('services');
    expect(document.querySelector('a[href="/services/my"]')).not.toBeNull();
    expect(document.querySelector('a[href="/approvals/inbox"]')).toBeNull();
    expect(document.body.textContent).toContain('work:workHub.sourcesDialog.retry');
  });

  it('keeps live source states and durable batch receipt outcomes in one review dialog', async () => {
    const first = hubItem({ key: 'first', title: 'Confirmed work' });
    const second = hubItem({ key: 'second', title: 'Conflicted work' });
    const third = hubItem({ key: 'third', title: 'Restricted work' });
    const fourth = hubItem({ key: 'fourth', title: 'Unconfirmed work' });
    const fifth = hubItem({ key: 'fifth', title: 'Excluded work' });
    const review = vi.fn();
    await act(async () =>
      root.render(
        <MemoryRouter>
          <WorkHubSourceStatusDialog
            open
            sources={[
              {
                sourceId: 'personal',
                state: 'READY',
                items: [first],
                receivedAt: new Date(NOW).toISOString(),
                generatedAt: null,
                hasMore: false,
              },
              {
                sourceId: 'workspace',
                state: 'READY',
                items: [second],
                receivedAt: new Date(NOW).toISOString(),
                generatedAt: null,
                hasMore: true,
              },
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
                sourceId: 'work-assignments',
                state: 'NOT_REQUESTED',
                items: [],
                receivedAt: null,
                generatedAt: null,
                hasMore: false,
              },
            ]}
            snapshotReceivedAt={new Date(NOW).toISOString()}
            completeness="PARTIAL"
            onClose={vi.fn()}
            onRetry={vi.fn()}
            retrying={false}
            batchItems={[first, second, third, fourth, fifth]}
            batchOutcome="UNKNOWN"
            batchExpanded
            reportFocused
            batchReceipts={[
              {
                item: first,
                state: 'CONFIRMED',
                idempotencyKey: 'receipt-1',
                reviewedCommand: { kind: 'PERSONAL_COMPLETE', lifecycle: 'OPEN', version: 1 },
              },
              {
                item: second,
                state: 'CONFLICT',
                idempotencyKey: 'receipt-2',
                reviewedCommand: { kind: 'PERSONAL_COMPLETE', lifecycle: 'OPEN', version: 1 },
              },
              {
                item: third,
                state: 'FORBIDDEN',
                idempotencyKey: 'receipt-3',
                reviewedCommand: { kind: 'PERSONAL_COMPLETE', lifecycle: 'OPEN', version: 1 },
              },
              {
                item: fourth,
                state: 'UNKNOWN',
                idempotencyKey: 'receipt-4',
                reviewedCommand: { kind: 'PERSONAL_COMPLETE', lifecycle: 'OPEN', version: 1 },
              },
              {
                item: fifth,
                state: 'EXCLUDED',
                idempotencyKey: 'receipt-5',
                reviewedCommand: { kind: null, lifecycle: 'OPEN', version: 1 },
              },
            ]}
            onReviewItem={review}
          />
        </MemoryRouter>
      )
    );

    expect(document.body.textContent).toContain('work:workHub.sourcesDialog.serviceCode');
    const { sourceTab, resultTab } = sourceTabs();
    const sourcePanel = document.querySelector<HTMLElement>(
      '[role="tabpanel"][id$="sources-panel"]'
    )!;
    const resultsPanel = document.querySelector<HTMLElement>(
      '[role="tabpanel"][id$="results-panel"]'
    )!;
    expect(resultTab.getAttribute('aria-selected')).toBe('true');
    expect(sourcePanel.hidden).toBe(true);
    expect(resultsPanel.hidden).toBe(false);
    expect(document.querySelectorAll('li')).toHaveLength(10);
    const report = document.querySelector('[data-testid="work-hub-batch-report"]');
    expect(report).not.toBeNull();
    expect(Array.from(report!.querySelectorAll('dd')).map((node) => node.textContent)).toEqual([
      '5',
      '4',
      '1',
      '1',
      '1',
      '1',
      '1',
    ]);
    const reviewButton = document.querySelector<HTMLButtonElement>(
      '[aria-label="work:workHub.batch.reviewItemLabel"]'
    );
    await act(async () => reviewButton?.click());
    expect(review).toHaveBeenCalledWith(second);

    await act(async () => sourceTab.click());
    expect(sourceTab.getAttribute('aria-selected')).toBe('true');
    expect(sourcePanel.hidden).toBe(false);
    expect(resultsPanel.hidden).toBe(true);
    sourceTab.focus();
    await act(async () =>
      sourceTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    );
    expect(document.activeElement).toBe(resultTab);
    expect(resultTab.getAttribute('aria-selected')).toBe('true');
    expect(resultsPanel.hidden).toBe(false);
  });

  it('opens durable batch detail when the results tab is selected from source status', async () => {
    const item = hubItem({ key: 'confirmed', title: 'Confirmed work' });
    const openBatch = vi.fn();
    await act(async () =>
      root.render(
        <MemoryRouter>
          <WorkHubSourceStatusDialog
            open
            sources={[]}
            onClose={vi.fn()}
            onRetry={vi.fn()}
            retrying={false}
            batchItems={[item]}
            batchOutcome="CONFIRMED"
            batchReceipts={[
              {
                item,
                state: 'CONFIRMED',
                idempotencyKey: 'receipt-1',
                reviewedCommand: { kind: 'PERSONAL_COMPLETE', lifecycle: 'OPEN', version: 1 },
              },
            ]}
            onOpenBatchResults={openBatch}
          />
        </MemoryRouter>
      )
    );

    const { resultTab } = sourceTabs();
    await act(async () => resultTab.click());
    expect(openBatch).toHaveBeenCalledOnce();
    expect(resultTab.getAttribute('aria-selected')).toBe('true');
  });
});
