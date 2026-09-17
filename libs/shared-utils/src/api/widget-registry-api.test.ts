import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  createWidgetRegistryCommandHeaders,
  getEffectiveWidgetCatalog,
  getProviderWidgetRegistryReadiness,
  getTenantWidgetCatalog,
  getWidgetRegistryReadiness,
  listWidgetDefinitions,
  publishWidgetDefinitionVersion,
} from './widget-registry-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('widget registry API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('rotates command identity for each deliberate mutation attempt', () => {
    const first = createWidgetRegistryCommandHeaders();
    const second = createWidgetRegistryCommandHeaders();
    expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
    expect(first.correlationId).not.toBe(second.correlationId);
  });

  it('reads readiness and scopes the effective Home context to the current first-class mode', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ schemaVersion: 1, migrationMode: 'SHADOW' }))
      .mockResolvedValueOnce(jsonResponse({ schemaVersion: 1, migrationMode: 'SHADOW' }))
      .mockResolvedValueOnce(jsonResponse({ schemaVersion: 1, mode: 'SHADOW' }));
    vi.stubGlobal('fetch', fetchMock);

    await getWidgetRegistryReadiness();
    await getProviderWidgetRegistryReadiness();
    await getEffectiveWidgetCatalog('workspace-home', 'MZ_V1');

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/platform/v1/widget-catalog/readiness');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/provider/v1/admin/widget-registry/readiness');
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      '/api/platform/v1/widget-catalog/effective?surfaceKey=workspace-home&mode=MZ_V1'
    );
    expect(String(fetchMock.mock.calls[2]?.[0])).not.toContain('placementContext');
    expect(String(fetchMock.mock.calls[2]?.[0])).not.toContain('hostMode');
  });

  it('uses closed provider and tenant list query contracts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await listWidgetDefinitions({ page: 0, size: 100, definitionState: 'ACTIVE' });
    await getTenantWidgetCatalog({ surfaceKey: 'workspace-home' });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/provider/v1/admin/widget-definitions?page=0&size=100&definitionState=ACTIVE'
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/admin/widget-catalog?surfaceKey=workspace-home'
    );
  });

  it('binds high-impact mutations to idempotency, correlation, version, and impact revision', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ versionId: 'version-1' }));
    vi.stubGlobal('fetch', fetchMock);

    await publishWidgetDefinitionVersion(
      'version/1',
      {
        channel: 'STABLE',
        validationRunId: '11111111-1111-4111-8111-111111111111',
        evidenceIds: ['22222222-2222-4222-8222-222222222222'],
        manifestHash: 'a'.repeat(64),
        expectedImpactRevision: 'b'.repeat(64),
        expectedVersion: 3,
        reasonCode: 'APPROVED_RELEASE',
        reasonText: 'Publish after review.',
      },
      {
        idempotencyKey: '33333333-3333-4333-8333-333333333333',
        correlationId: '44444444-4444-4444-8444-444444444444',
      }
    );

    const [url, request] = fetchMock.mock.calls[1] as [string, RequestInit];
    const headers = new Headers(request.headers);
    expect(url).toBe('/api/provider/v1/admin/widget-definition-versions/version%2F1/publish');
    expect(headers.get('Idempotency-Key')).toBe('33333333-3333-4333-8333-333333333333');
    expect(headers.get('X-Correlation-ID')).toBe('44444444-4444-4444-8444-444444444444');
    expect(JSON.parse(String(request.body))).toMatchObject({
      expectedVersion: 3,
      expectedImpactRevision: 'b'.repeat(64),
    });
  });

  it('rejects malformed command identifiers before any request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      publishWidgetDefinitionVersion(
        'version-1',
        {
          channel: 'STABLE',
          validationRunId: 'validation-1',
          evidenceIds: [],
          manifestHash: 'a'.repeat(64),
          expectedImpactRevision: 'b'.repeat(64),
          expectedVersion: 1,
          reasonCode: 'TEST',
          reasonText: 'Test',
        },
        { idempotencyKey: 'not-a-uuid', correlationId: 'not-a-uuid' }
      )
    ).rejects.toThrow(/UUID idempotency and correlation keys/u);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
