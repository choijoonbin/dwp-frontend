import { expect, type Locator, type Page, type Route } from '@playwright/test';

import { fulfillSuccess } from './shell-session';

type TransferSummary = {
  transferBatchId: string;
  sourceOwnerUserId: number;
  sourceOwnerDisplayName: string;
  targetOwnerUserId: number | null;
  targetOwnerDisplayName: string | null;
  disposition: 'TRANSFER' | 'RETAIN_ORPHANED';
  reasonCode: 'OFFBOARDING' | 'TEAM_REORGANIZATION' | 'OWNER_CORRECTION';
  reason: string;
  sourceReference: string;
  retentionUntil: string | null;
  transferredCount: number;
  createdAt: string;
  createdBy: number;
};

type OrphanedViewRow = {
  savedViewId: string;
  surfaceKey: string;
  name: string;
  scope: 'PERSONAL' | 'TEAM' | 'TENANT';
  ownerGroupRef: string | null;
  reassignmentBlockReason?: 'SHARED_NAME_CONFLICT' | null;
  retentionUntil: string;
  version: number;
  updatedAt: string;
};

export type CustodyWorkspaceOptions = {
  failRegisters?: boolean;
  failLifecycleHistory?: boolean;
  seedOwnershipHistory?: boolean;
  previewNameConflict?: boolean;
  conflictOnFirstExecution?: boolean;
  transferEligibilityFailureOnFirstExecution?: boolean;
  orphanConflictOnFirstExecution?: boolean;
  orphanNoLongerRetainedOnFirstExecution?: boolean;
  orphanNameConflictOnFirstExecution?: boolean;
  orphanSharedNameConflictOnFirstExecution?: boolean;
  sharedOrphanNameConflict?: boolean;
  candidateIneligibilityReason?: string;
  orphanCandidateIneligibilityReason?: string;
  orphanEligibilityFailureOnFirstExecution?: string;
};

const custodyUsers = [
  {
    tenantId: 1,
    userId: 1,
    displayName: 'Tenant Admin',
    email: 'tenant.admin@example.com',
    jobTitle: 'Tenant administrator',
    status: 'ACTIVE',
  },
  {
    tenantId: 1,
    userId: 11,
    displayName: 'Alex Former',
    email: 'alex.former@example.com',
    jobTitle: 'Former finance lead',
    status: 'INACTIVE',
  },
  {
    tenantId: 1,
    userId: 12,
    displayName: 'Jordan Owner',
    email: 'jordan.owner@example.com',
    jobTitle: 'Finance operations lead',
    status: 'ACTIVE',
  },
  {
    tenantId: 1,
    userId: 13,
    displayName: 'Taylor Invited',
    email: 'taylor.invited@example.com',
    jobTitle: 'Pending team member',
    status: 'INVITED',
  },
  {
    tenantId: 1,
    userId: 14,
    displayName: 'Casey Steward',
    email: 'casey.steward@example.com',
    jobTitle: 'Operations steward',
    status: 'ACTIVE',
  },
];

const affectedViews = [
  {
    savedViewId: '90000000-0000-0000-0000-000000000001',
    surfaceKey: 'workspace.work',
    name: 'Former owner approvals',
    scope: 'PERSONAL',
    ownerGroupRef: null,
    version: 3,
    updatedAt: '2026-08-12T09:00:00Z',
  },
  {
    savedViewId: '90000000-0000-0000-0000-000000000002',
    surfaceKey: 'workspace.activity',
    name: 'Leadership activity',
    scope: 'TEAM',
    ownerGroupRef: 'finance-operations',
    version: 1,
    updatedAt: '2026-08-12T10:00:00Z',
  },
];

async function fulfillConflict(route: Route, message: string, errorCode = 'RESOURCE_CONFLICT') {
  return route.fulfill({
    status: 409,
    contentType: 'application/json',
    body: JSON.stringify({
      status: 'ERROR',
      errorCode,
      message,
    }),
  });
}

async function fulfillEligibilityFailure(route: Route, message: string) {
  return route.fulfill({
    status: 400,
    contentType: 'application/json',
    body: JSON.stringify({
      status: 'ERROR',
      errorCode: 'SAVED_VIEW_TARGET_INELIGIBLE',
      message,
    }),
  });
}

