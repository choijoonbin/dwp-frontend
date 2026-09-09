import { describe, expect, it } from 'vitest';
import {
  canUseWorkHubGenericAdjunct,
  canUnlinkWorkSchedule,
  canExecuteWorkHubAction,
  canUpdatePersonalWork,
  isWorkHubItemCommandReady,
  isWorkHubSourceCommandReady,
  personalTaskInputUsesUnsupportedSource,
} from './work-hub-command-authority';
import { hubItem, snapshot } from './work-hub.test-support';

const permission = (effect: 'ALLOW' | 'DENY') => ({
  resourceType: 'APP',
  resourceKey: 'APP.WORK',
  permissionCode: 'UPDATE',
  effect,
});

describe('Work command authority', () => {
  it('keeps assignment work out of every generic adjunct and personal source mutation', () => {
    const assignment = hubItem({
      key: 'WORK_ASSIGNMENT:11111111-1111-4111-8111-111111111111:',
      sourceId: 'work-assignments',
      reference: {
        sourceSystem: 'WORK_ASSIGNMENT',
        sourceReference: '11111111-1111-4111-8111-111111111111',
      },
    });

    for (const adjunct of [
      'AI',
      'ACTIVITY',
      'BATCH',
      'CALENDAR',
      'DAY_PLAN',
      'PERSONAL_TASK_SOURCE',
    ] as const) {
      expect(canUseWorkHubGenericAdjunct(assignment, adjunct)).toBe(false);
    }
    expect(canUnlinkWorkSchedule(snapshot([assignment]), assignment)).toBe(false);
    expect(
      personalTaskInputUsesUnsupportedSource({
        title: 'Personal task',
        priority: 'NORMAL',
        sourceReference: assignment.reference,
      })
    ).toBe(true);
    expect(
      personalTaskInputUsesUnsupportedSource({
        title: 'Personal task',
        priority: 'NORMAL',
        sourceReferences: [hubItem().reference, assignment.reference],
      })
    ).toBe(true);
  });

  it('requires an exact update grant and gives an explicit denial precedence', () => {
    expect(canUpdatePersonalWork([])).toBe(false);
    expect(canUpdatePersonalWork([permission('ALLOW')])).toBe(true);
    expect(canUpdatePersonalWork([permission('ALLOW'), permission('DENY')])).toBe(false);
    expect(
      canUpdatePersonalWork([
        { ...permission('ALLOW'), permissionCode: 'VIEW' },
        { ...permission('ALLOW'), resourceKey: 'APP.CALENDAR' },
      ])
    ).toBe(false);
  });

  it('never treats rows retained through an aggregate outage as command authority', () => {
    const item = hubItem();
    const unavailable = {
      ...snapshot([item]),
      completeness: 'UNAVAILABLE' as const,
      sources: [
        {
          ...snapshot([item]).sources[0],
          state: 'UNAVAILABLE' as const,
          items: [],
          receivedAt: null,
        },
      ],
    };

    expect(isWorkHubItemCommandReady(unavailable, item)).toBe(false);
    expect(canExecuteWorkHubAction(unavailable, item, 'PERSONAL_COMPLETE')).toBe(false);
    expect(canExecuteWorkHubAction(unavailable, item, 'OPEN_SOURCE')).toBe(true);
  });

  it('allows exact READY-source rows in a PARTIAL snapshot and rejects another failed source', () => {
    const personal = hubItem();
    const workspace = hubItem({
      key: 'workspace',
      sourceId: 'workspace',
      reference: { sourceSystem: 'WORKSPACE', sourceReference: 'workspace' },
      actions: [{ kind: 'WORKSPACE_COMPLETE', availability: 'AVAILABLE' }],
    });
    const partial = {
      ...snapshot([personal]),
      completeness: 'PARTIAL' as const,
      sources: [
        { ...snapshot([personal]).sources[0], hasMore: true },
        {
          sourceId: 'workspace' as const,
          state: 'UNAVAILABLE' as const,
          items: [],
          receivedAt: null,
          generatedAt: null,
          hasMore: false,
        },
      ],
    };

    expect(isWorkHubSourceCommandReady(partial, 'personal')).toBe(true);
    expect(isWorkHubSourceCommandReady(partial, 'workspace')).toBe(false);
    expect(canExecuteWorkHubAction(partial, personal, 'PERSONAL_COMPLETE')).toBe(true);
    expect(canExecuteWorkHubAction(partial, workspace, 'WORKSPACE_COMPLETE')).toBe(false);
  });

  it.each([
    ['source id', { sourceId: 'workspace' as const }],
    ['version', { version: hubItem().version + 1 }],
    ['lifecycle', { lifecycle: 'WAITING' as const }],
    ['status', { sourceStatus: 'WAITING' }],
    ['obligation', { reference: { ...hubItem().reference, obligationKey: 'another-obligation' } }],
  ])('rejects a reviewed item when the READY source changed its %s', (_label, changes) => {
    const reviewed = hubItem();
    const changed = { ...reviewed, ...changes };
    expect(isWorkHubItemCommandReady(snapshot([changed]), reviewed)).toBe(false);
  });

  it('checks command availability on the fresh candidate rather than the reviewed row', () => {
    const reviewed = hubItem();
    const fresh = { ...reviewed, actions: [] };

    expect(isWorkHubItemCommandReady(snapshot([fresh]), reviewed)).toBe(true);
    expect(canExecuteWorkHubAction(snapshot([fresh]), reviewed, 'PERSONAL_COMPLETE')).toBe(false);
  });

  it('rejects ambiguous source and item receipts and source-only action revocation', () => {
    const reviewed = hubItem();
    const ready = snapshot([reviewed]);
    expect(
      isWorkHubItemCommandReady(
        { ...ready, sources: [...ready.sources, ...ready.sources] },
        reviewed
      )
    ).toBe(false);
    expect(isWorkHubItemCommandReady({ ...ready, items: [reviewed, reviewed] }, reviewed)).toBe(
      false
    );
    expect(
      isWorkHubItemCommandReady(
        { ...ready, sources: [{ ...ready.sources[0]!, items: [reviewed, reviewed] }] },
        reviewed
      )
    ).toBe(false);
    expect(
      canExecuteWorkHubAction(
        { ...ready, sources: [{ ...ready.sources[0]!, items: [{ ...reviewed, actions: [] }] }] },
        reviewed,
        'PERSONAL_COMPLETE'
      )
    ).toBe(false);
  });

  it('allows schedule unlink from a PARTIAL snapshot when personal and selected sources are exact and READY', () => {
    const personal = hubItem();
    const reviewed = hubItem({
      key: 'WORKSPACE:workspace-1:',
      sourceId: 'workspace',
      reference: { sourceSystem: 'WORKSPACE', sourceReference: 'workspace-1' },
      lifecycle: 'IN_PROGRESS',
      sourceStatus: 'in-progress',
      version: 7,
    });
    const receivedAt = new Date().toISOString();
    const partial = {
      ...snapshot([personal]),
      completeness: 'PARTIAL' as const,
      items: [personal, reviewed],
      sources: [
        { ...snapshot([personal]).sources[0], hasMore: true },
        {
          sourceId: 'workspace' as const,
          state: 'READY' as const,
          items: [reviewed],
          receivedAt,
          generatedAt: receivedAt,
          hasMore: false,
        },
      ],
    };

    expect(canUnlinkWorkSchedule(partial, reviewed)).toBe(true);
    expect(
      canUnlinkWorkSchedule(
        {
          ...partial,
          sources: partial.sources.map((source) =>
            source.sourceId === 'personal'
              ? { ...source, state: 'UNAVAILABLE' as const, items: [], receivedAt: null }
              : source
          ),
        },
        reviewed
      )
    ).toBe(false);
    expect(
      canUnlinkWorkSchedule(
        {
          ...partial,
          items: [personal, { ...reviewed, sourceStatus: 'completed' }],
          sources: partial.sources.map((source) =>
            source.sourceId === 'workspace'
              ? { ...source, items: [{ ...reviewed, sourceStatus: 'completed' }] }
              : source
          ),
        },
        reviewed
      )
    ).toBe(false);
  });
});
