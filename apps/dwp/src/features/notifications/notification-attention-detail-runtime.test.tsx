// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NotificationAttentionControlsProps } from './notification-attention-controls';
import type {
  NotificationAttentionControlImpactPreview,
  NotificationAttentionControls as NotificationAttentionControlsResponse,
} from '@dwp-frontend/shared-utils/api/notification-attention-api';

const runtime = vi.hoisted(() => ({
  online: true,
  translate: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
  props: null as NotificationAttentionControlsProps | null,
  getControls: vi.fn(),
  previewControl: vi.fn(),
  applyControl: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: runtime.translate,
  }),
}));

vi.mock('@dwp-frontend/shared-utils/api/notification-attention-api', () => ({
  getNotificationAttentionControls: runtime.getControls,
  previewNotificationAttentionControl: runtime.previewControl,
  applyNotificationAttentionControl: runtime.applyControl,
}));

vi.mock('@dwp-frontend/shared-utils/api/notification-api', () => ({
  createNotificationIdempotencyKey: (scope: string) => `${scope}:test-command`,
}));

vi.mock('@dwp-frontend/shared-utils', () => ({
  HttpError: class HttpError extends Error {
    constructor(
      message: string,
      public readonly status: number
    ) {
      super(message);
    }
  },
  useToast: () => runtime.toast,
}));

vi.mock('@dwp-frontend/design-system', () => ({
  InlineFeedback: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  LoadingState: () => createElement('div'),
}));

vi.mock('./notification-attention-adapters', () => ({
  controlEffect: () => 'FOLLOW',
  toAttentionScopeOption: () => ({
    optionId: 'FOLLOW_CONTEXT',
    action: 'FOLLOW_CONTEXT',
    label: 'Follow this context',
    description: 'Keep this work visible.',
    scopeLabel: 'Cloud budget approval',
    scopeKind: 'THREAD',
    current: false,
    availability: 'AVAILABLE',
    expirationOptions: [
      { optionId: 'ONGOING', label: 'Ongoing', expiresAt: null },
      { optionId: 'ONE_DAY', label: 'One day', expiresAt: '2099-09-18T00:00:00Z' },
    ],
  }),
}));

vi.mock('./notification-attention-controls', () => ({
  NotificationAttentionControls: (props: NotificationAttentionControlsProps) => {
    runtime.props = props;
    return createElement('div', { 'data-testid': 'attention-controls-probe' });
  },
}));

vi.mock('./use-notification-runtime', () => ({
  useOnlineStatus: () => runtime.online,
}));

import { HttpError } from '@dwp-frontend/shared-utils';
import { NotificationAttentionDetailRuntime } from './notification-attention-detail-runtime';

const controls: NotificationAttentionControlsResponse = {
  partial: false,
  unavailableSources: [],
  message: null,
  notificationId: 'notification-1',
  whyReceived: 'You own this approval.',
  controls: [
    {
      controlKey: 'FOLLOW_CONTEXT',
      scopeKind: 'THREAD',
      label: 'Cloud budget approval',
      description: 'Keep this work visible.',
      allowedEffects: ['FOLLOW'],
      currentEffect: null,
      policyLocked: false,
      policyReason: null,
      dndBypassAllowed: false,
      expiresAt: null,
      ruleId: null,
      ruleVersion: null,
    },
  ],
  generatedAt: '2026-09-17T00:00:00Z',
};

const authoritativePreview: NotificationAttentionControlImpactPreview = {
  controlKey: 'FOLLOW_CONTEXT',
  allowed: true,
  policyLocked: false,
  effectiveEffect: 'FOLLOW',
  policySource: 'TENANT_GOVERNANCE',
  policyReason: null,
  previewFingerprint: 'a'.repeat(64),
  currentRuleVersion: '7',
  expiresAt: '2099-09-18T00:00:00Z',
  asOf: '2026-09-17T00:01:00Z',
};

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;

