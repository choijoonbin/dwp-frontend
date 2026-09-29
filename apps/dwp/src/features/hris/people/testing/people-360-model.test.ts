import { describe, expect, it } from 'vitest';

import {
  createPeople360HomeContribution,
  isCalendarDate,
  PEOPLE_360_FIELD_REGISTRY,
  People360PayloadError,
  people360Decision,
  people360DetailQueryKey,
  people360ListQueryKey,
  people360Today,
  replacePeople360SearchParams,
  resolvePeople360Filters,
  selectPeople360Detail,
  selectPeople360Page,
  type People360RequestScope,
} from '../index';
import { people360ListSnapshot, people360Page, people360Snapshot } from './people-360.test-support';

const requestScope: People360RequestScope = {
  governed: true,
  ready: true,
  contextScopeKey: 'scope:hris/operations',
  cacheKey: ['tenant-1', 'actor-7', 'NORMAL', 'hcm.operations', 'scope:hris/operations', '42'],
  queryMeta: {
    accessSensitive: true,
    tenantId: 'tenant-1',
    actorId: 'actor-7',
    accessMode: 'NORMAL',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
    contextScopeKey: 'scope:hris/operations',
    decisionRevision: '42',
  },
};

const personId = '11111111-1111-4111-8111-111111111111';

