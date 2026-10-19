import { describe, expect, it, vi } from 'vitest';

import { createPer004BrowserClient } from './per004-browser-client';
import { PER004_ROUTES } from './per004-contract';
import type { Per004Action } from './per004-contract';
import { projection } from './per004-contract.test';

const sample = projection();
const action = sample.items[0]!.availableActions[0]! as Per004Action;
const grant = {
  actionKey: action.actionKey,
  targetConfigurationId: action.targetConfigurationId,
  targetVersion: action.targetVersion,
  expectedObjectVersion: action.expectedObjectVersion,
  idempotencyKey: 'per004-idempotency-1234',
  expectedDecisionRevision: 'decision-7',
  purposeCode: 'HRIS_PERFORMANCE_CONFIGURATION',
  body: { reason: 'reviewed' },
} as const;

describe('PER-004 unbound browser client', () => {
  it('uses exact browser gateway paths and rejects non-closed owner responses', async () => {
    const transport = vi.fn().mockResolvedValue({ status: 200, data: sample });
    const client = createPer004BrowserClient(transport);
    await expect(client.load('PERFORMANCE')).resolves.toMatchObject({ variantKey: 'PERFORMANCE' });
    expect(transport).toHaveBeenCalledWith(PER004_ROUTES.settingsPerformance,
      { method: 'GET', headers: {} });
    expect(PER004_ROUTES.formsScales).toBe('/api/people/v1/hris/performance/workbench/forms-scales');
    transport.mockResolvedValueOnce({ status: 200, data: { ...sample, ownerPayload: {} } });
    await expect(client.load('PERFORMANCE')).rejects.toThrow('PER004_CONTRACT_INVALID');
  });

  it('posts only an exact Platform-bound descriptor with matching governed grant', async () => {
    const transport = vi.fn().mockResolvedValue({ status: 202, data: {} });
    const client = createPer004BrowserClient(transport);
    await expect(client.execute(action, grant)).resolves.toBe('SUCCEEDED');
    expect(transport).toHaveBeenCalledWith(action.resolvedHref, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': grant.idempotencyKey,
        'X-DWP-Expected-Decision-Revision': grant.expectedDecisionRevision,
        'X-Purpose-Code': grant.purposeCode,
        'X-DWP-Expected-Object-Version': '11',
      },
      body: JSON.stringify(grant.body),
    });
    const replaced = { ...action, resolvedHref: '/api/platform/v1/admin/hris/configurations/other/versions' };
    await expect(client.execute(replaced, grant)).rejects.toThrow('PER004_ACTION_INVALID');
    await expect(client.execute(action, { ...grant, targetVersion: 8 }))
      .rejects.toThrow('PER004_ACTION_GRANT_MISMATCH');
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('uses the configuration target for a synthetic create without a version CAS header', async () => {
    const transport = vi.fn().mockResolvedValue({ status: 202, data: {} });
    const client = createPer004BrowserClient(transport);
    const create: Per004Action = {
      actionKey: 'hris.action.sys.post.platform.v1.admin.hris.configurations.resource.versions',
      method: 'POST',
      targetResourceType: 'REFERENCE_CONFIGURATION',
      targetConfigurationId: action.targetConfigurationId,
      resolvedHref: `/api/platform/v1/admin/hris/configurations/${action.targetConfigurationId}/versions`,
      idempotencyPolicy: 'REQUIRED_IDEMPOTENCY_KEY',
      stepUpPolicy: 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED',
    };
    await expect(client.execute(create, { ...grant, actionKey: create.actionKey,
      targetVersion: undefined, expectedObjectVersion: undefined })).resolves.toBe('SUCCEEDED');
    expect(transport.mock.calls[0]?.[1]?.headers).not.toHaveProperty('X-DWP-Expected-Object-Version');
    expect(transport.mock.calls[0]?.[0]).toBe(create.resolvedHref);
  });
});