async function flushUntil(predicate: () => boolean) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (predicate()) return;
  }
  throw new Error('The notification attention runtime did not settle.');
}

async function renderRuntime() {
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(NotificationAttentionDetailRuntime, { notificationId: 'notification-1' })
      )
    );
  });
  await flushUntil(() => runtime.props?.selectedOptionId === 'FOLLOW_CONTEXT');
  return runtime.props as NotificationAttentionControlsProps;
}

async function previewOneDay() {
  let props = runtime.props as NotificationAttentionControlsProps;
  await act(async () => {
    props.onPreview(props.scopeOptions[0]!, 'ONE_DAY');
  });
  await flushUntil(() => runtime.props?.preview.state === 'READY');
  props = runtime.props as NotificationAttentionControlsProps;
  return props;
}

describe('NotificationAttentionDetailRuntime', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    runtime.online = true;
    runtime.props = null;
    runtime.getControls.mockReset().mockResolvedValue(controls);
    runtime.previewControl.mockReset().mockResolvedValue(authoritativePreview);
    runtime.applyControl.mockReset().mockResolvedValue({ ruleId: 'rule-1' });
    runtime.toast.success.mockReset();
    runtime.toast.error.mockReset();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    host.remove();
  });

  it('applies only the exact server-authoritative preview fingerprint', async () => {
    await renderRuntime();
    const props = await previewOneDay();

    expect(runtime.previewControl).toHaveBeenCalledWith('notification-1', {
      controlKey: 'FOLLOW_CONTEXT',
      effect: 'FOLLOW',
      expiresAt: '2099-09-18T00:00:00Z',
    });
    await act(async () => {
      props.onApply(props.scopeOptions[0]!, 'ONE_DAY');
    });
    await flushUntil(() => runtime.toast.success.mock.calls.length === 1);
    expect(runtime.applyControl).toHaveBeenCalledTimes(1);
    expect(runtime.applyControl).toHaveBeenCalledWith(
      'notification-1',
      expect.objectContaining({
        controlKey: 'FOLLOW_CONTEXT',
        effect: 'FOLLOW',
        expectedVersion: '7',
        previewFingerprint: 'a'.repeat(64),
        idempotencyKey: 'attention-control:test-command',
      })
    );
  });

  it('fails closed offline without dispatching a preview or apply request', async () => {
    runtime.online = false;
    const props = await renderRuntime();

    await act(async () => props.onPreview(props.scopeOptions[0]!, 'ONE_DAY'));

    expect(runtime.previewControl).not.toHaveBeenCalled();
    expect(runtime.applyControl).not.toHaveBeenCalled();
    expect(runtime.props?.preview.state).toBe('OFFLINE');
  });

  it('distinguishes stale preview conflicts and reloads current controls', async () => {
    runtime.applyControl.mockRejectedValueOnce(new HttpError('Preview changed', 409));
    await renderRuntime();
    const props = await previewOneDay();

    await act(async () => {
      props.onApply(props.scopeOptions[0]!, 'ONE_DAY');
    });
    await flushUntil(() => runtime.props?.preview.state === 'CONFLICT');
    expect(runtime.getControls.mock.calls.length).toBeGreaterThan(1);
    expect(runtime.toast.success).not.toHaveBeenCalled();
  });

  it('distinguishes revoked authority from stale preview and reloads policy locks', async () => {
    runtime.applyControl.mockRejectedValueOnce(new HttpError('Forbidden', 403));
    await renderRuntime();
    const props = await previewOneDay();

    await act(async () => {
      props.onApply(props.scopeOptions[0]!, 'ONE_DAY');
    });
    await flushUntil(() => runtime.props?.preview.state === 'ERROR');
    expect(runtime.getControls.mock.calls.length).toBeGreaterThan(1);
    expect(runtime.toast.error).toHaveBeenCalledWith('attention.controls.feedback.denied');
  });
});
