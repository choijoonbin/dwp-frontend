import { describe, expect, it, vi } from 'vitest';

import {
  buildAIExecutionPolicy,
  createAIRuntimePolicyEditor,
} from './dwaion-ai-runtime-control-model';

describe('AI runtime policy editor model', () => {
  it('builds a normalized policy without accepting administrator-authored evidence', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'route-1' });
    const editor = createAIRuntimePolicyEditor();
    editor.routes = [
      { id: 'route-1', provider: ' openai ', model: ' approved-model ', region: ' kr ' },
    ];
    editor.toolKeys = 'calendar.read, calendar.read\nmail.search';
    editor.knowledgeSources = 'work_item';
    editor.maxOutputTokens = '1200';
    editor.budgetMode = 'ENFORCED';
    editor.periodTokenLimit = '1000000';
    editor.alertThresholdPercent = '75';
    editor.requireEvaluationPass = true;
    editor.changeReason = 'Apply the approved tenant AI execution limits.';

    const result = buildAIExecutionPolicy(editor);

    expect(result.issues).toEqual([]);
    expect(result.value).toMatchObject({
      allowedModelRoutes: [
        {
          provider: 'OPENAI',
          model: 'approved-model',
          region: 'kr',
          availabilityState: 'UNVERIFIED',
          availabilityObservedAt: null,
        },
      ],
      allowedToolKeys: ['CALENDAR.READ', 'MAIL.SEARCH'],
      allowedKnowledgeSources: ['WORK_ITEM'],
      evaluationGateStatus: 'PENDING',
      evaluationObservedAt: null,
      evaluationPolicyVersion: null,
    });
    vi.unstubAllGlobals();
  });

  it('requires a hard limit for enforced mode and rejects malformed routes', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'route-1' });
    const editor = createAIRuntimePolicyEditor();
    editor.routes = [{ id: 'route-1', provider: 'bad provider', model: '', region: '' }];
    editor.budgetMode = 'ENFORCED';
    editor.periodTokenLimit = '';
    editor.changeReason = 'short';

    expect(buildAIExecutionPolicy(editor).issues).toEqual(
      expect.arrayContaining([
        'MODEL_ROUTE_INVALID',
        'PERIOD_LIMIT_REQUIRED',
        'CHANGE_REASON_REQUIRED',
      ])
    );
    vi.unstubAllGlobals();
  });

  it('enforces the owner contract limit of 50 knowledge sources', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'route-1' });
    const editor = createAIRuntimePolicyEditor();
    editor.routes = [{ id: 'route-1', provider: 'OPENAI', model: 'approved', region: '' }];
    editor.knowledgeSources = Array.from({ length: 51 }, (_, index) => `SOURCE_${index}`).join(',');
    editor.changeReason = 'Apply the reviewed tenant knowledge-source policy.';

    expect(buildAIExecutionPolicy(editor).issues).toContain('IDENTIFIER_INVALID');
    vi.unstubAllGlobals();
  });

  it('enforces the owner contract limit of 50 model routes', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'route-1' });
    const editor = createAIRuntimePolicyEditor();
    editor.routes = Array.from({ length: 51 }, (_, index) => ({
      id: `route-${index}`,
      provider: 'OPENAI',
      model: `approved-${index}`,
      region: '',
    }));
    editor.changeReason = 'Apply the reviewed tenant model-route policy.';

    expect(buildAIExecutionPolicy(editor).issues).toContain('MODEL_ROUTE_INVALID');
    vi.unstubAllGlobals();
  });
});
