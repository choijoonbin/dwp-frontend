import type { Page, Route } from '@playwright/test';

export const PLAN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
export const RUN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
export const RECEIPT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
const DELIVERY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4';
export const ATTACHMENT_CONVERSATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba0';
export const ATTACHMENT_IDS = [
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
] as const;

export async function mockAttachmentRuntime(
  page: Page,
  options: { advancedActions?: boolean } = {}
) {
  const digestByAttachmentId = new Map<string, string>();
  const deletionAttempts = new Map<string, number>();
  const detachRequests: Record<string, unknown>[] = [];
  const auditRequests: Record<string, unknown>[] = [];
  await page.route(`**/api/agent/v1/conversations/${ATTACHMENT_CONVERSATION_ID}*`, (route) => {
    const answer = attachmentAnswer('request-attachment-review');
    return success(route, {
      summary: {
        conversationId: ATTACHMENT_CONVERSATION_ID,
        title: '검증된 아키텍처, 예산, 토폴로지 첨부 근거 대조',
        locale: 'ko',
        messageCount: 2,
        agentKey: 'DWP_ASSISTANT',
        sourceSystems: ['DWAI_ON_ATTACHMENT'],
        evidenceCount: answer.citations.length,
        summaryExcerpt: answer.answer,
        lastAnswerStatus: answer.statusCode,
        retentionUntil: '2026-12-16T02:59:00Z',
        legalHold: false,
        createdAt: '2026-09-17T02:58:30Z',
        updatedAt: answer.completedAt,
        lastMessageAt: answer.completedAt,
      },
      messages: [
        {
          messageId: answer.userMessageId,
          role: 'USER',
          content: '검증된 아키텍처, 예산, 토폴로지 첨부 근거를 대조해 주세요.',
          citations: [],
          runId: answer.runId,
          statusCode: null,
          createdAt: '2026-09-17T02:58:30Z',
        },
        {
          messageId: answer.assistantMessageId,
          role: 'ASSISTANT',
          content: answer.answer,
          citations: answer.citations,
          runId: answer.runId,
          statusCode: answer.statusCode,
          createdAt: answer.completedAt,
        },
      ],
    });
  });
  await page.route('**/api/agent/v1/attachments**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (
      options.advancedActions &&
      request.method() === 'POST' &&
      path.endsWith(`/conversations/${ATTACHMENT_CONVERSATION_ID}/detach-all`)
    ) {
      const body = request.postDataJSON() as Record<string, unknown>;
      detachRequests.push(body);
      return success(route, {
        receiptId: '51515151-5151-4151-8151-515151515151',
        commandId: body.commandId,
        conversationId: ATTACHMENT_CONVERSATION_ID,
        detachedAttachments: [{ attachmentId: ATTACHMENT_IDS[0], revision: 4 }],
        integrityFingerprint: 'a'.repeat(64),
        detachedAt: '2026-09-17T03:02:00Z',
      });
    }
    if (
      options.advancedActions &&
      request.method() === 'POST' &&
      path.endsWith(`/conversations/${ATTACHMENT_CONVERSATION_ID}/audit-reports`)
    ) {
      const body = request.postDataJSON() as Record<string, unknown>;
      auditRequests.push(body);
      const reportId = '61616161-6161-4161-8161-616161616161';
      return success(route, {
        reportId,
        commandId: body.commandId,
        conversationId: ATTACHMENT_CONVERSATION_ID,
        attachmentIds: [ATTACHMENT_IDS[0]],
        contentSha256: 'b'.repeat(64),
        signatureAlgorithm: 'Ed25519',
        signature: 'signed-audit-report',
        signingKeyFingerprint: 'c'.repeat(64),
        downloadPath: `/v1/attachments/audit-reports/${reportId}/download`,
        createdAt: '2026-09-17T03:01:00Z',
      });
    }
    if (
      options.advancedActions &&
      request.method() === 'GET' &&
      path.endsWith('/audit-reports/61616161-6161-4161-8161-616161616161/download')
    ) {
      return route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: Buffer.from('signed DWAI.ON attachment audit report'),
      });
    }
    if (request.method() === 'POST' && path.endsWith('/attachments')) {
      const body = request.postDataJSON() as { sourceSha256: string; fileName: string };
      const value = attachment(body.fileName, body.sourceSha256, options.advancedActions);
      digestByAttachmentId.set(value.attachmentId, body.sourceSha256);
      return success(route, value);
    }
    if (request.method() === 'GET' && path.endsWith('/evidence')) {
      const attachmentId = path.split('/').at(-2) ?? '';
      const index = ATTACHMENT_IDS.indexOf(attachmentId as (typeof ATTACHMENT_IDS)[number]);
      if (index < 0)
        return route.fulfill({ status: 404, json: { detail: 'Attachment evidence not found.' } });
      const file = ATTACHMENT_FILES[index];
      const value = attachment(
        file.name,
        digestByAttachmentId.get(attachmentId) ?? String(index + 1).repeat(64),
        options.advancedActions
      );
      return success(route, {
        attachmentId: value.attachmentId,
        sourceSha256: value.sourceSha256,
        stages: value.stages,
        citations: value.citations,
        inspectionLog: [
          {
            eventId: ATTACHMENT_EVENT_IDS[index],
            eventType: 'ATTACHMENT_SCAN_COMPLETED',
            previousState: 'SCANNING',
            currentState: 'READY',
            revision: 3,
            safeErrorCode: null,
            occurredAt: '2026-09-17T02:58:00Z',
          },
        ],
        maskingHistory: [],
        ocrEvidence: value.citations,
      });
    }
    if (request.method() === 'DELETE') {
      const attachmentId = path.split('/').at(-1) ?? '';
      const index = ATTACHMENT_IDS.indexOf(attachmentId as (typeof ATTACHMENT_IDS)[number]);
      if (index < 0)
        return route.fulfill({ status: 404, json: { detail: 'Attachment not found.' } });
      const file = ATTACHMENT_FILES[index];
      const attempt = (deletionAttempts.get(attachmentId) ?? 0) + 1;
      deletionAttempts.set(attachmentId, attempt);
      if (attempt === 1) {
        return success(route, {
          ...attachment(
            file.name,
            digestByAttachmentId.get(attachmentId) ?? String(index + 1).repeat(64),
            options.advancedActions
          ),
          revision: 4,
          state: 'DELETION_PENDING',
          deletionAttemptCount: 1,
          deletionLastErrorCode: 'ATTACHMENT_PROVIDER_UNAVAILABLE',
          deletionReceiptId: null,
          updatedAt: '2026-09-17T02:59:30Z',
          deletedAt: null,
        });
      }
      return success(route, {
        ...attachment(
          file.name,
          digestByAttachmentId.get(attachmentId) ?? String(index + 1).repeat(64),
          options.advancedActions
        ),
        revision: 5,
        state: 'DELETED',
        updatedAt: '2026-09-17T03:00:00Z',
        deletedAt: '2026-09-17T03:00:00Z',
        deletionAttemptCount: 2,
        deletionLastErrorCode: null,
        deletionReceiptId: `provider-delete-${attachmentId}`,
      });
    }
    return route.fulfill({ status: 501, json: { detail: 'Attachment command is not mocked.' } });
  });

  await page.route('**/api/agent/v1/ask/stream', (route) => {
    const request = route.request().postDataJSON() as { requestId?: string };
    const response = attachmentAnswer(request.requestId ?? 'request-attachment-review');
    return route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: `event: result\ndata: ${JSON.stringify({ data: response })}\n\n`,
    });
  });
  return { detachRequests, auditRequests };
}

