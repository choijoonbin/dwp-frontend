// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { buildDwpTheme, foundationTokens } from '@dwp-frontend/design-system';

const runtime = vi.hoisted(() => ({ activityData: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));
vi.mock('@mui/material/useMediaQuery', () => ({ default: () => false }));
vi.mock('../features/activity/use-activity-data', () => ({
  useActivityData: runtime.activityData,
}));
vi.mock('../components/governed-saved-view-control', () => ({
  GovernedSavedViewControl: () => null,
}));
vi.mock('../components/activity/activity-event-detail', () => ({
  ActivityEventDetail: () => null,
}));
vi.mock('../components/activity/activity-source-status', () => ({
  ActivitySourceStatus: () => null,
}));

import ActivityPage from './activity';

import type { WorkspaceActivityFilters } from '@dwp-frontend/shared-utils';

let root: Root;
let host: HTMLDivElement;

function query<T>(data: T) {
  return {
    data,
    error: null,
    isLoading: false,
    isPending: false,
    isError: false,
    isFetching: false,
    dataUpdatedAt: Date.parse('2026-10-28T02:00:00Z'),
    refetch: vi.fn(),
  };
}

describe('Activity page search request boundary', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    runtime.activityData.mockReset().mockImplementation(() => ({
      feed: query({
        events: [],
        generatedAt: '2026-10-28T02:00:00Z',
        partial: false,
        sourceStates: [],
        hasMore: false,
        nextCursor: null,
      }),
      summary: query({
        total: 0,
        running: 0,
        needsInput: 0,
        policyBlocked: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        generatedAt: '2026-10-28T02:00:00Z',
        coverage: { supportedObjectTypes: [] },
        partial: false,
        sourceStates: [],
      }),
      detail: query(undefined),
      executionRun: query(undefined),
      evidence: query(undefined),
      sources: query({ observedAt: '2026-10-28T02:00:00Z', sources: [] }),
      rootDenied: false,
      now: Date.parse('2026-10-28T02:00:30Z'),
      refresh: vi.fn(),
    }));
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  });

  it('keeps the committed query key while a valid 3-to-4 character draft is debouncing', () => {
    const theme = buildDwpTheme({
      mode: 'light',
      highContrast: false,
      density: 'standard',
      reduceMotion: true,
      accentColor: foundationTokens.color.product.primary,
      fontFamily: foundationTokens.font.ui,
    });
    act(() => {
      root.render(
        <ThemeProvider theme={theme}>
          <MemoryRouter initialEntries={['/activity?q=abc']}>
            <ActivityPage />
          </MemoryRouter>
        </ThemeProvider>
      );
    });
    expect((runtime.activityData.mock.calls.at(-1)?.[0] as WorkspaceActivityFilters).query).toBe(
      'abc'
    );
    const search = host.querySelector<HTMLInputElement>(
      'input[placeholder="activityPage.searchPlaceholder"]'
    );
    expect(search).not.toBeNull();

    act(() => {
      const setInputValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      setInputValue?.call(search, 'abcd');
      search!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => vi.advanceTimersByTime(299));
    expect((runtime.activityData.mock.calls.at(-1)?.[0] as WorkspaceActivityFilters).query).toBe(
      'abc'
    );

    act(() => vi.advanceTimersByTime(1));
    expect((runtime.activityData.mock.calls.at(-1)?.[0] as WorkspaceActivityFilters).query).toBe(
      'abcd'
    );
  });
});
