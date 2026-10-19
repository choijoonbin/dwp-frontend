// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PER004_FEATURE_DEFAULT_ENABLED,
  PER004_ENROLLED_TENANTS,
  PER004_PROVIDER_BOUND,
} from '../../configuration/per004-contract';
import type { Per004Projection } from '../../configuration/per004-contract';
import { Per004Workspace, Per004WorkspaceView } from '../../configuration/per004-workspace';

const CONFIG = '12345678-1234-4234-8234-123456789abc';
const CORRELATION = '12345678-1234-4234-8234-123456789abd';
const projection: Per004Projection = {
  projectionVersion: '2', asOf: '2026-10-19T08:00:00Z', variantKey: 'PERFORMANCE',
  queryState: {
    state: 'COMPLETE', scopeDecisionRevision: 'scope-1', freshness: 'CURRENT', nextCursor: null,
    fieldDecisionSummary: { viewCount: 3, maskedCount: 0, omittedCount: 0 }, partialFailures: [],
    correlationId: CORRELATION,
    cachePolicy: { authorizationDecisionRevision: 'auth-1',
      invalidationEvent: 'dwp.hris.access.assignment.changed.v1', maxAgeSeconds: 0 },
  },
  items: [{
    itemPublicId: CONFIG, title: 'A very long governed performance policy title that must wrap at narrow widths',
    statusCode: 'SIMULATED',
    fieldGroups: {
      POLICY_VERSION: { decision: 'VIEW', value: { policyKey: 'review.policy', revision: 7,
        effectiveFrom: '2026-10-19', effectiveTo: null, status: 'SIMULATED' } },
      PERFORMANCE_POLICY: { decision: 'VIEW', value: { policyKey: 'review.policy', revision: 7,
        effectiveFrom: '2026-10-19', effectiveTo: null, status: 'SIMULATED' } },
      EFFECTIVE_STATUS: { decision: 'VIEW', value: { code: 'SIMULATED', revision: 7 } },
    },
    deepLink: { route: '/hr/settings/performance', resourcePublicId: CONFIG },
    availableActions: [{
      actionKey: 'hris.action.sys.post.platform.v1.admin.hris.configurations.resource.versions.resource.submit',
      method: 'POST', targetResourceType: 'REFERENCE_CONFIGURATION_VERSION',
      targetConfigurationId: CONFIG, targetVersion: 7, expectedObjectVersion: 11,
      resolvedHref: `/api/platform/v1/admin/hris/configurations/${CONFIG}/versions/7/submit`,
      idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
      stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
    }],
  }],
};

describe('BASE-TFR-PER-004 unmounted configuration slice', () => {
  let mount: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    mount = document.createElement('div');
    document.body.append(mount);
    root = createRoot(mount);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    mount.remove();
    vi.restoreAllMocks();
  });

  it('defaults off, zero enrollment, no provider, and no owner calls until all gates open', async () => {
    expect(PER004_FEATURE_DEFAULT_ENABLED).toBe(false);
    expect(PER004_ENROLLED_TENANTS).toEqual([]);
    expect(PER004_PROVIDER_BOUND).toBe(false);
    const load = vi.fn().mockResolvedValue(projection);
    await act(async () => root.render(<Per004Workspace variant="PERFORMANCE" dataSource={{ load }} />));
    expect(mount.innerHTML).toBe('');
    expect(load).not.toHaveBeenCalled();
    await act(async () => root.render(<Per004Workspace variant="PERFORMANCE" mounted
      featureEnabled enrolled dataSource={{ load }} />));
    expect(load).not.toHaveBeenCalled();
  });

  it('renders accessible loading, empty, complete, partial, unavailable, forbidden, retry and step-up states', () => {
    const base = { variant: 'PERFORMANCE' as const, projection, onRetry: vi.fn(), retryable: true };
    const loading = renderToStaticMarkup(<Per004WorkspaceView {...base} state="LOADING" />);
    const empty = renderToStaticMarkup(<Per004WorkspaceView {...base} state="EMPTY" />);
    const complete = renderToStaticMarkup(<Per004WorkspaceView {...base} state="COMPLETE"
      onAction={vi.fn()} />);
    const partial = renderToStaticMarkup(<Per004WorkspaceView {...base} state="PARTIAL" />);
    const unavailable = renderToStaticMarkup(<Per004WorkspaceView {...base} state="UNAVAILABLE" />);
    const forbidden = renderToStaticMarkup(<Per004WorkspaceView {...base} state="FORBIDDEN" />);
    const stepUp = renderToStaticMarkup(<Per004WorkspaceView {...base} state="STEP_UP" />);
    expect(loading).toContain('role="status"');
    expect(empty).toContain('No governed configuration');
    expect(complete).toContain('Submit for approval');
    expect(complete).toContain('aria-label="Performance policy settings"');
    expect(partial).toContain('No actions are offered');
    expect(partial).not.toContain('Submit for approval');
    expect(unavailable).toContain('Try again');
    expect(forbidden).toContain('do not have access');
    expect(stepUp).toContain('Additional verification');
    expect(renderToStaticMarkup(<Per004WorkspaceView {...base} state="COMPLETE" locale="ko" />))
      .toContain('성과 정책 설정');
    expect(renderToStaticMarkup(<Per004WorkspaceView variant="FORMS_SCALES" state="EMPTY" />))
      .toContain('Performance forms and rating scales');
  });

  it('keeps retry and step-up controls named, focusable and in reading order', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('owner unavailable'))
      .mockResolvedValue(projection);
    const actionExecutor = vi.fn().mockResolvedValue('STEP_UP_REQUIRED');
    await act(async () => root.render(<Per004Workspace variant="PERFORMANCE" mounted
      featureEnabled enrolled providerBound dataSource={{ load }} actionExecutor={actionExecutor} />));
    const retry = mount.querySelector('button');
    expect(retry?.textContent).toBe('Try again');
    expect(retry?.tabIndex).toBeGreaterThanOrEqual(0);
    retry?.focus();
    expect(document.activeElement).toBe(retry);
    await act(async () => retry?.click());
    const submit = mount.querySelector('.per004-workspace__action') as HTMLButtonElement | null;
    expect(submit?.textContent).toBe('Submit for approval');
    expect(submit?.tabIndex).toBeGreaterThanOrEqual(0);
    expect(mount.querySelectorAll('button')).toHaveLength(1);
    submit?.focus();
    expect(document.activeElement).toBe(submit);
    await act(async () => submit?.click());
    expect(actionExecutor).toHaveBeenCalledWith(projection.items[0]!.availableActions[0]);
    expect(mount.querySelector('[role="alert"]')?.textContent)
      .toContain('Additional verification is required');
    expect(mount.querySelector('.per004-workspace__action')).toBeNull();
  });
});