export async function mockCustodyWorkspace(page: Page, options?: CustodyWorkspaceOptions) {
  let transfers: TransferSummary[] = options?.seedOwnershipHistory
    ? [
        {
          transferBatchId: '91000000-0000-0000-0000-000000000000',
          sourceOwnerUserId: 11,
          sourceOwnerDisplayName: 'Alex Former',
          targetOwnerUserId: 12,
          targetOwnerDisplayName: 'Jordan Owner',
          disposition: 'TRANSFER',
          reasonCode: 'OFFBOARDING',
          reason: 'Transfer approved after the documented offboarding review.',
          sourceReference: 'HR-SEED-TRANSFER',
          retentionUntil: null,
          transferredCount: 2,
          createdAt: '2026-08-13T01:01:00Z',
          createdBy: 1,
        },
      ]
    : [];
  let lifecycleActions: Record<string, unknown>[] = [];
  let previewPayload: Record<string, unknown> | null = null;
  let executionPayload: Record<string, unknown> | null = null;
  const executionPayloads: Record<string, unknown>[] = [];
  const orphanExecutionPayloads: Record<string, unknown>[] = [];
  let orphanedViews: OrphanedViewRow[] = [
    {
      savedViewId: '92000000-0000-0000-0000-000000000001',
      surfaceKey: 'workspace.activity',
      name: 'Quarterly leadership review',
      scope: 'TEAM',
      ownerGroupRef: 'finance-operations',
      reassignmentBlockReason: options?.sharedOrphanNameConflict ? 'SHARED_NAME_CONFLICT' : null,
      retentionUntil: '2026-09-30T01:30:00Z',
      version: 4,
      updatedAt: '2026-08-13T01:05:00Z',
    },
  ];

  await page.route('**/api/platform/v1/admin/saved-view-ownership/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith('/users') && request.method() === 'GET') {
      const evaluated =
        url.searchParams.has('sourceOwnerUserId') || url.searchParams.has('savedViewId');
      return fulfillSuccess(
        route,
        custodyUsers.map((user) => {
          if (!evaluated) {
            return { ...user, eligibilityStatus: 'NOT_EVALUATED', ineligibilityReasons: [] };
          }
          const evaluatedConflictReason = url.searchParams.has('savedViewId')
            ? options?.orphanCandidateIneligibilityReason
            : options?.candidateIneligibilityReason;
          const reasons =
            user.userId === 1
              ? ['SELF_ASSIGNMENT_NOT_ALLOWED']
              : user.userId === 11
                ? ['SOURCE_OWNER_NOT_SUCCESSOR']
                : user.userId === 13
                  ? ['IDENTITY_NOT_ELIGIBLE']
                  : user.userId === 12 && evaluatedConflictReason
                    ? [evaluatedConflictReason]
                    : [];
          return {
            ...user,
            eligibilityStatus: reasons.length ? 'INELIGIBLE' : 'ELIGIBLE',
            ineligibilityReasons: reasons,
          };
        })
      );
    }
    if (path.endsWith('/orphaned/actions') && request.method() === 'GET') {
      if (options?.failRegisters || options?.failLifecycleHistory) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Lifecycle history unavailable' }),
        });
      }
      return fulfillSuccess(route, lifecycleActions);
    }
    if (path.endsWith('/orphaned') && request.method() === 'GET') {
      if (options?.failRegisters) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Registry unavailable' }),
        });
      }
      return fulfillSuccess(route, orphanedViews);
    }
    if (path.endsWith('/transfers') && request.method() === 'GET') {
      if (options?.failRegisters) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR', message: 'Registry unavailable' }),
        });
      }
      return fulfillSuccess(route, transfers);
    }
    if (path.endsWith('/preview') && request.method() === 'POST') {
      previewPayload = request.postDataJSON() as Record<string, unknown>;
      const disposition = previewPayload.disposition as TransferSummary['disposition'];
      return fulfillSuccess(route, {
        sourceOwnerUserId: 11,
        disposition,
        targetOwnerUserId:
          disposition === 'TRANSFER' ? Number(previewPayload.targetOwnerUserId) : null,
        retentionUntil:
          disposition === 'RETAIN_ORPHANED' ? String(previewPayload.retentionUntil) : null,
        affectedCount: 2,
        ownershipFingerprint: 'f'.repeat(64),
        evaluatedAt: '2026-08-13T01:00:00Z',
        nameConflicts: options?.previewNameConflict
          ? [
              {
                incomingSavedViewId: affectedViews[0].savedViewId,
                incomingName: affectedViews[0].name,
                surfaceKey: affectedViews[0].surfaceKey,
                existingTargetSavedViewId: '94000000-0000-0000-0000-000000000001',
                existingTargetName: affectedViews[0].name,
              },
            ]
          : [],
        views: affectedViews,
      });
    }

    const orphanAction = path.match(/\/orphaned\/([^/]+)\/(reassign|extend-retention|archive)$/);
    if (orphanAction && request.method() === 'POST') {
      const [, savedViewId, endpoint] = orphanAction;
      const payload = request.postDataJSON() as Record<string, unknown>;
      orphanExecutionPayloads.push({ endpoint, ...payload });
      const current = orphanedViews.find((view) => view.savedViewId === savedViewId);
      if (!current) return route.fulfill({ status: 404 });
      if (options?.orphanNoLongerRetainedOnFirstExecution && orphanExecutionPayloads.length === 1) {
        orphanedViews = orphanedViews.filter((view) => view.savedViewId !== savedViewId);
        return fulfillConflict(
          route,
          'The saved view is no longer retained and cannot be changed.',
          'SAVED_VIEW_CUSTODY_STALE'
        );
      }
      if (options?.orphanConflictOnFirstExecution && orphanExecutionPayloads.length === 1) {
        orphanedViews = orphanedViews.map((view) =>
          view.savedViewId === savedViewId
            ? { ...view, version: view.version + 1, updatedAt: '2026-08-13T01:10:00Z' }
            : view
        );
        return fulfillConflict(
          route,
          'The retained saved view changed. Refresh it and retry.',
          'SAVED_VIEW_CUSTODY_STALE'
        );
      }
      if (
        options?.orphanNameConflictOnFirstExecution &&
        endpoint === 'reassign' &&
        orphanExecutionPayloads.length === 1
      ) {
        return fulfillConflict(
          route,
          'The target owner already has an active personal saved view with the same name and surface. Choose another steward.',
          'SAVED_VIEW_PERSONAL_NAME_CONFLICT'
        );
      }
      if (
        options?.orphanSharedNameConflictOnFirstExecution &&
        endpoint === 'reassign' &&
        orphanExecutionPayloads.length === 1
      ) {
        return fulfillConflict(
          route,
          'An active shared saved view with the same name and surface already exists.',
          'SAVED_VIEW_SHARED_NAME_CONFLICT'
        );
      }
      if (
        options?.orphanEligibilityFailureOnFirstExecution &&
        endpoint === 'reassign' &&
        orphanExecutionPayloads.length === 1
      ) {
        const message =
          options.orphanEligibilityFailureOnFirstExecution === 'MISSING_TEAM_MEMBERSHIP'
            ? 'The target user must belong to every team that owns an affected view.'
            : 'The target user must be a tenant shared-view administrator.';
        return fulfillEligibilityFailure(route, message);
      }

      const action =
        endpoint === 'reassign'
          ? 'REASSIGN'
          : endpoint === 'extend-retention'
            ? 'EXTEND_RETENTION'
            : 'ARCHIVE_NOW';
      const nextRetentionUntil =
        action === 'EXTEND_RETENTION' ? String(payload.retentionUntil) : null;
      const resultingVersion = current.version + 1;
      if (action === 'EXTEND_RETENTION') {
        orphanedViews = orphanedViews.map((view) =>
          view.savedViewId === savedViewId
            ? {
                ...view,
                retentionUntil: nextRetentionUntil!,
                version: resultingVersion,
                updatedAt: '2026-08-13T01:15:00Z',
              }
            : view
        );
      } else {
        orphanedViews = orphanedViews.filter((view) => view.savedViewId !== savedViewId);
      }
      const result = {
        commandId: '93000000-0000-0000-0000-000000000001',
        idempotencyKey: payload.idempotencyKey,
        savedViewId,
        savedViewName: current.name,
        surfaceKey: current.surfaceKey,
        scope: current.scope,
        action,
        targetOwnerUserId: action === 'REASSIGN' ? Number(payload.targetOwnerUserId) : null,
        targetOwnerDisplayName:
          action === 'REASSIGN'
            ? Number(payload.targetOwnerUserId) === 14
              ? 'Casey Steward'
              : 'Jordan Owner'
            : null,
        previousLifecycleState: 'ORPHANED',
        newLifecycleState:
          action === 'REASSIGN' ? 'ACTIVE' : action === 'ARCHIVE_NOW' ? 'ARCHIVED' : 'ORPHANED',
        previousRetentionUntil: current.retentionUntil,
        nextRetentionUntil,
        reasonCode: payload.reasonCode,
        reason: payload.reason,
        sourceReference: payload.sourceReference,
        requestFingerprint: 'd'.repeat(64),
        previousVersion: current.version,
        resultingVersion,
        createdAt: '2026-08-13T01:15:00Z',
        createdBy: 1,
      };
      lifecycleActions = [result, ...lifecycleActions];
      return fulfillSuccess(route, result);
    }

    if (path.endsWith('/transfers') && request.method() === 'POST') {
      executionPayload = request.postDataJSON() as Record<string, unknown>;
      executionPayloads.push(executionPayload);
      if (options?.conflictOnFirstExecution && executionPayloads.length === 1) {
        return fulfillConflict(
          route,
          'Saved-view ownership changed after preview. Refresh the plan and retry.',
          'SAVED_VIEW_CUSTODY_STALE'
        );
      }
      if (options?.transferEligibilityFailureOnFirstExecution && executionPayloads.length === 1) {
        return fulfillEligibilityFailure(
          route,
          'The selected target is no longer eligible for this ownership plan.'
        );
      }
      const completed: TransferSummary = {
        transferBatchId: '91000000-0000-0000-0000-000000000001',
        sourceOwnerUserId: 11,
        sourceOwnerDisplayName: 'Alex Former',
        targetOwnerUserId:
          executionPayload.disposition === 'TRANSFER'
            ? Number(executionPayload.targetOwnerUserId)
            : null,
        targetOwnerDisplayName:
          executionPayload.disposition === 'TRANSFER'
            ? Number(executionPayload.targetOwnerUserId) === 14
              ? 'Casey Steward'
              : 'Jordan Owner'
            : null,
        disposition: executionPayload.disposition as TransferSummary['disposition'],
        reasonCode: executionPayload.reasonCode as TransferSummary['reasonCode'],
        reason: String(executionPayload.reason),
        sourceReference: String(executionPayload.sourceReference),
        retentionUntil:
          executionPayload.disposition === 'RETAIN_ORPHANED'
            ? String(executionPayload.retentionUntil)
            : null,
        transferredCount: 2,
        createdAt: '2026-08-13T01:01:00Z',
        createdBy: 1,
      };
      transfers = [completed];
      return fulfillSuccess(route, {
        ...completed,
        idempotencyKey: executionPayload.idempotencyKey,
        ownershipFingerprint: 'f'.repeat(64),
        requestFingerprint: 'e'.repeat(64),
      });
    }
    return route.abort('failed');
  });

  return {
    get previewPayload() {
      return previewPayload;
    },
    get executionPayload() {
      return executionPayload;
    },
    get executionPayloads() {
      return executionPayloads;
    },
    get orphanExecutionPayloads() {
      return orphanExecutionPayloads;
    },
  };
}

export async function openOrphanAction(page: Page): Promise<Locator> {
  await page.getByRole('tab', { name: /Awaiting archive/ }).click();
  await page.getByRole('button', { name: 'Manage' }).click();
  const editor = page.getByRole('dialog', { name: 'Follow up a view awaiting archive' });
  await expect(editor).toBeVisible();
  return editor;
}

export async function fillOrphanEvidence(editor: Locator, reference: string, note: string) {
  await editor.getByLabel('Source document or request').fill(reference);
  await editor.getByLabel('Administrator note').fill(note);
}
