import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  downloadWorkplaceExceptionExport,
  getWorkplaceExceptionConsole,
  parseWorkplaceExceptionConsole,
  previewWorkplaceExceptionExport,
  previewWorkplaceExceptionRecovery,
  startWorkplaceExceptionExport,
  startWorkplaceExceptionRecovery,
} from './workplace-exception-console-api';

const NOW = '2026-09-17T03:00:00Z';
const PREVIEW_ID = '81000000-0000-4000-8000-000000000022';
const COMMAND_ID = '82000000-0000-4000-8000-000000000022';

function item() {
  return {
    exceptionId: 'CONNECTOR:CALENDAR',
    source: 'CONNECTOR',
    severity: 'ERROR',
    status: 'ACTIVE',
    title: 'calendar dead-letter queue needs attention',
    impact: '3 failed events await governed replay.',
    code: 'ADAPTER_DLQ',
    detectedAt: NOW,
    version: 7,
    evidence: ['DLQ=3'],
    action: 'REPLAY_CONNECTOR',
    actionHref: null,
    connectorKind: 'CALENDAR',
    configurationVersion: 4,
    runtimeVersion: 7,
  };
}

function consoleResponse() {
  return {
    summary: {
      active: 1,
      critical: 0,
      warning: 0,
      error: 1,
      concurrencyConflicts24h: 2,
      deadLetterQueueDepth: 3,
      automaticRecoveryPercent: null,
      slaCompliancePercent: null,
    },
    exceptions: [item()],
    guardrails: [
      {
        code: 'CONNECTOR_DLQ',
        name: 'External integration delivery',
        scope: 'Calendar',
        threshold: 'DLQ depth = 0',
        observedValue: '3',
        status: 'BREACHED',
        enforcement: 'Preview and explicitly confirm a bounded replay',
      },
    ],
    generatedAt: NOW,
    externalTelemetryUrl: null,
  };
}

function json(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('Workplace exception console API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('rejects invented percentages and unsafe action links', () => {
    expect(
      parseWorkplaceExceptionConsole(consoleResponse()).summary.slaCompliancePercent
    ).toBeNull();
    expect(() =>
      parseWorkplaceExceptionConsole({
        ...consoleResponse(),
        summary: { ...consoleResponse().summary, slaCompliancePercent: 100.1 },
      })
    ).toThrow(/slaCompliancePercent/u);
    expect(() =>
      parseWorkplaceExceptionConsole({
        ...consoleResponse(),
        exceptions: [{ ...item(), actionHref: 'https://untrusted.example.test' }],
      })
    ).toThrow(/actionHref/u);
  });

  it('binds read, governed recovery and guarded export to exact endpoints', async () => {
    const recoveryPreview = {
      exceptionId: 'CONNECTOR:CALENDAR',
      replay: {
        previewId: PREVIEW_ID,
        kind: 'CALENDAR',
        provider: 'msgraph',
        from: '2026-09-16T03:00:00Z',
        to: NOW,
        failedOnly: true,
        maximumRecords: 100,
        estimatedRecords: 3,
        eligible: true,
        limitations: [],
        configurationVersion: 4,
        runtimeVersion: 7,
        expiresAt: '2026-09-17T03:10:00Z',
        createdAt: NOW,
      },
      impactSummary: 'Up to 3 failed integration events will be replayed.',
    };
    const job = {
      jobId: COMMAND_ID,
      previewId: PREVIEW_ID,
      kind: 'CALENDAR',
      provider: 'msgraph',
      state: 'QUEUED',
      reason: 'Recover confirmed DLQ',
      providerOperationReference: null,
      resultSummary: null,
      configurationVersion: 4,
      runtimeVersion: 7,
      version: 1,
      requestedAt: NOW,
      startedAt: null,
      finishedAt: null,
      updatedAt: NOW,
    };
    const recoveryReceipt = {
      exceptionId: 'CONNECTOR:CALENDAR',
      recovery: {
        job,
        receipt: {
          commandId: COMMAND_ID,
          state: 'QUEUED',
          acceptedAt: NOW,
          statusHref: `/v1/admin/workplace/connectors/CALENDAR/replays/${COMMAND_ID}`,
          idempotentReplay: false,
          correlationId: 'corr',
        },
      },
    };
    const exportPreview = {
      previewId: PREVIEW_ID,
      rowCount: 1,
      purpose: 'Incident review',
      createdAt: NOW,
      expiresAt: '2026-09-17T03:10:00Z',
    };
    const exportReceipt = {
      commandId: COMMAND_ID,
      rowCount: 1,
      acceptedAt: NOW,
      expiresAt: '2026-09-17T04:00:00Z',
      downloadHref: `/v1/admin/workplace/exceptions/exports/${COMMAND_ID}/content`,
      idempotentReplay: false,
      correlationId: 'corr-export',
    };
    const blob = new Blob(['safe'], { type: 'text/csv' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(consoleResponse()))
      .mockResolvedValueOnce(json({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(json(recoveryPreview))
      .mockResolvedValueOnce(json(recoveryReceipt))
      .mockResolvedValueOnce(json(exportPreview))
      .mockResolvedValueOnce(json(exportReceipt))
      .mockResolvedValueOnce({ ok: true, status: 200, blob: async () => blob } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await getWorkplaceExceptionConsole();
    await previewWorkplaceExceptionRecovery(
      'CONNECTOR:CALENDAR',
      { from: '2026-09-16T03:00:00Z', to: NOW, maximumRecords: 100 },
      { idempotencyKey: 'recovery-preview', activeAccessMode: 'ELEVATED' }
    );
    await startWorkplaceExceptionRecovery(
      'CONNECTOR:CALENDAR',
      {
        previewId: PREVIEW_ID,
        configurationVersion: 4,
        runtimeVersion: 7,
        reason: 'Recover confirmed DLQ',
        explicitConfirmation: true,
      },
      { idempotencyKey: 'recovery-start', activeAccessMode: 'ELEVATED' }
    );
    await previewWorkplaceExceptionExport('Incident review', {
      idempotencyKey: 'export-preview',
      activeAccessMode: 'ELEVATED',
    });
    await startWorkplaceExceptionExport(
      { previewId: PREVIEW_ID, reason: 'Incident review', explicitConfirmation: true },
      { idempotencyKey: 'export-start', activeAccessMode: 'ELEVATED' }
    );
    await expect(
      downloadWorkplaceExceptionExport(COMMAND_ID, { activeAccessMode: 'ELEVATED' })
    ).resolves.toBe(blob);

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/platform/v1/admin/workplace/exceptions',
      '/api/auth/csrf',
      '/api/platform/v1/admin/workplace/exceptions/CONNECTOR_CALENDAR/recovery:preview',
      '/api/platform/v1/admin/workplace/exceptions/CONNECTOR_CALENDAR/recovery',
      '/api/platform/v1/admin/workplace/exceptions/exports:preview',
      '/api/platform/v1/admin/workplace/exceptions/exports',
      `/api/platform/v1/admin/workplace/exceptions/exports/${COMMAND_ID}/content`,
    ]);
    expect(
      new Headers((fetchMock.mock.calls[5]?.[1] as RequestInit).headers).get(
        'X-DWP-Active-Access-Mode'
      )
    ).toBe('ELEVATED');
    expect(
      new Headers((fetchMock.mock.calls[6]?.[1] as RequestInit).headers).get(
        'X-DWP-Active-Access-Mode'
      )
    ).toBe('ELEVATED');
  });
});
