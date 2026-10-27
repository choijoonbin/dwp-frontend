import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  expect,
  test,
  type APIResponse,
  type Page,
  type Response as BrowserResponse,
} from '@playwright/test';

type WorkplaceResource = {
  resourceId: string;
  calendarResourceId: string | null;
  floorId: string;
  siteId: string;
  name: string;
  nameKo?: string;
  approvalRequired?: boolean;
  type: string;
  mode: string;
  state: string;
  version: number;
};

type WorkplaceExplore = {
  sites: { siteId: string; timeZone: string }[];
  floors: { floorId: string; siteId: string }[];
  resources: WorkplaceResource[];
  occupancy: { resourceId: string }[];
  closures?: { resourceId: string }[];
};

type RoomAvailability = {
  rooms: { resourceId: string; version: number }[];
  bookingEligibility: {
    resourceId: string;
    resourceVersion: number;
    eligible: boolean;
    reasonCode: string;
  }[];
};

type CalendarEvent = {
  eventId: string;
  title: string;
  status: string;
  version: number;
};

type Candidate = {
  date: string;
  start: string;
  from: string;
  to: string;
  siteId: string;
  floorId: string;
  timeZone: string;
  resource: WorkplaceResource;
};

type HttpEvidence = {
  method: string;
  pathname: string;
  status: number;
  correlationId: string | null;
};

type ProductSurfaceContextList = {
  contexts: {
    productKey: string;
    surfaceKey: string;
    contextKey: string;
    scopes: { key: string; isDefault: boolean; readOnly: boolean }[];
  }[];
};

type ProductSurfaceEvaluation = {
  decision: string;
  decisionRevision: string | null;
  effectiveReadOnly: boolean | null;
  context: { contextKey: string } | null;
  scope: { key: string; readOnly: boolean } | null;
};

type RoomActionAuthority = {
  contextScopeKey: string;
  expectedDecisionRevision: string;
  evaluationStatus: number;
};

type CleanupEvidence = {
  outcome: 'SAFE' | 'SAFE_AFTER_RECOVERY' | 'UNPROVEN';
  mode: 'UI_CANCEL' | 'COMPENSATING_API' | 'RECONCILIATION_ONLY';
  routeContract: string;
  evaluationStatus: number | null;
  cancelStatus: number | null;
  finalReadStatus: number | null;
  absentFromActiveProjection: boolean;
  expectedRevisionMatched: boolean;
  contextScopeMatched: boolean;
  correlationId: string | null;
  recoveredByTitle: boolean;
  attempts: {
    attempt: number;
    evaluationStatus: number | null;
    cancelStatus: number | null;
    readStatus: number | null;
  }[];
  errors: string[];
};

type ApiHistoryEventEvidence = {
  observationPoint: 'GATEWAY' | 'SERVICE';
  serviceName: string;
  httpMethod: string;
  routeTemplate: string;
  statusCode: number;
  outcome: string;
  correlationId: string | null;
};

const SEOUL_TIME_ZONE = 'Asia/Seoul';
const BOOKING_HOURS = [14, 15, 10, 11] as const;
const CREATE_ROOM_ACTION = 'route.workplace.work.room-bookings-post.action';
const CANCEL_ROOM_ACTION = 'route.workplace.work.room-booking-cancel-post.action';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function seoulCalendarDay(instant: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SEOUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    weekday: part('weekday'),
  };
}

function expectedRoute(pathname: string, method: string) {
  if (pathname === '/api/platform/v1/rooms/bookings' && method === 'POST') {
    return CREATE_ROOM_ACTION;
  }
  if (pathname === '/api/platform/v1/rooms/bookings' && method === 'GET') {
    return 'route.workplace.work.reservations.page';
  }
  if (/^\/api\/platform\/v1\/rooms\/bookings\/[^/]+\/cancel$/u.test(pathname)) {
    return CANCEL_ROOM_ACTION;
  }
  return null;
}

function isActionEvaluation(response: BrowserResponse, routeContractKey: string) {
  if (
    new URL(response.url()).pathname !== '/api/auth/product-surface-access/evaluate' ||
    response.request().method() !== 'POST'
  ) {
    return false;
  }
  try {
    const body = response.request().postDataJSON() as { routeContractKey?: string };
    return body.routeContractKey === routeContractKey;
  } catch {
    return false;
  }
}

