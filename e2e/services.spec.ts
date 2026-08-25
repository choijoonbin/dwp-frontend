import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { fulfillSuccess, mockShellSession } from './support/shell-session';
import { mockLegacyProductSurfaceAuthority } from './support/product-surface-authority';

const service = {
  serviceKey: 'EMPLOYMENT_CERTIFICATE',
  categoryKey: 'PEOPLE',
  name: 'Employment certificate',
  description: 'Request a verified certificate for an external institution.',
  ownerGroup: 'People Operations',
  lifecycleState: 'ACTIVE',
  requestSchema: {
    fields: [
      {
        key: 'purpose',
        type: 'TEXT',
        labelKo: '제출 목적',
        labelEn: 'Business purpose',
        required: true,
      },
      {
        key: 'language',
        type: 'SELECT',
        labelKo: '발급 언어',
        labelEn: 'Language',
        required: true,
        options: ['KOREAN', 'ENGLISH'],
      },
    ],
  },
  schemaVersion: 1,
  slaHours: 8,
  estimatedResolutionHours: 4,
  dataClassification: 'CONFIDENTIAL',
  featured: true,
  tags: ['certificate', 'employment'],
  version: 1,
} as const;

const category = {
  categoryKey: 'PEOPLE',
  name: 'People',
  description: 'Employment and people services',
  iconKey: 'users-round',
  tone: 'GREEN',
  sortOrder: 1,
};

function requestDetail(input: {
  summary: string;
  values: Record<string, unknown>;
  status: 'DRAFT' | 'SUBMITTED';
  version: number;
}) {
  const occurredAt = '2026-08-14T01:00:00Z';
  return {
    request: {
      requestId: '96000000-0000-0000-0000-000000000001',
      requestNumber: 'SR-00001001',
      serviceKey: service.serviceKey,
      serviceNameKo: '재직 증명서',
      serviceNameEn: service.name,
      summary: input.summary,
      status: input.status,
      priority: 'NORMAL',
      assignedGroup: service.ownerGroup,
      assignedTo: null,
      submittedAt: input.status === 'SUBMITTED' ? occurredAt : null,
      slaDueAt: input.status === 'SUBMITTED' ? '2026-08-14T09:00:00Z' : null,
      updatedAt: occurredAt,
      version: input.version,
    },
    values: input.values,
    requestSchema: service.requestSchema,
    schemaVersion: service.schemaVersion,
    dataClassification: service.dataClassification,
    timeline: [
      {
        eventId: `event-${input.version}`,
        eventType: input.status === 'SUBMITTED' ? 'REQUEST_SUBMITTED' : 'DRAFT_CREATED',
        status: input.status,
        actorType: 'USER',
        actorId: 1,
        note: null,
        occurredAt,
      },
    ],
  };
}

async function mockServices(page: Page) {
  let detail = requestDetail({ summary: '', values: {}, status: 'DRAFT', version: 0 });
  let created = false;
  let updatePayload: Record<string, unknown> | null = null;
  let separateSubmitCalls = 0;

  await page.route('**/api/platform/v1/services/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === '/api/platform/v1/services/catalog') {
      return fulfillSuccess(route, {
        categories: [category],
        items: [service],
        activeCount: 1,
        generatedAt: '2026-08-14T00:00:00Z',
      });
    }
    if (path === '/api/platform/v1/services/requests' && request.method() === 'GET') {
      return fulfillSuccess(route, created ? [detail.request] : []);
    }
    if (path === '/api/platform/v1/services/requests' && request.method() === 'POST') {
      const body = request.postDataJSON() as {
        summary: string;
        values: Record<string, unknown>;
        submit: boolean;
      };
      created = true;
      detail = requestDetail({
        summary: body.summary,
        values: body.values,
        status: body.submit ? 'SUBMITTED' : 'DRAFT',
        version: 0,
      });
      return fulfillSuccess(route, detail);
    }
    if (path.endsWith('/draft') && request.method() === 'PUT') {
      const body = request.postDataJSON() as {
        summary: string;
        values: Record<string, unknown>;
        submit?: boolean;
      };
      updatePayload = body;
      detail = requestDetail({
        summary: body.summary,
        values: body.values,
        status: body.submit ? 'SUBMITTED' : 'DRAFT',
        version: body.submit ? 2 : 1,
      });
      return fulfillSuccess(route, detail);
    }
    if (path.endsWith('/submit') && request.method() === 'POST') {
      separateSubmitCalls += 1;
      return fulfillSuccess(route, detail);
    }
    if (/\/api\/platform\/v1\/services\/requests\/[^/]+$/u.test(path)) {
      return fulfillSuccess(route, detail);
    }

    return route.fulfill({ status: 404 });
  });

  return {
    getUpdatePayload: () => updatePayload,
    getSeparateSubmitCalls: () => separateSubmitCalls,
  };
}

test('service hub presents a responsive and accessible cross-domain catalog', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER'], {
    displayName: 'Mina Kim',
    jobTitle: 'Network operations lead',
  });
  await mockLegacyProductSurfaceAuthority(page);
  await mockServices(page);

  await page.goto('/services/discover');

  await expect(
    page.getByRole('heading', { name: 'Start every workplace request in one place' })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: service.name }).first()).toBeVisible();
  const hero = page.locator('section').first();
  await expect(hero).toHaveCSS('background-image', /service-center-hero\.jpg/u);
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('editing and submitting a draft is one atomic request', async ({ page }) => {
  await mockShellSession(page, ['WORKSPACE_MEMBER']);
  await mockLegacyProductSurfaceAuthority(page);
  const state = await mockServices(page);

  await page.goto('/services/discover');
  await page.getByRole('button', { name: 'Start request' }).first().click();
  const createDialog = page.getByRole('dialog');
  await createDialog.getByLabel('Request summary').fill('Certificate for customer onboarding');
  await createDialog.getByRole('button', { name: 'Save draft' }).click();

  await expect(page).toHaveURL(/\/services\/drafts\/[^/]+$/u);
  await expect(createDialog).toBeHidden();
  await expect(page.getByRole('heading', { name: service.name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit draft' }).click();
  const editDialog = page.getByRole('dialog');
  await editDialog.getByLabel('Business purpose').fill('Customer onboarding');
  await editDialog.getByLabel('Language').click();
  await page.getByRole('option', { name: 'English' }).click();
  await editDialog.getByRole('button', { name: 'Submit request' }).click();

  await expect(page.getByText('Submitted', { exact: true }).first()).toBeVisible();
  await expect.poll(state.getUpdatePayload).toMatchObject({
    submit: true,
    summary: 'Certificate for customer onboarding',
    values: { purpose: 'Customer onboarding', language: 'ENGLISH' },
    version: 0,
  });
  expect(state.getSeparateSubmitCalls()).toBe(0);
});
