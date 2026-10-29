// @vitest-environment jsdom
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@mui/material/styles';
import { buildDwpTheme, foundationTokens } from '@dwp-frontend/design-system';
import { HttpError } from '@dwp-frontend/shared-utils';

const runtime = vi.hoisted(() => ({ activityData: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values?.title ? `${key}:${String(values.title)}` : key,
  }),
}));
vi.mock('./use-activity-data', () => ({ useActivityData: runtime.activityData }));
vi.mock('../../components/shell-auxiliary-avoidance/use-shell-auxiliary-avoidance', () => ({
  useShellAuxiliaryAvoidance: vi.fn(),
}));

import { ActivityHome } from './activity-home';

import type { WorkspaceActivityEvent } from '@dwp-frontend/shared-utils';

function event(id: string, title: string): WorkspaceActivityEvent {
  return {
    id,
    occurredAt: '2026-10-28T01:00:00Z',
    stateChangedAt: '2026-10-28T02:00:00Z',
    actor: 'agent',
    actorName: 'Agent',
    state: 'needs-input',
    title,
    summary: 'Review required',
    objectType: 'agent-run',
    objectLabel: title,
    source: 'DWAI_ON',
    auditId: null,
    eventKind: 'EXECUTION',
    sourceAccess: 'AVAILABLE',
  };
}

