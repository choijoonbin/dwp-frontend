import { expect, test } from '@playwright/test';

import { fulfillSuccess } from './support/shell-session';
import { mockWorkHubFoundation, WORK_HUB_FIXTURE } from './support/work-hub-foundation-fixtures';

import type { Page } from '@playwright/test';
import type { ServiceRequestDetail } from '@dwp-frontend/shared-utils/api/service-center-api';

const requestId = WORK_HUB_FIXTURE.serviceId;
const requestPath = `/api/platform/v1/services/requests/${requestId}`;
const responsePath = `${requestPath}/information-response`;
const serviceRoute = `/work/queue?work=${encodeURIComponent(`SERVICE_REQUEST:${requestId}:`)}`;
const network = 'vpn.customer-support.internal';
const purpose = '고객사 장애 원인 분석과 승인된 복구 작업';
const message =
  '고객 지원 프로젝트 수행 기간에만 원격접속을 사용하고 종료 후 즉시 권한을 반납하겠습니다.';

function currentDetail(version: number, status: 'AWAITING_REQUESTER' | 'IN_PROGRESS', values = {}) {
  return {
    request: {
      requestId,
      requestNumber: 'SR-088',
      serviceKey: 'vpn-access',
      serviceNameKo: '원격접속(VPN) 신청',
      serviceNameEn: 'VPN access request',
      summary: '원격접속(VPN) 신청의 사용 사유 보완 요청',
      status,
      priority: 'NORMAL',
      assignedGroup: 'IT Service',
      assignedTo: null,
      submittedAt: '2026-09-04T00:00:00Z',
      slaDueAt: null,
      updatedAt: '2026-09-04T00:00:00Z',
      version,
    },
    values,
    requestSchema: {
      fields: [
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
      ],
    },
    schemaVersion: 1,
    dataClassification: 'INTERNAL',
    timeline: [
      {
        eventId: 'service-info',
        eventType: 'INFORMATION_REQUESTED',
        status: 'AWAITING_REQUESTER',
        actorType: 'USER',
        note: '접속 목적과 대상 서버망을 구체적으로 보완해 주세요.',
        occurredAt: '2026-09-04T00:00:00Z',
      },
    ],
  } satisfies ServiceRequestDetail;
}

async function openForm(page: Page, width: number) {
  await page.setViewportSize({ width, height: width <= 390 ? 844 : 1000 });
  await page.goto(serviceRoute);
  const form = page.getByTestId('service-information-response');
  await expect(form).toBeVisible();
  return form;
}

async function fillResponse(page: Page) {
  const form = page.getByTestId('service-information-response');
  await form.getByRole('textbox', { name: '접속 대상 리소스 / 서버망' }).fill(network);
  await form.getByRole('textbox', { name: '업무 목적' }).fill(purpose);
  await form.getByRole('textbox', { name: '담당자에게 전달할 보완 답변' }).fill(message);
  return form;
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll<HTMLElement>('body *')]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          testId: element.dataset.testid,
          className: element.className,
          text: element.textContent?.trim().slice(0, 120),
          parent: element.parentElement?.className,
          left: rect.left,
          right: rect.right,
        };
      })
      .filter(({ left, right }) => left < -1 || right > document.documentElement.clientWidth + 1)
      .slice(0, 8),
  }));
  expect(metrics.scrollWidth - metrics.clientWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(1);
}

