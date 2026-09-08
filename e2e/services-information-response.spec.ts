import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { fulfillSuccess, mockShellSession } from './support/shell-session';
import { DEFAULT_APP_PERMISSIONS } from './support/runtime-access';
import { mockLegacyProductSurfaceAuthority } from './support/product-surface-authority';
import type { Page } from '@playwright/test';
import type { ServiceRequestDetail } from '@dwp-frontend/shared-utils/api/service-center-api';

const requestId = '96000000-0000-4000-8000-000000000888';
const endpoint = `/api/platform/v1/services/requests/${requestId}`;
const responseText = 'Customer incident support requires VPN access for the assigned project.';
function detail(): ServiceRequestDetail {
  return {
    request: {
      requestId,
      requestNumber: 'SR-088',
      serviceKey: 'VPN',
      serviceNameKo: '원격접속 신청',
      serviceNameEn: 'Remote access request',
      summary: 'VPN access for customer support',
      status: 'AWAITING_REQUESTER',
      priority: 'HIGH',
      assignedGroup: 'IT Service Desk',
      assignedTo: 'Service reviewer',
      slaDueAt: '2026-09-08T07:00:00Z',
      updatedAt: '2026-09-07T00:30:00Z',
      version: 3,
    },
    values: { purpose: 'Customer support', duration: '2026-09-30' },
    requestSchema: {
      fields: [
        {
          key: 'purpose',
          type: 'TEXTAREA',
          labelKo: '업무 목적',
          labelEn: 'Business purpose',
          required: true,
        },
        {
          key: 'duration',
          type: 'DATE',
          labelKo: '필요 기간',
          labelEn: 'Required until',
          required: true,
        },
      ],
    },
    schemaVersion: 2,
    dataClassification: 'INTERNAL',
    timeline: [
      {
        eventId: 'request-info',
        eventType: 'INFORMATION_REQUESTED',
        status: 'AWAITING_REQUESTER',
        actorType: 'USER',
        note: 'Please provide the business purpose and required access period.',
        occurredAt: '2026-09-07T00:30:00Z',
      },
    ],
  };
}
async function mock(page: Page, writable = true, governed = false, locale: 'en' | 'ko' = 'en') {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    locale,
    permissions: [
      ...DEFAULT_APP_PERMISSIONS,
      ...(writable
        ? [
            {
              resourceType: 'APP',
              resourceKey: 'APP.EMPLOYEE_SERVICES',
              permissionCode: 'UPDATE',
              effect: 'ALLOW' as const,
            },
          ]
        : []),
    ],
  });
  await mockLegacyProductSurfaceAuthority(page);
  const state = {
    detail: detail(),
    writes: [] as Record<string, unknown>[],
    mode: 'success' as 'success' | 'conflict' | 'unknown' | 'denied',
    denyAuthority: false,
    failRead: false,
    failReadAfterConflict: false,
  };
  if (governed) {
    const generatedAt = new Date().toISOString();
    const revalidateAt = new Date(Date.now() + 3_600_000).toISOString();
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
    const policy = {
      grantKind: 'POLICY',
      accessPolicyKey: 'services.work-access.v1',
      authorityMode: 'ENTITLEMENT',
      policyDecisionRef: 'policy:services:work',
      scopeKeys: [scope.key],
      requiresProductEntitlement: true,
      readOnly: false,
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
      effectiveGrants: [policy, grant],
      scopes: [scope],
      revalidateAt,
    };
    await page.route('**/api/auth/product-surface-contexts', (route) =>
      fulfillSuccess(route, {
        contractVersion: 'product-surfaces/v3',
        decisionRevision: 'services-response-111',
        sourceRevisions: {
          auth: 'auth-v1',
          policy: 'policy-v1',
          productRelationship: 'relationship-v1',
        },
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
      const body = route.request().postDataJSON();
      const action =
        body.routeContractKey === 'route.services.work.request-information-response.action';
      if (body.subject?.productKey !== 'services' || (action && state.denyAuthority))
        return fulfillSuccess(route, {
          decision: 'ROUTE_DENIED',
          reasonCode: 'ROUTE_CAPABILITY_REQUIRED',
          decisionRevision: 'services-response-111',
        });
      return fulfillSuccess(route, {
        decision: 'ALLOWED',
        reasonCode: null,
        decisionRevision: 'services-response-111',
        context: { ...context, effectiveGrants: action ? [grant] : [policy] },
        routeGrantRef: `grant:${body.routeContractKey}`,
        scope,
        effectiveReadOnly: false,
        validUntil: null,
        revalidateAt,
      });
    });
  }
  await page.route(`**${endpoint}**`, async (route) => {
    if (route.request().method() === 'GET')
      return state.failRead
        ? route.fulfill({
            status: 503,
            json: { success: false, message: 'Temporary read failure' },
          })
        : fulfillSuccess(route, state.detail);
    if (new URL(route.request().url()).pathname !== `${endpoint}/information-response`)
      return route.fallback();
    const body = route.request().postDataJSON();
    state.writes.push(body);
    if (state.mode === 'denied')
      return route.fulfill({ status: 403, json: { success: false, message: 'Access revoked' } });
    if (state.mode === 'conflict') {
      if (state.failReadAfterConflict) state.failRead = true;
      state.detail = {
        ...state.detail,
        request: { ...state.detail.request, version: body.version + 1 },
      };
      return route.fulfill({ status: 409, json: { success: false, message: 'Version conflict' } });
    }
    state.detail = {
      ...state.detail,
      request: { ...state.detail.request, status: 'IN_PROGRESS', version: body.version + 1 },
      values: body.values,
    };
    if (state.mode === 'unknown') {
      state.mode = 'success';
      return route.abort('failed');
    }
    return fulfillSuccess(route, state.detail);
  });
  await page.goto(`/services/my/${requestId}`);
  await expect(
    page.getByRole('heading', {
      name: locale === 'ko' ? '요청된 정보를 보완해 주세요' : 'Provide the requested information',
      exact: true,
    })
  ).toBeVisible();
  return state;
}
async function preview(page: Page) {
  await page
    .getByRole('textbox', { name: 'Response to the service team', exact: false })
    .fill(responseText);
  await page.getByRole('button', { name: 'Review response', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Submit this response?' })).toBeVisible();
}
test('owner response validates, previews, confirms, and distinguishes service progress', async ({
  page,
}, info) => {
  const state = await mock(page);
  await page.screenshot({
    path: info.outputPath('04-owner-service-response-form.png'),
    fullPage: true,
  });
  await expect(page.getByRole('button', { name: 'Review response', exact: true })).toBeDisabled();
  await preview(page);
  expect(state.writes).toHaveLength(0);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Submit response', exact: true })
    .click();
  await expect(
    page.getByText(
      'Your information was received. The service team will continue processing this request.'
    )
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({
    version: 3,
    message: responseText,
    values: { purpose: 'Customer support', duration: '2026-09-30' },
  });
  expect(state.detail.request.status).toBe('IN_PROGRESS');
  await page.screenshot({
    path: info.outputPath('04-owner-service-response-receipt.png'),
    fullPage: true,
  });
});
test('a newer version after preview blocks dispatch and preserves the response', async ({
  page,
}) => {
  const state = await mock(page);
  await preview(page);
  state.detail = { ...state.detail, request: { ...state.detail.request, version: 4 } };
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Submit response', exact: true })
    .click();
  await expect(page.getByText(/This request changed. Your input is preserved./u)).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await expect(page.getByRole('textbox', { name: 'Response to the service team' })).toHaveValue(
    responseText
  );
  await page.getByRole('button', { name: 'I reviewed the latest request; keep my input' }).click();
  await page.getByRole('button', { name: 'Review response', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Submit response', exact: true })
    .click();
  await expect.poll(() => state.writes[0]?.version).toBe(4);
  await expect(
    page.getByText(
      'Your information was received. The service team will continue processing this request.'
    )
  ).toBeVisible();
});
test('a source 409 after preflight preserves input and requires reviewing the new version', async ({
  page,
}) => {
  const state = await mock(page);
  state.mode = 'conflict';
  await preview(page);
  const refreshed = page.waitForResponse(
    async (response) =>
      new URL(response.url()).pathname === endpoint &&
      response.request().method() === 'GET' &&
      (await response.json()).data?.request?.version === 4
  );
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Submit response', exact: true })
    .click();
  await refreshed;
  await expect(page.getByText(/This request changed. Your input is preserved./u)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Response to the service team' })).toHaveValue(
    responseText
  );
  expect(state.writes).toHaveLength(1);
  state.mode = 'success';
  await page.getByRole('button', { name: 'I reviewed the latest request; keep my input' }).click();
  await page.getByRole('button', { name: 'Review response', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Submit response', exact: true })
    .click();
  await expect(
    page.getByText(
      'Your information was received. The service team will continue processing this request.'
    )
  ).toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]).toMatchObject({ version: 4, message: responseText });
  expect(state.writes[1].idempotencyKey).not.toBe(state.writes[0].idempotencyKey);
});
test('a temporary refresh failure after 409 retains the draft and can recover', async ({
  page,
}) => {
  const state = await mock(page);
  state.mode = 'conflict';
  state.failReadAfterConflict = true;
  await preview(page);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Submit response', exact: true })
    .click();
  await expect(
    page.getByText(/The latest request could not be loaded. Your input is preserved./u)
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Response to the service team' })).toHaveValue(
    responseText
  );
  state.failRead = false;
  state.mode = 'success';
  await page.getByRole('button', { name: 'Reload latest request', exact: true }).click();
  await expect(
    page.getByText(/The latest request could not be loaded. Your input is preserved./u)
  ).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'Response to the service team' })).toHaveValue(
    responseText
  );
  await page.getByRole('button', { name: 'I reviewed the latest request; keep my input' }).click();
  await page.getByRole('button', { name: 'Review response', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Submit response', exact: true })
    .click();
  await expect(
    page.getByText(
      'Your information was received. The service team will continue processing this request.'
    )
  ).toBeVisible();
  expect(state.writes[1]).toMatchObject({ version: 4, message: responseText });
});
test('a lost receipt is recovered using the identical command and idempotency key', async ({
  page,
}) => {
  const state = await mock(page);
  state.mode = 'unknown';
  await preview(page);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Submit response', exact: true })
    .click();
  await expect(page.getByText(/The response result could not be confirmed/u)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Response to the service team' })).toBeDisabled();
  state.failRead = true;
  const failedRead = page.waitForResponse(
    (response) => new URL(response.url()).pathname === endpoint && response.status() === 503
  );
  await page.getByRole('button', { name: 'Check submission result' }).click();
  await failedRead;
  await expect(page.getByText(/The response result could not be confirmed/u)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Response to the service team' })).toBeDisabled();
  expect(state.writes).toHaveLength(1);
  state.failRead = false;
  await page.getByRole('button', { name: 'Check submission result' }).click();
  await expect(
    page.getByText(
      'Your information was received. The service team will continue processing this request.'
    )
  ).toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]).toEqual(state.writes[0]);
});
test('permission loss never claims a receipt and keeps the draft', async ({ page }) => {
  const state = await mock(page);
  state.mode = 'denied';
  await preview(page);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Submit response', exact: true })
    .click();
  await expect(page.getByText(/The response was not accepted./u)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Response to the service team' })).toHaveValue(
    responseText
  );
  expect(state.detail.request.status).toBe('AWAITING_REQUESTER');
});
test('read-only users see request context without executable response controls', async ({
  page,
}) => {
  const state = await mock(page, false);
  await expect(page.getByRole('button', { name: 'Review response' })).toBeDisabled();
  await expect(
    page.getByText(/Response submission is not available with your current access/u)
  ).toBeVisible();
  expect(state.writes).toHaveLength(0);
});
test('rollout 111 rechecks the exact Services action and blocks revoked authority', async ({
  page,
}) => {
  const state = await mock(page, true, true);
  await preview(page);
  state.denyAuthority = true;
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Submit response', exact: true })
    .click();
  await expect(page.getByText(/The response was not accepted./u)).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await expect(page.getByRole('textbox', { name: 'Response to the service team' })).toHaveValue(
    responseText
  );
});
test('rollout 111 submits with the owner scope and governed command authority', async ({
  page,
}) => {
  const state = await mock(page, true, true);
  await preview(page);
  const sent = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === `${endpoint}/information-response` &&
      request.method() === 'POST'
  );
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Submit response', exact: true })
    .click();
  const request = await sent;
  expect(new URL(request.url()).searchParams.get('contextScopeKey')).toBe('scope:services:self');
  expect(request.headers()['x-dwp-expected-decision-revision']).toBe('services-response-111');
  await expect(
    page.getByText(
      'Your information was received. The service team will continue processing this request.'
    )
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
});
test('320px owner form exposes the response and keyboard action without overflow', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await mock(page);
  await preview(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Back to editing' }).click();
  await expect(page.getByRole('textbox', { name: 'Response to the service team' })).toHaveValue(
    responseText
  );
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: info.outputPath('04-owner-service-response-320.png'),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    )
  ).toBe(true);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))
  ).toEqual([]);
});