describe('People 360 owner projection boundary', () => {
  it('accepts the exact decision registry and retains only explicitly selected fields', () => {
    const source = people360Snapshot();
    (source as Record<string, unknown>).privatePayroll = { amount: 'PRIVATE' };
    (source.person as Record<string, unknown>).nationalIdentifier = 'PRIVATE-NATIONAL-ID';
    (source.employment as Record<string, unknown>).bankAccount = 'PRIVATE-BANK';
    (source.primaryAssignment as Record<string, unknown>).salary = 'PRIVATE-SALARY';
    const selected = selectPeople360Detail(source, personId, '2026-09-17');

    expect(selected.person.displayName).toBe('Synthetic Worker Alpha');
    expect(selected.employment?.workerNumber).toBe('••••');
    expect(people360Decision(selected, 'employment.workerNumber')).toBe('MASK');
    expect(JSON.stringify(selected)).not.toContain('PRIVATE');
    expect(selected.access.fieldDecisions.map((item) => item.field)).toEqual(
      PEOPLE_360_FIELD_REGISTRY
    );
    expect(Object.isFrozen(selected)).toBe(true);
  });

  it('fails closed when an OMIT field is present or MASK is not the owner literal', () => {
    const omitted = people360Snapshot({
      decisions: { 'employment.workerNumber': 'OMIT' },
    });
    (omitted.employment as Record<string, unknown>).workerNumber = 'SYNTH-SECRET';
    expect(() => selectPeople360Detail(omitted, personId)).toThrowError(People360PayloadError);

    const invalidMask = people360Snapshot();
    (invalidMask.employment as Record<string, unknown>).workerNumber = '****0001';
    expect(() => selectPeople360Detail(invalidMask, personId)).toThrowError(People360PayloadError);
  });

  it('rejects missing, reordered, duplicate, and unsupported field decisions', () => {
    const mutations = [
      (items: unknown[]) => items.pop(),
      (items: unknown[]) => items.reverse(),
      (items: unknown[]) => {
        items[1] = items[0];
      },
      (items: unknown[]) => {
        items[0] = { field: 'person.privateSalary', decision: 'VIEW' };
      },
    ];
    for (const mutate of mutations) {
      const source = people360Snapshot();
      const items = (source.access as { fieldDecisions: unknown[] }).fieldDecisions;
      mutate(items);
      expect(() => selectPeople360Detail(source, personId)).toThrowError(People360PayloadError);
    }
  });

  it('rejects owner archetype and scope combinations that do not match', () => {
    expect(() =>
      selectPeople360Detail(
        people360Snapshot({ archetype: 'SELF', scope: 'WORKFORCE_POLICY' }),
        personId
      )
    ).toThrowError(People360PayloadError);
    expect(() =>
      selectPeople360Detail(people360Snapshot({ archetype: 'MANAGER', scope: 'SELF' }), personId)
    ).toThrowError(People360PayloadError);
    expect(() =>
      selectPeople360Detail(people360Snapshot({ archetype: 'AUDITOR', scope: 'TEAM' }), personId)
    ).toThrowError(People360PayloadError);
  });

  it('accepts exact masking on allowlisted text fields and rejects masking a date field', () => {
    const selected = selectPeople360Detail(
      people360Snapshot({
        decisions: {
          'person.displayName': 'MASK',
          'primaryAssignment.locationName': 'MASK',
        },
      }),
      personId
    );
    expect(selected.person.displayName).toBe('••••');
    expect(selected.primaryAssignment?.locationName).toBe('••••');

    expect(() =>
      selectPeople360Detail(
        people360Snapshot({ decisions: { 'employment.originalHireDate': 'MASK' } }),
        personId
      )
    ).toThrowError(People360PayloadError);
  });

  it('binds a snapshot to the requested person and mandatory as-of date', () => {
    expect(() =>
      selectPeople360Detail(people360Snapshot(), '22222222-2222-4222-8222-222222222222')
    ).toThrowError(People360PayloadError);
    expect(() => selectPeople360Detail(people360Snapshot(), personId, '2026-09-18')).toThrowError(
      People360PayloadError
    );
    const missingAsOf = people360Snapshot();
    delete missingAsOf.asOf;
    expect(() => selectPeople360Detail(missingAsOf, personId)).toThrowError(People360PayloadError);
  });

  it('keeps owner PARTIAL separate from policy MASK and OMIT', () => {
    const partial = selectPeople360Detail(
      people360Snapshot({
        state: 'PARTIAL',
        decisions: {
          'person.preferredLocale': 'OMIT',
          'employment.workerNumber': 'MASK',
        },
      }),
      personId
    );
    expect(partial.state).toBe('PARTIAL');
    expect(partial.primaryAssignment?.assignmentStatus).toBe('ACTIVE');
    expect(people360Decision(partial, 'person.preferredLocale')).toBe('OMIT');
    expect(people360Decision(partial, 'employment.workerNumber')).toBe('MASK');
  });

  it('allows an absent section only when every field in that section is OMIT', () => {
    expect(() =>
      selectPeople360Detail(people360Snapshot({ employment: false }), personId)
    ).toThrowError(People360PayloadError);

    const employmentOmitted = Object.fromEntries(
      PEOPLE_360_FIELD_REGISTRY.filter((field) => field.startsWith('employment.')).map((field) => [
        field,
        'OMIT',
      ])
    );
    const selected = selectPeople360Detail(
      people360Snapshot({
        employment: false,
        decisions: employmentOmitted,
      }),
      personId
    );
    expect(selected.employment).toBeUndefined();
  });
});