function normalizeCorrelationId(value: string | undefined) {
  return (
    value
      ?.split(',')
      .map((candidate) => candidate.trim())
      .find((candidate) => UUID_PATTERN.test(candidate)) ?? null
  );
}

function responseCorrelationId(response: BrowserResponse) {
  return normalizeCorrelationId(response.headers()['x-correlation-id']);
}

async function jsonData<T>(response: APIResponse): Promise<T> {
  const body = (await response.json()) as { data: T };
  return body.data;
}

async function csrfHeaders(page: Page, headers: Record<string, string>) {
  const response = await page.request.get('/api/auth/csrf', { headers });
  expect(response.status(), 'Cleanup CSRF bootstrap must succeed').toBe(200);
  const csrf = await jsonData<{ token: string; headerName: string }>(response);
  expect(csrf.token).toBeTruthy();
  expect(csrf.headerName).toBeTruthy();
  return { ...headers, [csrf.headerName]: csrf.token };
}

async function resolveRoomActionAuthority(
  page: Page,
  headers: Record<string, string>,
  routeContractKey: string
): Promise<RoomActionAuthority> {
  const contextsResponse = await page.request.get('/api/auth/product-surface-contexts', {
    headers,
  });
  expect(contextsResponse.status(), 'Product-surface contexts must remain available').toBe(200);
  const contexts = await jsonData<ProductSurfaceContextList>(contextsResponse);
  const matchingContexts = contexts.contexts.filter(
    (context) => context.productKey === 'workplace' && context.surfaceKey === 'workplace.work'
  );
  expect(matchingContexts).toHaveLength(1);
  const context = matchingContexts[0]!;
  const writableScopes = context.scopes.filter((scope) => !scope.readOnly);
  const scope = writableScopes.find((candidate) => candidate.isDefault) ?? writableScopes[0];
  expect(scope, 'Workplace action evaluation requires one writable canonical scope').toBeTruthy();

  const mutationHeaders = await csrfHeaders(page, headers);
  const evaluationResponse = await page.request.post('/api/auth/product-surface-access/evaluate', {
    headers: mutationHeaders,
    data: {
      subject: {
        type: 'PRODUCT',
        productKey: 'workplace',
        surfaceKey: 'workplace.work',
      },
      routeContractKey,
      contextScopeKey: scope!.key,
    },
  });
  expect(
    evaluationResponse.status(),
    `Exact action evaluation failed for ${routeContractKey}`
  ).toBe(200);
  const evaluation = await jsonData<ProductSurfaceEvaluation>(evaluationResponse);
  expect(evaluation).toMatchObject({
    decision: 'ALLOWED',
    effectiveReadOnly: false,
    context: { contextKey: context.contextKey },
    scope: { key: scope!.key, readOnly: false },
  });
  expect(evaluation.decisionRevision).toBeTruthy();
  return {
    contextScopeKey: scope!.key,
    expectedDecisionRevision: evaluation.decisionRevision!,
    evaluationStatus: evaluationResponse.status(),
  };
}

async function waitForGatewayAndServiceHistory(
  page: Page,
  headers: Record<string, string>,
  response: BrowserResponse
): Promise<ApiHistoryEventEvidence[]> {
  const correlationId = responseCorrelationId(response);
  expect(correlationId, 'Gateway response must expose a correlation ID').toBeTruthy();
  const params = new URLSearchParams({
    window: 'H1',
    observationPoint: 'ALL',
    outcome: 'SUCCESS',
    query: correlationId!,
    size: '20',
  });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const historyResponse = await page.request.get(
      `/api/platform/v1/admin/api-history/events?${params}`,
      { headers }
    );
    expect(historyResponse.status(), 'API history evidence query must succeed').toBe(200);
    const pageData = await jsonData<{ content: ApiHistoryEventEvidence[] }>(historyResponse);
    const matching = pageData.content.filter(
      (event) => event.correlationId === correlationId && event.statusCode === 200
    );
    if (
      matching.some((event) => event.observationPoint === 'GATEWAY') &&
      matching.some((event) => event.observationPoint === 'SERVICE')
    ) {
      return matching;
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`Gateway and service 2xx history did not converge for ${correlationId}`);
}

