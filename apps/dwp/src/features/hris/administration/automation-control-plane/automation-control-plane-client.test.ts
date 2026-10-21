import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type { AutomationCommand } from './automation-control-plane-types';

const transport = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: { get: transport.get, post: transport.post },
}));

import {
  AUTOMATION_COMMAND_AUTHORITY_POLICY,
  AUTOMATION_CONTROL_PLANE_OPERATION_BINDINGS,
  AutomationCommandOutcomeUnknownError,
  executeAutomationCommand,
  readAutomationCatalog,
  readAutomationRun,
} from './automation-control-plane-client';
import {
  AUTOMATION_FIXTURE_IDS,
  automationCatalogFixture,
  automationCommandFixtures,
  automationRunFixture,
} from './automation-control-plane-fixtures.test-support';
import { AUTOMATION_ACTION_KEYS, AUTOMATION_SCOPE_TYPES } from './automation-control-plane-types';

describe('SYS-006 automation-control-plane typed client', () => {
  beforeEach(() => {
    transport.get.mockReset();
    transport.post.mockReset();
  });

  it('binds exactly two data and fourteen action operations without adding a page route', () => {
    expect(AUTOMATION_CONTROL_PLANE_OPERATION_BINDINGS).toHaveLength(16);
    expect(
      AUTOMATION_CONTROL_PLANE_OPERATION_BINDINGS.filter(([method]) => method === 'GET')
    ).toHaveLength(2);
    expect(
      AUTOMATION_CONTROL_PLANE_OPERATION_BINDINGS.filter(([method]) => method === 'POST')
    ).toHaveLength(14);
    expect(
      new Set(AUTOMATION_CONTROL_PLANE_OPERATION_BINDINGS.map((binding) => binding.join(' '))).size
    ).toBe(16);
    expect(JSON.stringify(AUTOMATION_CONTROL_PLANE_OPERATION_BINDINGS)).not.toContain(
      '/hr/settings'
    );
  });

  it('pins the complete fourteen-command CAS and high-risk authority matrix', () => {
    expect(AUTOMATION_COMMAND_AUTHORITY_POLICY).toEqual({
      CREATE_DEFINITION: { requiresObjectRevision: false, highRisk: false },
      QUEUE_RUN: { requiresObjectRevision: true, highRisk: true },
      RETRY_RUN: { requiresObjectRevision: true, highRisk: true },
      CREATE_VERSION: { requiresObjectRevision: true, highRisk: false },
      VALIDATE_VERSION: { requiresObjectRevision: true, highRisk: false },
      SUBMIT_VERSION: { requiresObjectRevision: true, highRisk: false },
      APPROVE_VERSION: { requiresObjectRevision: true, highRisk: true },
      ACTIVATE_VERSION: { requiresObjectRevision: true, highRisk: true },
      CREATE_SCHEDULE: { requiresObjectRevision: true, highRisk: false },
      SUBMIT_SCHEDULE: { requiresObjectRevision: true, highRisk: false },
      APPROVE_SCHEDULE: { requiresObjectRevision: true, highRisk: true },
      ACTIVATE_SCHEDULE: { requiresObjectRevision: true, highRisk: true },
      SUSPEND_SCHEDULE: { requiresObjectRevision: true, highRisk: true },
      CANCEL_RUN: { requiresObjectRevision: true, highRisk: true },
    });
    expect(Object.values(AUTOMATION_COMMAND_AUTHORITY_POLICY)).toHaveLength(14);
    expect(
      Object.values(AUTOMATION_COMMAND_AUTHORITY_POLICY).filter(
        (policy) => policy.requiresObjectRevision
      )
    ).toHaveLength(13);
  });

  it('reads the closed catalog with required field set, freshness, scope, purpose, and correlation', async () => {
    const payload = automationCatalogFixture();
    const signal = new AbortController().signal;
    transport.get.mockResolvedValue({ data: { data: payload } });

    await expect(
      readAutomationCatalog(
        {
          asOf: '2026-10-21T02:00:00Z',
          freshness: 'ALLOW_STALE',
          limit: 25,
          filter: 'payroll',
          resourceTypes: ['AUTOMATION_DEFINITION', 'AUTOMATION_VERSION'],
        },
        {
          correlationId: AUTOMATION_FIXTURE_IDS.correlation,
          contextScopeKey: 'tenant:skax/hris-automation',
          signal,
        }
      )
    ).resolves.toEqual(payload);

    const [path, config] = transport.get.mock.calls[0];
    const requested = new URL(path, 'http://test.invalid');
    expect(requested.pathname).toBe('/api/platform/v1/admin/hris/automations');
    expect(requested.searchParams.get('asOf')).toBe('2026-10-21T02:00:00Z');
    expect(requested.searchParams.get('freshness')).toBe('ALLOW_STALE');
    expect(requested.searchParams.getAll('fields')).toHaveLength(14);
    expect(requested.searchParams.getAll('resourceTypes')).toEqual([
      'AUTOMATION_DEFINITION',
      'AUTOMATION_VERSION',
    ]);
    expect(config).toMatchObject({
      contextScopeKey: 'tenant:skax/hris-automation',
      signal,
      headers: {
        'X-Correlation-ID': AUTOMATION_FIXTURE_IDS.correlation,
        'X-Purpose-Code': 'HRIS_SYSTEM_ADMIN',
      },
    });
  });

  it('reads invariant run evidence with independently bound cursors and no field selector', async () => {
    const payload = automationRunFixture();
    transport.get.mockResolvedValue({ data: { data: payload } });

    await expect(
      readAutomationRun(
        AUTOMATION_FIXTURE_IDS.run,
        {
          asOf: '2026-10-21T02:00:00Z',
          attemptCursor: 'attempt-cursor-0001',
          itemCursor: 'item-cursor-000001',
          checkpointCursor: 'checkpoint-cursor-1',
        },
        { correlationId: AUTOMATION_FIXTURE_IDS.correlation }
      )
    ).resolves.toEqual(payload);

    const requested = new URL(transport.get.mock.calls[0][0], 'http://test.invalid');
    expect(requested.pathname).toBe(
      `/api/platform/v1/admin/hris/automation-runs/${AUTOMATION_FIXTURE_IDS.run}`
    );
    expect(requested.searchParams.has('fields')).toBe(false);
    expect(requested.searchParams.get('attemptCursor')).toBe('attempt-cursor-0001');
    expect(requested.searchParams.get('itemCursor')).toBe('item-cursor-000001');
    expect(requested.searchParams.get('checkpointCursor')).toBe('checkpoint-cursor-1');
  });

  it('submits collection create without CAS and target-bound approval with strong browser CAS', async () => {
    transport.post
      .mockResolvedValueOnce({
        data: {
          data: receipt('CREATE_AUTOMATION_DEFINITION', AUTOMATION_ACTION_KEYS.createDefinition),
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: receipt('APPROVE_AUTOMATION_VERSION', AUTOMATION_ACTION_KEYS.approveVersion),
        },
      });

    await executeAutomationCommand(
      {
        kind: 'CREATE_DEFINITION',
        body: {
          automationKey: 'payroll.posting',
          displayName: 'Payroll posting',
          description: null,
          ownerDomain: 'PAY',
        },
      },
      authority(false, false)
    );
    await executeAutomationCommand(
      {
        kind: 'APPROVE_VERSION',
        definitionPublicId: AUTOMATION_FIXTURE_IDS.definition,
        versionNumber: 4,
        body: { evidenceDigest: 'f'.repeat(64), reason: null },
      },
      authority(true, true)
    );

    expect(transport.post.mock.calls.map(([path]) => path)).toEqual([
      '/api/platform/v1/admin/hris/automations',
      `/api/platform/v1/admin/hris/automations/${AUTOMATION_FIXTURE_IDS.definition}/versions/4/approve`,
    ]);
    const createHeaders = new Headers(transport.post.mock.calls[0][2].headers);
    expect(createHeaders.get('Idempotency-Key')).toBe(AUTOMATION_FIXTURE_IDS.idempotency);
    expect(createHeaders.has('If-Match')).toBe(false);
    const approveHeaders = new Headers(transport.post.mock.calls[1][2].headers);
    expect(approveHeaders.get('If-Match')).toBe('"7"');
    expect(approveHeaders.has('X-DWP-Expected-Object-Version')).toBe(false);
    expect(approveHeaders.has('X-DWP-Step-Up-Challenge')).toBe(false);
    expect(approveHeaders.get('X-Purpose-Code')).toBe('HRIS_SYSTEM_ADMIN');
  });

  it('sends all fourteen closed owner bodies without extra fields or trusted gateway headers', async () => {
    const fixtures = automationCommandFixtures();
    for (const fixture of fixtures) {
      transport.post.mockResolvedValueOnce({
        data: { data: receipt(fixture.commandType, fixture.actionKey) },
      });
      const policy = AUTOMATION_COMMAND_AUTHORITY_POLICY[fixture.command.kind];
      await executeAutomationCommand(
        fixture.command,
        authority(policy.highRisk, policy.requiresObjectRevision)
      );
    }

    expect(transport.post).toHaveBeenCalledTimes(14);
    fixtures.forEach((fixture, index) => {
      expect(transport.post.mock.calls[index][1]).toEqual(fixture.command.body);
      const headers = new Headers(transport.post.mock.calls[index][2].headers);
      expect(headers.has('X-DWP-Step-Up-Challenge')).toBe(false);
      expect(headers.has('X-DWP-Expected-Object-Version')).toBe(false);
      expect(headers.get('If-Match')).toBe(
        AUTOMATION_COMMAND_AUTHORITY_POLICY[fixture.command.kind].requiresObjectRevision
          ? '"7"'
          : null
      );
    });

    const invalid = {
      kind: 'CREATE_DEFINITION',
      body: {
        automationKey: 'payroll.posting',
        displayName: 'Payroll posting',
        description: null,
        ownerDomain: 'PAY',
        unexpectedOwnerField: 'must-not-cross-boundary',
      },
    } as unknown as AutomationCommand;
    await expect(executeAutomationCommand(invalid, authority(false, false))).rejects.toThrow(
      'closed owner contract'
    );
    expect(transport.post).toHaveBeenCalledTimes(14);
  });

  it('closes queue and signed-version scopes to the six canonical PDX-004 values', async () => {
    expect(AUTOMATION_SCOPE_TYPES).toEqual([
      'GLOBAL',
      'TENANT',
      'LEGAL_ENTITY',
      'ORGANIZATION',
      'POPULATION',
      'SUBJECT',
    ]);

    const commands = automationCommandFixtures().map(({ command }) => command);
    const queue = commands.find(
      (command): command is Extract<AutomationCommand, { kind: 'QUEUE_RUN' }> =>
        command.kind === 'QUEUE_RUN'
    );
    const createVersion = commands.find(
      (command): command is Extract<AutomationCommand, { kind: 'CREATE_VERSION' }> =>
        command.kind === 'CREATE_VERSION'
    );
    if (!queue || !createVersion) throw new Error('fixture mismatch');
    expect(createVersion.body.allowedScopeTypes).toEqual(['LEGAL_ENTITY', 'ORGANIZATION']);

    await expect(
      executeAutomationCommand(
        {
          ...queue,
          body: { ...queue.body, scopeType: 'PAY_GROUP' },
        } as unknown as AutomationCommand,
        authority(true, true)
      )
    ).rejects.toThrow('queue scope type is outside the PDX-004 contract');
    await expect(
      executeAutomationCommand(
        {
          ...createVersion,
          body: {
            ...createVersion.body,
            allowedScopeTypes: [...AUTOMATION_SCOPE_TYPES, 'GLOBAL'],
          },
        } as unknown as AutomationCommand,
        authority(false, true)
      )
    ).rejects.toThrow('allowed scope types are outside the PDX-004 contract');
    expect(transport.post).not.toHaveBeenCalled();
  });

  it.each([
    ['an empty list', []],
    ['a duplicate within the six-item limit', ['LEGAL_ENTITY', 'LEGAL_ENTITY']],
    ['a non-canonical value within the six-item limit', ['LEGAL_ENTITY', 'PAY_GROUP']],
  ])('rejects create-version allowedScopeTypes with %s', async (_case, allowedScopeTypes) => {
    const createVersion = automationCommandFixtures()
      .map(({ command }) => command)
      .find(
        (command): command is Extract<AutomationCommand, { kind: 'CREATE_VERSION' }> =>
          command.kind === 'CREATE_VERSION'
      );
    if (!createVersion) throw new Error('fixture mismatch');

    await expect(
      executeAutomationCommand(
        {
          ...createVersion,
          body: { ...createVersion.body, allowedScopeTypes },
        } as unknown as AutomationCommand,
        authority(false, true)
      )
    ).rejects.toThrow('allowed scope types are outside the PDX-004 contract');
    expect(transport.post).not.toHaveBeenCalled();
  });

  it('rejects substituted authority before dispatch and treats an unbound receipt as outcome unknown', async () => {
    await expect(
      executeAutomationCommand(
        {
          kind: 'APPROVE_VERSION',
          definitionPublicId: AUTOMATION_FIXTURE_IDS.definition,
          versionNumber: 4,
          body: { evidenceDigest: 'f'.repeat(64), reason: null },
        },
        { ...authority(true, true), expectedObjectRevision: 8 }
      )
    ).rejects.toThrow('does not match');
    expect(transport.post).not.toHaveBeenCalled();

    transport.post.mockResolvedValue({
      data: {
        data: receipt('APPROVE_AUTOMATION_VERSION', AUTOMATION_ACTION_KEYS.activateVersion),
      },
    });
    await expect(
      executeAutomationCommand(
        {
          kind: 'APPROVE_VERSION',
          definitionPublicId: AUTOMATION_FIXTURE_IDS.definition,
          versionNumber: 4,
          body: { evidenceDigest: 'f'.repeat(64), reason: null },
        },
        authority(true, true)
      )
    ).rejects.toBeInstanceOf(AutomationCommandOutcomeUnknownError);
    expect(transport.post).toHaveBeenCalledTimes(1);
  });
});

