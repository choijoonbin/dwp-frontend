import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  HRM012_API_CONTRACTS,
  HRM012_DEFAULT_GATE,
  HRM012_FEATURE,
  HRM012_QUERY_CONTRACT,
} from '../../data-quality';

const featureRoot = new URL('../../data-quality/', import.meta.url);
const apiSource = readFileSync(new URL('data-quality-api.ts', featureRoot), 'utf8');
const contractSource = readFileSync(new URL('data-quality-contract.ts', featureRoot), 'utf8');
const hookSource = readFileSync(new URL('use-data-quality-workbench.ts', featureRoot), 'utf8');
const runtimeSource = readFileSync(new URL('data-quality-workbench.tsx', featureRoot), 'utf8');
const commandCenterSource = readFileSync(
  new URL('components/data-quality-command-center.tsx', featureRoot),
  'utf8'
);
const inspectorSource = readFileSync(
  new URL('components/data-quality-inspector.tsx', featureRoot),
  'utf8'
);

describe('[SLICE:BASE-TFR-HRM-012] governed workforce data quality', () => {
  it('pins IAQ-012 to the exact read-only People paths', () => {
    expect(HRM012_API_CONTRACTS).toEqual([
      {
        bindingId: 'IAQ-012',
        operationId: 'IAQ.OP.012',
        method: 'GET',
        browserPath: '/api/people/v1/hris/workbench/operations/data/quality',
        ownerPath: '/v1/hris/workbench/operations/data/quality',
      },
    ]);
    expect(apiSource).toContain('productSurfaceReadScopeConfig');
    expect(apiSource).not.toMatch(/axiosInstance\.post|HighRiskMutation|mutation/iu);
    expect(commandCenterSource).not.toMatch(/onAction|onReplay|onRetry|onIngest/iu);
  });

  it('keeps the module unmounted, default OFF, zero-enrollment, and zero-call compatible', () => {
    expect(HRM012_DEFAULT_GATE).toEqual({
      feature: HRM012_FEATURE,
      enabled: false,
      tenantEnrolled: false,
    });
    expect(Object.isFrozen(HRM012_DEFAULT_GATE)).toBe(true);
    expect(runtimeSource).not.toMatch(/react-router|createBrowserRouter|routeCatalog/iu);
    expect(runtimeSource).toContain('data-owner-calls="0"');
    expect(runtimeSource.indexOf('if (!rolloutAdmitted)')).toBeLessThan(
      runtimeSource.indexOf('<ActiveWorkbench')
    );
  });

  it('seals exact filters, stable sorting, typed field decisions, deep link, and empty actions', () => {
    expect(HRM012_QUERY_CONTRACT).toEqual(
      expect.objectContaining({
        variantKey: 'DATA_QUALITY',
        route: '/hr/operations/people/data-quality',
        pageLimit: 100,
        fieldGroups: ['INGESTION_STATUS', 'QUALITY_FINDING', 'COMMAND_RECEIPT'],
        filters: ['ingestionStatus', 'qualityFinding', 'commandReceipt', 'effectiveOn'],
        defaultSort: 'itemPublicId:ASC',
        availableActions: [],
      })
    );
    expect(HRM012_QUERY_CONTRACT.sorts).toEqual([
      'ingestionStatus:ASC',
      'qualityFinding:ASC',
      'commandReceipt:ASC',
      'ingestionStatus:DESC',
      'qualityFinding:DESC',
      'commandReceipt:DESC',
      'itemPublicId:ASC',
      'itemPublicId:DESC',
    ]);
    expect(contractSource).toContain("projectionVersion: '1'");
    expect(contractSource).toContain('availableActions: readonly []');
    expect(contractSource).toContain("decision: 'VIEW'");
    expect(contractSource).toContain("decision: 'MASK'");
  });

  it('covers all seven states and the responsive accessible list-detail inspector', () => {
    for (const state of ['loading', 'empty', 'partial', 'unavailable', 'denied', 'stale']) {
      expect(`${runtimeSource}\n${commandCenterSource}`.toLowerCase()).toContain(state);
    }
    expect(contractSource).toContain("'COMPLETE'");
    expect(HRM012_QUERY_CONTRACT.framing.archetype).toBe(
      'command-center-with-list-detail-inspector'
    );
    expect(commandCenterSource).toContain("xs: 'minmax(0, 1fr)'");
    expect(commandCenterSource).toContain("'@media (forced-colors: active)'");
    expect(commandCenterSource).toContain("'@media (prefers-reduced-motion: reduce)'");
    expect(commandCenterSource).toContain('aria-pressed={active}');
    expect(commandCenterSource).toContain('aria-live="polite"');
    expect(commandCenterSource).toContain("overflowWrap: 'anywhere'");
    expect(inspectorSource).toContain('fieldGroups.flatMap');
  });

  it('binds paging to scope revision and never displays or serializes raw cursors', () => {
    expect(hookSource).toContain('scopeChanged');
    expect(hookSource).toContain('asOfRef.current = null');
    expect(hookSource).toContain('setCursorHistory([null])');
    expect(commandCenterSource).not.toContain('nextCursor');
    expect(commandCenterSource).not.toContain('query.cursor');
    expect(apiSource).not.toMatch(/tenantId|actorPublicId|subjectPrincipalPublicId/iu);
  });
});