function cleanupError(stage: string, error: unknown) {
  return `${stage}: ${error instanceof Error ? error.message : String(error)}`;
}

async function readVerificationBooking(
  page: Page,
  headers: Record<string, string>,
  candidate: Candidate,
  title: string,
  eventId: string | null
) {
  const range = new URLSearchParams({ from: candidate.from, to: candidate.to });
  const response = await page.request.get(`/api/platform/v1/rooms/bookings?${range}`, { headers });
  if (response.status() !== 200) {
    throw new Error(`active booking read returned ${response.status()}`);
  }
  const events = await jsonData<CalendarEvent[]>(response);
  const byId = eventId ? events.find((event) => event.eventId === eventId) : undefined;
  const byTitle = events.find((event) => event.title === title);
  return {
    event: byId ?? byTitle ?? null,
    recoveredByTitle: !byId && Boolean(byTitle),
    status: response.status(),
  };
}

async function guaranteeBookingCleanup(input: {
  page: Page;
  tenantId: string;
  candidate: Candidate;
  title: string;
  created: CalendarEvent | null;
  existing: CleanupEvidence | null;
}) {
  const { page, tenantId, candidate, title } = input;
  const headers = { 'X-Tenant-ID': tenantId };
  const errors = [...(input.existing?.errors ?? [])];
  const attempts = [...(input.existing?.attempts ?? [])];
  let tracked = input.created;
  let recoveredByTitle = input.existing?.recoveredByTitle ?? false;
  let evaluationStatus = input.existing?.evaluationStatus ?? null;
  let cancelStatus = input.existing?.cancelStatus ?? null;
  let finalReadStatus = input.existing?.finalReadStatus ?? null;
  let correlationId = input.existing?.correlationId ?? null;
  let expectedRevisionMatched = input.existing?.expectedRevisionMatched ?? false;
  let contextScopeMatched = input.existing?.contextScopeMatched ?? false;
  let compensationAttempted = false;
  let absentFromActiveProjection = false;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let active = tracked;
    try {
      const read = await readVerificationBooking(
        page,
        headers,
        candidate,
        title,
        tracked?.eventId ?? null
      );
      finalReadStatus = read.status;
      if (read.event) {
        tracked = read.event;
        active = read.event;
        recoveredByTitle ||= read.recoveredByTitle;
      } else {
        absentFromActiveProjection = true;
        break;
      }
    } catch (error) {
      errors.push(cleanupError(`attempt-${attempt}-read`, error));
    }

    if (!active) {
      await page.waitForTimeout(250);
      continue;
    }

    compensationAttempted = true;
    const evidence = {
      attempt,
      evaluationStatus: null as number | null,
      cancelStatus: null as number | null,
      readStatus: finalReadStatus,
    };
    attempts.push(evidence);
    try {
      const authority = await resolveRoomActionAuthority(page, headers, CANCEL_ROOM_ACTION);
      evaluationStatus = authority.evaluationStatus;
      evidence.evaluationStatus = authority.evaluationStatus;
      const mutationHeaders = await csrfHeaders(page, {
        ...headers,
        'X-DWP-Expected-Decision-Revision': authority.expectedDecisionRevision,
      });
      expectedRevisionMatched = true;
      contextScopeMatched = true;
      const cancelPath = `/api/platform/v1/rooms/bookings/${active.eventId}/cancel`;
      const response = await page.request.post(cancelPath, {
        headers: mutationHeaders,
        params: { contextScopeKey: authority.contextScopeKey },
        data: { version: active.version },
      });
      cancelStatus = response.status();
      evidence.cancelStatus = response.status();
      correlationId =
        normalizeCorrelationId(response.headers()['x-correlation-id']) ?? correlationId;
      if (!response.ok()) {
        errors.push(`attempt-${attempt}-cancel: returned ${response.status()}`);
      }
    } catch (error) {
      errors.push(cleanupError(`attempt-${attempt}-authority-or-cancel`, error));
    }
    await page.waitForTimeout(250);
  }

  for (let reconciliation = 1; reconciliation <= 4; reconciliation += 1) {
    try {
      const read = await readVerificationBooking(
        page,
        headers,
        candidate,
        title,
        tracked?.eventId ?? null
      );
      finalReadStatus = read.status;
      recoveredByTitle ||= read.recoveredByTitle;
      if (!read.event) {
        absentFromActiveProjection = true;
        break;
      }
      tracked = read.event;
      absentFromActiveProjection = false;
      errors.push(`reconciliation-${reconciliation}: booking remains active`);
    } catch (error) {
      errors.push(cleanupError(`reconciliation-${reconciliation}`, error));
    }
    await page.waitForTimeout(250);
  }

  return {
    created: tracked,
    cancelled: absentFromActiveProjection,
    evidence: {
      outcome: absentFromActiveProjection
        ? errors.length > 0
          ? ('SAFE_AFTER_RECOVERY' as const)
          : ('SAFE' as const)
        : ('UNPROVEN' as const),
      mode: compensationAttempted
        ? ('COMPENSATING_API' as const)
        : (input.existing?.mode ?? ('RECONCILIATION_ONLY' as const)),
      routeContract: CANCEL_ROOM_ACTION,
      evaluationStatus,
      cancelStatus,
      finalReadStatus,
      absentFromActiveProjection,
      expectedRevisionMatched,
      contextScopeMatched,
      correlationId,
      recoveredByTitle,
      attempts,
      errors,
    } satisfies CleanupEvidence,
  };
}

