import type { Page } from '@playwright/test';

import { fulfillSuccess } from './shell-session';

function renderTemplateFixture(value: unknown, samples: Record<string, string>): string {
  return String(value ?? '').replace(/\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/gu, (_match, variable) =>
    samples[variable]?.trim() ? samples[variable] : `예시 ${variable}`
  );
}

export const NOTIFICATION_GOVERNANCE_PERMISSIONS = [
  {
    resourceType: 'APP',
    resourceKey: 'APP.NOTIFICATIONS',
    permissionCode: 'VIEW',
    effect: 'ALLOW' as const,
  },
  ...[
    ['ADMIN.NOTIFICATION_CONTRACT', 'VIEW'],
    ['ADMIN.NOTIFICATION_POLICY', 'VIEW'],
    ['ADMIN.NOTIFICATION_POLICY', 'MANAGE'],
    ['ADMIN.NOTIFICATION_POLICY', 'APPROVE'],
    ['ADMIN.NOTIFICATION_TEMPLATE', 'VIEW'],
    ['ADMIN.NOTIFICATION_TEMPLATE', 'MANAGE'],
    ['ADMIN.NOTIFICATION_TEMPLATE', 'APPROVE'],
  ].map(([resourceKey, permissionCode]) => ({
    resourceType: 'ADMIN',
    resourceKey,
    permissionCode,
    effect: 'ALLOW' as const,
  })),
];

const channels = [
  {
    channel: 'IN_APP',
    enabled: true,
    defaultMode: 'IMMEDIATE',
    userOverridable: true,
    maxPerWindow: 20,
  },
  {
    channel: 'EMAIL',
    enabled: false,
    defaultMode: 'DIGEST',
    userOverridable: false,
    maxPerWindow: 5,
  },
] as const;

const approvalPolicy = {
  policyId: 'policy-approvals-current',
  scopeType: 'APP',
  scopeKey: 'approvals',
  scopeLabel: '전자결재',
  source: 'TENANT_POLICY',
  state: 'PUBLISHED',
  mandatory: false,
  quietHoursBypass: false,
  digestMode: 'IMMEDIATE',
  channels,
  changeReason: '전자결재 기본 수신 정책',
  createdBy: 91,
  approvedBy: 92,
  approvedAt: '2026-09-07T04:00:00Z',
  version: '4',
  createdAt: '2026-09-07T03:00:00Z',
} as const;

const mailPolicy = {
  ...approvalPolicy,
  policyId: 'policy-mail-provider',
  scopeKey: 'mail',
  scopeLabel: '메일',
  source: 'PROVIDER_POLICY',
  changeReason: 'Provider 메일 기본 수신 정책',
  version: '0',
} as const;

const workPolicy = {
  ...approvalPolicy,
  policyId: 'policy-work-current',
  scopeKey: 'work',
  scopeLabel: '업무',
  changeReason: '업무 앱 기본 수신 정책',
  version: '2',
} as const;

const policyDraft = {
  ...approvalPolicy,
  policyId: 'policy-approvals-draft',
  state: 'DRAFT',
  mandatory: true,
  quietHoursBypass: true,
  channels: channels.map((channel) =>
    channel.channel === 'IN_APP' ? { ...channel, userOverridable: false } : channel
  ),
  changeReason: '긴급 결재 요청을 업무 시간 밖에도 놓치지 않도록 변경',
  createdBy: 200,
  approvedBy: null,
  approvedAt: null,
  version: '5',
  createdAt: '2026-09-08T02:30:00Z',
} as const;

const selfPolicyDraft = {
  ...workPolicy,
  policyId: 'policy-work-draft',
  state: 'DRAFT',
  changeReason: '집중 시간대 업무 알림 정책을 재검토하기 위한 초안',
  createdBy: 100,
  approvedBy: null,
  approvedAt: null,
  version: '3',
  createdAt: '2026-09-08T02:40:00Z',
} as const;

const providerContent = {
  title: '{{actorName}}님이 결재를 요청했습니다',
  preview: '{{documentTitle}} 검토가 필요합니다.',
  body: '{{documentTitle}} 문서를 {{dueAt}}까지 검토해 주세요.',
  actionLabel: '결재 검토',
};

