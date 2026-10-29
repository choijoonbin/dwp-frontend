import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { ActivityConnectorStatus } from './activity-connector-status';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) =>
      `${key}${values ? `:${JSON.stringify(values)}` : ''}`,
  }),
}));

describe('Activity connector status', () => {
  it('shows ledger states and explicitly labels local verification data', () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(ActivityConnectorStatus, {
          loading: false,
          failed: false,
          report: {
            observedAt: '2026-09-07T09:00:00Z',
            sources: [
              {
                sourceId: 'mail-ready',
                label: 'Personal mail connector',
                resourceKind: 'MAIL',
                status: 'READY',
                lastAttemptAt: '2026-09-07T08:59:00Z',
                lastSuccessAt: '2026-09-07T08:59:01Z',
                observedAt: '2026-09-07T09:00:00Z',
                semantics: 'PERSONAL_SYNC_LEDGER',
              },
              {
                sourceId: 'calendar-local',
                label: '[development] Personal calendar connector',
                resourceKind: 'CALENDAR',
                status: 'STALE',
                lastAttemptAt: '2026-09-07T08:59:00Z',
                lastSuccessAt: '2026-09-07T08:30:00Z',
                observedAt: '2026-09-07T09:00:00Z',
                semantics: 'LOCAL_FIXTURE',
              },
              {
                sourceId: 'calendar-policy-blocked',
                label: '[development] Policy-blocked calendar connector',
                resourceKind: 'CALENDAR',
                status: 'BLOCKED',
                lastAttemptAt: '2026-09-07T08:45:00Z',
                lastSuccessAt: null,
                observedAt: '2026-09-07T09:00:00Z',
                semantics: 'LOCAL_FIXTURE',
              },
            ],
          },
        })
      )
    );

    expect(markup).toContain('data-connector-status="READY"');
    expect(markup).toContain('data-connector-status="STALE"');
    expect(markup).toContain('data-connector-status="BLOCKED"');
    expect(markup).toContain('data-connector-provenance="LOCAL_FIXTURE"');
    expect(markup).toContain('activityFoundation.connectorStatus.localFixture');
    expect(markup).toContain('activityFoundation.connectorStatus.lastAttempt');
    expect(markup).toContain('href="/calendar/settings"');
    expect(markup).not.toContain('href="/mail/accounts"');
    expect(markup).toContain('<details');
    expect(markup).not.toContain('78%');
  });

  it('does not turn missing or failed source data into healthy status', () => {
    const empty = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(ActivityConnectorStatus, {
          loading: false,
          failed: false,
          report: { observedAt: '2026-09-07T09:00:00Z', sources: [] },
        })
      )
    );
    expect(empty).toContain('activityFoundation.connectorStatus.empty');
    expect(empty).not.toContain('activityFoundation.connectorStatus.states.READY');

    const failed = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(ActivityConnectorStatus, { loading: false, failed: true })
      )
    );
    expect(failed).toContain('activityFoundation.connectorStatus.unavailableTitle');
    expect(failed).not.toContain('activityFoundation.connectorStatus.states.READY');
  });

  it('keeps the last successful connector report visible after a refresh error', () => {
    const retry = vi.fn();
    const cached = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(ActivityConnectorStatus, {
          loading: false,
          failed: true,
          onRetry: retry,
          report: {
            observedAt: '2026-09-07T09:00:00Z',
            sources: [
              {
                sourceId: 'calendar-stale',
                label: 'Cached calendar connector',
                resourceKind: 'CALENDAR',
                status: 'STALE',
                lastAttemptAt: '2026-09-07T08:59:00Z',
                lastSuccessAt: '2026-09-07T08:30:00Z',
                observedAt: '2026-09-07T09:00:00Z',
                semantics: 'PERSONAL_SYNC_LEDGER',
              },
            ],
          },
        })
      )
    );

    expect(cached).toContain('Cached calendar connector');
    expect(cached).toContain('activityFoundation.connectorStatus.cachedDescription');
    expect(cached).toContain('activityPage.retry');
  });
});
