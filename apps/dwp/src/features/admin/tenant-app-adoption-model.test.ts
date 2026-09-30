import { describe, expect, it } from 'vitest';

import {
  tenantAppAssignmentActions,
  tenantAppInstallationActions,
  tenantAppSeatState,
} from './tenant-app-adoption-model';

import type { TenantAppAssignment, TenantAppInstallation } from '@dwp-frontend/shared-utils';

const installation = (overrides: Partial<TenantAppInstallation> = {}): TenantAppInstallation => ({
  installationId: 'installation-1',
  productKey: 'approvals',
  appResourceKey: 'APP.APPROVALS',
  installationKind: 'INTERNAL_AUTH_CONTROLLED',
  lifecycleState: 'DRAFT',
  externalExecutorState: 'NOT_REQUIRED',
  seatCapacity: 10,
  reservedSeats: 0,
  activeSeats: 0,
  justification: 'Install the application for the tenant.',
  requestedBy: 11,
  version: 0,
  createdAt: '2026-09-29T00:00:00Z',
  updatedAt: '2026-09-29T00:00:00Z',
  allowedActions: ['SUBMIT'],
  ...overrides,
});

const assignment = (overrides: Partial<TenantAppAssignment> = {}): TenantAppAssignment => ({
  assignmentId: 'assignment-1',
  installationId: 'installation-1',
  productKey: 'approvals',
  userId: 41,
  userDisplayName: 'User 41',
  lifecycleState: 'PENDING_APPROVAL',
  seatQuantity: 1,
  sourceType: 'TENANT_DIRECT',
  externalSettlementState: 'NOT_REQUIRED',
  justification: 'Assign the application to this workforce user.',
  requestedBy: 11,
  version: 0,
  createdAt: '2026-09-29T00:00:00Z',
  updatedAt: '2026-09-29T00:00:00Z',
  allowedActions: [],
  ...overrides,
});

describe('tenant app adoption authority', () => {
  it('uses owner-authorized installation actions without inferring authority in the client', () => {
    expect(tenantAppInstallationActions(installation(), 11)).toEqual(['SUBMIT']);
    expect(
      tenantAppInstallationActions(
        installation({ lifecycleState: 'IN_REVIEW', allowedActions: [] }),
        11
      )
    ).toEqual([]);
    expect(
      tenantAppInstallationActions(
        installation({
          lifecycleState: 'IN_REVIEW',
          allowedActions: ['APPROVE', 'REJECT'],
        }),
        12
      )
    ).toEqual(['APPROVE', 'REJECT']);
    expect(
      tenantAppInstallationActions(
        installation({
          lifecycleState: 'ENABLED',
          allowedActions: ['REQUEST_ASSIGNMENT'],
        }),
        13
      )
    ).toEqual([]);
  });

  it('never offers internal activation for an external service', () => {
    expect(
      tenantAppInstallationActions(
        installation({
          lifecycleState: 'APPROVED',
          approvedBy: 12,
          installationKind: 'EXTERNAL_SERVICE',
          externalExecutorState: 'UNAVAILABLE',
          allowedActions: [],
        }),
        13
      )
    ).toEqual([]);
  });

  it('uses owner-authorized assignment actions without rebuilding permission rules', () => {
    expect(tenantAppAssignmentActions(assignment(), 11)).toEqual([]);
    expect(
      tenantAppAssignmentActions(assignment({ allowedActions: ['APPROVE', 'REJECT'] }), 12)
    ).toEqual(['APPROVE', 'REJECT']);
    expect(
      tenantAppAssignmentActions(
        assignment({
          lifecycleState: 'APPROVED',
          approvedBy: 12,
          allowedActions: ['ACTIVATE', 'REVOKE'],
        }),
        13
      )
    ).toEqual(['ACTIVATE', 'REVOKE']);
    expect(
      tenantAppAssignmentActions(
        assignment({ lifecycleState: 'ACTIVE', allowedActions: ['REVOKE'] }),
        11
      )
    ).toEqual(['REVOKE']);
  });

  it('drops unknown server actions instead of routing them to a default command', () => {
    expect(
      tenantAppInstallationActions(installation({ allowedActions: ['FUTURE_ACTION' as 'SUBMIT'] }))
    ).toEqual([]);
    expect(
      tenantAppAssignmentActions(assignment({ allowedActions: ['FUTURE_ACTION' as 'APPROVE'] }))
    ).toEqual([]);
  });

  it('distinguishes reserved-seat saturation from an unbounded contract', () => {
    expect(tenantAppSeatState(installation({ reservedSeats: 10 }))).toBe('FULL');
    expect(tenantAppSeatState(installation({ reservedSeats: 9 }))).toBe('AVAILABLE');
    expect(tenantAppSeatState(installation({ seatCapacity: null }))).toBe('UNBOUNDED');
  });
});
