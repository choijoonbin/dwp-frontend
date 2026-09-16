import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OWNER_WIDGET_CONTRACTS } from './owner-widget-contracts';
import { OwnerWidgetRuntimeBoundary } from './owner-widget-runtime-boundary';

import type { OwnerWidgetContract } from './owner-widget-contracts';
import type { OwnerWidgetLabelResolver } from './owner-widget-renderer';
import type {
  OwnerWidgetRuntimeRecord,
  OwnerWidgetRuntimeState,
} from './owner-widget-runtime-boundary';

const label: OwnerWidgetLabelResolver = (key) => key;

function contract(definitionKey: string): OwnerWidgetContract {
  return OWNER_WIDGET_CONTRACTS.find((value) => value.definitionKey === definitionKey)!;
}

function record(
  state: OwnerWidgetRuntimeState,
  overrides: Partial<OwnerWidgetRuntimeRecord> = {}
): OwnerWidgetRuntimeRecord {
  const value = contract('approval.focus-queue');
  return {
    definitionKey: value.definitionKey,
    definitionVersion: value.definitionVersion,
    definitionManifestHash: value.definitionManifestHash,
    rendererBindingRevision: value.rendererBindingRevision,
    rendererKey: value.rendererKey,
    state,
    governanceSourceRoute: value.canonicalSourceRoute,
    actions:
      state === 'FORBIDDEN' || state === 'UNAVAILABLE'
        ? []
        : [
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
    payload:
      state === 'EMPTY' || state === 'FORBIDDEN' || state === 'UNAVAILABLE'
        ? {}
        : {
            pendingCount: 2,
            dueTodayCount: 1,
            overdueCount: 0,
            items: [
              {
                id: '11111111-1111-4111-8111-111111111111',
                requestNumber: 'APR-42',
                title: '검증된 승인',
                status: 'PENDING',
                priority: 'HIGH',
                version: 2,
              },
            ],
          },
    source: {
      sourceKey: 'APPROVAL_HOME',
      lastSuccessAt: '2026-09-16T08:00:00Z',
      retryable: state !== 'FORBIDDEN',
      resultVersion: 'v1:verified',
    },
    ...overrides,
  };
}

function render(runtimeWidget: OwnerWidgetRuntimeRecord, extra = {}) {
  return renderToStaticMarkup(
    createElement(OwnerWidgetRuntimeBoundary, {
      runtimeWidget,
      variant: 'FLOW',
      label,
      ...extra,
    })
  );
}

describe('OwnerWidgetRuntimeBoundary', () => {
  it('renders verified AVAILABLE content and preserves it while refreshing', () => {
    expect(render(record('AVAILABLE'))).toContain('검증된 승인');
    const refreshing = render(record('AVAILABLE'), { refreshing: true });
    expect(refreshing).toContain('data-home-content-state="background-refresh"');
    expect(refreshing).toContain('검증된 승인');
  });

  it('maps EMPTY and FORBIDDEN to blocking content states without parsing an empty payload', () => {
    expect(render(record('EMPTY'))).toContain('data-home-content-state="empty"');
    expect(render(record('FORBIDDEN'))).toContain('data-home-content-state="forbidden"');
    expect(render(record('FORBIDDEN'))).not.toContain('검증된 승인');
  });

  it('offers retry for UNAVAILABLE only when the source explicitly allows it', () => {
    const retryable = render(record('UNAVAILABLE'), { onRetry: () => undefined });
    const fixed = render(
      record('UNAVAILABLE', { source: { sourceKey: 'APPROVAL_HOME', retryable: false } }),
      { onRetry: () => undefined }
    );
    expect(retryable).toContain('data-home-content-state="widget-error"');
    expect(retryable).toContain('<button');
    expect(fixed).toContain('data-home-content-state="widget-error"');
    expect(fixed).not.toContain('<button');
  });

  it('preserves verified PARTIAL and STALE data with source and freshness evidence', () => {
    const partial = render(record('PARTIAL'));
    const stale = render(record('STALE'));
    expect(partial).toContain('data-home-content-state="partial"');
    expect(partial).toContain('검증된 승인');
    expect(partial).toContain('data-home-state-sources');
    expect(stale).toContain('data-home-content-state="stale"');
    expect(stale).toContain('검증된 승인');
    expect(stale).toContain('data-home-state-last-success');
  });

  it('isolates malformed payloads and signed tuple mismatches to one widget', () => {
    const malformed = render(record('AVAILABLE', { payload: { secret: 'private-title' } }));
    const mismatch = render(record('AVAILABLE', { rendererBindingRevision: '0'.repeat(64) }));
    expect(malformed).toContain('data-home-content-state="widget-error"');
    expect(malformed).not.toContain('private-title');
    expect(mismatch).toContain('data-home-content-state="widget-error"');
  });

  it('never renders app-badges as a card in any runtime state', () => {
    const value = contract('notification.app-badges');
    const badges = record('AVAILABLE', {
      definitionKey: value.definitionKey,
      definitionVersion: value.definitionVersion,
      definitionManifestHash: value.definitionManifestHash,
      rendererBindingRevision: value.rendererBindingRevision,
      rendererKey: value.rendererKey,
      governanceSourceRoute: value.canonicalSourceRoute,
      actions: [],
      payload: { counterVersion: '4', items: [] },
    });
    expect(render(badges)).toBe('');
    expect(render({ ...badges, state: 'UNAVAILABLE' })).toBe('');
  });

  it('rejects a command action before rendering verified content', () => {
    const candidate = record('AVAILABLE');
    const command = render({
      ...candidate,
      actions: [
        {
          actionId: 'approve',
          labelKey: 'unsafe',
          kind: 'COMMAND',
          sourceRoute: '/approvals/home',
          commandKey: 'approve',
          expectedResultVersion: 'v1',
          requiresConfirmation: false,
        },
      ],
    });
    expect(command).toContain('data-home-content-state="widget-error"');
    expect(command).not.toContain('검증된 승인');
  });
});