export const ATTACHMENT_FILES = [
  {
    name: 'infra-architecture-v3.4.pdf',
    mediaType: 'application/pdf',
    sizeBytes: 14_200_000,
    locator: 'page:4',
    label: '프라이빗 멀티 존 아키텍처 근거',
  },
  {
    name: 'q3-budget-simulation-draft.xlsx',
    mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sizeBytes: 4_800_000,
    locator: 'sheet:Q3 Summary!C12:F24',
    label: '3분기 예산 대조 근거',
  },
  {
    name: 'cluster-topology-diagram.png',
    mediaType: 'image/png',
    sizeBytes: 8_100_000,
    locator: 'image:block-12',
    label: '게이트웨이 토폴로지 근거',
  },
] as const;

const ATTACHMENT_EVENT_IDS = [
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc1',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc2',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc3',
] as const;

const ATTACHMENT_ALLOWED_MEDIA_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/png',
  'image/jpeg',
  'text/plain',
] as const;

function attachment(fileName: string, sourceSha256: string, advancedActions = false) {
  const index = Math.max(
    0,
    ATTACHMENT_FILES.findIndex((file) => file.name === fileName)
  );
  const file = ATTACHMENT_FILES[index];
  const capability = {
    available: true,
    configured: true,
    reasonCode: null,
    recoveryHint: null,
  };
  const unavailable = {
    available: false,
    configured: false,
    reasonCode: 'PROVIDER_NOT_CONFIGURED',
    recoveryHint: '관리자가 해당 보안 증거 제공자를 구성하고 검증해야 합니다.',
  };
  const observedAt = '2026-09-17T02:58:00Z';
  return {
    attachmentId: ATTACHMENT_IDS[index],
    conversationId: null,
    fileName,
    mediaType: file.mediaType,
    sizeBytes: file.sizeBytes,
    sourceSha256,
    revision: 3,
    state: 'READY',
    stages: [
      ['UPLOAD', 'PASSED'],
      ['AV', 'PASSED'],
      ['DLP', 'PASSED'],
      ['PARSER', 'PASSED'],
      ['OCR', 'PASSED'],
      ['INDEX', 'PASSED'],
    ].map(([key, state]) => ({
      key,
      state,
      providerCode: `${key}_OK`,
      observedAt,
      safeErrorCode: null,
      recoveryHint: null,
    })),
    citations: [
      {
        citationId: `attachment-${index + 1}-evidence-1`,
        locator: file.locator,
        label: file.label,
        contentSha256: String(index + 4).repeat(64),
      },
    ],
    retentionExpiresAt: '2026-09-18T03:00:00Z',
    capabilities: {
      upload: capability,
      antivirus: capability,
      dlp: capability,
      parser: capability,
      ocr: capability,
      index: capability,
      deletion: capability,
      detachAll: advancedActions ? capability : unavailable,
      inspectionLog: capability,
      maskingHistory: unavailable,
      ocrViewer: capability,
      signedAuditReport: advancedActions ? capability : unavailable,
      maximumFileBytes: 104_857_600,
      allowedMediaTypes: ATTACHMENT_ALLOWED_MEDIA_TYPES,
    },
    uploadTicket: null,
    createdAt: '2026-09-17T02:57:00Z',
    updatedAt: observedAt,
    deletedAt: null,
  };
}

