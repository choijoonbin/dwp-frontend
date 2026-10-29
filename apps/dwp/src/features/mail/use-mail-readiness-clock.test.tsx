// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MAIL_ACCOUNT_READINESS_EVIDENCE_MAX_AGE_MS,
  mailAccountFeatureIsReady,
  mailAccountReadinessIsReady,
} from './mail-account-capability-presentation';
import { resolveMailHomeHealth } from './mail-home-health';
import { resolveReadinessAction } from './mail-preferences-model';
import { mailReadinessInvalidationAt, useMailReadinessNow } from './use-mail-readiness-clock';

import type { Root } from 'react-dom/client';
import type { MailAccount, MailAccountReadinessEvidence } from '@dwp-frontend/shared-utils';

const BASE_TIME = Date.parse('2026-10-29T00:00:00.000Z');

function readiness(tokenExpiresAt = new Date(BASE_TIME + 60 * 60 * 1_000).toISOString()) {
  return {
    state: 'READY',
    source: 'CONNECTOR_RUNTIME',
    observedAt: new Date(BASE_TIME).toISOString(),
    errorCode: null,
    credentialConfigured: true,
    lastSuccessfulSyncAt: new Date(BASE_TIME).toISOString(),
    lastSuccessfulSyncScope: 'INBOX',
    action: 'NONE',
    consentEvidence: {
      state: 'VERIFIED',
      source: 'CONNECTOR_RUNTIME',
      observedAt: new Date(BASE_TIME).toISOString(),
      expiresAt: null,
      errorCode: null,
      action: 'NONE',
    },
    tokenEvidence: {
      state: 'VERIFIED',
      source: 'CONNECTOR_RUNTIME',
      observedAt: new Date(BASE_TIME).toISOString(),
      expiresAt: tokenExpiresAt,
      errorCode: null,
      action: 'NONE',
    },
    featureReadiness: {
      SEND: {
        state: 'READY',
        source: 'CONNECTOR_RUNTIME',
        observedAt: new Date(BASE_TIME).toISOString(),
        errorCode: null,
        lastSuccessfulAt: new Date(BASE_TIME).toISOString(),
        lastSuccessfulScope: 'SEND',
        action: 'NONE',
      },
    },
  } satisfies MailAccountReadinessEvidence;
}

function account(evidence: MailAccountReadinessEvidence): MailAccount {
  return {
    accountId: 'account-1',
    emailAddress: 'user@example.com',
    displayName: 'Work',
    accountKind: 'PERSONAL',
    providerType: 'MICROSOFT_GRAPH',
    connectionState: 'ACTIVE',
    synchronizationState: 'READY',
    defaultAccount: true,
    readiness: evidence,
  };
}

function ReadinessProbe({ evidence }: { evidence: MailAccountReadinessEvidence }) {
  const now = useMailReadinessNow(mailReadinessInvalidationAt([evidence]));
  const currentAccount = account(evidence);
  const sendReady =
    mailAccountReadinessIsReady(evidence, now) && mailAccountFeatureIsReady(evidence, 'SEND', now);

  return (
    <output
      data-health={resolveMailHomeHealth([currentAccount], now).state}
      data-preference-action={resolveReadinessAction(currentAccount, evidence, now)}
      data-send-ready={String(sendReady)}
    />
  );
}

describe('Mail readiness clock', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(BASE_TIME));
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    expect(vi.getTimerCount()).toBe(0);
    host.remove();
    vi.useRealTimers();
  });

  it('automatically fails Home, Preferences, and Address Book closed when evidence ages out', async () => {
    await act(async () => root.render(<ReadinessProbe evidence={readiness()} />));

    const output = host.querySelector('output');
    expect(output?.dataset).toMatchObject({
      health: 'HEALTHY',
      preferenceAction: 'NONE',
      sendReady: 'true',
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MAIL_ACCOUNT_READINESS_EVIDENCE_MAX_AGE_MS + 1);
    });

    expect(output?.dataset).toMatchObject({
      health: 'STALE',
      preferenceAction: 'RETRY',
      sendReady: 'false',
    });
  });

  it('invalidates at the earlier token expiry without waiting for the observation window', async () => {
    const tokenExpiresAt = new Date(BASE_TIME + 60_000).toISOString();
    await act(async () => root.render(<ReadinessProbe evidence={readiness(tokenExpiresAt)} />));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(host.querySelector('output')?.dataset).toMatchObject({
      health: 'ACTION_REQUIRED',
      preferenceAction: 'RETRY',
      sendReady: 'false',
    });
  });

  it('ignores an already stale account when scheduling the next current account expiry', () => {
    const current = readiness();
    const staleObservedAt = new Date(
      BASE_TIME - MAIL_ACCOUNT_READINESS_EVIDENCE_MAX_AGE_MS - 1
    ).toISOString();
    const stale = {
      ...current,
      observedAt: staleObservedAt,
      consentEvidence: { ...current.consentEvidence!, observedAt: staleObservedAt },
      tokenEvidence: { ...current.tokenEvidence!, observedAt: staleObservedAt, expiresAt: null },
      featureReadiness: {
        SEND: { ...current.featureReadiness!.SEND!, observedAt: staleObservedAt },
      },
    } satisfies MailAccountReadinessEvidence;

    expect(mailReadinessInvalidationAt([stale, current], BASE_TIME)).toBe(
      BASE_TIME + MAIL_ACCOUNT_READINESS_EVIDENCE_MAX_AGE_MS + 1
    );
  });
});
