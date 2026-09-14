import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import type {
  MeResponse,
  WorkplaceFloor,
  WorkplaceSite,
  WorkplaceGovernanceChangeReview,
  WorkplaceGovernanceDelegatedAdminScope,
  WorkplaceGovernanceDelegatedAdminScopeInput,
} from '@dwp-frontend/shared-utils';

const output = path.resolve('../output/workplace-floor-range-delegation-2026-09-14/native-review');
const admin = '/api/platform/v1/admin/workplace';
const reviewPrefix = `${admin}/experience/collaboration/delegations`;
const nativeImpact = [
  'Only the selected delegation and its listed site/actions/validity are changed.',
  'A delegation does not grant Workplace or Rooms application entitlement.',
];
const nativeWarning =
  'Saved delegation scope is checked on subsequent administrator requests; no external approval or instant cache-propagation guarantee is asserted.';
const sourcePaths = [
  '../dwp-backend/dwp-platform-server/src/main/java/com/dwp/services/platform/workplace/WorkplaceExperienceCollaborationGovernanceService.java',
  '../dwp-backend/dwp-platform-server/src/main/java/com/dwp/services/platform/workplace/WorkplaceExperienceCollaborationAdminController.java',
  '../dwp-backend/dwp-platform-server/src/main/java/com/dwp/services/platform/workplace/WorkplaceAccessPolicyGovernanceService.java',
  '../dwp-backend/dwp-platform-server/src/main/java/com/dwp/services/platform/workplace/WorkplaceSpatialGovernanceService.java',
  '../dwp-backend/dwp-platform-server/src/main/java/com/dwp/services/platform/workplace/WorkplaceSpatialGovernanceDtos.java',
  '../dwp-backend/dwp-platform-server/src/main/resources/db/migration/V253__restrict_workplace_delegated_admin_floor_scope.sql',
  'libs/shared-utils/src/api/workplace-collaboration-api.ts',
  'apps/dwp/src/features/rooms/workplace-admin-governance-model.ts',
  'apps/dwp/src/features/rooms/workplace-governance-delegation-editor.tsx',
  'apps/dwp/src/features/rooms/workplace-delegation-floor-scope.ts',
  'apps/dwp/src/features/rooms/workplace-governance-change-review.tsx',
  'libs/shared-i18n/src/locales/ko/rooms.json',
  'libs/shared-i18n/src/locales/en/rooms.json',
];
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const snapshot = async () =>
  Object.fromEntries(
    await Promise.all(
      sourcePaths.map(async (file) => [
        path.resolve(file),
        createHash('sha256')
          .update(await readFile(file))
          .digest('hex'),
      ])
    )
  );
const canonical = (rows: WorkplaceGovernanceDelegatedAdminScope[]) =>
  [...rows].sort((first, second) => first.delegationId.localeCompare(second.delegationId));

