import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  WORKPLACE_CONNECTOR_KINDS,
  getWorkplaceConnectorOperation,
  getWorkplaceConnectorOperations,
  getWorkplaceConnectorReplay,
  parseWorkplaceConnectorOperations,
  parseWorkplaceConnectorRuntimeTruth,
  previewWorkplaceConnectorReplay,
  startWorkplaceConnectorReplay,
} from './workplace-connector-operations-api';

const jobId = '82000000-0000-4000-8000-000000000021';
const previewId = '81000000-0000-4000-8000-000000000021';
const evaluatedAt = '2026-09-16T04:00:00Z';

function runtime(kind = 'CALENDAR') {
  return {
    kind,
    provider: 'calendar-adapter',
    enabled: true,
    state: 'HEALTHY',
    providerReportedState: 'HEALTHY',
    capabilities: ['HEALTH', 'CHECKPOINT', 'RETRY_QUEUE', 'REPLAY'],
    configurationVersion: 7,
    observedConfigurationVersion: 7,
    runtimeVersion: 11,
    sourceObservedAt: '2026-09-16T03:59:20Z',
    receivedAt: '2026-09-16T03:59:25Z',
    lastSuccessAt: '2026-09-16T03:59:20Z',
    lagSeconds: 40,
    checkpointReference: 'cursor:calendar:700',
    retryQueueDepth: 2,
    deadLetterQueueDepth: 1,
    errorCode: null,
    activeReplayJobId: null,
    evaluatedAt,
  };
}

function replayJob(state = 'QUEUED') {
  return {
    jobId,
    previewId,
    kind: 'CALENDAR',
    provider: 'calendar-adapter',
    state,
    reason: 'Recover failed calendar events',
    providerOperationReference: null,
    resultSummary:
      state === 'RESULT_UNKNOWN'
        ? 'Provider dispatch outcome is unknown; query this receipt.'
        : null,
    configurationVersion: 7,
    runtimeVersion: 11,
    version: 1,
    requestedAt: '2026-09-16T04:01:00Z',
    startedAt: null,
    finishedAt: null,
    updatedAt: '2026-09-16T04:01:00Z',
  };
}

