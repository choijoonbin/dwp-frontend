import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { OWNER_WIDGET_CONTRACTS } from '../runtime/owner-widgets';
import {
  FLOW_FUTURE_WIDGET_CONTRACTS,
  FlowFutureWidgetMesh,
  projectFlowFutureWidgetRuntime,
} from './flow-future-widget-mesh';

import type { HomeV2Widget, HomeV2WidgetState } from '@dwp-frontend/shared-utils';
import type { OwnerWidgetDefinitionKey } from '../runtime/owner-widgets';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'en', language: 'en' },
  }),
}));

function runtimeWidget(
  definitionKey: OwnerWidgetDefinitionKey,
  state: HomeV2WidgetState,
  payload: unknown,
  sourceAction = false
): HomeV2Widget {
  const contract = OWNER_WIDGET_CONTRACTS.find(
    (candidate) => candidate.definitionKey === definitionKey
  )!;
  return {
    instanceId: `11111111-1111-4111-8111-${String(
      OWNER_WIDGET_CONTRACTS.indexOf(contract) + 1
    ).padStart(12, '0')}`,
    definitionKey,
    definitionVersion: contract.definitionVersion,
    definitionManifestHash: contract.definitionManifestHash,
    rendererBindingRevision: contract.rendererBindingRevision,
    rendererKey: contract.rendererKey,
    state,
    source: {
      sourceKey: `${definitionKey}-source`,
      generatedAt: '2026-09-16T00:00:00Z',
      expiresAt: '2026-09-16T00:05:00Z',
      lastSuccessAt: ['AVAILABLE', 'PARTIAL', 'STALE'].includes(state)
        ? '2026-09-16T00:00:00Z'
        : null,
      reasonCode: state === 'AVAILABLE' ? null : `TEST_${state}`,
      retryable: state === 'PARTIAL',
      resultVersion: 'runtime-1',
    },
    payload: payload as Readonly<Record<string, unknown>>,
    actions: sourceAction
      ? [
          {
            actionId: 'open-source',
            commandKey: null,
            expectedResultVersion: null,
            kind: 'SOURCE_ROUTE',
            labelKey: 'home.action.openSource',
            requiresConfirmation: false,
            sourceRoute: contract.canonicalSourceRoute,
          },
        ]
      : [],
    redactions: [],
    governance: {
      owner: definitionKey.split('.')[0]!,
      sourceAppResourceKey: 'APP.TEST',
      requiredAuthorities: [],
      classification: 'INTERNAL',
      retention: 'SESSION',
      sourceRoute: contract.canonicalSourceRoute,
    },
  };
}

const meetingPayload = {
  meetingsToday: 2,
  meetingMinutesToday: 60,
  items: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Runtime meeting payload',
      state: 'READY',
      startsAt: '2026-09-16T01:00:00Z',
      endsAt: '2026-09-16T02:00:00Z',
      attendeeCount: 4,
      version: 1,
    },
  ],
};

const workplacePayload = {
  visibleCount: 1,
  items: [
    {
      bookingId: '33333333-3333-4333-8333-333333333333',
      resourceName: 'Runtime focus booth',
      resourceType: 'FOCUS_BOOTH',
      siteName: 'Seoul HQ',
      floorName: '8F',
      startsAt: '2026-09-16T03:00:00Z',
      endsAt: '2026-09-16T04:00:00Z',
      status: 'CONFIRMED',
      canCheckIn: true,
      canCancel: true,
      checkInOpensAt: '2026-09-16T02:50:00Z',
      checkInClosesAt: '2026-09-16T03:10:00Z',
    },
  ],
};

