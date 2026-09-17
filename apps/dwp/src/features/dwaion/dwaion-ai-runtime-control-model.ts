import type {
  AIBudgetEnforcementMode,
  EditableAIExecutionPolicy,
  TenantAIExecutionPolicy,
} from '@dwp-frontend/shared-utils';

export type AIModelRouteEditor = {
  id: string;
  provider: string;
  model: string;
  region: string;
};

export type AIRuntimePolicyEditor = {
  routes: AIModelRouteEditor[];
  toolKeys: string;
  knowledgeSources: string;
  maxOutputTokens: string;
  budgetMode: AIBudgetEnforcementMode;
  periodTokenLimit: string;
  alertThresholdPercent: string;
  requireEvaluationPass: boolean;
  changeReason: string;
};

export type AIRuntimePolicyIssue =
  | 'MODEL_ROUTE_REQUIRED'
  | 'MODEL_ROUTE_INVALID'
  | 'IDENTIFIER_INVALID'
  | 'MAX_OUTPUT_INVALID'
  | 'PERIOD_LIMIT_REQUIRED'
  | 'PERIOD_LIMIT_INVALID'
  | 'ALERT_THRESHOLD_INVALID'
  | 'CHANGE_REASON_REQUIRED';

export function createAIRuntimePolicyEditor(
  policy?: TenantAIExecutionPolicy | null
): AIRuntimePolicyEditor {
  return {
    routes: policy?.allowedModelRoutes.length
      ? policy.allowedModelRoutes.map((route) => ({
          id: crypto.randomUUID(),
          provider: route.provider,
          model: route.model,
          region: route.region ?? '',
        }))
      : [{ id: crypto.randomUUID(), provider: '', model: '', region: '' }],
    toolKeys: policy?.allowedToolKeys.join('\n') ?? '',
    knowledgeSources: policy?.allowedKnowledgeSources.join('\n') ?? '',
    maxOutputTokens: String(policy?.maxOutputTokensPerRequest ?? 900),
    budgetMode: policy?.budgetEnforcementMode ?? 'ALERT_ONLY',
    periodTokenLimit: policy?.periodTokenLimit ? String(policy.periodTokenLimit) : '',
    alertThresholdPercent: String(policy?.alertThresholdPercent ?? 80),
    requireEvaluationPass: policy?.requireEvaluationPass ?? false,
    changeReason: '',
  };
}

export function buildAIExecutionPolicy(editor: AIRuntimePolicyEditor): {
  value?: EditableAIExecutionPolicy;
  issues: AIRuntimePolicyIssue[];
} {
  const issues = new Set<AIRuntimePolicyIssue>();
  if (editor.routes.length === 0) issues.add('MODEL_ROUTE_REQUIRED');
  const routes = editor.routes.map((route) => ({
    provider: route.provider.trim().toUpperCase(),
    model: route.model.trim(),
    region: route.region.trim() || null,
    availabilityState: 'UNVERIFIED' as const,
    availabilityObservedAt: null,
  }));
  if (
    routes.length > 50 ||
    routes.some(
      (route) =>
        !/^[A-Z][A-Z0-9_]{1,39}$/u.test(route.provider) ||
        route.model.length < 1 ||
        route.model.length > 160 ||
        (route.region?.length ?? 0) > 80
    ) ||
    new Set(
      routes.map((route) => `${route.provider}\u0000${route.model}\u0000${route.region ?? ''}`)
    ).size !== routes.length
  ) {
    issues.add('MODEL_ROUTE_INVALID');
  }

  const toolKeys = identifiers(editor.toolKeys, 100);
  const knowledgeSources = identifiers(editor.knowledgeSources, 50);
  if (!toolKeys.valid || !knowledgeSources.valid) issues.add('IDENTIFIER_INVALID');

  const maxOutputTokens = integer(editor.maxOutputTokens);
  if (maxOutputTokens === null || maxOutputTokens < 128 || maxOutputTokens > 4096) {
    issues.add('MAX_OUTPUT_INVALID');
  }
  const periodTokenLimit = editor.periodTokenLimit.trim() ? integer(editor.periodTokenLimit) : null;
  if (editor.budgetMode === 'ENFORCED' && periodTokenLimit === null) {
    issues.add('PERIOD_LIMIT_REQUIRED');
  }
  if (periodTokenLimit !== null && (periodTokenLimit < 1 || periodTokenLimit > 10_000_000_000)) {
    issues.add('PERIOD_LIMIT_INVALID');
  }
  const alertThresholdPercent = integer(editor.alertThresholdPercent);
  if (alertThresholdPercent === null || alertThresholdPercent < 1 || alertThresholdPercent > 100) {
    issues.add('ALERT_THRESHOLD_INVALID');
  }
  if (editor.changeReason.trim().length < 10 || editor.changeReason.trim().length > 500) {
    issues.add('CHANGE_REASON_REQUIRED');
  }

  if (issues.size > 0) return { issues: [...issues] };
  return {
    issues: [],
    value: {
      allowedModelRoutes: routes,
      allowedToolKeys: toolKeys.values,
      allowedKnowledgeSources: knowledgeSources.values,
      maxOutputTokensPerRequest: maxOutputTokens!,
      budgetEnforcementMode: editor.budgetMode,
      periodTokenLimit,
      alertThresholdPercent: alertThresholdPercent!,
      requireEvaluationPass: editor.requireEvaluationPass,
      evaluationGateStatus: editor.requireEvaluationPass ? 'PENDING' : 'NOT_REQUIRED',
      evaluationObservedAt: null,
      evaluationPolicyVersion: null,
      changeReason: editor.changeReason.trim(),
    },
  };
}

function identifiers(value: string, maximum: number): { values: string[]; valid: boolean } {
  const values = [
    ...new Set(
      value
        .split(/[\s,]+/u)
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean)
    ),
  ];
  return {
    values,
    valid:
      values.length <= maximum && values.every((item) => /^[A-Z][A-Z0-9_.:-]{0,127}$/u.test(item)),
  };
}

function integer(value: string): number | null {
  if (!/^\d+$/u.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
