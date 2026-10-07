import { describe, expect, it } from 'vitest';

import {
  HrisSystemBoundaryError,
  buildHrisSystemWorkspaceModel,
  reconcileOwnerCommandReceipt,
  toHrisHomeEntitlements,
} from '../model/hris-system-model';

import type {
  HrisAccessGrant,
  HrisAccessSnapshot,
  HrisConfigurationProjection,
  OwnerAssignmentEvidence,
  OwnerCommandReceipt,
} from '../model/hris-system-model';

const selfDataKeys = [
  'DATA.WORKFORCE',
  'DATA.HR_TIME',
  'DATA.HR_ABSENCE',
  'DATA.HR_PAY',
  'DATA.HR_TALENT',
] as const;

function grant(overrides: Partial<HrisAccessGrant> = {}): HrisAccessGrant {
  return {
    action: 'VIEW',
    resourceType: 'PRODUCT',
    resourceKey: 'UI.MENU.HRIS',
    scopeType: 'SELF',
    scopeKey: '11',
    mutable: false,
    ...overrides,
  };
}

function access(overrides: Partial<HrisAccessSnapshot> = {}): HrisAccessSnapshot {
  return {
    tenantId: 7,
    subjectId: 11,
    evaluatedAt: '2026-09-17T03:00:00Z',
    policyVersion: 'PEP-SYS-W1-3',
    evidenceVersion: 'access-1',
    state: 'ALLOWED',
    reasonCode: 'AUTHORIZED',
    roleGroups: ['EMPLOYEE'],
    grants: [
      grant(),
      grant({ resourceKey: 'UI.WIDGET.HRIS' }),
      ...selfDataKeys.map((resourceKey) =>
        grant({ resourceType: 'DATA', resourceKey, action: 'VIEW' })
      ),
    ],
    authority: {
      appEntitled: true,
      configurationAuthority: false,
      accessGovernanceAuthority: false,
      auditAuthority: false,
      readOnly: false,
      separationOfDutiesConflict: false,
      commandAuthorizationReusable: false,
    },
    ...overrides,
  };
}

function projection(
  overrides: Partial<HrisConfigurationProjection> = {}
): HrisConfigurationProjection {
  return {
    tenantId: 7,
    subjectId: 11,
    evaluatedAt: '2026-09-17T03:00:00Z',
    projectionVersion: 'projection-1',
    state: 'COMPLETE',
    readOnly: false,
    commandAuthorizationReusable: false,
    allowedActions: ['VIEW_PROJECTION'],
    menus: [
      {
        navigationKey: 'hr',
        itemType: 'GROUP',
        label: 'Human resources',
        children: [
          {
            navigationKey: 'hr.self',
            itemType: 'APP',
            label: 'My HR',
            route: '/hr/me',
            children: [],
          },
        ],
      },
    ],
    widgets: [
      {
        templateId: 'template-1',
        templateKey: 'employee-home',
        templateName: 'Employee home',
        widgetKey: 'hris-profile',
        size: 'medium',
        height: 'standard',
        templateVersion: 2,
      },
    ],
    sources: [
      { source: 'NAVIGATION', state: 'AVAILABLE' },
      { source: 'HOME_TEMPLATE', state: 'AVAILABLE' },
    ],
    ...overrides,
  };
}