describe('Flow personalized projection widget boundary', () => {
  it('keeps the five approved visual prototypes ordered and outside the runtime registry', () => {
    expect(FLOW_FUTURE_WIDGET_CONTRACTS).toEqual([
      expect.objectContaining({ key: 'space-change-feed', permission: 'APP.SPACES:VIEW' }),
      expect.objectContaining({
        key: 'meetings-prep-decisions',
        permission: 'APP.MEETINGS:VIEW',
      }),
      expect.objectContaining({
        key: 'dwaion-artifact',
        permission: 'APP.DWAION_ARTIFACTS:VIEW',
      }),
      expect.objectContaining({ key: 'workplace-booking', permission: 'APP.WORKPLACE:VIEW' }),
      expect.objectContaining({ key: 'learning-progress', permission: 'APP.HCM:VIEW' }),
    ]);
    expect(
      FLOW_FUTURE_WIDGET_CONTRACTS.every(
        ({ owner, source, connection }) =>
          owner.length > 0 && source.length > 0 && connection === 'WAVE4_PROVIDER_PROJECTION'
      )
    ).toBe(true);
    expect(new Set(FLOW_FUTURE_WIDGET_CONTRACTS.map(({ key }) => key)).size).toBe(5);
  });

  it('fails closed without exposing design-sample content or actions before runtime projection', () => {
    const markup = renderToStaticMarkup(createElement(FlowFutureWidgetMesh));
    expect(markup.match(/data-flow-provider-status="unavailable"/gu)).toHaveLength(5);
    expect(markup.match(/data-flow-projection-kind="unavailable"/gu)).toHaveLength(5);
    expect(markup.match(/data-integration-boundary="WAVE4_PROVIDER_PROJECTION"/gu)).toHaveLength(5);
    expect(markup).not.toContain('<button');
    expect(markup).not.toContain('flow.future.artifact.document');
    expect(markup).toContain(
      'data-flow-future-mobile-order="meetings-space-ai-workplace-learning"'
    );
    expect(markup).not.toContain('data-flow-provider-status="ready"');
  });

  it('renders deterministic loaded evidence without activating the production provider boundary', () => {
    const stateByKey = Object.fromEntries(
      FLOW_FUTURE_WIDGET_CONTRACTS.map(({ key }) => [key, 'loaded'] as const)
    );
    const markup = renderToStaticMarkup(createElement(FlowFutureWidgetMesh, { stateByKey }));

    expect(markup.match(/data-flow-provider-status="available"/gu)).toHaveLength(5);
    expect(markup.match(/data-flow-projection-kind="deterministic-evidence"/gu)).toHaveLength(5);
    expect(markup.match(/data-flow-provider-activation="fixture-only"/gu)).toHaveLength(5);
    expect(markup).toContain('flow.future.loadedEvidence');
    expect(markup).not.toContain('flow.future.previewUnavailable');
    expect(markup).not.toContain(' disabled=""');
    expect(markup.match(/data-integration-boundary="WAVE4_PROVIDER_PROJECTION"/gu)).toHaveLength(5);
  });

  it('shows design-sample content only for an explicit test evidence preview', () => {
    const stateByKey = Object.fromEntries(
      FLOW_FUTURE_WIDGET_CONTRACTS.map(({ key }) => [key, 'preview'] as const)
    );
    const markup = renderToStaticMarkup(createElement(FlowFutureWidgetMesh, { stateByKey }));

    expect(markup.match(/flow.future.previewUnavailable/gu)).toHaveLength(5);
    expect(markup).toContain('flow.future.artifact.document');
    expect(markup.match(/<button/gu)).toHaveLength(5);
    expect(markup.match(/ disabled=""/gu)).toHaveLength(5);
  });

  it('renders the six runtime states in one mesh shell without duplicate cards or sample copy', () => {
    const widgets = [
      runtimeWidget('meetings.next-prep', 'PARTIAL', meetingPayload),
      runtimeWidget('space.change-feed', 'FORBIDDEN', {}),
      runtimeWidget('hr.edu', 'STALE', {
        requiredLearningCount: 2,
        activeGoalCount: 1,
        state: { availability: 'AVAILABLE', dataOrigin: 'SOURCE' },
      }),
      runtimeWidget('workplace.booking', 'AVAILABLE', workplacePayload, true),
      runtimeWidget('dwaion.artifact', 'UNAVAILABLE', {}),
    ];
    const markup = renderToStaticMarkup(
      createElement(FlowFutureWidgetMesh, { runtimeWidgets: widgets, onOpenRuntimeSource: vi.fn() })
    );

    expect(markup.match(/<article/gu)).toHaveLength(5);
    expect(markup.match(/<h3/gu)).toHaveLength(5);
    expect(markup).not.toContain('data-owner-widget=');
    expect(markup).toContain('data-home-content-state="partial"');
    expect(markup).toContain('data-home-content-state="forbidden"');
    expect(markup).toContain('data-home-content-state="stale"');
    expect(markup).toContain('data-home-content-state="widget-error"');
    expect(markup).toContain('Runtime meeting payload');
    expect(markup).toContain('Runtime focus booth');
    expect(markup.match(/<button/gu)).toHaveLength(1);
    expect(markup).not.toContain('flow.future.artifact.document');

    const emptyMarkup = renderToStaticMarkup(
      createElement(FlowFutureWidgetMesh, {
        runtimeWidgets: [runtimeWidget('meetings.next-prep', 'EMPTY', {})],
      })
    );
    expect(emptyMarkup).toContain('data-home-content-state="empty"');
  });

  it('marks duplicate exact definitions invalid instead of choosing one provider record', () => {
    const candidate = runtimeWidget('meetings.next-prep', 'AVAILABLE', meetingPayload);
    expect(
      projectFlowFutureWidgetRuntime([candidate, { ...candidate, instanceId: 'duplicate' }])
    ).toMatchObject({
      'meetings-prep-decisions': { state: 'INVALID', widget: null, runtimeWidget: null },
    });
  });
});