describe('People 360 list and cache identity', () => {
  it('validates every list row as the same explicit owner projection', () => {
    const secondId = '22222222-2222-4222-8222-222222222222';
    const selected = selectPeople360Page(
      people360Page([
        people360ListSnapshot(),
        people360ListSnapshot({ personId: secondId, displayName: 'Synthetic Worker Beta' }),
      ]),
      '2026-09-17'
    );
    expect(selected.items.map((item) => item.person.personId)).toEqual([personId, secondId]);
    expect(selected.items.every((item) => item.access.fieldDecisions.length === 22)).toBe(true);
  });

  it('accepts the owner LIST profile when the authorized population omits employment fields', () => {
    const directoryOnly = people360ListSnapshot({
      employment: false,
      primaryAssignment: false,
      decisions: {
        'employment.workerStatus': 'OMIT',
        'primaryAssignment.businessTitle': 'OMIT',
        'primaryAssignment.organizationName': 'OMIT',
        'primaryAssignment.jobProfileName': 'OMIT',
      },
    });
    const selected = selectPeople360Page(people360Page([directoryOnly]), '2026-09-17');
    expect(selected.items[0]?.employment).toBeUndefined();
    expect(selected.items[0]?.primaryAssignment).toBeUndefined();
  });

  it('accepts independent server decisions for every list-allowlisted field', () => {
    const mixed = people360ListSnapshot({
      decisions: {
        'person.displayName': 'MASK',
        'person.lifecycleState': 'OMIT',
        'employment.workerStatus': 'OMIT',
        'primaryAssignment.businessTitle': 'VIEW',
        'primaryAssignment.organizationName': 'MASK',
        'primaryAssignment.jobProfileName': 'OMIT',
      },
    });
    const selected = selectPeople360Page(people360Page([mixed]), '2026-09-17');
    expect(selected.items[0]?.person.displayName).toBe('••••');
    expect(selected.items[0]?.person.lifecycleState).toBeUndefined();
    expect(selected.items[0]?.employment?.workerStatus).toBeUndefined();
    expect(selected.items[0]?.primaryAssignment?.businessTitle).toBe(
      'Synthetic Product Specialist'
    );
    expect(selected.items[0]?.primaryAssignment?.organizationName).toBe('••••');
    expect(selected.items[0]?.primaryAssignment?.jobProfileName).toBeUndefined();
  });

  it('rejects duplicate people, row date drift, and incomplete cursors', () => {
    expect(() =>
      selectPeople360Page(
        people360Page([people360ListSnapshot(), people360ListSnapshot()]),
        '2026-09-17'
      )
    ).toThrowError(People360PayloadError);
    expect(() =>
      selectPeople360Page(
        people360Page([people360ListSnapshot({ asOf: '2026-09-18' })], {
          asOf: '2026-09-17',
        }),
        '2026-09-17'
      )
    ).toThrowError(People360PayloadError);
    expect(() =>
      selectPeople360Page(
        { ...people360Page([people360ListSnapshot()]), hasMore: true },
        '2026-09-17'
      )
    ).toThrowError(People360PayloadError);
  });

  it('binds the page envelope to the requested as-of date', () => {
    expect(() =>
      selectPeople360Page(
        people360Page([people360ListSnapshot({ asOf: '2026-09-18' })], {
          asOf: '2026-09-18',
        }),
        '2026-09-17'
      )
    ).toThrowError(People360PayloadError);
  });

  it('rejects a list row that exposes detail-purpose fields', () => {
    expect(() =>
      selectPeople360Page(people360Page([people360Snapshot()]), '2026-09-17')
    ).toThrowError(People360PayloadError);
  });

  it('keys list and detail by as-of plus the complete authorization identity', () => {
    expect(
      people360ListQueryKey({ asOf: '2026-09-17', query: '', status: 'ALL' }, requestScope)
    ).toEqual(['hris', 'people-360', 'list-v2', '2026-09-17', '', 'ALL', ...requestScope.cacheKey]);
    expect(people360DetailQueryKey(personId, '2026-09-17', requestScope)).toEqual([
      'hris',
      'people-360',
      'detail-v2',
      personId,
      '2026-09-17',
      ...requestScope.cacheKey,
    ]);
  });
});