async function settleVisual(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => Number.isFinite(animation.effect?.getTiming().iterations))
        .map((animation) => animation.finished.catch(() => undefined))
    );
  });
}

for (const width of [390, 320]) {
  test(`04 Korean owner ${width}px previews and submits the requested information`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    const state = await mock(page, true, true, 'ko');
    const message =
      '고객사의 장애 지원 업무를 수행하기 위해 프로젝트에 배정된 기간 동안 원격 접근이 필요합니다.';
    await page
      .getByRole('textbox', { name: '업무 목적' })
      .fill('고객사 장애 원인 분석 및 승인된 시스템 복구 지원');
    await page.getByRole('textbox', { name: '담당자에게 전달할 보완 답변' }).fill(message);
    await expect(page.getByRole('button', { name: '보완 답변 검토', exact: true })).toBeEnabled();
    await settleVisual(page);
    await page.screenshot({
      path: info.outputPath(`04-owner-${width}-ko-form.png`),
      fullPage: true,
    });
    await page.getByRole('button', { name: '보완 답변 검토', exact: true }).click();
    const preview = page.getByRole('dialog', { name: '보완 답변을 제출할까요?' });
    await expect(preview.getByText(message, { exact: true })).toBeVisible();
    await settleVisual(page);
    await page.screenshot({ path: info.outputPath(`04-owner-${width}-ko-preview.png`) });
    expect(state.writes).toHaveLength(0);
    await preview.getByRole('button', { name: '보완 답변 제출', exact: true }).click();
    await expect(
      page.getByText('보완 답변이 접수되었습니다. 서비스 담당자가 요청 처리를 이어갑니다.')
    ).toBeVisible();
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toMatchObject({ version: 3, message });
    expect(state.detail.request.status).toBe('IN_PROGRESS');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
      )
    ).toBe(true);
    await settleVisual(page);
    await page.screenshot({
      path: info.outputPath(`04-owner-${width}-ko-receipt.png`),
      fullPage: true,
    });
  });
}
