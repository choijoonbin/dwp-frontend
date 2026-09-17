import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  downloadWorkplacePlanningBoardReport,
  executeWorkplacePlanningBoardReport,
  parseWorkplacePlanningReportPreview,
  parseWorkplacePlanningReportReceipt,
  previewWorkplacePlanningBoardReport,
} from './workplace-space-planning-report-api';

const ids = {
  site: '22000000-0000-4000-8000-000000000001',
  scenario: '22000000-0000-4000-8000-000000000002',
  preview: '22000000-0000-4000-8000-000000000003',
  command: '22000000-0000-4000-8000-000000000004',
  token: '22000000-0000-4000-8000-000000000005',
} as const;
const now = '2026-09-17T01:00:00Z';
const expires = '2027-09-17T01:00:00Z';
const revision = `psr-${'b'.repeat(64)}`;

function json(data: unknown) {
  return new Response(JSON.stringify({ status: 'SUCCESS', message: 'OK', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function snapshot() {
  return {
    scenarioId: ids.scenario,
    scenarioVersion: 4,
    scenarioName: 'Capacity proposal',
    scenarioState: 'PREVIEWED',
    siteId: ids.site,
    siteCode: 'SEL',
    siteName: 'Seoul Workplace',
    floorId: null,
    floorName: null,
    windowStart: now,
    windowEnd: expires,
    currentCapacity: 100,
    proposedCapacity: 92,
    currentRoomCapacity: 20,
    proposedRoomCapacity: 18,
    currentAccessibleResourceCount: 4,
    proposedAccessibleResourceCount: 6,
    currentUtilizationPercent: 73.4,
    proposedUtilizationPercent: 79.1,
    peakDemand: 84,
    forecastConfidencePercent: 92,
    forecastState: 'READY',
    calculationVersion: 'forecast-v21',
    energyValue: 120.5,
    energyUnit: 'kWh',
    co2eValue: 52.2,
    co2eUnit: 'kgCO2e',
    emissionFactorVersion: 'factor-kr-2026',
    emissionRegionCode: 'KR',
    affectedResourceCount: 6,
    impactedBookingCount: 2,
    personLevelDataIncluded: false,
    personLevelRowCount: 0,
    capturedAt: now,
  };
}

function preview() {
  return {
    previewId: ids.preview,
    scenarioId: ids.scenario,
    siteId: ids.site,
    floorId: null,
    format: 'PDF',
    scenarioVersion: 4,
    previewVersion: 1,
    confirmationToken: ids.token,
    snapshotSha256: 'a'.repeat(64),
    snapshot: snapshot(),
    createdAt: now,
    expiresAt: expires,
    idempotentReplay: false,
  };
}

function receipt(format: 'PDF' | 'XLSX', byteSize: number, contentSha256: string) {
  const pdf = format === 'PDF';
  return {
    commandId: ids.command,
    previewId: ids.preview,
    scenarioId: ids.scenario,
    siteId: ids.site,
    floorId: null,
    format,
    state: 'SUCCEEDED',
    scenarioVersion: 4,
    commandVersion: 1,
    mimeType: pdf
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileName: `workplace-board-report.${pdf ? 'pdf' : 'xlsx'}`,
    byteSize,
    contentSha256,
    contentHref:
      `/v1/admin/workplace/space-planning/reports/${ids.command}/content` + `?siteId=${ids.site}`,
    acceptedAt: now,
    completedAt: now,
    expiresAt: expires,
    idempotentReplay: false,
    correlationId: 'report-correlation',
  };
}

async function sha256(bytes: Uint8Array) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)))]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

