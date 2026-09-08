import { DEFAULT_APP_PERMISSIONS } from './runtime-access';
import { fulfillSuccess, mockShellSession } from './shell-session';

import type { Page } from '@playwright/test';
import type {
  PersonalWorkTask,
  PersonalWorkTaskInput,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';

/** Fictional fixtures: these assertions exercise the integrated UI, not a live tenant. */
export const WORK_HUB_FIXTURE = {
  personalId: 'b1111111-1111-4111-8111-111111111111',
  secondaryPersonalId: 'b2222222-2222-4222-8222-222222222222',
  personalTitle: 'Prepare the customer handover notes',
  secondaryTitle: 'Draft next week team checklist',
  approvalId: 'c1111111-1111-4111-8111-111111111111',
  approvalTitle: 'Review project data access',
  serviceId: 'd1111111-1111-4111-8111-111111111111',
  serviceTitle: 'Provide the laptop delivery address',
  serviceDesignTitle: 'Provide the VPN access business purpose',
  workspaceId: 'e1111111-1111-4111-8111-111111111111',
  workspaceTitle: 'Publish the verified handover package',
};

const base = '/api/platform/v1/workspace/work-hub/personal-tasks';
const stamp = '2026-09-04T00:00:00Z';

export function personalTaskRoute(taskId = WORK_HUB_FIXTURE.personalId) {
  return `/work/queue?work=PERSONAL_TASK%3A${taskId}%3A`;
}

export type WorkHubCapturedMutation = {
  path: string;
  body: { version: number; status?: PersonalWorkTask['status'] };
  idempotencyKey: string | undefined;
};

export type WorkHubCapturedCreation = {
  body: PersonalWorkTaskInput;
  idempotencyKey: string | undefined;
};

export async function mockWorkHubFoundation(
  page: Page,
  options: {
    locale?: 'ko' | 'en';
    designDetails?: boolean;
    accessReview?: boolean;
    personal?: boolean;
    sourceOwned?: boolean;
    failServices?: boolean;
    failAllSources?: boolean;
    canUpdate?: boolean;
    mode?: 'light' | 'dark';
    highContrast?: boolean;
    loseFirstMutationResponse?: boolean;
    personalTitle?: string;
    nativeWorkspace?: boolean;
  } = {}
) {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: options.mode ?? 'light' });
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale: options.locale ?? 'en',
    displayName: 'Mina Kim',
    appearance: {
      mode: options.mode ?? 'light',
      density: 'standard',
      highContrast: options.highContrast ?? false,
      reduceMotion: true,
    },
    permissions: [
      ...DEFAULT_APP_PERMISSIONS.map((permission) => ({ ...permission, effect: 'ALLOW' as const })),
      ...['APP.APPROVALS', 'APP.EMPLOYEE_SERVICES'].map((resourceKey) => ({
        resourceType: 'APP',
        resourceKey,
        permissionCode: 'VIEW',
        effect: 'ALLOW' as const,
      })),
      ...['ACTION.APPROVAL_TASK', 'ACTION.APPROVAL_REQUEST'].map((resourceKey) => ({
        resourceType: 'ACTION',
        resourceKey,
        permissionCode: 'VIEW',
        effect: 'ALLOW' as const,
      })),
      ...(options.designDetails
        ? [
            ...['VIEW', 'CREATE', 'UPDATE'].map((permissionCode) => ({
              resourceType: 'APP',
              resourceKey: 'APP.CALENDAR',
              permissionCode,
              effect: 'ALLOW' as const,
            })),
            {
              resourceType: 'APP',
              resourceKey: 'APP.EMPLOYEE_SERVICES',
              permissionCode: 'UPDATE',
              effect: 'ALLOW' as const,
            },
            ...['CLAIM', 'APPROVE', 'REJECT', 'REQUEST_INFO'].map((permissionCode) => ({
              resourceType: 'ACTION',
              resourceKey: 'ACTION.APPROVAL_TASK',
              permissionCode,
              effect: 'ALLOW' as const,
            })),
          ]
        : []),
      ...(options.canUpdate === false
        ? []
        : [
            {
              resourceType: 'APP',
              resourceKey: 'APP.WORK',
              permissionCode: 'UPDATE',
              effect: 'ALLOW' as const,
            },
          ]),
    ],
  });

  let tasks: PersonalWorkTask[] =
    options.personal === false
      ? []
      : [
          {
            taskId: WORK_HUB_FIXTURE.personalId,
            title: options.personalTitle ?? WORK_HUB_FIXTURE.personalTitle,
            description: 'Summarize the three open customer questions before the handover.',
            status: 'OPEN',
            priority: 'HIGH',
            dueAt: null,
            source: null,
            version: 4,
            createdAt: stamp,
            updatedAt: stamp,
            completedAt: null,
          },
          {
            taskId: WORK_HUB_FIXTURE.secondaryPersonalId,
            title: WORK_HUB_FIXTURE.secondaryTitle,
            description:
              'A separate low-priority task proves deep links do not select the first row.',
            status: 'OPEN',
            priority: 'LOW',
            dueAt: null,
            source: null,
            version: 0,
            createdAt: stamp,
            updatedAt: stamp,
            completedAt: null,
          },
        ];
  let approval = {
    taskId: WORK_HUB_FIXTURE.approvalId,
    requestId: 'c2222222-2222-4222-8222-222222222222',
    requestNumber: 'APR-2026-0904-001',
    title: WORK_HUB_FIXTURE.approvalTitle,
    summary: 'Read the source evidence before an approval decision.',
    workflowNameKo: '프로젝트 데이터 접근',
    workflowNameEn: 'Project data access',
    stepKey: 'SECURITY_REVIEW',
    stepName: 'Security review',
    stepSequence: 1,
    requesterName: 'Jisoo Park',
    requesterOrgName: 'Delivery',
    status: 'PENDING',
    priority: 'HIGH',
    dataClassification: 'CONFIDENTIAL',
    riskScore: 35,
    submittedAt: stamp,
    dueAt: null,
    version: 2,
  };
  let service = {
    requestId: WORK_HUB_FIXTURE.serviceId,
    requestNumber: 'SR-2026-0904-001',
    serviceKey: 'laptop-delivery',
    serviceNameKo: '업무용 기기 배송',
    serviceNameEn: 'Laptop delivery',
    summary: WORK_HUB_FIXTURE.serviceTitle,
    dataClassification: 'INTERNAL',
    status: 'AWAITING_REQUESTER',
    priority: 'NORMAL',
    assignedGroup: 'IT Service',
    assignedTo: null,
    submittedAt: stamp,
    slaDueAt: null,
    updatedAt: stamp,
    version: 3,
  };
  const designKo = options.designDetails && options.locale === 'ko';
  if (options.designDetails) {
    approval = {
      ...approval,
      requestNumber: 'APR-031',
      title: designKo ? '고객 지원 장비 구매 승인 · 1,850,000원' : approval.title,
      summary: designKo ? '고객지원 인력 증원에 따른 헤드셋 10대 구매 검토' : approval.summary,
      requesterName: designKo ? '박서진' : 'Seojin Park',
      requesterOrgName: designKo ? '고객지원본부' : 'Customer Support',
    };
    service = {
      ...service,
      requestNumber: 'SR-088',
      serviceKey: 'vpn-access',
      serviceNameKo: '원격접속(VPN) 신청',
      serviceNameEn: 'VPN access request',
      summary: designKo
        ? '원격접속(VPN) 신청의 사용 사유 보완 요청'
        : WORK_HUB_FIXTURE.serviceDesignTitle,
    };
    tasks = tasks.map((task, index) => ({
      ...task,
      title: designKo
        ? index
          ? '팀 예산 검토 메모 작성'
          : '분기 고객 안내 초안 정리'
        : task.title,
      status: index ? 'IN_PROGRESS' : 'OPEN',
      checklist: [
        {
          itemId: 'a0000000-0000-4000-8000-000000000001',
          title: designKo ? '요청 자료와 원본 확인' : 'Review source material',
          completed: true,
        },
        {
          itemId: 'a0000000-0000-4000-8000-000000000002',
          title: designKo ? '초안 작성 및 검토' : 'Draft and review',
          completed: false,
        },
      ],
      sources: [],
    }));
  }
  const sourceMutations: Array<{ path: string; body: unknown }> = [];
  const approvalDecisionEvents: Array<Record<string, unknown>> = [];
  const serviceResponseEvents: Array<Record<string, unknown>> = [];
  let serviceValues: Record<string, unknown> = { network: '', purpose: '' };
  const planSaves: Array<{
    version: number;
    items: Array<{ sourceSystem: string; sourceReference: string; obligationKey?: string | null }>;
  }> = [];
  const plans = new Map<
    string,
    { date: string; version: number; items: unknown[]; updatedAt: string | null }
  >();
  const reviewId = 'f1111111-1111-4111-8111-111111111111';
  let review = {
    workItemRef: reviewId,
    campaignName: designKo ? '2026년 3분기 정기 접근권한 검토' : 'Quarterly access review',
    dueAt: '2026-09-07T08:00:00Z',
    subjectUserId: 88,
    subjectDisplayName: designKo ? '김현수' : 'Hyunsu Kim',
    subjectEmail: 'reviewer@example.test',
    roleId: 1,
    roleCode: 'ROLE_FINANCE_READ',
    roleName: designKo ? '재무 보고 및 전표 조회 권한' : 'Finance report access',
    accessSourceType: 'DIRECT',
    assignmentCreatedAt: '2026-01-01T00:00:00Z',
    subjectLastSignInAt: '2026-09-04T09:00:00Z',
    privileged: true,
    recommendation: 'REVIEW',
    recommendationReason: 'PRIVILEGED_ROLE',
    decision: 'PENDING',
    decisionReason: null as string | null,
    decidedAt: null as string | null,
    remediationState: 'NOT_REQUIRED',
    version: 3,
  };
  const mutations: WorkHubCapturedMutation[] = [];
  const batchMutations: Array<{ body: unknown }> = [];
  const creations: WorkHubCapturedCreation[] = [];
  const failedSourceReads: string[] = [];
  const forbiddenWorkspaceMutations: string[] = [];
  const receipts = new Map<string, PersonalWorkTask>();
  let personalReads = 0;
  let releaseMutation: (() => void) | undefined;
  let nextMutationGate: Promise<void> | undefined;
  let responseLost = false;
  let failSourceReads = options.failAllSources === true;
  let nativeWorkspace = {
    workItemId: WORK_HUB_FIXTURE.workspaceId,
    id: 'WK-2026-0904-001',
    title: WORK_HUB_FIXTURE.workspaceTitle,
    summary: 'A DWP-owned task that supports atomic batch status changes.',
    type: 'TASK',
    priority: 'MEDIUM',
    status: 'IN_PROGRESS',
    owner: 'Mina Kim',
    sourceSystem: 'WORKSPACE',
    sourceReference: null,
    sourceRoute: null,
    reason: null,
    version: 1,
    updatedAt: stamp,
    capabilities: { canStart: true, canComplete: true, canWait: true },
  };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (
      path === '/api/platform/v1/workspace/work-hub/calendar-links' &&
      request.method() === 'GET'
    ) {
      return fulfillSuccess(route, {
        items: [],
        page: Number(url.searchParams.get('page') ?? 0),
        size: Number(url.searchParams.get('size') ?? 100),
        totalElements: 0,
        hasMore: false,
      });
    }
    if (
      failSourceReads &&
      request.method() === 'GET' &&
      (path === '/api/platform/v1/workspace/work-items' ||
        path === '/api/approvals/v1/tasks' ||
        path === '/api/approvals/v1/requests' ||
        path === '/api/platform/v1/services/requests' ||
        path === base)
    ) {
      failedSourceReads.push(`${path}${url.search}`);
      return route.fulfill({
        status: 503,
        json: { status: 'ERROR', message: 'Work source temporarily unavailable' },
      });
    }
    if (path === '/api/platform/v1/workspace/work-items') {
      const items = [
        ...(options.nativeWorkspace ? [nativeWorkspace] : []),
        ...(options.accessReview
          ? [
              {
                ...nativeWorkspace,
                workItemId: reviewId,
                id: 'IG-014',
                title: designKo ? '재무 시스템 접근권한 정기 검토' : 'Review finance system access',
                type: 'REVIEW',
                status: review.decision === 'PENDING' ? 'DUE_SOON' : 'COMPLETED',
                sourceSystem: 'IDENTITY_GOVERNANCE',
                sourceReference: reviewId,
                capabilities: { canStart: false, canComplete: false, canWait: false },
                version: review.version,
              },
            ]
          : []),
      ];
      return fulfillSuccess(route, {
        summary: {
          total: items.length,
          dueSoon: 0,
          inProgress: nativeWorkspace.status === 'IN_PROGRESS' ? 1 : 0,
          waiting: 0,
          completed: nativeWorkspace.status === 'COMPLETED' ? 1 : 0,
        },
        items,
        generatedAt: new Date().toISOString(),
      });
    }
    if (
      path === '/api/platform/v1/workspace/work-items/batch/status' &&
      request.method() === 'PATCH'
    ) {
      const body = request.postDataJSON() as {
        items: Array<{ workItemId: string; version: number }>;
        status: 'IN_PROGRESS' | 'COMPLETED';
      };
      batchMutations.push({ body });
      if (
        body.items.length !== 1 ||
        body.items[0].workItemId !== nativeWorkspace.workItemId ||
        body.items[0].version !== nativeWorkspace.version
      ) {
        return route.fulfill({ status: 409 });
      }
      nativeWorkspace = {
        ...nativeWorkspace,
        status: body.status,
        version: nativeWorkspace.version + 1,
        updatedAt: new Date().toISOString(),
      };
      return fulfillSuccess(route, [nativeWorkspace]);
    }
    if (path.startsWith('/api/platform/v1/workspace/work-items/') && request.method() !== 'GET') {
      forbiddenWorkspaceMutations.push(path);
      return route.fulfill({
        status: 403,
        json: { status: 'ERROR', message: 'Source-owned work' },
      });
    }
    if (path === '/api/approvals/v1/tasks') {
      return fulfillSuccess(
        route,
        options.sourceOwned !== false && url.searchParams.get('view') === 'INBOX' ? [approval] : []
      );
    }
    if (path === '/api/approvals/v1/requests') return fulfillSuccess(route, []);
    if (path.startsWith(`/api/approvals/v1/tasks/${approval.taskId}`)) {
      if (request.method() !== 'GET') {
        const body = request.postDataJSON();
        sourceMutations.push({ path, body });
        if ((body.expectedVersion ?? body.version) !== approval.version)
          return route.fulfill({ status: 409 });
        approval = {
          ...approval,
          status: path.endsWith('/claim')
            ? 'CLAIMED'
            : body.decision === 'APPROVE'
              ? 'APPROVED'
              : body.decision === 'REJECT'
                ? 'REJECTED'
                : 'INFO_REQUESTED',
          version: approval.version + 1,
        };
        approvalDecisionEvents.push({
          eventId: `approval-decision-${approval.version}`,
          eventType: path.endsWith('/claim')
            ? 'TASK_CLAIMED'
            : body.decision === 'APPROVE'
              ? 'TASK_APPROVED'
              : body.decision === 'REJECT'
                ? 'TASK_REJECTED'
                : 'INFORMATION_REQUESTED',
          actorType: 'USER',
          actorDisplayName: 'Mina Kim',
          stepName: approval.stepName,
          stepSequence: approval.stepSequence,
          outcome: 'SUCCESS',
          message: body.comment,
          occurredAt: new Date().toISOString(),
        });
      }
      return fulfillSuccess(route, {
        task: approval,
        payload: options.designDetails
          ? {
              purpose: designKo
                ? '고객센터 인력 증원에 따른 상담용 장비 교체'
                : 'Customer support equipment refresh',
              amount: 1850000,
              vendor: 'DWP Supplies',
            }
          : {},
        formSchema: {
          schemaVersion: 1,
          fields: options.designDetails
            ? [
                {
                  key: 'purpose',
                  labelKo: '구매 목적',
                  labelEn: 'Purpose',
                  type: 'TEXTAREA',
                  required: true,
                },
                {
                  key: 'amount',
                  labelKo: '신청 금액',
                  labelEn: 'Amount',
                  type: 'NUMBER',
                  required: true,
                },
                {
                  key: 'vendor',
                  labelKo: '공급 업체',
                  labelEn: 'Vendor',
                  type: 'TEXT',
                  required: true,
                },
              ]
            : [],
        },
        timeline: options.designDetails
          ? [
              {
                eventId: 'approval-created',
                eventType: 'REQUEST_CREATED',
                actorType: 'USER',
                actorDisplayName: approval.requesterName,
                stepName: 'Request',
                stepSequence: 1,
                outcome: 'SUCCESS',
                occurredAt: stamp,
              },
              ...approvalDecisionEvents,
            ]
          : [],
        canClaim: false,
        canDecide: Boolean(
          options.designDetails && ['PENDING', 'CLAIMED'].includes(approval.status)
        ),
        selfApprovalBlocked: false,
      });
    }
    if (path === '/api/platform/v1/services/requests') {
      if (options.failServices)
        return route.fulfill({
          status: 503,
          json: { status: 'ERROR', message: 'Service source temporarily unavailable' },
        });
      return fulfillSuccess(route, options.sourceOwned === false ? [] : [service]);
    }
    if (path.startsWith(`/api/platform/v1/services/requests/${service.requestId}`)) {
      if (request.method() !== 'GET') {
        const body = request.postDataJSON();
        sourceMutations.push({ path, body });
        if (body.version !== service.version || service.status !== 'AWAITING_REQUESTER')
          return route.fulfill({ status: 409 });
        service = {
          ...service,
          status: 'IN_PROGRESS',
          version: service.version + 1,
          updatedAt: new Date().toISOString(),
        };
        serviceValues = { ...body.values };
        serviceResponseEvents.push({
          eventId: `service-response-${service.version}`,
          eventType: 'REQUESTER_RESPONDED',
          status: 'IN_PROGRESS',
          actorType: 'USER',
          actorId: 7,
          note: body.message,
          occurredAt: new Date().toISOString(),
        });
      }
      return fulfillSuccess(route, {
        request: service,
        values: serviceValues,
        requestSchema: {
          fields: options.designDetails
            ? [
                {
                  key: 'network',
                  labelKo: '접속 대상 리소스 / 서버망',
                  labelEn: 'Target network',
                  type: 'TEXT',
                  required: true,
                },
                {
                  key: 'purpose',
                  labelKo: '업무 목적',
                  labelEn: 'Business purpose',
                  type: 'TEXTAREA',
                  required: true,
                },
              ]
            : [],
        },
        schemaVersion: 1,
        dataClassification: 'INTERNAL',
        timeline: options.designDetails
          ? [
              {
                eventId: 'service-info',
                eventType: 'INFORMATION_REQUESTED',
                status: 'AWAITING_REQUESTER',
                actorType: 'USER',
                note: designKo
                  ? '접속 목적이 모호합니다. 구체적인 프로젝트명과 접속 대상, 수행 기간을 보완해 주세요.'
                  : 'Please specify the project, target network and intended access period.',
                occurredAt: stamp,
              },
              ...serviceResponseEvents,
            ]
          : [],
      });
    }
    if (options.accessReview && path === '/api/auth/governed-route-access/evaluate') {
      const body = request.postDataJSON();
      if (body.subject?.type === 'GOVERNED_CONTEXT')
        return fulfillSuccess(route, {
          decision: 'ALLOWED',
          decisionRevision: 'e2e-product-authority-baseline',
          context: {
            decisionRevision: 'e2e-product-authority-baseline',
            contextKey: 'work-review-fixture',
            navigationContextId: body.navigationContextId,
            accessSource: 'RELATIONSHIP',
            accessMode: 'NORMAL',
            routeGrantRef: 'review-own-grant',
            effectiveReadOnly: false,
            revalidateAt: '2026-10-01T00:00:00Z',
          },
        });
      return route.fallback();
    }
    if (options.accessReview && path.startsWith(`/api/auth/work/access-review-items/${reviewId}`)) {
      if (request.method() === 'PUT') {
        const body = request.postDataJSON();
        sourceMutations.push({ path, body });
        if (body.version !== review.version) return route.fulfill({ status: 409 });
        review = {
          ...review,
          decision: body.decision,
          decisionReason: body.reason,
          decidedAt: new Date().toISOString(),
          remediationState: body.decision === 'REVOKE' ? 'PENDING' : 'NOT_REQUIRED',
          version: review.version + 1,
        };
      }
      return fulfillSuccess(route, review);
    }
    if (path.startsWith('/api/platform/v1/workspace/work-hub/day-plans/')) {
      const date = path.slice(path.lastIndexOf('/') + 1);
      const planItem = (
        reference: { sourceSystem: string; sourceReference: string; obligationKey?: string | null },
        position: number
      ) => {
        const task = tasks.find((item) => item.taskId === reference.sourceReference);
        return {
          position,
          selectionReference: reference,
          source: task
            ? {
                availability: 'AVAILABLE',
                reference,
                title: task.title,
                status: task.status,
                sourceRoute: personalTaskRoute(task.taskId),
                dueAt: task.dueAt,
              }
            : {
                availability: 'REFERENCE_ONLY',
                reference,
                title: null,
                sourceRoute: null,
                status: null,
                dueAt: null,
              },
        };
      };
      let plan = plans.get(date) ?? {
        date,
        version: 0,
        items:
          options.designDetails && tasks[0]
            ? [planItem({ sourceSystem: 'PERSONAL_TASK', sourceReference: tasks[0].taskId }, 0)]
            : [],
        updatedAt: null,
      };
      if (request.method() === 'PUT') {
        const body = request.postDataJSON();
        planSaves.push(body);
        if (body.version !== plan.version) return route.fulfill({ status: 409 });
        plan = {
          date,
          version: plan.version + 1,
          items: body.items.map(planItem),
          updatedAt: new Date().toISOString(),
        };
        plans.set(date, plan);
      }
      return fulfillSuccess(route, plan);
    }
    if (path === base) {
      if (request.method() === 'GET') {
        personalReads += 1;
        return fulfillSuccess(route, {
          items: tasks,
          page: 0,
          size: 100,
          totalElements: tasks.length,
          hasMore: false,
        });
      }
      if (request.method() === 'POST') {
        const body = request.postDataJSON() as PersonalWorkTaskInput;
        const idempotencyKey = request.headers()['idempotency-key'];
        creations.push({ body, idempotencyKey });
        const created: PersonalWorkTask = {
          taskId: 'b3333333-3333-4333-8333-333333333333',
          title: body.title,
          description: body.description ?? null,
          status: 'OPEN',
          priority: body.priority,
          dueAt: body.dueAt ?? null,
          source: null,
          sources: [],
          checklist: body.checklist ?? [],
          version: 0,
          createdAt: stamp,
          updatedAt: stamp,
          completedAt: null,
        };
        tasks = [created, ...tasks];
        return fulfillSuccess(route, created);
      }
    }
    if (path.startsWith(`${base}/`)) {
      const [taskId, command] = path.slice(base.length + 1).split('/');
      const task = tasks.find((item) => item.taskId === taskId);
      if (!task) return route.fulfill({ status: 404 });
      if (command === 'timeline' && request.method() === 'GET') {
        return fulfillSuccess(route, {
          items: [],
          page: 0,
          size: 50,
          totalElements: 0,
          hasMore: false,
        });
      }
      if (request.method() === 'GET') return fulfillSuccess(route, task);
      const body = request.postDataJSON() as WorkHubCapturedMutation['body'];
      const idempotencyKey = request.headers()['idempotency-key'];
      mutations.push({ path, body, idempotencyKey });
      const gate = nextMutationGate;
      nextMutationGate = undefined;
      if (gate) await gate;
      const receipt = idempotencyKey ? receipts.get(idempotencyKey) : undefined;
      if (receipt) return fulfillSuccess(route, receipt);
      if (!idempotencyKey || body.version !== task.version) {
        return route.fulfill({
          status: 409,
          json: { status: 'ERROR', message: 'Version or request identity mismatch' },
        });
      }
      if (command === 'delete') {
        tasks = tasks.filter((item) => item.taskId !== taskId);
        return fulfillSuccess(route, {
          taskId,
          version: task.version + 1,
          deletedAt: new Date().toISOString(),
        });
      }
      const status =
        command === 'complete'
          ? 'COMPLETED'
          : command === 'archive'
            ? 'ARCHIVED'
            : command === 'reopen'
              ? 'OPEN'
              : (body.status ?? task.status);
      const updated: PersonalWorkTask = {
        ...task,
        ...(request.method() === 'PUT' ? request.postDataJSON() : {}),
        status,
        version: task.version + 1,
        updatedAt: new Date().toISOString(),
        completedAt: status === 'COMPLETED' ? new Date().toISOString() : null,
      };
      tasks = tasks.map((item) => (item.taskId === taskId ? updated : item));
      receipts.set(idempotencyKey, updated);
      if (options.loseFirstMutationResponse && !responseLost) {
        responseLost = true;
        return route.abort('failed');
      }
      return fulfillSuccess(route, updated);
    }
    return route.fallback();
  });

  return {
    mutations,
    sourceMutations,
    planSaves,
    batchMutations,
    creations,
    failedSourceReads,
    forbiddenWorkspaceMutations,
    get personalReads() {
      return personalReads;
    },
    holdNextMutation() {
      nextMutationGate = new Promise<void>((resolve) => {
        releaseMutation = resolve;
      });
    },
    releaseMutation() {
      releaseMutation?.();
    },
    failFutureReads() {
      failSourceReads = true;
    },
  };
}