describe('People 360 date, URL, and home contribution', () => {
  it('uses the configured time zone and rejects impossible calendar dates', () => {
    const instant = '2026-01-01T00:30:00Z';
    expect(people360Today('Asia/Seoul', instant)).toBe('2026-01-01');
    expect(people360Today('America/Los_Angeles', instant)).toBe('2025-12-31');
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('2028-02-29')).toBe(true);
  });

  it('retains direct selection and normalizes neutral URL filters', () => {
    expect(
      resolvePeople360Filters(
        new URLSearchParams(`asOf=invalid&person=${personId}&status=ACTIVE`),
        '2026-09-17'
      )
    ).toEqual({
      asOf: '2026-09-17',
      query: '',
      status: 'ACTIVE',
      personId,
    });
    expect(
      replacePeople360SearchParams(new URLSearchParams('q=synthetic&status=ACTIVE'), {
        status: 'ALL',
        person: personId,
      }).toString()
    ).toBe(`q=synthetic&person=${personId}`);
  });

  it('exports a complete home adapter without an omitted or masked business field', () => {
    const profile = selectPeople360Detail(
      people360Snapshot({
        decisions: {
          'person.displayName': 'OMIT',
          'employment.workerNumber': 'MASK',
          'primaryAssignment.organizationName': 'OMIT',
        },
      }),
      personId
    );
    const contribution = createPeople360HomeContribution(
      profile,
      { kind: 'ORG_UNIT', key: 'org-unit:synthetic-people' },
      'trace-synthetic-1'
    );

    expect(contribution).toMatchObject({
      widgetId: 'hris.people.current-snapshot',
      sourceModule: 'HRM',
      dataAuthority: 'MODULE_API',
      audience: ['OPERATOR', 'AUDITOR'],
      requiredEntitlements: [
        {
          resourceType: 'APP',
          resourceKey: 'APP.HRIS',
          permissionCodes: ['VIEW', 'USE', 'LAUNCH', 'MANAGE'],
          match: 'ANY',
        },
        {
          resourceType: 'DATA',
          resourceKey: 'DATA.WORKFORCE',
          permissionCodes: ['VIEW', 'MANAGE'],
          match: 'ANY',
        },
      ],
      scope: { kind: 'ORG_UNIT', key: 'org-unit:synthetic-people' },
      horizon: 'CHANGED',
      priority: 'MEDIUM',
      freshness: { generatedAt: null, maxAgeSeconds: 300, state: 'UNKNOWN' },
      sensitivity: {
        classification: 'CONFIDENTIAL',
        projection: 'VIEW',
        exposedFields: ['asOf', 'projectionRevision', 'personId', 'workerStatus', 'businessTitle'],
      },
      state: 'AVAILABLE',
      reasonCode: null,
      primaryAction: {
        actionId: 'OPEN_PEOPLE_360',
        labelKey: 'hris.people.openCurrentSnapshot',
      },
      traceId: 'trace-synthetic-1',
    });
    expect(contribution.payload).toEqual({
      asOf: '2026-09-17',
      projectionRevision: `projection:${personId}:2026-09-17`,
      personId,
      workerStatus: 'ACTIVE',
      businessTitle: 'Synthetic Product Specialist',
    });
    expect(Object.keys(contribution.payload ?? {}).sort()).toEqual(
      [...contribution.sensitivity.exposedFields].sort()
    );
    expect(contribution.deepLink).toContain(`person=${personId}`);
    expect(JSON.stringify(contribution)).not.toContain('••••');
  });

  it('maps an owner-source PARTIAL snapshot without inventing freshness', () => {
    const partial = selectPeople360Detail(people360Snapshot({ state: 'PARTIAL' }), personId);
    const contribution = createPeople360HomeContribution(
      partial,
      { kind: 'LEGAL_ENTITY', key: 'legal-employer:synthetic' },
      null
    );
    expect(contribution).toMatchObject({
      scope: { kind: 'LEGAL_ENTITY', key: 'legal-employer:synthetic' },
      freshness: { generatedAt: null, maxAgeSeconds: 300, state: 'UNKNOWN' },
      state: 'PARTIAL',
      reasonCode: 'PEOPLE_360_SOURCE_PARTIAL',
      traceId: null,
    });
    expect(Object.keys(contribution.payload ?? {}).sort()).toEqual(
      [...contribution.sensitivity.exposedFields].sort()
    );
  });

  it('fails closed instead of routing a SELF projection through the operations contribution', () => {
    const self = selectPeople360Detail(
      people360Snapshot({ archetype: 'SELF', scope: 'SELF' }),
      personId
    );
    expect(() =>
      createPeople360HomeContribution(
        self,
        { kind: 'ORG_UNIT', key: 'org-unit:synthetic-people' },
        'trace-self'
      )
    ).toThrowError('PEOPLE_360_OPERATIONS_CONTRIBUTION_SCOPE_MISMATCH');
  });
});