test('Work Direct 보완 응답은 검토 전에 POST하지 않고 정확한 command/receipt로만 완료된다', async ({
  page,
}, testInfo) => {
  const runtime = await mockWorkHubFoundation(page, { locale: 'ko', designDetails: true });
  await openForm(page, 1440);
  const form = await fillResponse(page);
  await form.getByRole('button', { name: '보완 답변 검토', exact: true }).click();
  expect(runtime.sourceMutations).toHaveLength(0);
  const dialog = page.getByRole('dialog', { name: '보완 답변을 제출할까요?' });
  await expect(dialog.getByText(message, { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('work-service-response-1440-review.png'),
    fullPage: true,
  });
  const sent = page.waitForRequest(
    (request) => new URL(request.url()).pathname === responsePath && request.method() === 'POST'
  );
  await dialog.getByRole('button', { name: '보완 답변 제출', exact: true }).click();
  const request = await sent;
  const body = request.postDataJSON() as Record<string, unknown>;
  expect(body).toEqual({
    version: 3,
    values: { network, purpose },
    message,
    idempotencyKey: expect.stringMatching(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
    ),
  });
  await expect(
    page.getByText('보완 답변이 접수되었습니다. 서비스 담당자가 요청 처리를 이어갑니다.')
  ).toBeVisible();
  expect(runtime.sourceMutations).toHaveLength(1);
  await page.screenshot({
    path: testInfo.outputPath('work-service-response-1440-receipt.png'),
    fullPage: true,
  });
});

test('Work 409는 로컬 입력을 보존하고 새 version을 명시적으로 검토한 뒤에만 재제출한다', async ({
  page,
}, testInfo) => {
  await mockWorkHubFoundation(page, { locale: 'ko', designDetails: true });
  let version = 3;
  let status: 'AWAITING_REQUESTER' | 'IN_PROGRESS' = 'AWAITING_REQUESTER';
  let conflict = true;
  const writes: Array<Record<string, unknown>> = [];
  await page.route(`**${requestPath}**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'GET')
      return fulfillSuccess(route, currentDetail(version, status));
    if (path !== responsePath) return route.fallback();
    const body = route.request().postDataJSON() as Record<string, unknown>;
    writes.push(body);
    if (conflict) {
      conflict = false;
      version = 4;
      return route.fulfill({ status: 409, json: { status: 'ERROR', message: 'Conflict' } });
    }
    status = 'IN_PROGRESS';
    version += 1;
    return fulfillSuccess(
      route,
      currentDetail(version, status, body.values as Record<string, unknown>)
    );
  });
  await openForm(page, 390);
  const form = await fillResponse(page);
  await form.getByRole('button', { name: '보완 답변 검토', exact: true }).click();
  await page
    .getByRole('dialog', { name: '보완 답변을 제출할까요?' })
    .getByRole('button', { name: '보완 답변 제출', exact: true })
    .click();
  await expect(
    page.getByText('신청 내용이 변경되었습니다. 작성한 내용은 유지됩니다.', { exact: false })
  ).toBeVisible();
  await expect(form.getByRole('textbox', { name: '접속 대상 리소스 / 서버망' })).toHaveValue(
    network
  );
  await expect(form.getByRole('textbox', { name: '업무 목적' })).toHaveValue(purpose);
  await expect(form.getByRole('textbox', { name: '담당자에게 전달할 보완 답변' })).toHaveValue(
    message
  );
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('work-service-response-390-conflict.png'),
    fullPage: true,
  });
  expect(writes).toHaveLength(1);
  await form.getByRole('button', { name: '최신 신청 확인 후 작성 내용 유지', exact: true }).click();
  await form.getByRole('button', { name: '보완 답변 검토', exact: true }).click();
  await page
    .getByRole('dialog', { name: '보완 답변을 제출할까요?' })
    .getByRole('button', { name: '보완 답변 제출', exact: true })
    .click();
  await expect(
    page.getByText('보완 답변이 접수되었습니다. 서비스 담당자가 요청 처리를 이어갑니다.')
  ).toBeVisible();
  expect(writes.map((write) => write.version)).toEqual([3, 4]);
  expect(writes[0]?.idempotencyKey).not.toBe(writes[1]?.idempotencyKey);
});

test('Work에서 Services exact-action 권한이 회수되면 source POST를 보내지 않고 초안을 보존한다', async ({
  page,
}, testInfo) => {
  const runtime = await mockWorkHubFoundation(page, { locale: 'ko', designDetails: true });
  const evaluated: Array<Record<string, unknown>> = [];
  const generatedAt = new Date().toISOString();
  const revalidateAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const scope = {
    key: 'scope:services:self',
    kind: 'SELF',
    displayName: 'My service requests',
    isDefault: true,
    readOnly: false,
    validUntil: null,
  };
  const grant = {
    grantKind: 'CAPABILITY',
    capabilityContractKey: 'services.request.respond',
    resolvedCapabilityCode: 'APP.EMPLOYEE_SERVICES:UPDATE',
    authorityMode: 'PERMISSION_AND_RELATIONSHIP',
    predicatePolicyKeys: [],
    responsibilityRequirement: 'NOT_REQUIRED',
    responsibility: null,
    scopeKeys: [scope.key],
    requiresProductEntitlement: true,
    readOnly: false,
    activationState: 'ACTIVE',
    validUntil: null,
  };
  const context = {
    contextKey: 'ctx:services:work',
    productKey: 'services',
    surfaceKey: 'services.work',
    plane: 'work',
    accessMode: 'NORMAL',
    accessSource: 'ENTITLEMENT',
    appResourceKey: 'APP.EMPLOYEE_SERVICES',
    effectiveGrants: [grant],
    scopes: [scope],
    revalidateAt,
  };
  await page.route('**/api/auth/product-surface-contexts', (route) =>
    fulfillSuccess(route, {
      contractVersion: 'product-surfaces/v3',
      decisionRevision: 'services-response-work-111',
      sourceRevisions: { auth: 'auth-v1', policy: 'policy-v1', productRelationship: 'rel-v1' },
      activeAccessMode: 'NORMAL',
      generatedAt,
      contexts: [context],
      rollouts: [
        'approvals',
        'calendar',
        'communications',
        'dwaion',
        'hcm',
        'mail',
        'meetings',
        'messaging',
        'notifications',
        'services',
        'spaces',
        'workplace',
      ].map((productKey) => ({
        productKey,
        state: productKey === 'services' ? '111' : '000',
        flags: {
          contextShadow: productKey === 'services',
          capabilityEnforcement: productKey === 'services',
          surfaceUi: productKey === 'services',
        },
        cohort: 'e2e',
        opaqueRevision: `rollout-${productKey}`,
        authorityStatus: productKey === 'services' ? 'AVAILABLE' : 'NOT_EVALUATED',
      })),
    })
  );
  await page.route('**/api/auth/product-surface-access/evaluate', (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    evaluated.push(body);
    return fulfillSuccess(route, {
      decision: 'ROUTE_DENIED',
      reasonCode: 'ROUTE_CAPABILITY_REQUIRED',
      decisionRevision: 'services-response-work-111',
    });
  });
  await openForm(page, 320);
  const form = await fillResponse(page);
  await form.getByRole('button', { name: '보완 답변 검토', exact: true }).click();
  await page
    .getByRole('dialog', { name: '보완 답변을 제출할까요?' })
    .getByRole('button', { name: '보완 답변 제출', exact: true })
    .click();
  await expect(page.getByText('보완 답변이 접수되지 않았습니다.', { exact: false })).toBeVisible();
  await expect(form.getByRole('textbox', { name: '담당자에게 전달할 보완 답변' })).toHaveValue(
    message
  );
  expect(runtime.sourceMutations).toHaveLength(0);
  expect(evaluated).toHaveLength(1);
  expect(evaluated[0]).toMatchObject({
    routeContractKey: 'route.services.work.request-information-response.action',
    subject: { type: 'PRODUCT', productKey: 'services', surfaceKey: 'services.work' },
    contextScopeKey: 'scope:services:self',
  });
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath('work-service-response-320-revoked.png'),
    fullPage: true,
  });
});