function attachmentAnswer(requestId: string) {
  return {
    runId: 'run-attachment-review-20260917',
    auditId: 'AUD-ATTACHMENT-REVIEW-20260917',
    requestId,
    correlationId: 'correlation-attachment-review-20260917',
    conversationId: ATTACHMENT_CONVERSATION_ID,
    userMessageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbd1',
    assistantMessageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbd2',
    state: 'COMPLETED',
    answer:
      '1. 인프라 및 보안 검토\n아키텍처는 프라이빗 멀티 존 엔드포인트를 사용합니다. 토폴로지 근거에서는 게이트웨이 인그레스가 통제된 네트워크 경계 안에 있음을 확인했습니다.\n\n2. 예산 대조 분석\n검증된 워크북은 14.8% 증가를 나타내며 인용된 셀 범위가 검토 근거입니다.\n\n3. 근거 경계\n이 답변은 필수 보안 검사와 색인을 완료한 첨부 인용 3건만 사용했습니다.',
    confidence: 'HIGH',
    citations: ATTACHMENT_FILES.map((file, index) => ({
      sourceId: `src-0${index + 1}`,
      sourceType: 'ATTACHMENT',
      title: `${file.name}: ${file.label}`,
      sourceSystem: 'DWAI_ON_ATTACHMENT',
      route: null,
      occurredAt: '2026-09-17T02:58:00Z',
      excerpt: null,
    })),
    sourceCount: 3,
    policy: {
      outcome: 'ALLOW',
      riskTier: 'L1',
      code: 'READ_ONLY_GROUNDED_ANSWER',
      explanation: '검증된 세션 범위에서 읽기 전용 첨부 근거만 사용했습니다.',
      modelAllowed: true,
      mutationAllowed: false,
    },
    modelRoute: {
      state: 'COMPLETED',
      provider: 'OPENAI',
      model: 'gpt-test-2026-09-01',
      inputTokens: 1_112,
      outputTokens: 186,
      totalTokens: 1_298,
      latencyMs: 1_840,
    },
    agentRegistry: {
      entryKey: 'DWP_ASSISTANT',
      revision: 4,
      artifactVersion: 'ask-runtime-v4',
      riskTier: 'MEDIUM',
      resolution: 'ACTIVE',
    },
    statusCode: 'ANSWER_GROUNDED',
    completedAt: '2026-09-17T02:59:00Z',
  };
}

