import { describe, expect, it } from 'vitest';

import {
  PRODUCT_AUTHORIZATION_PAGE_PROJECTIONS,
  PRODUCT_AUTHORIZATION_REGISTRY_REVISION,
  PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS,
} from '../../../../../routes/product-surface-authorization.generated';

import {
  HRIS_OPERATIONS_API_CONTRACTS,
  HRIS_OPERATIONS_FEATURE,
  hrisOperationOwnerDeepLink,
  mergeHrisOperationsQueryState,
  parseHrisOperationalExceptionDetail,
  parseHrisOperationalExceptionPage,
  parseHrisOperationsEntry,
  parseHrisOperationsQueryState,
} from '../model/hris-operations-contract';
import {
  EXCEPTION_ID,
  NOW,
  OWNER_ROUTE_KEY,
  emptyOperationsEntry,
  exceptionDetail,
  exceptionPage,
  operationsEntry,
} from './hris-operations-fixtures.test-support';

describe('SYS-002 HRIS operations contract', () => {
  it('pins IAQ-059, PEP-SYS-037/038 and the existing receipt without mutation bindings', () => {
    expect(HRIS_OPERATIONS_FEATURE).toBe('HRIS_OPERATIONS_EXCEPTION_CENTER');
    expect(HRIS_OPERATIONS_API_CONTRACTS).toEqual({
      entry: {
        id: 'IAQ-059',
        method: 'GET',
        path: '/api/platform/v1/hris/workbench/settings-operations',
        routeContractKey: 'route.hcm.configuration.settings-operations.page',
        surfaceId: 'hcm.management',
        capability: 'hcm.configuration.workbench.view',
        purpose: 'HRIS_CONFIGURATION',
        responseSchemaKey: 'route.hcm.configuration.settings-operations.page.response.v1',
        targetBindingKinds: ['CONFIG_SCOPE'],
      },
      list: {
        id: 'PEP-SYS-037',
        method: 'GET',
        path: '/api/platform/v1/admin/hris/operations/exceptions',
        routeContractKey: 'route.hcm.operations.exception.data',
        surfaceId: 'hcm.operations',
        capability: 'hcm.operations.exception.view',
        purpose: 'HRIS_OPERATIONS',
        responseSchemaKey: 'route.hcm.operations.exception.data.response.v1',
        targetBindingKinds: ['TARGET_POPULATION'],
      },
      detail: {
        id: 'PEP-SYS-038',
        method: 'GET',
        path: '/api/platform/v1/admin/hris/operations/exceptions/{exceptionId}',
        routeContractKey: 'route.hcm.operations.exception-detail.data',
        surfaceId: 'hcm.operations',
        capability: 'hcm.operations.exception.view',
        purpose: 'HRIS_OPERATIONS',
        responseSchemaKey: 'route.hcm.operations.exception-detail.data.response.v1',
        targetBindingKinds: ['TARGET_POPULATION', 'OBJECT'],
      },
      receipt: {
        id: 'PEP-SYS-040',
        method: 'GET',
        path: '/api/platform/v1/admin/hris/command-receipts/{receiptId}',
        reused: true,
      },
    });
    expect(JSON.stringify(HRIS_OPERATIONS_API_CONTRACTS)).not.toMatch(/POST|PUT|PATCH|DELETE/u);
  });

  it('retains the exact v52 operations and HRM-009 PAGE tuples on a successor registry', () => {
    const operationContractKeys = new Set<string>([
      HRIS_OPERATIONS_API_CONTRACTS.entry.routeContractKey,
      HRIS_OPERATIONS_API_CONTRACTS.list.routeContractKey,
      HRIS_OPERATIONS_API_CONTRACTS.detail.routeContractKey,
    ]);
    expect(PRODUCT_AUTHORIZATION_REGISTRY_REVISION.version).toBeGreaterThanOrEqual(52);
    expect(
      PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter((projection) =>
        operationContractKeys.has(projection.routeContractKey)
      ).map((projection) => ({
        routeContractKey: projection.routeContractKey,
        routeKind: projection.routeKind,
        navigationContextId: projection.navigationContextId,
        surfaceId: projection.surfaceId,
        routeId: projection.routeId,
        pattern: projection.pattern,
        gatewayBindings: projection.gatewayBindings,
      }))
    ).toEqual([
      {
        routeContractKey: 'route.hcm.configuration.settings-operations.page',
        routeKind: 'PAGE',
        navigationContextId: 'hcm.management',
        surfaceId: 'hcm.management',
        routeId: 'hcm.management.settings-operations',
        pattern: '/hr/settings/operations',
        gatewayBindings: [
          { method: 'GET', path: '/api/platform/v1/hris/workbench/settings-operations' },
        ],
      },
      {
        routeContractKey: 'route.hcm.operations.exception-detail.data',
        routeKind: 'DATA',
        navigationContextId: 'hcm.operations',
        surfaceId: 'hcm.operations',
        routeId: null,
        pattern: null,
        gatewayBindings: [
          {
            method: 'GET',
            path: '/api/platform/v1/admin/hris/operations/exceptions/{exceptionId}',
          },
        ],
      },
      {
        routeContractKey: 'route.hcm.operations.exception.data',
        routeKind: 'DATA',
        navigationContextId: 'hcm.operations',
        surfaceId: 'hcm.operations',
        routeId: null,
        pattern: null,
        gatewayBindings: [
          { method: 'GET', path: '/api/platform/v1/admin/hris/operations/exceptions' },
        ],
      },
    ]);
    expect(
      PRODUCT_AUTHORIZATION_PAGE_PROJECTIONS.filter(
        (projection) =>
          projection.routeContractKey === 'route.hcm.operations.certificates-documents.page'
      )
    ).toEqual([
      expect.objectContaining({
        navigationContextId: 'hcm.operations',
        productId: 'hcm',
        surfaceId: 'hcm.operations',
        routeId: 'hcm.operations.certificates-documents',
        pattern: '/hr/operations/people/certificates-documents',
      }),
    ]);
  });

  it('accepts the closed entry, list and redacted detail projections', () => {
    expect(parseHrisOperationsEntry(operationsEntry())).toEqual(operationsEntry());
    expect(parseHrisOperationsEntry(operationsEntry('PARTIAL'))).toEqual(
      operationsEntry('PARTIAL')
    );
    expect(parseHrisOperationsEntry(operationsEntry('STALE'))).toEqual(operationsEntry('STALE'));
    expect(parseHrisOperationsEntry(emptyOperationsEntry())).toEqual(emptyOperationsEntry());
    expect(Object.hasOwn(operationsEntry(), 'availableActions')).toBe(false);
    expect(parseHrisOperationalExceptionPage(exceptionPage())).toEqual(exceptionPage());
    expect(parseHrisOperationalExceptionDetail(exceptionDetail())).toEqual(exceptionDetail());
    expect(() =>
      parseHrisOperationsEntry({ ...operationsEntry(), availableActions: ['RECOVER'] })
    ).toThrow('Invalid HRIS operations response');
  });

  it('accepts lowercase Java-canonical UUIDs without RFC version or variant restrictions', () => {
    expect(EXCEPTION_ID).toBe('10000000-0000-f000-0000-000000000001');
    expect(parseHrisOperationalExceptionDetail(exceptionDetail())).toMatchObject({
      exceptionPublicId: EXCEPTION_ID,
      evidenceRefs: [
        `urn:dwp:hris:evidence:command-receipt:30000000-0000-4000-8000-000000000001`,
        `urn:dwp:hris:evidence:domain-event:${EXCEPTION_ID}`,
      ],
    });
  });

  it('derives an owner deep link only from exact PAGE tuples retained by a successor registry', () => {
    expect(hrisOperationOwnerDeepLink(OWNER_ROUTE_KEY, EXCEPTION_ID)).toBe(
      `/hr/settings/reference-data?focus=${EXCEPTION_ID}`
    );
    expect(() =>
      parseHrisOperationalExceptionDetail({
        ...exceptionDetail(),
        ownerDeepLink: `https://attacker.invalid/recover?focus=${EXCEPTION_ID}`,
      })
    ).toThrow('Unsafe HRIS operations owner deep link');
    expect(() =>
      parseHrisOperationalExceptionDetail({
        ...exceptionDetail(),
        ownerDeepLink: `/hr/settings/reference-data?focus=${EXCEPTION_ID}&recover=true`,
      })
    ).toThrow('Unsafe HRIS operations owner deep link');
    const crossModuleRoute = 'route.hcm.operations.time-exceptions.page' as const;
    expect(() =>
      parseHrisOperationalExceptionDetail({
        ...exceptionDetail(),
        ownerRouteKey: crossModuleRoute,
        ownerDeepLink: hrisOperationOwnerDeepLink(crossModuleRoute, EXCEPTION_ID),
      })
    ).toThrow('owner route does not match its owner module');
  });

  it('rejects raw payload additions and field-decision redaction leaks', () => {
    expect(() =>
      parseHrisOperationalExceptionDetail({
        ...exceptionDetail(),
        rawPayload: { stackTrace: 'secret' },
      })
    ).toThrow('Invalid HRIS operations response');
    expect(() =>
      parseHrisOperationalExceptionDetail({
        ...exceptionDetail(),
        fieldDecisions: {
          ...exceptionDetail().fieldDecisions,
          REDACTED_PAYLOAD: 'VIEW',
        },
      })
    ).toThrow('Raw HRIS exception payload must be omitted');
    expect(() =>
      parseHrisOperationalExceptionDetail({
        ...exceptionDetail(),
        fieldDecisions: {
          ...exceptionDetail().fieldDecisions,
          RECOVERY_METADATA: 'OMIT',
        },
      })
    ).toThrow('Masked HRIS operation recovery metadata was returned');
    expect(() =>
      parseHrisOperationalExceptionDetail({
        ...exceptionDetail(),
        correlationId: null,
      })
    ).toThrow('Visible HRIS operation recovery metadata is incomplete');
    expect(() =>
      parseHrisOperationalExceptionDetail({
        ...exceptionDetail(),
        evidenceRefs: [],
      })
    ).toThrow('Visible HRIS operation recovery metadata is incomplete');
    expect(() =>
      parseHrisOperationalExceptionDetail({
        ...exceptionDetail(),
        evidenceRefs: [...exceptionDetail().evidenceRefs].reverse(),
      })
    ).toThrow('HRIS operation evidence references are not canonical');
  });

  it('accepts an explicitly masked owner link and omitted recovery metadata only when values are absent', () => {
    const redacted = {
      ...exceptionDetail(),
      ownerDeepLink: null,
      correlationId: null,
      evidenceRefs: [],
      fieldDecisions: {
        ...exceptionDetail().fieldDecisions,
        OWNER_DEEP_LINK: 'MASK',
        RECOVERY_METADATA: 'OMIT',
      },
    };
    expect(parseHrisOperationalExceptionDetail(redacted)).toMatchObject({
      ownerDeepLink: null,
      correlationId: null,
      evidenceRefs: [],
      fieldDecisions: { OWNER_DEEP_LINK: 'MASK', RECOVERY_METADATA: 'OMIT' },
    });
  });

  it('rejects inconsistent entry totals and duplicate exception identities', () => {
    expect(() =>
      parseHrisOperationsEntry({
        ...operationsEntry(),
        counts: { ...operationsEntry().counts, total: 2 },
      })
    ).toThrow('Inconsistent HRIS operations counts');
    expect(() =>
      parseHrisOperationalExceptionPage({
        ...exceptionPage(),
        items: [exceptionPage().items[0], exceptionPage().items[0]],
      })
    ).toThrow('Invalid HRIS operations response');
  });

  it('rejects incomplete, unordered or semantically inconsistent entry source projections', () => {
    expect(() =>
      parseHrisOperationsEntry({
        ...operationsEntry(),
        sources: operationsEntry().sources.slice(0, -1),
      })
    ).toThrow('Incomplete or unordered HRIS operations source status');

    const reordered = [...operationsEntry().sources];
    [reordered[0], reordered[1]] = [reordered[1]!, reordered[0]!];
    expect(() =>
      parseHrisOperationsEntry({
        ...operationsEntry(),
        sources: reordered,
      })
    ).toThrow('Incomplete or unordered HRIS operations source status');

    expect(() =>
      parseHrisOperationsEntry({
        ...operationsEntry(),
        sources: [
          { ...operationsEntry().sources[0]!, reasonCode: 'OWNER_PROJECTION_STALE' },
          ...operationsEntry().sources.slice(1),
        ],
      })
    ).toThrow('Inconsistent HRIS operations source status');

    expect(() =>
      parseHrisOperationsEntry({
        ...operationsEntry(),
        projectionState: 'PARTIAL',
      })
    ).toThrow('Inconsistent HRIS operations projection state');

    expect(() =>
      parseHrisOperationsEntry({
        ...emptyOperationsEntry(),
        sources: emptyOperationsEntry().sources.map((source, index) =>
          index === 3 ? { ownerModule: source.ownerModule, state: 'AVAILABLE' } : source
        ),
      })
    ).toThrow('Inconsistent HRIS operations source availability');

    expect(() =>
      parseHrisOperationsEntry({
        ...emptyOperationsEntry(),
        lastSuccessfulRefreshAt: NOW,
      })
    ).toThrow('Inconsistent HRIS operations refresh state');
  });

  it('accepts a later revision with an earlier owner timestamp and still enforces cursor order', () => {
    const olderId = '00000000-0000-4000-8000-000000000002';
    const newest = exceptionPage().items[0]!;
    const older = {
      ...newest,
      exceptionPublicId: olderId,
      ownerDeepLink: hrisOperationOwnerDeepLink(OWNER_ROUTE_KEY, olderId),
      sourceRevision: newest.sourceRevision + 1,
      firstObservedAt: '2026-10-17T08:00:30Z',
      lastObservedAt: '2026-10-17T07:59:59Z',
    };
    expect(
      parseHrisOperationalExceptionDetail({
        ...exceptionDetail(),
        ...older,
      })
    ).toMatchObject({
      sourceRevision: 8,
      firstObservedAt: '2026-10-17T08:00:30Z',
      lastObservedAt: '2026-10-17T07:59:59Z',
    });
    expect(
      parseHrisOperationalExceptionPage({
        ...exceptionPage(),
        items: [newest, older],
      }).items
    ).toHaveLength(2);
    expect(() =>
      parseHrisOperationalExceptionPage({
        ...exceptionPage(),
        items: [older, newest],
      })
    ).toThrow('Unstable HRIS operational exception ordering');
  });

  it('sanitizes deep-link input and preserves only allowlisted filters when selection changes', () => {
    const source = new URLSearchParams(
      `tab=owner&focus=../../recover&owner=SYS&severity=HIGH&state=OPEN&recover=true&unrelated=preserved`
    );
    expect(parseHrisOperationsQueryState(source)).toEqual({
      tab: 'overview',
      focus: null,
      ownerModule: 'SYS',
      severity: 'HIGH',
      state: 'OPEN',
    });
    const next = mergeHrisOperationsQueryState(source, { focus: EXCEPTION_ID });
    expect(next.get('tab')).toBe('overview');
    expect(next.get('focus')).toBe(EXCEPTION_ID);
    expect(next.get('owner')).toBe('SYS');
    expect(next.get('severity')).toBe('HIGH');
    expect(next.get('state')).toBe('OPEN');
    expect(next.get('recover')).toBeNull();
    expect(next.get('unrelated')).toBeNull();
    expect([...next.keys()]).toEqual(['tab', 'focus', 'owner', 'severity', 'state']);
  });
});
