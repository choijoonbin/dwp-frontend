import { describe, expect, it } from 'vitest';

import {
  assertAutomationCatalogProjection,
  assertAutomationCommandReceipt,
  assertAutomationRunProjection,
  automationActionsForItem,
  automationActionsForRun,
  catalogRows,
  resolveAutomationControlPlaneState,
} from './automation-control-plane-model';
import {
  AUTOMATION_FIXTURE_IDS,
  automationCatalogFixture,
  automationRunFixture,
} from './automation-control-plane-fixtures.test-support';
import {
  AUTOMATION_ACTION_KEYS,
  AUTOMATION_CONTROL_PLANE_EXPERIENCE,
} from './automation-control-plane-types';

describe('SYS-006 automation-control-plane view model', () => {
  it('pins the operational question, primary action, users, and list-detail command-center archetype', () => {
    expect(AUTOMATION_CONTROL_PLANE_EXPERIENCE).toMatchObject({
      operationalQuestion:
        'Which tenant automation needs governance intervention, and is its next transition safe and authorized?',
      pageArchetype: 'COMMAND_CENTER_LIST_DETAIL',
      customerImpactFirst: true,
      mounted: false,
    });
    expect(AUTOMATION_CONTROL_PLANE_EXPERIENCE.primaryUsers).toHaveLength(3);
    expect(AUTOMATION_CONTROL_PLANE_EXPERIENCE.primaryAction).toContain('server-authorized');
  });

  it('parses the closed catalog and derives comparison rows without losing exact resource identity', () => {
    const catalog = assertAutomationCatalogProjection(automationCatalogFixture());
    const rows = catalogRows(catalog);

    expect(Object.isFrozen(catalog)).toBe(true);
    expect(rows.map(({ resourceLabel }) => resourceLabel)).toEqual([
      'Definition',
      'Version',
      'Schedule',
    ]);
    expect(rows[0]).toMatchObject({
      key: AUTOMATION_FIXTURE_IDS.definition,
      title: 'payroll.posting',
      lifecycle: 'ACTIVE',
      redacted: false,
    });
    expect(rows[1]?.actions.map(({ actionKey }) => actionKey)).toEqual([
      AUTOMATION_ACTION_KEYS.approveVersion,
    ]);
  });

  it('enforces lifecycle, persisted target, caller descriptor, and visible-fact intersection', () => {
    const baseFixture = structuredClone(automationCatalogFixture());
    const version = baseFixture.items[1];
    if (version?.resourceType !== 'AUTOMATION_VERSION') throw new Error('fixture mismatch');
    const fixture = {
      ...baseFixture,
      items: baseFixture.items.map((item, index) =>
        index === 1
          ? {
              ...version,
              availableActions: [
                {
                  ...version.availableActions[0]!,
                  actionKey: AUTOMATION_ACTION_KEYS.activateVersion,
                  resolvedHref: `/api/platform/v1/admin/hris/automations/${AUTOMATION_FIXTURE_IDS.definition}/versions/4/activate`,
                },
              ],
            }
          : item
      ),
    };
    const catalog = assertAutomationCatalogProjection(fixture);
    expect(automationActionsForItem(catalog.items[1]!)).toEqual([]);

    const baseRestricted = structuredClone(automationCatalogFixture());
    const definition = baseRestricted.items[0];
    if (definition?.resourceType !== 'AUTOMATION_DEFINITION') throw new Error('fixture mismatch');
    const restricted = {
      ...baseRestricted,
      items: baseRestricted.items.map((item, index) =>
        index === 0
          ? {
              ...definition,
              definitionPublicId: { decision: 'MASK' as const, displayValue: '••••' as const },
              availableActions: [],
            }
          : item
      ),
    };
    const parsed = assertAutomationCatalogProjection(restricted);
    expect(automationActionsForItem(parsed.items[0]!)).toEqual([]);
    expect(catalogRows(parsed)[0]).toMatchObject({ redacted: true, title: 'payroll.posting' });
  });

  it('resolves all eight required operator states in fail-closed priority order', () => {
    const catalog = automationCatalogFixture();
    const base = {
      loading: false,
      forbidden: false,
      stepUpRequired: false,
      failed: false,
      retryable: false,
      catalog,
      now: Date.parse('2026-10-21T02:03:00Z'),
    };
    expect(resolveAutomationControlPlaneState({ ...base, loading: true })).toBe('loading');
    expect(
      resolveAutomationControlPlaneState({
        ...base,
        catalog: { ...catalog, items: [] },
      })
    ).toBe('empty');
    expect(resolveAutomationControlPlaneState(base)).toBe('complete');
    expect(
      resolveAutomationControlPlaneState({
        ...base,
        now: Date.parse('2099-10-21T02:07:00Z'),
      })
    ).toBe('partial');
    expect(resolveAutomationControlPlaneState({ ...base, catalog: undefined })).toBe('unavailable');
    expect(resolveAutomationControlPlaneState({ ...base, forbidden: true })).toBe('forbidden');
    expect(resolveAutomationControlPlaneState({ ...base, failed: true, retryable: true })).toBe(
      'retry'
    );
    expect(resolveAutomationControlPlaneState({ ...base, stepUpRequired: true })).toBe('step-up');
  });

  it('parses run attempts, items, checkpoints, and only exposes an eligible bound retry', () => {
    const run = assertAutomationRunProjection(automationRunFixture());
    expect(run.attempts).toHaveLength(1);
    expect(run.items[0]).toMatchObject({
      state: 'FAILED_RETRYABLE',
      effectState: 'NO_EFFECT_CONFIRMED',
    });
    expect(run.checkpoints[0]?.checkpointOrdinal).toBe(1);
    expect(automationActionsForRun(run).map(({ actionKey }) => actionKey)).toEqual([
      AUTOMATION_ACTION_KEYS.retryRun,
    ]);
  });

  it('rejects unknown catalog fields, commands on hidden facts, and inconsistent run eligibility', () => {
    expect(() =>
      assertAutomationCatalogProjection({ ...automationCatalogFixture(), surprise: true })
    ).toThrow('catalog projection is invalid');

    const baseHidden = structuredClone(automationCatalogFixture());
    const definition = baseHidden.items[0];
    if (definition?.resourceType !== 'AUTOMATION_DEFINITION') throw new Error('fixture mismatch');
    const hidden = {
      ...baseHidden,
      items: baseHidden.items.map((item, index) =>
        index === 0 ? { ...definition, automationKey: { decision: 'OMIT' as const } } : item
      ),
    };
    expect(() => assertAutomationCatalogProjection(hidden)).toThrow(
      'Restricted automation facts cannot expose actions'
    );

    const substitutedHref = structuredClone(automationCatalogFixture());
    const schedule = substitutedHref.items[2];
    if (schedule?.resourceType !== 'AUTOMATION_SCHEDULE') throw new Error('fixture mismatch');
    const mismatched = {
      ...substitutedHref,
      items: substitutedHref.items.map((item, index) =>
        index === 2
          ? {
              ...schedule,
              availableActions: [
                {
                  ...schedule.availableActions[0]!,
                  resolvedHref: `/api/platform/v1/admin/hris/automation-schedules/${AUTOMATION_FIXTURE_IDS.schedule}/approve`,
                },
              ],
            }
          : item
      ),
    };
    expect(() => assertAutomationCatalogProjection(mismatched)).toThrow(
      'resource action binding is invalid'
    );

    const run = { ...structuredClone(automationRunFixture()), retryEligibleItemCount: 0 };
    expect(() => assertAutomationRunProjection(run)).toThrow(
      'run action eligibility is inconsistent'
    );
  });

  it('rejects duplicate run actions and retry eligibility outside partial or failed states', () => {
    const duplicateBase = structuredClone(automationRunFixture());
    const duplicate = {
      ...duplicateBase,
      availableActions: [
        ...duplicateBase.availableActions,
        structuredClone(duplicateBase.availableActions[0]!),
      ],
    };
    expect(() => assertAutomationRunProjection(duplicate)).toThrow('run actions are not unique');

    for (const state of ['QUEUED', 'LEASED', 'RUNNING'] as const) {
      expect(() =>
        assertAutomationRunProjection({
          ...structuredClone(automationRunFixture()),
          state,
          availableActions: [],
          retryEligibleItemCount: 1,
          cancelEligibility: state === 'RUNNING' ? 'INELIGIBLE' : 'ELIGIBLE_NO_EFFECT',
        })
      ).toThrow('run action eligibility is inconsistent');
    }

    for (const state of ['SUCCEEDED', 'CANCELLED', 'DEAD_LETTER'] as const) {
      expect(() =>
        assertAutomationRunProjection({
          ...structuredClone(automationRunFixture()),
          state,
          outputDigest: 'f'.repeat(64),
          availableActions: [],
          retryEligibleItemCount: 1,
          cancelEligibility: 'INELIGIBLE',
        })
      ).toThrow('run action eligibility is inconsistent');
    }
  });

  it('accepts only a closed, paired immutable command receipt', () => {
    const receipt = {
      receiptId: AUTOMATION_FIXTURE_IDS.receipt,
      commandType: 'APPROVE_AUTOMATION_VERSION',
      originatingAction: AUTOMATION_ACTION_KEYS.approveVersion,
      subjectPrincipalPublicId: AUTOMATION_FIXTURE_IDS.subject,
      populationScopeDigest: 'd'.repeat(64),
      fieldPolicyRevision: 17,
      purposeCode: 'HRIS_SYSTEM_ADMIN',
      authorizationRevision: 41,
      status: 'SUCCEEDED',
      correlationId: AUTOMATION_FIXTURE_IDS.correlation,
      requestDigest: 'e'.repeat(64),
      createdAt: '2026-10-21T02:03:00Z',
      aggregateVersion: 8,
      resultRef: `${AUTOMATION_FIXTURE_IDS.definition}/4`,
    } as const;
    expect(assertAutomationCommandReceipt(receipt)).toEqual(receipt);
    expect(() => assertAutomationCommandReceipt({ ...receipt, resultRef: undefined })).toThrow(
      'receipt aggregate binding is invalid'
    );
    expect(() => assertAutomationCommandReceipt({ ...receipt, extra: 'open-wire' })).toThrow(
      'receipt is invalid'
    );
  });
});