async function findAvailableRoom(page: Page, headers: Record<string, string>): Promise<Candidate> {
  for (let dayOffset = 1; dayOffset <= 14; dayOffset += 1) {
    const day = seoulCalendarDay(new Date(Date.now() + dayOffset * 86_400_000));
    if (day.weekday === 'Sat' || day.weekday === 'Sun') continue;

    for (const hour of BOOKING_HOURS) {
      const start = `${String(hour).padStart(2, '0')}:00`;
      const from = `${day.date}T${start}:00+09:00`;
      const to = `${day.date}T${String(hour + 1).padStart(2, '0')}:00:00+09:00`;
      const range = new URLSearchParams({ from, to });
      const initialResponse = await page.request.get(
        `/api/platform/v1/workplace/explore?${range}`,
        { headers }
      );
      expect(initialResponse.status(), 'Workplace candidate discovery must stay readable').toBe(
        200
      );
      const initial = await jsonData<WorkplaceExplore>(initialResponse);

      const availabilityResponse = await page.request.get(
        `/api/platform/v1/rooms/availability?${range}`,
        { headers }
      );
      expect(availabilityResponse.status(), 'Room eligibility must stay readable').toBe(200);
      const availability = await jsonData<RoomAvailability>(availabilityResponse);

      for (const floor of initial.floors) {
        const site = initial.sites.find((candidate) => candidate.siteId === floor.siteId);
        if (!site || site.timeZone !== SEOUL_TIME_ZONE) continue;
        const floorQuery = new URLSearchParams({ from, to, floorId: floor.floorId });
        const floorResponse = await page.request.get(
          `/api/platform/v1/workplace/explore?${floorQuery}`,
          { headers }
        );
        expect(floorResponse.status()).toBe(200);
        const floorSnapshot = await jsonData<WorkplaceExplore>(floorResponse);
        const resource = floorSnapshot.resources.find((candidate) => {
          if (
            candidate.type !== 'ROOM' ||
            candidate.mode !== 'RESERVABLE' ||
            candidate.state !== 'AVAILABLE' ||
            candidate.approvalRequired === true ||
            !candidate.calendarResourceId
          ) {
            return false;
          }
          if (
            floorSnapshot.occupancy.some((item) => item.resourceId === candidate.resourceId) ||
            floorSnapshot.closures?.some((item) => item.resourceId === candidate.resourceId)
          ) {
            return false;
          }
          const room = availability.rooms.find(
            (item) => item.resourceId === candidate.calendarResourceId
          );
          const decision = availability.bookingEligibility.find(
            (item) => item.resourceId === candidate.calendarResourceId
          );
          return Boolean(
            room &&
            decision?.eligible &&
            decision.reasonCode === 'ELIGIBLE' &&
            decision.resourceVersion === room.version
          );
        });
        if (resource) {
          return {
            date: day.date,
            start,
            from,
            to,
            siteId: site.siteId,
            floorId: floor.floorId,
            timeZone: site.timeZone,
            resource,
          };
        }
      }
    }
  }
  throw new Error('No collision-free bundled SKAX meeting room slot was found in 14 days.');
}

