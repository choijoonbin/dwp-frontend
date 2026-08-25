import { afterEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance, resetCsrfToken } from '../axios-instance';
import {
  PRODUCT_SURFACE_EVENT_ENDPOINT,
  reportProductSurfaceEvent,
  type ProductSurfaceTelemetryEvent,
} from './observability-api';

describe('product surface observability API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetCsrfToken();
  });

  it('posts only the typed client event to the dedicated endpoint', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: undefined });
    const event = {
      schemaVersion: 1,
      eventName: 'surface.scope.switch.completed',
      productKey: 'communications',
      surfaceKey: 'communications.management',
      scopeKind: 'RESOURCE_SET',
      attemptId: 'd2e63316-8564-4d8c-bd02-eaede882f982',
      elapsedBucket: 'S1_TO_5',
    } satisfies ProductSurfaceTelemetryEvent;

    await reportProductSurfaceEvent(event);

    expect(post).toHaveBeenCalledWith(PRODUCT_SURFACE_EVENT_ENDPOINT, event, {
      keepalive: true,
      timeoutMs: 2_000,
    });
    expect(post.mock.calls[0]?.[1]).not.toHaveProperty('tenantId');
    expect(post.mock.calls[0]?.[1]).not.toHaveProperty('cohort');
  });

  it('fails before transport when an untrusted caller adds a private dimension', async () => {
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: undefined });
    const event = {
      schemaVersion: 1,
      eventName: 'surface.exposed',
      productKey: 'communications',
      surfaceKey: 'communications.work',
      deviceClass: 'MOBILE',
      attemptId: 'd2e63316-8564-4d8c-bd02-eaede882f982',
      cohort: 'design-partner',
    } as ProductSurfaceTelemetryEvent;

    await expect(reportProductSurfaceEvent(event)).rejects.toThrow(/client allowlist/);
    expect(post).not.toHaveBeenCalled();
  });

  it('leaves the trusted cohort header to the gateway and omits private body fields', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        text: async () => '',
      } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await reportProductSurfaceEvent({
      schemaVersion: 1,
      eventName: 'surface.exposed',
      productKey: 'communications',
      surfaceKey: 'communications.work',
      deviceClass: 'DESKTOP',
      attemptId: 'd2e63316-8564-4d8c-bd02-eaede882f982',
    });

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(request.headers).not.toHaveProperty('X-DWP-Rollout-Cohort');
    expect(request.headers).not.toHaveProperty('X-DWP-Tenant-ID');
    expect(JSON.parse(String(request.body))).toEqual({
      schemaVersion: 1,
      eventName: 'surface.exposed',
      productKey: 'communications',
      surfaceKey: 'communications.work',
      deviceClass: 'DESKTOP',
      attemptId: 'd2e63316-8564-4d8c-bd02-eaede882f982',
    });
  });
});