function templateRevision({
  revisionId,
  typeVersionId,
  typeKey,
  createdBy,
  revision,
  title,
}: {
  revisionId: string;
  typeVersionId: string;
  typeKey: string;
  createdBy: number;
  revision: number;
  title: string;
}) {
  return {
    revisionId,
    typeVersionId,
    typeKey,
    appKey: 'approvals',
    channel: 'IN_APP',
    locale: 'ko',
    state: 'DRAFT',
    revision,
    content: {
      ...providerContent,
      title,
      actionLabel: '원천 업무 열기',
    },
    checksum: `sha256:${revisionId}`,
    changeReason: '업무 맥락과 마감 시각이 더 잘 보이도록 문구 개선',
    createdBy,
    approvedBy: null,
    approvedAt: null,
    approvalReason: null,
    version: String(revision),
    createdAt: '2026-09-08T03:00:00Z',
  };
}

const approvalTemplateDraft = templateRevision({
  revisionId: 'template-review-draft',
  typeVersionId: 'type-approval-v1',
  typeKey: 'APPROVAL.ACTION_REQUIRED',
  createdBy: 200,
  revision: 3,
  title: '결재 요청: {{documentTitle}}',
});

const selfTemplateDraft = templateRevision({
  revisionId: 'template-self-draft',
  typeVersionId: 'type-security-v1',
  typeKey: 'SECURITY.ACCESS_REVIEW',
  createdBy: 100,
  revision: 2,
  title: '보안 검토 요청: {{documentTitle}}',
});

const cleanTemplateVariant = {
  typeVersionId: 'type-digest-v1',
  typeKey: 'WORK.DAILY_DIGEST',
  displayName: '업무 일간 요약',
  appKey: 'work',
  appName: '업무',
  channel: 'IN_APP',
  locale: 'ko',
  allowedVariables: ['actorName', 'documentTitle', 'dueAt'],
  version: '7',
  providerDefault: {
    ...providerContent,
    title: '오늘의 업무 요약',
    body: '{{actorName}}님, 오늘 처리할 업무는 {{documentTitle}}입니다.',
  },
  publishedOverride: null,
  draft: null,
  history: [],
} as const;