export async function mockResearchRuntime(
  page: Page,
  locale: 'en' | 'ko' = 'en',
  options: { recoveryAvailable?: boolean } = {}
) {
  const recoveryRequests: Record<string, unknown>[] = [];
  const providerUnavailable = {
    available: false,
    configured: false,
    reasonCode: 'PROVIDER_NOT_CONFIGURED',
    recoveryHint:
      locale === 'ko'
        ? '관리자에게 검증형 리서치 공급자 설정을 요청해 주세요.'
        : 'Ask an administrator to configure this governed research operation.',
  };
  const available = {
    available: true,
    configured: true,
    reasonCode: null,
    recoveryHint: null,
  };
  await page.route('**/api/agent/v1/research/**', (route) => {
    const request = route.request();
    const path = new URL(route.request().url()).pathname;
    if (
      options.recoveryAvailable &&
      request.method() === 'POST' &&
      path.endsWith(`/runs/${RUN_ID}/recovery-actions`)
    ) {
      const body = request.postDataJSON() as Record<string, unknown>;
      recoveryRequests.push(body);
      return success(route, {
        receiptId: '71717171-7171-4171-8171-717171717171',
        commandId: body.commandId,
        action: body.action,
        state: 'COMPLETED',
        runId: RUN_ID,
        sourcePlanId: PLAN_ID,
        sourcePlanRevision: 2,
        targetPlanId: '81818181-8181-4181-8181-818181818181',
        targetPlanRevision: 1,
        cachedRunId: null,
        resultSha256: null,
        sensitivity: null,
        integrityFingerprint: 'd'.repeat(64),
        completedAt: '2026-09-17T03:03:00Z',
      });
    }
    if (path.endsWith('/research/capabilities')) {
      return success(route, {
        rawExport: available,
        pdfExport: providerUnavailable,
        receiptDownload: available,
        auditDownload: available,
        fork: options.recoveryAvailable ? available : providerUnavailable,
        merge: options.recoveryAvailable ? available : providerUnavailable,
        keepLocal: options.recoveryAvailable ? available : providerUnavailable,
        sensitivityRecalculation: options.recoveryAvailable ? available : providerUnavailable,
        cacheFallback: options.recoveryAvailable ? available : providerUnavailable,
        delivery: {
          artifact: available,
          proposal: providerUnavailable,
          export: available,
          handoff: providerUnavailable,
          share: providerUnavailable,
          routine: providerUnavailable,
        },
      });
    }
    if (path.endsWith(`/plans/${PLAN_ID}`)) return success(route, researchPlan(locale));
    if (path.endsWith(`/runs/${RUN_ID}/downloads/raw`)) {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(researchRun(locale).result),
      });
    }
    if (path.endsWith(`/runs/${RUN_ID}/downloads/receipt`)) {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ receiptId: RECEIPT_ID, state: 'COMPLETED' }),
      });
    }
    if (path.endsWith(`/runs/${RUN_ID}/downloads/audit`)) {
      return route.fulfill({
        contentType: 'application/x-ndjson',
        body: `${JSON.stringify({ eventType: 'DOWNLOAD', runId: RUN_ID })}\n`,
      });
    }
    if (path.endsWith(`/runs/${RUN_ID}/deliveries`)) {
      return success(route, [
        {
          deliveryId: DELIVERY_ID,
          runId: RUN_ID,
          deliveryType: 'ARTIFACT',
          state: 'COMPLETED',
          receiptId: RECEIPT_ID,
          receipt: {
            receiptId: RECEIPT_ID,
            deliveryId: DELIVERY_ID,
            runId: RUN_ID,
            deliveryType: 'ARTIFACT',
            terminalState: 'COMPLETED',
            completedAt: '2026-09-17T02:59:30Z',
          },
          safeErrorCode: null,
          recoveryHint: null,
          createdAt: '2026-09-17T02:59:00Z',
          updatedAt: '2026-09-17T02:59:30Z',
          completedAt: '2026-09-17T02:59:30Z',
        },
      ]);
    }
    if (path.endsWith(`/runs/${RUN_ID}`)) return success(route, researchRun(locale));
    return route.fulfill({ status: 501, json: { detail: 'Research command is not mocked.' } });
  });
  return { recoveryRequests };
}