function response(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('Workplace connector operations runtime contract', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('never exposes HEALTHY when current provider evidence is incomplete or version-mismatched', () => {
    expect(
      parseWorkplaceConnectorRuntimeTruth({
        ...runtime(),
        observedConfigurationVersion: 6,
        lastSuccessAt: null,
      }).state
    ).toBe('CONFIGURED_UNVERIFIED');
    expect(
      parseWorkplaceConnectorRuntimeTruth({ ...runtime(), capabilities: ['REPLAY'] }).state
    ).toBe('CONFIGURED_UNVERIFIED');
    expect(parseWorkplaceConnectorRuntimeTruth(runtime()).state).toBe('HEALTHY');
  });

  it('requires exactly one runtime truth row for every governed connector kind', () => {
    const connectors = WORKPLACE_CONNECTOR_KINDS.map((kind) => ({
      ...runtime(kind),
      provider: kind === 'CALENDAR' ? 'calendar-adapter' : null,
      enabled: kind === 'CALENDAR',
      state: kind === 'CALENDAR' ? 'HEALTHY' : 'NOT_CONFIGURED',
      providerReportedState: kind === 'CALENDAR' ? 'HEALTHY' : null,
      capabilities: kind === 'CALENDAR' ? runtime().capabilities : [],
      configurationVersion: kind === 'CALENDAR' ? 7 : 0,
      observedConfigurationVersion: kind === 'CALENDAR' ? 7 : null,
      runtimeVersion: kind === 'CALENDAR' ? 11 : null,
      sourceObservedAt: kind === 'CALENDAR' ? runtime().sourceObservedAt : null,
      receivedAt: kind === 'CALENDAR' ? runtime().receivedAt : null,
      lastSuccessAt: kind === 'CALENDAR' ? runtime().lastSuccessAt : null,
      lagSeconds: kind === 'CALENDAR' ? 40 : null,
      checkpointReference: kind === 'CALENDAR' ? 'cursor:calendar:700' : null,
      retryQueueDepth: kind === 'CALENDAR' ? 2 : null,
      deadLetterQueueDepth: kind === 'CALENDAR' ? 1 : null,
    }));
    expect(
      parseWorkplaceConnectorOperations({ connectors, generatedAt: evaluatedAt }).connectors
    ).toHaveLength(7);
    expect(() =>
      parseWorkplaceConnectorOperations({
        connectors: connectors.slice(1),
        generatedAt: evaluatedAt,
      })
    ).toThrow(/operations\.connectors/u);
  });

  it('uses list, detail, preview, 202 command and receipt status endpoints with immutable versions', async () => {
    const operations = {
      connectors: WORKPLACE_CONNECTOR_KINDS.map((kind) => ({
        ...runtime(kind),
        state: kind === 'CALENDAR' ? 'HEALTHY' : 'DISABLED',
      })),
      generatedAt: evaluatedAt,
    };
    const preview = {
      previewId,
      kind: 'CALENDAR',
      provider: 'calendar-adapter',
      from: '2026-09-16T03:00:00Z',
      to: '2026-09-16T04:00:00Z',
      failedOnly: true,
      maximumRecords: 500,
      estimatedRecords: 21,
      eligible: true,
      limitations: [],
      configurationVersion: 7,
      runtimeVersion: 11,
      expiresAt: '2026-09-16T04:10:00Z',
      createdAt: '2026-09-16T04:00:00Z',
    };
    const receipt = {
      commandId: jobId,
      state: 'QUEUED',
      acceptedAt: '2026-09-16T04:01:00Z',
      statusHref: `/v1/admin/workplace/connectors/CALENDAR/replays/${jobId}`,
      idempotentReplay: false,
      correlationId: 'correlation-21',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(operations))
      .mockResolvedValueOnce(response(runtime()))
      .mockResolvedValueOnce(response({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(response(preview))
      .mockResolvedValueOnce(response({ job: replayJob(), receipt }, 202))
      .mockResolvedValueOnce(response(replayJob('RESULT_UNKNOWN')));
    vi.stubGlobal('fetch', fetchMock);

    await getWorkplaceConnectorOperations();
    await getWorkplaceConnectorOperation('CALENDAR');
    const previewResult = await previewWorkplaceConnectorReplay(
      'CALENDAR',
      {
        from: preview.from,
        to: preview.to,
        failedOnly: true,
        maximumRecords: 500,
        configurationVersion: 7,
        runtimeVersion: 11,
      },
      {
        idempotencyKey: 'workplace-replay-preview-key',
        activeAccessMode: 'ELEVATED',
        correlationId: 'connector-preview-correlation',
      }
    );
    await startWorkplaceConnectorReplay(
      'CALENDAR',
      {
        previewId: previewResult.previewId,
        configurationVersion: previewResult.configurationVersion,
        runtimeVersion: previewResult.runtimeVersion,
        reason: 'Recover failed calendar events',
        explicitConfirmation: true,
      },
      {
        idempotencyKey: 'workplace-replay-key',
        activeAccessMode: 'ELEVATED',
        correlationId: 'connector-start-correlation',
      }
    );
    await expect(getWorkplaceConnectorReplay('CALENDAR', jobId)).resolves.toMatchObject({
      state: 'RESULT_UNKNOWN',
    });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/platform/v1/admin/workplace/connectors/operations',
      '/api/platform/v1/admin/workplace/connectors/CALENDAR/operations',
      '/api/auth/csrf',
      '/api/platform/v1/admin/workplace/connectors/CALENDAR/replays:preview',
      '/api/platform/v1/admin/workplace/connectors/CALENDAR/replays',
      `/api/platform/v1/admin/workplace/connectors/CALENDAR/replays/${jobId}`,
    ]);
    const previewCommand = fetchMock.mock.calls[3]?.[1] as RequestInit;
    expect(new Headers(previewCommand.headers).get('Idempotency-Key')).toBe(
      'workplace-replay-preview-key'
    );
    expect(new Headers(previewCommand.headers).get('X-DWP-Active-Access-Mode')).toBe('ELEVATED');
    expect(new Headers(previewCommand.headers).get('X-Correlation-ID')).toBe(
      'connector-preview-correlation'
    );
    const command = fetchMock.mock.calls[4]?.[1] as RequestInit;
    expect(new Headers(command.headers).get('Idempotency-Key')).toBe('workplace-replay-key');
    expect(new Headers(command.headers).get('X-DWP-Active-Access-Mode')).toBe('ELEVATED');
    expect(new Headers(command.headers).get('X-Correlation-ID')).toBe(
      'connector-start-correlation'
    );
    expect(JSON.parse(String(command.body))).toMatchObject({
      previewId,
      configurationVersion: 7,
      runtimeVersion: 11,
      explicitConfirmation: true,
    });
  });

  it('refuses replay dispatch without explicit confirmation or elevated access mode', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const input = {
      previewId,
      configurationVersion: 7,
      runtimeVersion: 11,
      reason: 'Recover failed events',
      explicitConfirmation: false,
    };
    await expect(
      startWorkplaceConnectorReplay('CALENDAR', input, {
        idempotencyKey: 'replay-key',
        activeAccessMode: 'ELEVATED',
      })
    ).rejects.toThrow(/command is invalid/u);
    expect(fetch).not.toHaveBeenCalled();
  });
});