test('opt-in real local delegation review echoes canonical floor scope without saving any delegation', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.WORKPLACE_NATIVE_DELEGATION_REVIEW !== '1',
    'Explicit opt-in to actual localhost read-only delegation review.'
  );
  test.setTimeout(100_000);
  const sourceBefore = await snapshot();
  const serviceSource = await readFile(sourcePaths[0], 'utf8');
  const readOnlyReview = serviceSource.match(
    /@Transactional\(readOnly = true\)\s+public GovernanceChangeReview reviewDelegation\b[\s\S]*?(?=\n {4}@Transactional)/
  )?.[0];
  expect(readOnlyReview).toBeTruthy();
  expect(readOnlyReview).not.toMatch(/\.(?:save\w*|audit)\s*\(/);
  expect(readOnlyReview).toContain('validateDelegationReview');
  const backendReadme = await readFile(path.resolve('../dwp-backend/README.md'), 'utf8');
  const password = backendReadme.match(/공통 비밀번호 `([^`]+)`/)?.[1];
  expect(Boolean(password)).toBe(true);
  const preventedPageWrites: string[] = [];
  await page.route('**/api/platform/v1/**', async (route) => {
    const request = route.request();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.fallback();
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === `${reviewPrefix}/review` &&
      request.postDataJSON()?.confirmed === false
    )
      return route.fallback();
    preventedPageWrites.push(`${request.method()} ${new URL(request.url()).pathname}`);
    return route.abort('blockedbyclient');
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/sign-in?returnUrl=%2Fworkplace%2Fhome');
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
  const login = (await loginResponse.json()).data;
  const headers: Record<string, string> = { 'X-Tenant-ID': String(login.tenantId) };
  await expect(page).toHaveURL(/\/workplace\/home/, { timeout: 40_000 });
  const nativeHttp: { method: string; pathname: string; status: number }[] = [];
  const read = async <T>(target: string): Promise<T> => {
    const response = await page.request.get(target, { headers });
    nativeHttp.push({ method: 'GET', pathname: target, status: response.status() });
    expect(response.status()).toBe(200);
    return (await response.json()).data as T;
  };
  const me = await read<MeResponse>('/api/auth/me');
  expect(String(me.tenantId)).toBe(headers['X-Tenant-ID']);
  expect(Number.isSafeInteger(me.userId) && me.userId > 0).toBe(true);
  const nativeLocale = me.preferredLocale?.startsWith('en') ? 'en' : 'ko';
  headers['Accept-Language'] = nativeLocale;
  const sites = await read<WorkplaceSite[]>(`${admin}/sites`);
  expect(sites.length).toBeGreaterThan(0);
  let selectedSite: WorkplaceSite | undefined, selectedFloor: WorkplaceFloor | undefined;
  for (const site of sites) {
    const floors = await read<WorkplaceFloor[]>(
      `${admin}/floors?siteId=${encodeURIComponent(site.siteId)}`
    );
    const floor = floors.find((item) => item.siteId === site.siteId);
    if (floor) {
      selectedSite = site;
      selectedFloor = floor;
      break;
    }
  }
  expect(Boolean(selectedSite && selectedFloor)).toBe(true);
  const siteId = selectedSite!.siteId,
    floorId = selectedFloor!.floorId;
  // Existing PostgreSQL/Java UUIDs may predate RFC version/variant normalization.
  // Exact canonical IDs come only from the authenticated tenant/site GETs.
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  expect(siteId).toMatch(uuid);
  expect(floorId).toMatch(uuid);
  const before = canonical(
    await read<WorkplaceGovernanceDelegatedAdminScope[]>(
      `${admin}/governance/delegated-admin-scopes`
    )
  );
  const effectiveBefore = await read<unknown[]>(
    `${admin}/governance/delegated-admin-scopes/effective`
  );
  const csrfResponse = await page.request.get('/api/auth/csrf', { headers });
  expect(csrfResponse.status()).toBe(200);
  const csrf = (await csrfResponse.json()).data;
  expect(typeof csrf.token).toBe('string');
  expect(typeof csrf.headerName).toBe('string');
  const reviews: {
    pathname: string;
    proposed: WorkplaceGovernanceDelegatedAdminScopeInput;
    response: WorkplaceGovernanceChangeReview<WorkplaceGovernanceDelegatedAdminScopeInput>;
  }[] = [];
  const review = async (
    id: string | null,
    proposed: WorkplaceGovernanceDelegatedAdminScopeInput
  ) => {
    const target = `${reviewPrefix}${id ? `/${encodeURIComponent(id)}` : ''}/review`;
    const response = await page.request.post(target, {
      headers: { ...headers, [csrf.headerName]: csrf.token },
      data: { proposed, reason: '', confirmed: false },
    });
    nativeHttp.push({ method: 'POST', pathname: target, status: response.status() });
    expect(response.status()).toBe(200);
    const result = (await response.json())
      .data as WorkplaceGovernanceChangeReview<WorkplaceGovernanceDelegatedAdminScopeInput>;
    expect(result.targetType).toBe('WP_DELEGATION');
    expect(result.targetId).toBe(id);
    expect(result.proposed).toEqual(proposed);
    expect(
      Array.isArray(result.knownImpact) &&
        result.knownImpact.length > 0 &&
        result.knownImpact.every((item) => typeof item === 'string')
    ).toBe(true);
    expect(
      Array.isArray(result.warnings) && result.warnings.every((item) => typeof item === 'string')
    ).toBe(true);
    expect(Number.isFinite(Date.parse(result.evaluatedAt))).toBe(true);
    expect(result.knownImpact).toEqual(nativeImpact);
    expect(result.warnings).toEqual([nativeWarning]);
    reviews.push({ pathname: target, proposed, response: result });
    return result;
  };
  const proposed: WorkplaceGovernanceDelegatedAdminScopeInput = {
    delegateType: 'USER',
    delegateUserId: me.userId,
    delegateGroupRef: null,
    scopeType: 'SITE',
    siteId,
    managedGroupRef: null,
    floorIds: [floorId],
    permissions: ['CATALOG_VIEW'],
    validFrom: null,
    validUntil: null,
    state: 'ACTIVE',
    version: null,
  };
  expect((await review(null, proposed)).current).toBeNull();
  const restricted = before.find((row) => Array.isArray(row.floorIds) && row.floorIds.length > 0);
  if (restricted) {
    const { delegationId, ...existingProposed } = restricted;
    expect((await review(delegationId, existingProposed)).current).toEqual(restricted);
  }
  const after = canonical(
    await read<WorkplaceGovernanceDelegatedAdminScope[]>(
      `${admin}/governance/delegated-admin-scopes`
    )
  );
  const effectiveAfter = await read<unknown[]>(
    `${admin}/governance/delegated-admin-scopes/effective`
  );
  expect(after).toEqual(before);
  expect(effectiveAfter).toEqual(effectiveBefore);
  await page.goto('/workplace/admin/governance?area=delegation');
  await expect(page.getByTestId('product-surface-loading-shell')).toHaveCount(0, {
    timeout: 20_000,
  });
  const main = page.locator('#dwp-main-content').first();
  await expect(main).toBeVisible();
  await expect(main.getByRole('progressbar')).toHaveCount(0, { timeout: 20_000 });
  await expect.poll(async () => (await main.innerText()).trim().length).toBeGreaterThan(50);
  await mkdir(output, { recursive: true });
  const screenshot = path.join(output, 'native-delegation-readonly-list-1440.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  const locale = nativeLocale;
  const labels = JSON.parse(
    await readFile(`libs/shared-i18n/src/locales/${locale}/rooms.json`, 'utf8')
  );
  const governanceLabels = labels.workplace.admin.governance;
  const experienceLabels = labels.workplace.experience;
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await main.getByRole('button', { name: governanceLabels.delegation.add, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: governanceLabels.delegation.add, exact: true });
  await dialog
    .getByRole('textbox', { name: new RegExp('^' + escape(governanceLabels.fields.userId)) })
    .fill(String(me.userId));
  await dialog
    .getByRole('combobox', { name: new RegExp('^' + escape(governanceLabels.fields.site)) })
    .click();
  await page.getByRole('option', { name: selectedSite!.name, exact: true }).click();
  await dialog
    .getByRole('combobox', {
      name: new RegExp('^' + escape(governanceLabels.delegation.floorRange)),
    })
    .click();
  await page
    .getByRole('option', { name: governanceLabels.delegation.selectedFloors, exact: true })
    .click();
  const floorOption = dialog.getByRole('checkbox', {
    name: `${selectedFloor!.name} · ${labels.workplace.floorStates[selectedFloor!.state]}`,
    exact: true,
  });
  await expect(floorOption).toBeVisible();
  await floorOption.check();
  const reviewRail = dialog.getByTestId('governance-change-review');
  const uiReviewFinished = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `${reviewPrefix}/review` &&
      response.request().method() === 'POST'
  );
  await reviewRail
    .getByRole('button', { name: experienceLabels.reviewChange, exact: true })
    .click();
  const uiReviewResponse = await uiReviewFinished;
  expect(uiReviewResponse.status()).toBe(200);
  const uiReviewBody = uiReviewResponse.request().postDataJSON();
  expect(uiReviewBody).toEqual({ proposed, reason: '', confirmed: false });
  const uiNativeResult = (await uiReviewResponse.json())
    .data as WorkplaceGovernanceChangeReview<WorkplaceGovernanceDelegatedAdminScopeInput>;
  expect(uiNativeResult.targetType).toBe('WP_DELEGATION');
  expect(uiNativeResult.current).toBeNull();
  expect(uiNativeResult.proposed).toEqual(proposed);
  expect(uiNativeResult.knownImpact).toEqual(nativeImpact);
  expect(uiNativeResult.warnings).toEqual([nativeWarning]);
  const localizedBusinessMessages = [
    'reviewImpactScope',
    'reviewApplicationAccess',
    'reviewPropagation',
  ].map((key) => governanceLabels.delegation[key] as string);
  for (const message of localizedBusinessMessages)
    await expect(reviewRail.getByText(message, { exact: true })).toBeVisible();
  for (const message of [...nativeImpact, nativeWarning])
    await expect(reviewRail.getByText(message, { exact: true })).toHaveCount(0);
  await expect(
    reviewRail.getByRole('button', { name: experienceLabels.saveReviewedChange, exact: true })
  ).toBeDisabled();
  nativeHttp.push({
    method: 'POST',
    pathname: `${reviewPrefix}/review`,
    status: uiReviewResponse.status(),
  });
  reviews.push({
    pathname: `${reviewPrefix}/review`,
    proposed: uiReviewBody.proposed,
    response: uiNativeResult,
  });
  const uiCaptures: string[] = [];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1100 });
    await expect
      .poll(() =>
        dialog.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.left >= -1 &&
            rect.right <= window.innerWidth + 1 &&
            element.scrollWidth <= element.clientWidth + 1
          );
        })
      )
      .toBe(true);
    await dialog
      .getByRole('region', { name: experienceLabels.proposedValues, exact: true })
      .scrollIntoViewIfNeeded();
    const file = path.join(output, `native-delegation-proposed-floor-review-${width}.png`);
    await page.screenshot({ path: file, fullPage: true });
    uiCaptures.push(file);
  }
  const afterUi = canonical(
    await read<WorkplaceGovernanceDelegatedAdminScope[]>(
      `${admin}/governance/delegated-admin-scopes`
    )
  );
  const effectiveAfterUi = await read<unknown[]>(
    `${admin}/governance/delegated-admin-scopes/effective`
  );
  expect(afterUi).toEqual(before);
  expect(effectiveAfterUi).toEqual(effectiveBefore);
  const sourceAfter = await snapshot();
  expect(sourceAfter).toEqual(sourceBefore);
  const manifest = {
    status: 'PASS',
    checkedAt: new Date().toISOString(),
    evidenceKind:
      'REAL_LOCAL_BROWSER_SESSION_NATIVE_HTTP_READ_ONLY_DELEGATION_REVIEW_NO_RESPONSE_FIXTURES',
    accountSource:
      'Existing local integrated verification account; numeric actor ID read from native auth/me.',
    canonicalTarget: {
      siteId,
      floorId,
      floorState: selectedFloor!.state,
      actorId: me.userId,
      siteSource: `${admin}/sites`,
      floorSource: `${admin}/floors?siteId=${siteId}`,
      uuidSource:
        'Exact authenticated PostgreSQL/Java canonical 8-4-4-4-12 native identifiers, including legacy version/variant bits.',
    },
    reviewMethod: {
      backendReadOnlyAnnotationVerified: true,
      saveAuditCallAbsentInReview: true,
      confirmed: false,
      reason: '',
      applyCreateGrantRequests: 0,
    },
    reviews,
    assignments: {
      beforeCount: before.length,
      afterCount: afterUi.length,
      beforeSha256: digest(before),
      afterSha256: digest(afterUi),
      unchanged: true,
    },
    effectiveScopes: {
      beforeSha256: digest(effectiveBefore),
      afterSha256: digest(effectiveAfterUi),
      unchanged: true,
    },
    existingRestrictedReview: restricted
      ? 'PASS_NATIVE_CURRENT_FULL_SNAPSHOT'
      : 'UNAVAILABLE_NO_EXISTING_RESTRICTED_NATIVE_ASSIGNMENT_NO_ASSIGNMENT_CREATED',
    nativeHttp,
    preventedPageWrites,
    screenshot,
    screenshotMeaning:
      'Actual read-only delegation list after native API review; no proposed assignment is saved.',
    uiPreflight: {
      source:
        'Actual native AddDelegation UI with existing canonical site/floor selection and read-only review POST',
      proposedFloorId: floorId,
      saveClicked: false,
      confirmationGiven: false,
      reviewedNativeEcho: true,
      localizedBusinessMessages,
      rawNativeMessagesUnchanged: true,
      rawEnglishMessagesAbsentFromUi: true,
      screenshots: uiCaptures,
    },
    sourceBefore,
    sourceAfter,
    limits: [
      'No delegation change/apply/create/grant or tenant business write was issued. Authentication/CSRF bootstrap uses the existing real session.',
      'Equality of native delegation/effective GET before and after plus reviewed read-only backend path establishes no new delegation from this test; it is not a full database grant-table audit.',
      'Existing restricted-current review is tested only when an actual row exists; none is manufactured.',
      'This is localhost runtime evidence and does not prove external connector health or new delegated-account activation.',
    ],
  };
  await writeFile(
    path.join(output, 'native-review-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );
  await testInfo.attach('native-read-only-delegation-review-manifest', {
    body: JSON.stringify(manifest),
    contentType: 'application/json',
  });
});
