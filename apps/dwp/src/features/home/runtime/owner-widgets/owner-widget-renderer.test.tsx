import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OWNER_WIDGET_CONTRACTS } from './owner-widget-contracts';
import { OwnerWidgetRenderer } from './owner-widget-renderer';
import { normalizeOwnerWidget } from './owner-widget-view-model';

import type { OwnerWidgetContract } from './owner-widget-contracts';
import type { OwnerWidgetLabelResolver } from './owner-widget-renderer';

const label: OwnerWidgetLabelResolver = (key, values) =>
  values ? `${key}:${Object.values(values).join(',')}` : key;

function contract(definitionKey: string): OwnerWidgetContract {
  return OWNER_WIDGET_CONTRACTS.find((value) => value.definitionKey === definitionKey)!;
}

function normalized(definitionKey: string, payload: unknown) {
  const value = contract(definitionKey);
  const result = normalizeOwnerWidget({
    definitionKey: value.definitionKey,
    definitionVersion: value.definitionVersion,
    definitionManifestHash: value.definitionManifestHash,
    rendererBindingRevision: value.rendererBindingRevision,
    rendererKey: value.rendererKey,
    governanceSourceRoute: value.canonicalSourceRoute,
    actions: [
      {
        actionId: 'open-source',
        labelKey: 'home.action.openSource',
        kind: 'SOURCE_ROUTE',
        sourceRoute: value.canonicalSourceRoute,
        commandKey: null,
        expectedResultVersion: null,
        requiresConfirmation: false,
      },
    ],
    payload,
    locale: 'ko-KR',
  });
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

const approvalPayload = {
  pendingCount: 4,
  dueTodayCount: 2,
  overdueCount: 1,
  items: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      requestNumber: 'APR-1',
      title: '첫 번째 승인',
      status: 'PENDING',
      priority: 'HIGH',
      version: 1,
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      requestNumber: 'APR-2',
      title: '두 번째 승인',
      status: 'PENDING',
      priority: 'MEDIUM',
      version: 1,
    },
  ],
};

describe('OwnerWidgetRenderer', () => {
  it.each(['CLASSIC', 'FLOW'] as const)('renders the same verified model for %s', (variant) => {
    const markup = renderToStaticMarkup(
      createElement(OwnerWidgetRenderer, {
        widget: normalized('approval.focus-queue', approvalPayload),
        variant,
        label,
        onOpenSource: () => undefined,
      })
    );
    expect(markup).toContain(`data-owner-widget-variant="${variant.toLowerCase()}"`);
    expect(markup).toContain('ownerWidgets.title.approval.focus-queue');
    expect(markup).toContain('첫 번째 승인');
    expect(markup).toContain('ownerWidgets.metric.overdue');
    expect(markup).toContain('ownerWidgets.action.openSource');
    expect(markup).toContain('<article');
    expect(markup).toContain('<h3');
  });

  it('uses a bounded item budget without introducing an internal scroll region', () => {
    const markup = renderToStaticMarkup(
      createElement(OwnerWidgetRenderer, {
        widget: normalized('approval.focus-queue', approvalPayload),
        variant: 'FLOW',
        label,
        maxItems: 1,
      })
    );
    expect(markup).toContain('첫 번째 승인');
    expect(markup).not.toContain('두 번째 승인');
    expect(markup).not.toContain('overflow-y');
    expect(markup).not.toContain('ownerWidgets.action.openSource');
  });

  it('renders only provider-supplied meeting facts and no fixture completion claims', () => {
    const markup = renderToStaticMarkup(
      createElement(OwnerWidgetRenderer, {
        widget: normalized('meetings.next-prep', {
          meetingsToday: 1,
          meetingMinutesToday: 45,
          items: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              title: '운영 회의',
              state: 'SCHEDULED',
              startsAt: '2026-09-16T15:00:00+09:00',
              endsAt: '2026-09-16T15:45:00+09:00',
              attendeeCount: 5,
              version: 1,
            },
          ],
        }),
        variant: 'FLOW',
        label,
        locale: 'ko-KR',
      })
    );
    expect(markup).toContain('운영 회의');
    expect(markup).toContain('ownerWidgets.meta.attendees:5');
    expect(markup).not.toContain('agenda');
    expect(markup).not.toContain('brief');
    expect(markup).not.toContain('room');
  });

  it('never renders notification app badges as a card', () => {
    const markup = renderToStaticMarkup(
      createElement(OwnerWidgetRenderer, {
        widget: normalized('notification.app-badges', {
          counterVersion: '9',
          items: [
            {
              appKey: 'approvals',
              totalUnread: 2,
              actionableUnread: 1,
              urgentUnread: 1,
              lastActivityAt: '2026-09-16T06:00:00Z',
            },
          ],
        }),
        variant: 'CLASSIC',
        label,
      })
    );
    expect(markup).toBe('');
  });

  it('shows count-only HR facts without inventing progress percentages', () => {
    const markup = renderToStaticMarkup(
      createElement(OwnerWidgetRenderer, {
        widget: normalized('hr.edu', {
          requiredLearningCount: 2,
          activeGoalCount: 1,
          state: { availability: 'AVAILABLE', dataOrigin: 'SOURCE' },
        }),
        variant: 'CLASSIC',
        label,
      })
    );
    expect(markup).toContain('ownerWidgets.metric.requiredLearning');
    expect(markup).toContain('ownerWidgets.metric.activeGoals');
    expect(markup).not.toContain('75%');
    expect(markup).not.toContain('progressbar');
  });

  it('renders the verified DWAI·ON count, rows, revision, and source action', () => {
    const markup = renderToStaticMarkup(
      createElement(OwnerWidgetRenderer, {
        widget: normalized('dwaion.artifact', {
          visibleCount: 1,
          items: [
            {
              artifactId: '33333333-3333-4333-8333-333333333333',
              title: 'H2 operating strategy',
              artifactType: 'COMPARISON',
              state: 'DRAFT',
              revision: 3,
              updatedAt: '2026-09-16T06:10:30Z',
            },
          ],
        }),
        variant: 'FLOW',
        label,
        locale: 'en-US',
        onOpenSource: () => undefined,
      })
    );
    expect(markup).toContain('ownerWidgets.metric.visibleArtifacts');
    expect(markup).toContain('H2 operating strategy');
    expect(markup).toContain('COMPARISON · DRAFT');
    expect(markup).toContain('r3');
    expect(markup).toContain('ownerWidgets.action.openSource');
  });

  it('does not place private business identifiers into data attributes', () => {
    const markup = renderToStaticMarkup(
      createElement(OwnerWidgetRenderer, {
        widget: normalized('approval.focus-queue', approvalPayload),
        variant: 'CLASSIC',
        label,
      })
    );
    expect(markup).not.toContain('data-request');
    expect(markup).not.toContain('data-item');
    expect(markup).not.toContain('data-title');
  });
});