type SecureAuthority = Extract<ProductSurfaceGovernedMutationAuthority, { mode: 'SECURE' }>;

function authority(highRisk: boolean, cas: boolean) {
  const governance: SecureAuthority = {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: 'decision-41',
    contextKey: 'hcm.configuration.automation-control-plane',
    contextScopeKey: 'tenant:skax/hris-automation',
    idempotencyKey: AUTOMATION_FIXTURE_IDS.idempotency,
    ...(cas ? { objectVersion: 7 } : {}),
    ...(highRisk
      ? {
          stepUp: {
            challenge: 'signed-automation-step-up',
            challengeId: 'automation-step-up-41',
            decisionRevision: 'decision-41',
            expiresAt: '2099-10-21T03:00:00Z',
          },
        }
      : {}),
  };
  return {
    governance,
    idempotencyKey: AUTOMATION_FIXTURE_IDS.idempotency,
    correlationId: AUTOMATION_FIXTURE_IDS.correlation,
    ...(cas ? { expectedObjectRevision: 7 } : {}),
  };
}

function receipt(commandType: string, originatingAction: string) {
  return {
    receiptId: AUTOMATION_FIXTURE_IDS.receipt,
    commandType,
    originatingAction,
    subjectPrincipalPublicId: AUTOMATION_FIXTURE_IDS.subject,
    populationScopeDigest: 'a'.repeat(64),
    fieldPolicyRevision: 17,
    purposeCode: 'HRIS_SYSTEM_ADMIN',
    authorizationRevision: 41,
    status: 'ACCEPTED',
    correlationId: AUTOMATION_FIXTURE_IDS.correlation,
    requestDigest: 'b'.repeat(64),
    createdAt: '2026-10-21T02:03:00Z',
  };
}