describe('Workplace space-planning board-report API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('parses an aggregate preview and rejects any person-level report marker', () => {
    expect(parseWorkplacePlanningReportPreview(preview()).snapshot).toMatchObject({
      currentCapacity: 100,
      proposedCapacity: 92,
      personLevelDataIncluded: false,
      personLevelRowCount: 0,
    });
    expect(() =>
      parseWorkplacePlanningReportPreview({
        ...preview(),
        snapshot: { ...snapshot(), personLevelDataIncluded: true },
      })
    ).toThrow(/personLevelData/u);
  });

  it('binds receipt MIME, suffix, command path and site query', async () => {
    const pdf = new TextEncoder().encode('%PDF-1.7\nreport');
    const valid = receipt('PDF', pdf.byteLength, await sha256(pdf));
    expect(parseWorkplacePlanningReportReceipt(valid).contentHref).toContain(`siteId=${ids.site}`);
    expect(() =>
      parseWorkplacePlanningReportReceipt({
        ...valid,
        contentHref:
          `/v1/admin/workplace/space-planning/reports/${ids.command}/content` +
          '?siteId=22000000-0000-4000-8000-000000000099',
      })
    ).toThrow(/contentHref/u);
    expect(() => parseWorkplacePlanningReportReceipt({ ...valid, mimeType: 'text/csv' })).toThrow(
      /content/u
    );
    expect(() =>
      parseWorkplacePlanningReportReceipt({ ...valid, fileName: 'workplace-board-report.xlsx' })
    ).toThrow(/content/u);
  });

  it('sends preview and execute with exact site, CAS, step-up and revision evidence', async () => {
    const pdf = new TextEncoder().encode('%PDF-1.7\nreport');
    const reportReceipt = receipt('PDF', pdf.byteLength, await sha256(pdf));
    const fetch = vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
      const value = String(url);
      if (value.endsWith('/api/auth/csrf')) {
        return json({ token: 'csrf', headerName: 'X-XSRF-TOKEN' });
      }
      if (value.includes('reports:preview')) return json(preview());
      if (value.includes('/space-planning/reports?')) return json(reportReceipt);
      throw new Error(`Unexpected request ${value}`);
    });
    vi.stubGlobal('fetch', fetch);

    const reportPreview = await previewWorkplacePlanningBoardReport(
      ids.site,
      {
        scenarioId: ids.scenario,
        expectedScenarioVersion: 4,
        format: 'PDF',
        reason: 'Quarterly board review',
      },
      { idempotencyKey: 'board-preview' }
    );
    await executeWorkplacePlanningBoardReport(
      ids.site,
      {
        previewId: reportPreview.previewId,
        expectedPreviewVersion: reportPreview.previewVersion,
        expectedScenarioVersion: reportPreview.scenarioVersion,
        confirmationToken: reportPreview.confirmationToken,
        reason: 'Quarterly board review',
        explicitConfirmation: true,
      },
      { idempotencyKey: 'board-execute', activeAccessMode: 'ELEVATED', decisionRevision: revision }
    );

    expect(String(fetch.mock.calls[1]?.[0])).toContain(`reports:preview?siteId=${ids.site}`);
    const previewRequest = fetch.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(previewRequest.headers).get('Idempotency-Key')).toBe('board-preview');
    expect(JSON.parse(String(previewRequest.body))).toMatchObject({ expectedScenarioVersion: 4 });
    const executeRequest = fetch.mock.calls[2]?.[1] as RequestInit;
    const executeHeaders = new Headers(executeRequest.headers);
    expect(executeHeaders.get('X-DWP-Active-Access-Mode')).toBe('ELEVATED');
    expect(executeHeaders.get('X-DWP-Expected-Decision-Revision')).toBe(revision);
    expect(executeHeaders.get('X-DWP-Current-Decision-Revision')).toBe(revision);
  });

  it.each([
    {
      format: 'PDF' as const,
      mimeType: 'application/pdf',
      bytes: new TextEncoder().encode('%PDF-1.7\nverified'),
    },
    {
      format: 'XLSX' as const,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      bytes: new TextEncoder().encode('PK\u0003\u0004\u0014\u0000'),
    },
  ])('verifies actual $format MIME, magic, size and SHA before returning content', async (item) => {
    const expected = parseWorkplacePlanningReportReceipt(
      receipt(item.format, item.bytes.byteLength, await sha256(item.bytes))
    );
    const content = item.bytes.buffer.slice(
      item.bytes.byteOffset,
      item.bytes.byteOffset + item.bytes.byteLength
    ) as ArrayBuffer;
    const blob = {
      type: item.mimeType,
      size: item.bytes.byteLength,
      arrayBuffer: async () => content,
    } as Blob;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': item.mimeType }),
        blob: async () => blob,
      })
    );

    await expect(
      downloadWorkplacePlanningBoardReport(expected, {
        activeAccessMode: 'ELEVATED',
        decisionRevision: revision,
      })
    ).resolves.toEqual(blob);
  });
});