test('bundled SKAX Workplace authority creates, reads, and safely cancels a real room booking', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.WORKPLACE_BOOKING_WRITE_VERIFY !== '1',
    'Opt in explicitly: this verification creates and then cancels a real local booking.'
  );
  test.setTimeout(180_000);

  const backendReadme = await readFile(path.resolve('../dwp-backend/README.md'), 'utf8');
  const password = backendReadme.match(/공통 비밀번호 `([^`]+)`/)?.[1];
  expect(password).toBeTruthy();

  const history: HttpEvidence[] = [];
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (!url.pathname.startsWith('/api/platform/v1/')) return;
    history.push({
      method: response.request().method(),
      pathname: url.pathname,
      status: response.status(),
      correlationId: normalizeCorrelationId(response.headers()['x-correlation-id']),
    });
  });

  let tenantId = '';
  let created: CalendarEvent | null = null;
  let cancelled = false;
  let cleanup: CleanupEvidence | null = null;
  let candidate: Candidate | null = null;
  const title = `DWP-WRITE-VERIFY-${Date.now()}`;
  const proof: Record<string, unknown> = {};

  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/sign-in?returnUrl=%2Fworkplace%2Ffind');
    await page.locator('input[name="email"]').fill('joonbin@sk.com');
    await page.locator('input[name="password"]').fill(password!);
    const loginFinished = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/auth/login' &&
        response.request().method() === 'POST'
    );
    await page.locator('#dwp-sign-in-form button[type="submit"]').click();
    const loginResponse = await loginFinished;
    expect(loginResponse.status()).toBe(200);
    const login = ((await loginResponse.json()) as { data: { tenantId: string | number } }).data;
    tenantId = String(login.tenantId);
    const headers = { 'X-Tenant-ID': tenantId };
    await expect(page).toHaveURL(/\/workplace\/find/u, { timeout: 45_000 });

    const meResponse = await page.request.get('/api/auth/me', { headers });
    expect(meResponse.status()).toBe(200);
    const me = await jsonData<{
      email: string | null;
      tenantId: number;
    }>(meResponse);
    expect(me.email).toBe('joonbin@sk.com');
    expect(String(me.tenantId)).toBe(tenantId);
    const permissionsResponse = await page.request.get('/api/auth/permissions', { headers });
    expect(permissionsResponse.status()).toBe(200);
    const permissions = await jsonData<
      {
        resourceKey: string;
        permissionCode: string;
        effect: string;
      }[]
    >(permissionsResponse);
    const workplaceAllows = new Set(
      permissions
        .filter(
          (permission) =>
            permission.resourceKey === 'APP.WORKPLACE' && permission.effect === 'ALLOW'
        )
        .map((permission) => permission.permissionCode)
    );
    expect([...workplaceAllows]).toEqual(expect.arrayContaining(['VIEW', 'CREATE', 'UPDATE']));

    candidate = await findAvailableRoom(page, headers);
    const findQuery = new URLSearchParams({
      v: '1',
      date: candidate.date,
      start: candidate.start,
      duration: '60',
      tz: candidate.timeZone,
      sites: candidate.siteId,
      floors: candidate.floorId,
      types: 'ROOM',
      resource: candidate.resource.resourceId,
    });
    await page.goto(`/workplace/find?${findQuery}`);
    await expect(page.getByTestId('product-surface-loading-shell')).toHaveCount(0, {
      timeout: 30_000,
    });
    const inspector = page.getByRole('complementary', {
      name: candidate.resource.nameKo || candidate.resource.name,
      exact: true,
    });
    await expect(inspector).toBeVisible({ timeout: 30_000 });
    const openBooking = inspector.getByRole('button', { name: '이 공간 예약', exact: true });
    await expect(openBooking).toBeEnabled({ timeout: 30_000 });
    await openBooking.click();

    const bookingDialog = page.getByRole('dialog', { name: '회의실 예약', exact: true });
    await expect(bookingDialog).toBeVisible();
    await bookingDialog.getByRole('textbox', { name: '회의 제목', exact: true }).fill(title);
    const submit = bookingDialog.getByRole('button', { name: '예약', exact: true });
    await expect(submit).toBeEnabled({ timeout: 30_000 });
    const createEvaluationFinished = page.waitForResponse((response) =>
      isActionEvaluation(response, CREATE_ROOM_ACTION)
    );
    const createFinished = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/platform/v1/rooms/bookings' &&
        response.request().method() === 'POST'
    );
    await submit.click();
    const [createEvaluationResponse, createResponse] = await Promise.all([
      createEvaluationFinished,
      createFinished,
    ]);
    expect(createEvaluationResponse.status()).toBe(200);
    const createEvaluation = (
      (await createEvaluationResponse.json()) as { data: ProductSurfaceEvaluation }
    ).data;
    expect(createEvaluation).toMatchObject({
      decision: 'ALLOWED',
      effectiveReadOnly: false,
    });
    expect(createEvaluation.decisionRevision).toBeTruthy();
    expect(createEvaluation.scope?.key).toBeTruthy();
    const createRequestHeaders = createResponse.request().headers();
    const createRequestUrl = new URL(createResponse.url());
    expect(createRequestHeaders['x-dwp-expected-decision-revision']).toBe(
      createEvaluation.decisionRevision
    );
    expect(createRequestUrl.searchParams.get('contextScopeKey')).toBe(createEvaluation.scope!.key);
    const createBody = (await createResponse.json()) as { data: CalendarEvent };
    created = createBody.data;
    expect(createResponse.status(), JSON.stringify(createBody)).toBe(200);
    expect(created).toMatchObject({ title, status: expect.stringMatching(/CONFIRMED|TENTATIVE/u) });
    await expect(bookingDialog).toHaveCount(0, { timeout: 30_000 });
    proof.create = {
      gatewayPath: '/api/platform/v1/rooms/bookings',
      servicePath: '/v1/rooms/bookings',
      routeContract: expectedRoute('/api/platform/v1/rooms/bookings', 'POST'),
      actionEvaluationStatus: createEvaluationResponse.status(),
      expectedRevisionMatched: true,
      contextScopeMatched: true,
      status: createResponse.status(),
      eventId: created.eventId,
    };

    const reservationsQuery = new URLSearchParams({
      v: '1',
      period: 'UPCOMING',
      types: 'MEETING',
      status: 'ACTIVE',
      authority: 'CALENDAR',
      q: title,
      reservation: created.eventId,
      reservationAuthority: 'CALENDAR',
    });
    const readFinished = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/platform/v1/rooms/bookings' &&
        response.request().method() === 'GET'
    );
    await page.goto(`/workplace/reservations?${reservationsQuery}`);
    const readResponse = await readFinished;
    expect(readResponse.status()).toBe(200);
    const visibleEvents = ((await readResponse.json()) as { data: CalendarEvent[] }).data;
    expect(visibleEvents).toEqual(
      expect.arrayContaining([expect.objectContaining({ eventId: created.eventId, title })])
    );
    const reservation = page.getByTestId(`workplace-reservation-calendar-${created.eventId}`);
    await expect(reservation).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: title, exact: true }).last()).toBeVisible();
    proof.read = {
      gatewayPath: '/api/platform/v1/rooms/bookings',
      servicePath: '/v1/rooms/bookings',
      routeContract: expectedRoute('/api/platform/v1/rooms/bookings', 'GET'),
      status: readResponse.status(),
      observedEventId: created.eventId,
    };

    await page.getByRole('button', { name: '예약 취소', exact: true }).click();
    const confirmation = page.getByRole('alertdialog', {
      name: '이 예약을 취소할까요?',
      exact: true,
    });
    await expect(confirmation).toBeVisible();
    const cancelPath = `/api/platform/v1/rooms/bookings/${created.eventId}/cancel`;
    const cancelEvaluationFinished = page.waitForResponse((response) =>
      isActionEvaluation(response, CANCEL_ROOM_ACTION)
    );
    const cancelFinished = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === cancelPath && response.request().method() === 'POST'
    );
    const finalReadFinished = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/platform/v1/rooms/bookings' &&
        response.request().method() === 'GET'
    );
    await confirmation.getByRole('button', { name: '예약 취소', exact: true }).click();
    const [cancelEvaluationResponse, cancelResponse] = await Promise.all([
      cancelEvaluationFinished,
      cancelFinished,
    ]);
    expect(cancelEvaluationResponse.status()).toBe(200);
    const cancelEvaluation = (
      (await cancelEvaluationResponse.json()) as { data: ProductSurfaceEvaluation }
    ).data;
    expect(cancelEvaluation).toMatchObject({
      decision: 'ALLOWED',
      effectiveReadOnly: false,
    });
    expect(cancelEvaluation.decisionRevision).toBeTruthy();
    expect(cancelEvaluation.scope?.key).toBeTruthy();
    const cancelRequestHeaders = cancelResponse.request().headers();
    const cancelRequestUrl = new URL(cancelResponse.url());
    expect(cancelRequestHeaders['x-dwp-expected-decision-revision']).toBe(
      cancelEvaluation.decisionRevision
    );
    expect(cancelRequestUrl.searchParams.get('contextScopeKey')).toBe(cancelEvaluation.scope!.key);
    expect(cancelResponse.status()).toBe(200);
    const finalReadResponse = await finalReadFinished;
    expect(finalReadResponse.status()).toBe(200);
    const remainingEvents = ((await finalReadResponse.json()) as { data: CalendarEvent[] }).data;
    expect(remainingEvents.some((event) => event.eventId === created!.eventId)).toBe(false);
    cancelled = true;
    await expect(reservation).toHaveCount(0, { timeout: 30_000 });
    proof.cancel = {
      gatewayPath: cancelPath,
      servicePath: `/v1/rooms/bookings/${created.eventId}/cancel`,
      routeContract: expectedRoute(cancelPath, 'POST'),
      actionEvaluationStatus: cancelEvaluationResponse.status(),
      expectedRevisionMatched: true,
      contextScopeMatched: true,
      status: cancelResponse.status(),
      finalReadStatus: finalReadResponse.status(),
      absentFromActiveProjection: true,
    };
    cleanup = {
      outcome: 'SAFE',
      mode: 'UI_CANCEL',
      routeContract: CANCEL_ROOM_ACTION,
      evaluationStatus: cancelEvaluationResponse.status(),
      cancelStatus: cancelResponse.status(),
      finalReadStatus: finalReadResponse.status(),
      absentFromActiveProjection: true,
      expectedRevisionMatched: true,
      contextScopeMatched: true,
      correlationId: responseCorrelationId(cancelResponse),
      recoveredByTitle: false,
      attempts: [
        {
          attempt: 0,
          evaluationStatus: cancelEvaluationResponse.status(),
          cancelStatus: cancelResponse.status(),
          readStatus: finalReadResponse.status(),
        },
      ],
      errors: [],
    };
    const [createHistory, readHistory, cancelHistory] = await Promise.all([
      waitForGatewayAndServiceHistory(page, headers, createResponse),
      waitForGatewayAndServiceHistory(page, headers, readResponse),
      waitForGatewayAndServiceHistory(page, headers, cancelResponse),
    ]);
    expect(createHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          observationPoint: 'GATEWAY',
          httpMethod: 'POST',
          routeTemplate: '/api/platform/v1/rooms/bookings',
          statusCode: 200,
        }),
        expect.objectContaining({
          observationPoint: 'SERVICE',
          serviceName: 'dwp-platform-server',
          httpMethod: 'POST',
          routeTemplate: '/v1/rooms/bookings',
          statusCode: 200,
        }),
      ])
    );
    expect(readHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          observationPoint: 'GATEWAY',
          httpMethod: 'GET',
          statusCode: 200,
        }),
        expect.objectContaining({
          observationPoint: 'SERVICE',
          serviceName: 'dwp-platform-server',
          httpMethod: 'GET',
          routeTemplate: '/v1/rooms/bookings',
          statusCode: 200,
        }),
      ])
    );
    expect(cancelHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          observationPoint: 'GATEWAY',
          httpMethod: 'POST',
          statusCode: 200,
        }),
        expect.objectContaining({
          observationPoint: 'SERVICE',
          serviceName: 'dwp-platform-server',
          httpMethod: 'POST',
          routeTemplate: '/v1/rooms/bookings/{eventId}/cancel',
          statusCode: 200,
        }),
      ])
    );
    proof.apiHistory = {
      create: createHistory,
      read: readHistory,
      cancel: cancelHistory,
    };
  } finally {
    if (tenantId && candidate) {
      try {
        const guaranteed = await guaranteeBookingCleanup({
          page,
          tenantId,
          candidate,
          title,
          created,
          existing: cleanup,
        });
        created = guaranteed.created;
        cancelled = guaranteed.cancelled;
        cleanup = guaranteed.evidence;
      } catch (error) {
        cleanup = {
          outcome: 'UNPROVEN',
          mode: cleanup?.mode ?? 'RECONCILIATION_ONLY',
          routeContract: CANCEL_ROOM_ACTION,
          evaluationStatus: cleanup?.evaluationStatus ?? null,
          cancelStatus: cleanup?.cancelStatus ?? null,
          finalReadStatus: cleanup?.finalReadStatus ?? null,
          absentFromActiveProjection: false,
          expectedRevisionMatched: cleanup?.expectedRevisionMatched ?? false,
          contextScopeMatched: cleanup?.contextScopeMatched ?? false,
          correlationId: cleanup?.correlationId ?? null,
          recoveredByTitle: cleanup?.recoveredByTitle ?? false,
          attempts: cleanup?.attempts ?? [],
          errors: [...(cleanup?.errors ?? []), cleanupError('cleanup-guard', error)],
        };
        cancelled = false;
      }
    }

    const manifest = {
      status: created
        ? cancelled
          ? 'CANCELLED_AFTER_VERIFICATION'
          : 'NO_ACTIVE_BOOKING_LEFT_UNPROVEN'
        : cleanup?.absentFromActiveProjection
          ? 'NO_VERIFICATION_BOOKING_DISCOVERED'
          : 'NO_ACTIVE_BOOKING_LEFT_UNPROVEN',
      checkedAt: new Date().toISOString(),
      account: 'joonbin@sk.com',
      canonicalAuthority: ['APP.WORKPLACE:VIEW', 'APP.WORKPLACE:CREATE', 'APP.WORKPLACE:UPDATE'],
      title,
      candidate,
      eventId: created?.eventId ?? null,
      proof,
      cleanup,
      gatewayHistory: history.filter(
        (item) =>
          item.pathname === '/api/platform/v1/rooms/bookings' ||
          item.pathname === `/api/platform/v1/rooms/bookings/${created?.eventId ?? '-'}/cancel`
      ),
    };
    const manifestPath = testInfo.outputPath('workplace-room-booking-write-live.json');
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await testInfo.attach('workplace-room-booking-write-live', {
      path: manifestPath,
      contentType: 'application/json',
    });
    if (tenantId && candidate) {
      expect(
        cleanup,
        'Cleanup must always finish with an active-booking reconciliation'
      ).toMatchObject({
        routeContract: CANCEL_ROOM_ACTION,
        finalReadStatus: 200,
        absentFromActiveProjection: true,
      });
    }
    if (created) {
      expect(cancelled, 'Any real booking created by this verification must be cancelled').toBe(
        true
      );
      expect(cleanup, 'Created bookings require explicit cleanup evidence').toMatchObject({
        routeContract: CANCEL_ROOM_ACTION,
        evaluationStatus: 200,
        finalReadStatus: 200,
        absentFromActiveProjection: true,
        expectedRevisionMatched: true,
        contextScopeMatched: true,
      });
    }
  }
});