describe('HRIS SYS authority projection', () => {
  it('adapts the employee SELF bundle to the canonical home permission vocabulary', () => {
    const entitlements = toHrisHomeEntitlements(access());

    expect(entitlements).toHaveLength(5);
    expect(entitlements.map((item) => item.resourceKey)).toEqual([...selfDataKeys].sort());
    expect(entitlements).toEqual(
      expect.arrayContaining(
        selfDataKeys.map((resourceKey) => ({
          resourceType: 'DATA',
          resourceKey,
          permissionCode: 'VIEW',
          scopeType: 'SELF',
          scopeKey: '11',
        }))
      )
    );
  });

  it('accepts custom-role grants in the same resource/action/scope vocabulary', () => {
    const custom = access({
      roleGroups: ['EMPLOYEE', 'MANAGER'],
      grants: [
        ...access().grants,
        grant({
          resourceType: 'DATA',
          resourceKey: 'DATA.WORKFORCE',
          action: 'VIEW',
          scopeType: 'TEAM',
          scopeKey: 'ASSIGNED',
        }),
      ],
    });

    expect(toHrisHomeEntitlements(custom)).toContainEqual({
      resourceType: 'DATA',
      resourceKey: 'DATA.WORKFORCE',
      permissionCode: 'VIEW',
      scopeType: 'TEAM',
      scopeKey: 'ASSIGNED',
    });
  });

  it('does not substitute menu or widget grants for data authorization', () => {
    const presentationOnly = access({
      grants: [grant(), grant({ resourceKey: 'UI.WIDGET.HRIS' })],
    });

    expect(toHrisHomeEntitlements(presentationOnly)).toEqual([]);
    expect(buildHrisSystemWorkspaceModel(presentationOnly, projection())).toMatchObject({
      state: 'CONFIGURATION_REQUIRED',
      menus: [{ navigationKey: 'hr' }],
      homeEntitlements: [],
    });
  });

  it('drops cross-subject and cross-tenant data grants', () => {
    const crossed = access({
      grants: [
        grant({
          resourceType: 'DATA',
          resourceKey: 'DATA.WORKFORCE',
          action: 'VIEW',
          scopeType: 'SELF',
          scopeKey: '12',
        }),
        grant({
          resourceType: 'DATA',
          resourceKey: 'DATA.HR_PAY',
          action: 'VIEW',
          scopeType: 'TENANT',
          scopeKey: '8',
        }),
      ],
    });

    expect(toHrisHomeEntitlements(crossed)).toEqual([]);
  });

  it('fails closed when tenant or subject evidence is crossed', () => {
    expect(() => buildHrisSystemWorkspaceModel(access(), projection({ tenantId: 8 }))).toThrowError(
      HrisSystemBoundaryError
    );
    expect(() =>
      buildHrisSystemWorkspaceModel(access(), projection({ subjectId: 12 }))
    ).toThrowError('TENANT_MISMATCH');
  });

  it('removes stale and revoked widgets even if a payload still contains them', () => {
    for (const state of ['STALE', 'REVOKED'] as const) {
      const model = buildHrisSystemWorkspaceModel(
        access(),
        projection({
          state: 'PARTIAL',
          sources: [
            { source: 'NAVIGATION', state: 'AVAILABLE' },
            { source: 'HOME_TEMPLATE', state },
          ],
          widgets: [
            {
              ...projection().widgets[0],
              templateLifecycle: state === 'REVOKED' ? 'REVOKED' : 'PUBLISHED',
              freshnessState: state === 'STALE' ? 'STALE' : 'CURRENT',
            },
          ],
        })
      );
      expect(model.widgets).toEqual([]);
      expect(model.state).toBe('PARTIAL');
    }
  });

  it('blocks SoD conflicts and keeps an auditor read-only', () => {
    const blocked = buildHrisSystemWorkspaceModel(
      access({
        state: 'DENIED',
        reasonCode: 'SEPARATION_OF_DUTIES_CONFLICT',
        roleGroups: [],
        grants: [],
        authority: {
          ...access().authority,
          separationOfDutiesConflict: true,
          readOnly: true,
        },
      }),
      projection()
    );
    expect(blocked).toMatchObject({ state: 'DENIED', readOnly: true, menus: [], widgets: [] });

    const auditor = buildHrisSystemWorkspaceModel(
      access({
        roleGroups: ['EMPLOYEE', 'ENTERPRISE_AUDITOR'],
        authority: { ...access().authority, auditAuthority: true, readOnly: true },
      }),
      projection({ readOnly: true })
    );
    expect(auditor.readOnly).toBe(true);
    expect(auditor.configurationActions).toEqual([]);
  });

  it('requires explicit presentation grants and rejects command-authority reuse', () => {
    const missing = buildHrisSystemWorkspaceModel(
      access({ grants: access().grants.filter((item) => item.resourceType === 'DATA') }),
      projection()
    );
    expect(missing).toMatchObject({ state: 'CONFIGURATION_REQUIRED', menus: [], widgets: [] });

    expect(() =>
      buildHrisSystemWorkspaceModel(
        access({ authority: { ...access().authority, commandAuthorizationReusable: true } }),
        projection()
      )
    ).toThrowError('COMMAND_AUTHORITY_REUSE');
  });
});

describe('owner request receipt reconciliation', () => {
  const receipt: OwnerCommandReceipt = {
    idempotencyKey: 'owner-request-0001',
    request: {
      presetCode: 'HCM_CONFIGURATION_OWNER',
      resourceSetId: 'resource-set-1',
      validTo: '2026-12-31T00:00:00Z',
      reviewDueAt: '2026-11-30T00:00:00Z',
    },
    status: 'RESULT_UNKNOWN',
  };
  const assignment: OwnerAssignmentEvidence = {
    ...receipt.request,
    presetAssignmentId: 'assignment-1',
    requestChannel: 'SELF_SERVICE',
    lifecycleState: 'PENDING_APPROVAL',
  };

  it('reconciles one exact owner result without resubmitting the command', () => {
    expect(reconcileOwnerCommandReceipt(receipt, [assignment])).toEqual({
      ...receipt,
      status: 'RECONCILED',
      presetAssignmentId: 'assignment-1',
    });
  });

  it('keeps RESULT_UNKNOWN when evidence is absent or ambiguous', () => {
    expect(reconcileOwnerCommandReceipt(receipt, [])).toEqual(receipt);
    expect(
      reconcileOwnerCommandReceipt(receipt, [
        assignment,
        { ...assignment, presetAssignmentId: 'assignment-2' },
      ])
    ).toEqual(receipt);
  });

  it('labels an exact confirmed receipt lookup as an idempotent replay', () => {
    expect(
      reconcileOwnerCommandReceipt(
        { ...receipt, status: 'CONFIRMED', presetAssignmentId: 'assignment-1' },
        [assignment]
      ).status
    ).toBe('REPLAYED');
  });
});