function renderHome() {
  const theme = buildDwpTheme({
    mode: 'light',
    highContrast: false,
    density: 'standard',
    reduceMotion: true,
    accentColor: foundationTokens.color.product.primary,
    fontFamily: foundationTokens.font.ui,
  });
  return renderToStaticMarkup(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <ActivityHome />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('Activity home partial failure', () => {
  it('keeps exact attention items when the recent feed fails and limits the review list to five', () => {
    const attentionItems = Array.from({ length: 6 }, (_, index) =>
      event(`dwaion:10000000-0000-4000-8000-00000000000${index}`, `Attention ${index + 1}`)
    );
    const refetch = vi.fn();
    runtime.activityData.mockReturnValue({
      feed: {
        data: undefined,
        isLoading: false,
        isError: true,
        error: new HttpError('recent feed unavailable', 503),
        isFetching: false,
        dataUpdatedAt: 0,
        refetch,
      },
      summary: {
        data: {
          total: 6,
          running: 0,
          needsInput: 6,
          policyBlocked: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
          generatedAt: '2026-10-28T02:00:00Z',
          coverage: { supportedObjectTypes: ['agent-run'] },
          attentionItems,
          partial: false,
          sourceStates: [{ sourceScope: 'DWAI_ON', status: 'AVAILABLE' }],
        },
        isLoading: false,
        isError: true,
        error: new HttpError('summary unavailable', 503),
        isFetching: false,
        dataUpdatedAt: Date.parse('2026-10-28T02:00:00Z'),
        refetch,
      },
      sources: {
        data: {
          observedAt: '2026-10-28T01:59:00Z',
          sources: [
            {
              sourceId: 'calendar-stale-cache',
              label: 'Cached calendar connector',
              resourceKind: 'CALENDAR',
              status: 'STALE',
              lastAttemptAt: '2026-10-28T01:58:00Z',
              lastSuccessAt: '2026-10-28T01:30:00Z',
              observedAt: '2026-10-28T01:59:00Z',
              semantics: 'PERSONAL_SYNC_LEDGER',
            },
          ],
        },
        isLoading: false,
        isError: true,
        error: new HttpError('connector status unavailable', 503),
        isFetching: false,
        dataUpdatedAt: 0,
        refetch,
      },
      now: Date.parse('2026-10-28T02:00:30Z'),
      refresh: vi.fn(),
    });

    const html = renderHome();

    expect(html).toContain('Attention 1');
    expect(html).toContain('Attention 5');
    expect(html).not.toContain('Attention 6');
    expect(html).toContain(
      'href="/activity/timeline?event=dwaion%3A10000000-0000-4000-8000-000000000000"'
    );
    expect(html).toContain('activityHome.attention.stateChangedAt');
    expect(html).toContain('activityFoundation.cachedSummary.title');
    expect(html).toContain('Cached calendar connector');
    expect(html).toContain('activityFoundation.connectorStatus.cachedDescription');
    expect(html).toContain('activityHome.errorTitle');
    expect(html.indexOf('activityHome.attention.title')).toBeLessThan(
      html.indexOf('activityHome.recentTitle')
    );
    expect(html.indexOf('activityHome.recentTitle')).toBeLessThan(
      html.indexOf('activityFoundation.connectorStatus.title')
    );
  });

  it('hides every root cached section when only the feed reports an authoritative denial', () => {
    const denied = new HttpError('access revoked', 403);
    const deniedEvent = event('dwaion:denied', 'Denied cached signal');
    const refetch = vi.fn();
    runtime.activityData.mockReturnValue({
      feed: {
        data: {
          events: [deniedEvent],
          generatedAt: '2026-10-28T02:00:00Z',
          sourceStates: [],
          partial: false,
        },
        isLoading: false,
        isError: true,
        error: denied,
        isFetching: false,
        dataUpdatedAt: Date.parse('2026-10-28T02:00:00Z'),
        refetch,
      },
      summary: {
        data: {
          total: 1,
          running: 0,
          needsInput: 1,
          policyBlocked: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
          generatedAt: '2026-10-28T02:00:00Z',
          coverage: { supportedObjectTypes: ['agent-run'] },
          attentionItems: [deniedEvent],
          partial: false,
          sourceStates: [],
        },
        isLoading: false,
        isError: false,
        error: null,
        isFetching: false,
        dataUpdatedAt: Date.parse('2026-10-28T02:00:00Z'),
        refetch,
      },
      sources: {
        data: {
          observedAt: '2026-10-28T02:00:00Z',
          sources: [
            {
              sourceId: 'denied-mail',
              label: 'Denied cached connector',
              resourceKind: 'MAIL',
              status: 'READY',
              lastAttemptAt: '2026-10-28T01:59:00Z',
              lastSuccessAt: '2026-10-28T01:59:00Z',
              observedAt: '2026-10-28T02:00:00Z',
              semantics: 'PERSONAL_SYNC_LEDGER',
            },
          ],
        },
        isLoading: false,
        isError: false,
        error: null,
        isFetching: false,
        dataUpdatedAt: Date.parse('2026-10-28T02:00:00Z'),
        refetch,
      },
      rootDenied: true,
      now: Date.parse('2026-10-28T02:00:30Z'),
      refresh: vi.fn(),
    });

    const html = renderHome();

    expect(html).not.toContain('Denied cached signal');
    expect(html).not.toContain('Denied cached connector');
    expect(html).not.toContain('activityFoundation.cachedSummary.title');
    expect(html).toContain('activityHome.attention.unavailableTitle');
    expect(html).toContain('activityHome.errorTitle');
  });

  it('offers a section-level retry when only the current summary is unavailable', () => {
    const refetch = vi.fn();
    runtime.activityData.mockReturnValue({
      feed: {
        data: {
          events: [],
          generatedAt: '2026-10-28T02:00:00Z',
          sourceStates: [],
          partial: false,
        },
        isLoading: false,
        isError: false,
        isFetching: false,
        dataUpdatedAt: Date.parse('2026-10-28T02:00:00Z'),
        refetch,
      },
      summary: {
        data: undefined,
        isLoading: false,
        isError: true,
        isFetching: false,
        dataUpdatedAt: 0,
        refetch,
      },
      sources: {
        data: undefined,
        isLoading: false,
        isError: true,
        isFetching: false,
        dataUpdatedAt: 0,
        refetch,
      },
      now: Date.parse('2026-10-28T02:00:30Z'),
      refresh: vi.fn(),
    });

    const html = renderHome();

    expect(html).toContain('activityHome.attention.unavailableTitle');
    expect(html).toContain('activityPage.retry');
    expect(html).toContain('activityHome.emptyTitle');
  });

  it('does not report all clear for a partial summary and retries only that summary', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const feedRefetch = vi.fn();
    const summaryRefetch = vi.fn();
    runtime.activityData.mockReturnValue({
      feed: {
        data: undefined,
        isLoading: false,
        isError: true,
        error: new HttpError('Activity feed is temporarily unavailable.', 503),
        isFetching: false,
        dataUpdatedAt: Date.parse('2026-10-28T02:00:00Z'),
        refetch: feedRefetch,
      },
      summary: {
        data: {
          total: 0,
          running: 0,
          needsInput: 0,
          policyBlocked: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
          generatedAt: '2026-10-28T02:00:00Z',
          coverage: { supportedObjectTypes: ['agent-run'] },
          attentionItems: [],
          partial: true,
          sourceStates: [
            { sourceScope: 'WORKSPACE', status: 'AVAILABLE' },
            { sourceScope: 'DWAI_ON', status: 'UNAVAILABLE' },
          ],
        },
        isLoading: false,
        isError: false,
        error: null,
        isFetching: false,
        dataUpdatedAt: Date.parse('2026-10-28T02:00:00Z'),
        refetch: summaryRefetch,
      },
      sources: {
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
        isFetching: false,
        dataUpdatedAt: 0,
        refetch: vi.fn(),
      },
      rootDenied: false,
      now: Date.parse('2026-10-28T02:00:30Z'),
      refresh: vi.fn(),
    });
    const theme = buildDwpTheme({
      mode: 'light',
      highContrast: false,
      density: 'standard',
      reduceMotion: true,
      accentColor: foundationTokens.color.product.primary,
      fontFamily: foundationTokens.font.ui,
    });
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ThemeProvider theme={theme}>
          <MemoryRouter>
            <ActivityHome />
          </MemoryRouter>
        </ThemeProvider>
      );
    });
    const attention = host.querySelector('[aria-labelledby="activity-home-attention"]');
    expect(attention?.textContent).toContain('activityHome.attention.unavailableTitle');
    expect(attention?.textContent).not.toContain('activityHome.attention.clearTitle');

    await act(async () => {
      attention?.querySelector('button')?.click();
    });
    expect(summaryRefetch).toHaveBeenCalledOnce();
    expect(feedRefetch).not.toHaveBeenCalled();

    const sourceStatus = host.querySelector('[aria-label="activityFoundation.sources.title"]');
    await act(async () => {
      sourceStatus?.querySelector('button')?.click();
    });
    expect(summaryRefetch).toHaveBeenCalledTimes(2);
    expect(feedRefetch).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    host.remove();
  });
});
