import { describe, expect, it } from 'vitest';

import {
  mailAccountFeatureIsReady,
  mailAccountFeatureReadinessPresentation,
  mailAccountCapabilityPresentation,
  mailAccountReadinessIsReady,
} from './mail-account-capability-presentation';

describe('mail account capability presentation', () => {
  it('keeps provider send, content, attachment, and scheduling readiness distinct', () => {
    const result = mailAccountCapabilityPresentation(
      { accountKind: 'PERSONAL' },
      {
        multipleRecipients: true,
        cc: true,
        bcc: false,
        html: true,
        attachments: false,
        scheduling: true,
        maximumAttachmentBytes: 25 * 1024 * 1024,
        senderMode: 'ACCOUNT',
      }
    );

    expect(result).toEqual([
      { key: 'send', ready: true },
      { key: 'bcc', ready: false },
      { key: 'html', ready: true },
      { key: 'attachments', ready: false },
      { key: 'scheduling', ready: true },
    ]);
  });

  it('reports shared identity readiness from the governed shared sender capability', () => {
    const result = mailAccountCapabilityPresentation({ accountKind: 'SHARED' }, undefined);
    expect(result.slice(-2)).toEqual([
      { key: 'sharedIdentitySendAs', ready: false },
      { key: 'sharedIdentityOnBehalf', ready: false },
    ]);
  });

  it('projects the governed shared sender mode without inferring it from recipient support', () => {
    const result = mailAccountCapabilityPresentation(
      { accountKind: 'SHARED' },
      {
        multipleRecipients: true,
        cc: true,
        bcc: true,
        html: true,
        attachments: true,
        scheduling: true,
        maximumAttachmentBytes: 25 * 1024 * 1024,
        senderMode: 'SEND_ON_BEHALF',
      }
    );
    expect(result.slice(-2)).toEqual([
      { key: 'sharedIdentitySendAs', ready: false },
      { key: 'sharedIdentityOnBehalf', ready: true },
    ]);
  });

  it('fails readiness closed when authoritative observation or credential evidence is absent', () => {
    const evidence = {
      state: 'READY' as const,
      source: 'CONNECTOR_RUNTIME' as const,
      observedAt: '2026-09-17T05:00:00Z',
      errorCode: null,
      credentialConfigured: true,
      lastSuccessfulSyncAt: '2026-09-17T04:55:00Z',
      lastSuccessfulSyncScope: 'INBOX',
      action: 'NONE' as const,
      consentEvidence: {
        state: 'VERIFIED' as const,
        source: 'CONNECTOR_RUNTIME',
        observedAt: '2026-09-17T05:00:00Z',
        expiresAt: '2026-09-18T05:00:00Z',
        errorCode: null,
        action: 'NONE' as const,
      },
      tokenEvidence: {
        state: 'VERIFIED' as const,
        source: 'CONNECTOR_RUNTIME',
        observedAt: '2026-09-17T05:00:00Z',
        expiresAt: '2026-09-18T05:00:00Z',
        errorCode: null,
        action: 'NONE' as const,
      },
      featureReadiness: {
        SEND: {
          state: 'READY' as const,
          source: 'CONNECTOR_RUNTIME',
          observedAt: '2026-09-17T05:00:00Z',
          errorCode: null,
          lastSuccessfulAt: '2026-09-17T04:55:00Z',
          lastSuccessfulScope: 'SEND',
          action: 'NONE' as const,
        },
      },
    };
    expect(mailAccountReadinessIsReady(evidence)).toBe(true);
    expect(mailAccountReadinessIsReady({ ...evidence, credentialConfigured: false })).toBe(false);
    expect(mailAccountReadinessIsReady({ ...evidence, consentEvidence: null })).toBe(false);
    expect(
      mailAccountReadinessIsReady({
        ...evidence,
        tokenEvidence: { ...evidence.tokenEvidence, state: 'EXPIRED' },
      })
    ).toBe(false);
    expect(mailAccountReadinessIsReady(undefined)).toBe(false);
  });

  it('fails every feature closed unless current feature evidence is present', () => {
    const readiness = {
      state: 'READY' as const,
      source: 'CONNECTOR_RUNTIME' as const,
      observedAt: '2026-09-17T05:00:00Z',
      errorCode: null,
      credentialConfigured: true,
      lastSuccessfulSyncAt: '2026-09-17T04:55:00Z',
      lastSuccessfulSyncScope: 'INBOX',
      action: 'NONE' as const,
      consentEvidence: {
        state: 'NOT_REQUIRED' as const,
        source: 'CONNECTOR_RUNTIME',
        observedAt: '2026-09-17T05:00:00Z',
        expiresAt: null,
        errorCode: null,
        action: 'NONE' as const,
      },
      tokenEvidence: {
        state: 'NOT_REQUIRED' as const,
        source: 'CONNECTOR_RUNTIME',
        observedAt: '2026-09-17T05:00:00Z',
        expiresAt: null,
        errorCode: null,
        action: 'NONE' as const,
      },
      featureReadiness: {
        SEND: {
          state: 'READY' as const,
          source: 'CONNECTOR_RUNTIME',
          observedAt: '2026-09-17T05:00:00Z',
          errorCode: null,
          lastSuccessfulAt: '2026-09-17T04:55:00Z',
          lastSuccessfulScope: 'SEND',
          action: 'NONE' as const,
        },
        BCC: {
          state: 'UNAVAILABLE' as const,
          source: 'NO_RUNTIME_ATTESTATION',
          observedAt: '2026-09-17T05:00:00Z',
          errorCode: 'BCC_NOT_ATTESTED',
          lastSuccessfulAt: null,
          lastSuccessfulScope: null,
          action: 'CONTACT_ADMIN' as const,
        },
      },
    };

    expect(mailAccountFeatureIsReady(readiness, 'SEND')).toBe(true);
    expect(mailAccountFeatureIsReady(readiness, 'BCC')).toBe(false);
    expect(mailAccountFeatureIsReady(readiness, 'HTML_BODY')).toBe(false);
    expect(mailAccountFeatureReadinessPresentation(readiness).slice(0, 3)).toMatchObject([
      { featureKey: 'SEND', ready: true },
      { featureKey: 'BCC', ready: false },
      { featureKey: 'HTML_BODY', ready: false, evidence: null },
    ]);
  });
});