function researchPlan(locale: 'en' | 'ko' = 'en') {
  return {
    planId: PLAN_ID,
    state: 'READY',
    revision: 2,
    definition: {
      goal:
        locale === 'ko'
          ? '검증된 근거로 거버넌스 적용 인프라 대안을 비교합니다.'
          : 'Compare governed infrastructure options with verified evidence.',
      question:
        locale === 'ko'
          ? '정책 범위 안에서 검증 가치가 가장 높은 대안은 무엇입니까?'
          : 'Which option offers the best verified value within policy?',
      successCriteria: [
        locale === 'ko'
          ? '거버넌스 적용 출처를 세 개 이상 검증'
          : 'Verify at least three governed sources',
      ],
      deliverableTypes: ['REPORT', 'COMPARISON'],
      sourcePolicies: [{ sourceKey: 'WORK_ITEM', allowed: true, scope: 'Current user work scope' }],
      requireAllAllowedSources: true,
      budget: { maximumMinutes: 45, maximumSources: 30, maximumTokens: 50_000 },
    },
    createdAt: '2026-09-17T02:45:00Z',
    updatedAt: '2026-09-17T02:46:00Z',
  };
}

function researchRun(locale: 'en' | 'ko' = 'en') {
  return {
    runId: RUN_ID,
    planId: PLAN_ID,
    planRevision: 2,
    state: 'COMPLETED',
    version: 5,
    progress: {
      completedSteps: 4,
      totalSteps: 4,
      discoveredSources: 4,
      verifiedCitations: 3,
      failedSources: [],
      recoveryHint: null,
    },
    result: {
      reportMarkdown:
        locale === 'ko'
          ? '## 거버넌스 기반 권고안\n\n**대안 B**는 모든 출처를 승인된 업무 범위 안에 유지하면서 가장 높은 검증 가치를 제공합니다.\n\n### 검증 비교\n\n| 대안 | 월 비용 | 가용성 | 정책 결과 |\n| --- | ---: | ---: | --- |\n| 대안 A | $128,400 | 99.95% | 검토 |\n| 대안 B | $116,200 | 99.99% | 승인 |\n| 대안 C | $109,800 | 99.90% | 차단 |\n\n### 의사결정 근거\n\n- 대안 B는 검증된 인용 세 건으로 뒷받침됩니다.\n- 추정치는 승인된 예산 상한 이내입니다.\n- 승인되지 않은 외부 출처나 쓰기 작업을 사용하지 않았습니다.\n\n### 의사결정 가드레일\n\n> 운영 인계 전에 출처 권한과 시나리오 민감도를 다시 검증해야 합니다.\n\n완료 영수증은 이 권고안을 불변 실행 및 인용 세트에 결속합니다.'
          : '## Governed recommendation\n\n**Option B** provides the best verified value while keeping every source inside the approved work scope.\n\n### Verified comparison\n\n| Option | Monthly cost | Availability | Policy result |\n| --- | ---: | ---: | --- |\n| Option A | $128,400 | 99.95% | Review |\n| Option B | $116,200 | 99.99% | Approved |\n| Option C | $109,800 | 99.90% | Blocked |\n\n### Decision reasons\n\n- Option B is supported by three verified citations.\n- The estimate stays below the approved budget ceiling.\n- No unapproved external source or write action was used.\n\n### Decision guardrails\n\n> Revalidate source permission and scenario sensitivity before any production handoff.\n\nThe completion receipt binds this recommendation to the immutable run and citation set.',
      citations: [
        {
          citationId: 'work-item-1042',
          locator: 'work-item:1042',
          label: locale === 'ko' ? '승인된 인프라 비교' : 'Approved infrastructure comparison',
          contentSha256: '3'.repeat(64),
        },
      ],
      resultSha256: '4'.repeat(64),
    },
    receiptId: RECEIPT_ID,
    safeErrorCode: null,
    startedAt: '2026-09-17T02:47:00Z',
    createdAt: '2026-09-17T02:46:30Z',
    updatedAt: '2026-09-17T02:59:00Z',
    completedAt: '2026-09-17T02:59:00Z',
  };
}

function success(route: Route, data: unknown) {
  return route.fulfill({ json: { success: true, status: 'SUCCESS', message: 'OK', data } });
}