export async function mockNotificationAdminGovernance(page: Page) {
  const policyPreviews: Array<Record<string, unknown>> = [];
  const policyWithdrawRequests: Array<Record<string, unknown>> = [];
  const policyRejectRequests: Array<Record<string, unknown>> = [];
  const templateWithdrawRequests: Array<Record<string, unknown>> = [];
  const templateRejectRequests: Array<Record<string, unknown>> = [];
  let policyDraftActive = true;
  let selfPolicyDraftActive = true;
  let approvalTemplateDraftActive = true;
  let selfDraftActive = true;

  await page.route('**/api/notifications/v1/admin/types**', (route) => {
    const url = new URL(route.request().url());
    const allItems = [
      {
        contractId: 'contract-approval',
        typeKey: 'APPROVAL.ACTION_REQUIRED',
        displayName: '결재 조치 필요',
        description: '수신자가 결재 원천 업무에서 의사결정을 완료해야 합니다.',
        appKey: 'approvals',
        appName: '전자결재',
        ownerLabel: 'Approval Platform',
        sourceEventType: 'approval.requested.v1',
        priority: 'URGENT',
        channels: ['IN_APP'],
        mandatory: true,
        state: 'ACTIVE',
        contractHealth: 'HEALTHY',
        volume24Hours: 1842,
        minSchemaVersion: 1,
        maxSchemaVersion: 3,
        schemaVersion: 3,
        dataClassification: 'INTERNAL',
        audienceMode: 'DIRECT',
        interruptionLevel: 'TIME_SENSITIVE',
        userConfigurable: false,
        previewPolicy: 'TITLE_ONLY',
        requiredVariables: ['requestTitle', 'requesterName', 'taskId'],
        deepLinkTemplate: '/approvals/tasks/{{taskId}}',
        dedupeStrategy: 'SOURCE_EVENT_RECIPIENT',
        endEventType: 'approval.task.decided.v1',
        retentionPolicy: 'TENANT_DEFAULT_LEGAL_HOLD_AWARE',
        runbookUrl: '/notifications/admin/operations?typeKey=APPROVAL.ACTION_REQUIRED',
        version: '11',
        updatedAt: '2026-09-08T01:20:00Z',
      },
      {
        contractId: 'contract-mail',
        typeKey: 'MAIL.MENTIONED',
        displayName: '메일에서 나를 멘션',
        description: '메일 본문이나 댓글에서 현재 사용자가 멘션되었습니다.',
        appKey: 'mail',
        appName: '메일',
        ownerLabel: 'Mail Platform',
        sourceEventType: 'mail.mention.created.v2',
        priority: 'NORMAL',
        channels: ['IN_APP', 'EMAIL'],
        mandatory: false,
        state: 'IN_REVIEW',
        contractHealth: 'ATTENTION',
        volume24Hours: 94,
        minSchemaVersion: 1,
        maxSchemaVersion: 2,
        schemaVersion: 2,
        dataClassification: 'INTERNAL',
        audienceMode: 'DIRECT',
        interruptionLevel: 'ACTIVE',
        userConfigurable: true,
        previewPolicy: 'CLASSIFICATION_AWARE',
        requiredVariables: [
          'senderName',
          'messagePreview',
          'conversationName',
          'conversationId',
          'messageId',
        ],
        deepLinkTemplate: '/mail/thread/{{messageId}}',
        dedupeStrategy: 'SOURCE_EVENT_RECIPIENT',
        endEventType: null,
        retentionPolicy: 'TENANT_DEFAULT_LEGAL_HOLD_AWARE',
        runbookUrl: '/notifications/admin/operations?typeKey=MAIL.MENTIONED',
        version: '6',
        updatedAt: '2026-09-08T00:10:00Z',
      },
    ];
    const query = (url.searchParams.get('query') ?? '').toLocaleLowerCase('ko-KR');
    const appKey = url.searchParams.get('appKey');
    const state = url.searchParams.get('state');
    const items = allItems.filter(
      (item) =>
        (!query ||
          [item.typeKey, item.displayName, item.appName, item.ownerLabel]
            .join(' ')
            .toLocaleLowerCase('ko-KR')
            .includes(query)) &&
        (!appKey || item.appKey === appKey) &&
        (!state || item.state === state)
    );
    return fulfillSuccess(route, {
      partial: false,
      unavailableSources: [],
      items,
      nextCursor: null,
      hasMore: false,
    });
  });

  await page.route('**/api/notifications/v1/admin/policies**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET') {
      return fulfillSuccess(route, {
        effectivePolicies: [approvalPolicy, mailPolicy, workPolicy],
        drafts: [
          ...(policyDraftActive ? [policyDraft] : []),
          ...(selfPolicyDraftActive ? [selfPolicyDraft] : []),
        ],
        generatedAt: '2026-09-08T04:00:00Z',
      });
    }
    if (path.endsWith('/preview') && request.method() === 'POST') {
      const payload = request.postDataJSON() as Record<string, unknown>;
      policyPreviews.push(payload);
      const currentPolicy = payload.scopeKey === 'mail' ? mailPolicy : approvalPolicy;
      const simulation = (payload.simulation ?? {
        persona: 'KNOWLEDGE_WORKER',
        timeZone: 'UTC',
        localTime: '09:00',
        focusMode: false,
        quietHoursActive: false,
      }) as {
        persona: string;
        timeZone: string;
        localTime: string;
        focusMode: boolean;
        quietHoursActive: boolean;
      };
      const requestedChannels = payload.channels as Array<{
        channel: string;
        enabled: boolean;
        defaultMode: string;
        maxPerWindow?: number | null;
      }>;
      const simulatedChannels = requestedChannels.map((channel) => {
        if (!channel.enabled || channel.defaultMode === 'MUTED') {
          return { ...channel, outcome: 'SUPPRESSED', reason: 'POLICY_MUTED' };
        }
        if (simulation.quietHoursActive && payload.quietHoursBypass !== true) {
          return { ...channel, outcome: 'DEFERRED', reason: 'QUIET_HOURS' };
        }
        if (simulation.focusMode && payload.quietHoursBypass !== true) {
          return { ...channel, outcome: 'DEFERRED', reason: 'FOCUS_MODE' };
        }
        if (channel.defaultMode === 'DIGEST') {
          return { ...channel, outcome: 'DEFERRED', reason: 'DIGEST_WINDOW' };
        }
        return { ...channel, outcome: 'IMMEDIATE', reason: 'POLICY_ADMITTED' };
      });
      const outcomeCount = (outcome: string) =>
        simulatedChannels.filter((channel) => channel.outcome === outcome).length;
      const immediateChannelCount = outcomeCount('IMMEDIATE');
      return fulfillSuccess(route, {
        currentPolicy,
        proposedPolicy: {
          ...currentPolicy,
          ...payload,
          policyId: 'policy-preview',
          source: 'TENANT_POLICY',
          state: 'PREVIEW',
          version: '1',
          createdAt: '2026-09-08T04:01:00Z',
        },
        affectedTypeCount: 4,
        observedRecipients30Days: 812,
        runtimeChannels: [
          {
            channel: 'IN_APP',
            enabled: true,
            effectiveMode: 'IMMEDIATE',
            managed: true,
            userOverridable: false,
            defaultDeliveryAdmitted: true,
          },
        ],
        riskFlags: ['USER_OVERRIDE_RESTRICTED'],
        simulation: {
          context: simulation,
          channels: simulatedChannels,
          immediateChannelCount,
          deferredChannelCount: outcomeCount('DEFERRED'),
          suppressedChannelCount: outcomeCount('SUPPRESSED'),
          attentionRisk:
            payload.mandatory === true && payload.quietHoursBypass === true
              ? 'HIGH'
              : immediateChannelCount > 0
                ? 'MEDIUM'
                : 'LOW',
          providerCostState: requestedChannels.some(
            (channel) => channel.channel !== 'IN_APP' && channel.enabled
          )
            ? 'RATE_CARD_REQUIRED'
            : 'NOT_APPLICABLE',
        },
      });
    }
    if (path.endsWith('/withdraw') && request.method() === 'POST') {
      policyWithdrawRequests.push(request.postDataJSON() as Record<string, unknown>);
      selfPolicyDraftActive = false;
      return fulfillSuccess(route, { ...selfPolicyDraft, state: 'RETIRED' });
    }
    if (path.endsWith('/reject') && request.method() === 'POST') {
      policyRejectRequests.push(request.postDataJSON() as Record<string, unknown>);
      policyDraftActive = false;
      return fulfillSuccess(route, { ...policyDraft, state: 'RETIRED' });
    }
    return fulfillSuccess(route, { ...policyDraft, policyId: 'policy-new-draft' });
  });

  await page.route('**/api/notifications/v1/admin/templates**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET') {
      return fulfillSuccess(route, {
        items: [
          {
            typeVersionId: 'type-approval-v1',
            typeKey: 'APPROVAL.ACTION_REQUIRED',
            displayName: '결재 조치 필요',
            appKey: 'approvals',
            appName: '전자결재',
            channel: 'IN_APP',
            locale: 'ko',
            allowedVariables: ['actorName', 'documentTitle', 'dueAt'],
            version: '9',
            providerDefault: providerContent,
            publishedOverride: null,
            draft: approvalTemplateDraftActive ? approvalTemplateDraft : null,
            history: [],
          },
          {
            typeVersionId: 'type-security-v1',
            typeKey: 'SECURITY.ACCESS_REVIEW',
            displayName: '접근 권한 재검토',
            appKey: 'security',
            appName: '보안',
            channel: 'IN_APP',
            locale: 'ko',
            allowedVariables: ['actorName', 'documentTitle', 'dueAt'],
            version: '5',
            providerDefault: providerContent,
            publishedOverride: null,
            draft: selfDraftActive ? selfTemplateDraft : null,
            history: [],
          },
          cleanTemplateVariant,
        ],
        generatedAt: '2026-09-08T04:00:00Z',
      });
    }
    if (path.endsWith('/preview') && request.method() === 'POST') {
      const payload = request.postDataJSON() as Record<string, unknown>;
      const sampleData = (payload.sampleData ?? {}) as Record<string, string>;
      const hasMissingSamples = Object.values(sampleData).some((value) => !value.trim());
      return fulfillSuccess(route, {
        rendered: {
          title: renderTemplateFixture(payload.title, sampleData),
          preview: renderTemplateFixture(payload.preview, sampleData),
          body: renderTemplateFixture(payload.body, sampleData),
          actionLabel: renderTemplateFixture(payload.actionLabel, sampleData),
        },
        variables: ['actorName', 'documentTitle', 'dueAt'],
        warnings: hasMissingSamples
          ? ['본문의 마감 시각 변수가 샘플 데이터에서 비어 있습니다.']
          : [],
      });
    }
    if (path.endsWith('/withdraw') && request.method() === 'POST') {
      templateWithdrawRequests.push(request.postDataJSON() as Record<string, unknown>);
      selfDraftActive = false;
      return fulfillSuccess(route, { ...selfTemplateDraft, state: 'RETIRED' });
    }
    if (path.endsWith('/reject') && request.method() === 'POST') {
      templateRejectRequests.push(request.postDataJSON() as Record<string, unknown>);
      approvalTemplateDraftActive = false;
      return fulfillSuccess(route, { ...approvalTemplateDraft, state: 'RETIRED' });
    }
    return fulfillSuccess(route, approvalTemplateDraft);
  });

  return {
    policyPreviews,
    policyWithdrawRequests,
    policyRejectRequests,
    templateWithdrawRequests,
    templateRejectRequests,
  };
}
