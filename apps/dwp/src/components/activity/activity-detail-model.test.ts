import { describe, expect, it } from 'vitest';
import type { WorkspaceActivityEvent } from '@dwp-frontend/shared-utils';

import { activityEventDetailModel } from './activity-detail-model';

const baseEvent: WorkspaceActivityEvent = {
  id: 'activity-1',
  occurredAt: '2026-09-04T01:00:00Z',
  actor: 'person',
  actorName: 'Mina Kim',
  state: 'completed',
  title: 'Purchase request owner changed',
  summary: 'The assigned owner was updated.',
  objectType: 'WORK_ITEM',
  objectId: 'work-1',
  objectLabel: 'PO-20260904-1',
  source: 'DWP_WORKSPACE',
  auditId: null,
};

describe('activity event detail presentation', () => {
  it('separates an immutable change record state from its work status at the change', () => {
    const model = activityEventDetailModel({
      ...baseEvent,
      eventKind: 'CHANGE',
      workStatus: 'WAITING',
      dataProvenance: 'LEGACY',
      auditStatus: 'LEGACY_UNLINKED',
      sourceObservedAt: null,
      updatedAt: null,
    });

    expect(model).toMatchObject({
      kind: 'CHANGE',
      workStatusAtChange: 'WAITING',
      sourceObservedAt: null,
      updatedAt: null,
      audit: { presentation: 'LEGACY_UNLINKED', recordId: null },
      legacy: true,
      canRefreshUnknownState: false,
    });
    expect(model.executionFields).toEqual([]);
  });

  it('presents only source-backed execution snapshot fields and a restricted audit reference', () => {
    const model = activityEventDetailModel({
      ...baseEvent,
      actor: 'agent',
      actorName: 'DWAI·ON',
      state: 'unknown',
      eventKind: 'EXECUTION_SNAPSHOT',
      sourceObservedAt: '2026-09-04T01:01:00Z',
      updatedAt: '2026-09-04T01:00:30Z',
      executionId: 'run-1',
      attempt: 2,
      executionVersion: 7,
      workStatus: 'WAITING',
      tool: null,
      sourceAccess: 'AVAILABLE',
      auditStatus: 'VERIFIED',
      auditRecordId: 'audit-1',
      auditAccess: 'RESTRICTED',
      correlationId: 'correlation-1',
    });

    expect(model).toMatchObject({
      kind: 'EXECUTION_SNAPSHOT',
      sourceObservedAt: '2026-09-04T01:01:00Z',
      updatedAt: '2026-09-04T01:00:30Z',
      workStatusAtChange: null,
      audit: { presentation: 'VERIFIED_RESTRICTED', recordId: 'audit-1' },
      canRefreshUnknownState: true,
    });
    expect(model.executionFields).toEqual([
      { key: 'executionId', value: 'run-1' },
      { key: 'attempt', value: '2' },
      { key: 'executionVersion', value: '7' },
    ]);
    expect(model.sourceFields).toEqual([
      { key: 'source', value: 'DWP_WORKSPACE' },
      { key: 'sourceAccess', value: 'AVAILABLE' },
    ]);
    expect(model.traceFields).toContainEqual({ key: 'correlationId', value: 'correlation-1' });
  });

  it('never represents VERIFIED without an actual audit record as a verified link', () => {
    const model = activityEventDetailModel({
      ...baseEvent,
      eventKind: 'CHANGE',
      auditStatus: 'VERIFIED',
      auditRecordId: null,
      auditId: 'legacy-display-only-id',
    });

    expect(model.audit).toEqual({ presentation: 'NOT_LINKED', recordId: null });
    expect(model.traceFields).not.toContainEqual({
      key: 'auditId',
      value: 'legacy-display-only-id',
    });
  });

  it('omits absent optional identifiers instead of inventing placeholders', () => {
    const model = activityEventDetailModel({
      ...baseEvent,
      eventKind: 'EXECUTION_SNAPSHOT',
      objectId: null,
      tool: '   ',
      sourceEventId: '',
      correlationId: null,
      executionId: null,
      attempt: null,
      executionVersion: null,
    });

    expect(model.objectFields.map(({ key }) => key)).toEqual(['objectLabel', 'objectType']);
    expect(model.sourceFields.map(({ key }) => key)).toEqual(['source']);
    expect(model.executionFields).toEqual([]);
    expect(model.traceFields).toEqual([{ key: 'recordId', value: 'activity-1' }]);
  });
});
