import path from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';

const SITE_ID = '19000000-0000-4000-8000-000000000001';
const FLOOR_ID = '19000000-0000-4000-8000-000000000002';
const ORIGIN_ID = '19000000-0000-4000-8000-000000000003';
const DESTINATION_ID = '19000000-0000-4000-8000-000000000004';
const DEVICE_ID = '19000000-0000-4000-8000-000000000005';
const COMMAND_ID = '19000000-0000-4000-8000-000000000006';
const PREVIEW_ID = '19000000-0000-4000-8000-000000000007';
const ACCESS_PASS_ID = '19000000-0000-4000-8000-000000000011';
const ACCESS_PREVIEW_ID = '19000000-0000-4000-8000-000000000012';
const ACCESS_COMMAND_ID = '19000000-0000-4000-8000-000000000013';
const NOW = '2026-09-16T03:00:00Z';

function poi(poiId: string, category: string, nameKo: string, nameEn: string) {
  return {
    poiId,
    nodeId: `${poiId.slice(0, -1)}8`,
    siteId: SITE_ID,
    floorId: FLOOR_ID,
    resourceId: category === 'ROOM' ? DESTINATION_ID : null,
    category,
    nameKo,
    nameEn,
    directionHintKo: category === 'HELP_DESK' ? '로비 오른쪽' : null,
    directionHintEn: category === 'HELP_DESK' ? 'Right side of lobby' : null,
  };
}

const pois = [
  poi(ORIGIN_ID, 'ENTRY', '정문', 'Main entrance'),
  poi(DESTINATION_ID, 'ROOM', '회의실 19A', 'Room 19A'),
  poi('19000000-0000-4000-8000-000000000008', 'HELP_DESK', '19층 안내 데스크', '19F help desk'),
];

function device(type: 'ROOM_PANEL' | 'STATUS_BOARD' = 'ROOM_PANEL') {
  return {
    deviceId: DEVICE_ID,
    displayName: type === 'ROOM_PANEL' ? '회의실 19A 패널' : '19층 현황판',
    deviceType: type,
    registrationState: 'BOUND',
    siteId: SITE_ID,
    floorId: FLOOR_ID,
    resourceId: type === 'ROOM_PANEL' ? DESTINATION_ID : null,
    hardwareModel: 'Panel X',
    osVersion: '14.2',
    appVersion: '2.9.0',
    policyVersion: 'privacy-v4',
    heartbeatAt: NOW,
    connectivity: 'ONLINE',
    scheduleSourceAt: NOW,
    scheduleReceivedAt: NOW,
    scheduleFreshness: 'FRESH',
    recentErrorCode: null,
    safetyOfflineFallback: true,
    version: 4,
    updatedAt: NOW,
  };
}

function safetyFrame() {
  return {
    safetyFrameId: '19000000-0000-4000-8000-000000000009',
    state: 'ACTIVE',
    message: '즉시 대피하세요',
    direction: '엘리베이터를 사용하지 말고 동쪽 출구로 이동하세요.',
    issuedAt: NOW,
    issuedByActorId: 918745,
    offlineFallback: true,
    clearedAt: null,
    version: 2,
  };
}

function roomProjection(safety = false) {
  return {
    surface: 'ROOM_PANEL',
    roomPanel: {
      device: device(),
      current: {
        bookingId: DESTINATION_ID,
        startsAt: NOW,
        endsAt: '2026-09-16T04:00:00Z',
        title: '극비 프로젝트 회의',
        organizer: '원문 사용자',
        privacyMasked: true,
      },
      next: null,
      availability: 'OCCUPIED',
      walkUpBookingAllowed: false,
      checkInAllowed: true,
      earlyEndAllowed: true,
      safetyFrame: safety ? safetyFrame() : null,
      asOf: NOW,
    },
    statusBoard: null,
  };
}

function boardProjection() {
  return {
    surface: 'STATUS_BOARD',
    roomPanel: null,
    statusBoard: {
      device: device('STATUS_BOARD'),
      resources: [
        {
          resourceId: DESTINATION_ID,
          zoneId: 'zone-east',
          zoneNameKo: '동쪽',
          zoneNameEn: 'East',
          nameKo: '회의실 19A',
          nameEn: 'Room 19A',
          availability: 'AVAILABLE',
          directionKo: '오른쪽 20m',
          directionEn: '20m right',
        },
      ],
      availableCount: 1,
      occupiedCount: 0,
      unavailableCount: 0,
      safetyFrame: null,
      freshness: 'STALE',
      asOf: NOW,
    },
  };
}

async function installHarness(page: Page) {
  const harnessPath = path.resolve(
    process.cwd(),
    'e2e/support/workplace-navigation-e2e-harness.tsx'
  );
  await page.route('**/__screen19**', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workplace indoor experience</title></head><body><div id="root"></div><script type="module" src="/@fs/${harnessPath}"></script></body></html>`,
    });
  });
}

async function installApi(page: Page) {
  let routeOutcome: 'GUIDED' | 'GRAPH_MISSING' = 'GUIDED';
  let projection: unknown = roomProjection();
  let commandPosts = 0;
  let receiptGets = 0;
  let previewFailuresRemaining = 0;
  let lastCommandType = 'FORCE_SYNC';
  let accessPass: Record<string, unknown> | null = null;
  let accessPassVersion = 0;
  let accessCommandType: 'ISSUE' | 'ROTATE' | 'REVOKE' = 'ISSUE';
  let accessExecutePosts = 0;
  const accessExecuteHeaders: Array<Record<string, string>> = [];
  const previewAttempts: Array<{
    idempotencyKey: string | undefined;
    correlationId: string | undefined;
    body: string | null;
  }> = [];
  const commandIdempotencyKeys: Array<string | undefined> = [];
  await page.route('**/api/auth/csrf', async (route) => {
    await route.fulfill({
      json: { data: { token: 'screen-19-csrf', headerName: 'X-XSRF-TOKEN' } },
    });
  });
  await page.route('**/api/platform/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    let data: unknown;
    let status = 200;
    if (path.endsWith('/workplace/navigation/access-pass/audit-events')) {
      data = accessPass
        ? [
            {
              auditEventId: '19000000-0000-4000-8000-000000000014',
              action: `navigation.access-pass.${accessCommandType.toLowerCase()}`,
              passId: ACCESS_PASS_ID,
              correlationId: 'screen-19-access-correlation',
              occurredAt: new Date().toISOString(),
            },
          ]
        : [];
    } else if (
      path.endsWith(`/workplace/navigation/access-pass/commands/${ACCESS_COMMAND_ID}`) &&
      method === 'GET'
    ) {
      data = accessCommand(null, null, true);
    } else if (path.endsWith('/workplace/navigation/access-pass:preview') && method === 'POST') {
      const input = request.postDataJSON() as { commandType: 'ISSUE' | 'ROTATE' | 'REVOKE' };
      accessCommandType = input.commandType;
      data = {
        previewId: ACCESS_PREVIEW_ID,
        commandType: input.commandType,
        passId: input.commandType === 'ISSUE' ? null : ACCESS_PASS_ID,
        siteId: SITE_ID,
        floorId: FLOOR_ID,
        resourceId: DESTINATION_ID,
        destinationPoiId: DESTINATION_ID,
        expectedPassVersion: input.commandType === 'ISSUE' ? 0 : accessPassVersion,
        nfcEnabled: true,
        qrEnabled: true,
        eligible: true,
        impact:
          input.commandType === 'REVOKE'
            ? ['CURRENT_CREDENTIAL_REVOKED_IMMEDIATELY', 'AUDIT_EVIDENCE_RECORDED']
            : ['NEW_ONE_TIME_CREDENTIAL_ISSUED', 'AUDIT_EVIDENCE_RECORDED'],
        limitations: [],
        expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        createdAt: new Date().toISOString(),
      };
    } else if (path.endsWith('/workplace/navigation/access-pass:execute') && method === 'POST') {
      accessExecutePosts += 1;
      accessExecuteHeaders.push(request.headers());
      accessPassVersion += 1;
      accessPass = accessPassFixture(
        accessCommandType === 'REVOKE' ? 'REVOKED' : 'ACTIVE',
        accessPassVersion
      );
      data = accessCommand(
        accessCommandType === 'REVOKE' ? null : `DWP1.screen19-secret-${accessPassVersion}`,
        accessCommandType === 'REVOKE' ? null : `8N5KQ7RM2W4${accessPassVersion}`,
        false
      );
    } else if (path.endsWith('/workplace/navigation/access-pass') && method === 'GET') {
      data = {
        pass: accessPass,
        providers: [accessProvider('NFC'), accessProvider('SPEED_GATE')],
        bookingEligible: true,
        bookingEndsAt: new Date(Date.now() + 45 * 60_000).toISOString(),
        evaluatedAt: new Date().toISOString(),
      };
    } else if (path.endsWith('/workplace/navigation/pois')) {
      data = pois;
    } else if (path.endsWith('/workplace/navigation/routes')) {
      data =
        routeOutcome === 'GUIDED'
          ? {
              outcome: 'GUIDED',
              graphRevisionId: 'graph-19',
              graphRevisionNumber: 7,
              origin: pois[0],
              destination: pois[1],
              steps: [
                {
                  fromNodeId: pois[0]!.nodeId,
                  toNodeId: pois[1]!.nodeId,
                  floorId: FLOOR_ID,
                  travelMode: 'ELEVATOR',
                  travelSeconds: 90,
                  directionKo: '복도 끝 엘리베이터를 이용하세요.',
                  directionEn: 'Take the elevator at the end of the corridor.',
                },
              ],
              totalTravelSeconds: 90,
              fallback: null,
              limitations: [],
              graphPublishedAt: NOW,
              asOf: NOW,
            }
          : {
              outcome: 'GRAPH_MISSING',
              graphRevisionId: null,
              graphRevisionNumber: 0,
              origin: pois[0],
              destination: pois[1],
              steps: [],
              totalTravelSeconds: 0,
              fallback: {
                siteId: SITE_ID,
                floorId: FLOOR_ID,
                resourceId: DESTINATION_ID,
                siteName: '서울 본사',
                floorName: '19층',
                resourceName: '회의실 19A',
                floorMapPath: '/floor-19.svg',
                helpDesks: [pois[2]],
              },
              limitations: ['PUBLISHED_GRAPH_MISSING'],
              graphPublishedAt: null,
              asOf: NOW,
            };
    } else if (path.endsWith('/admin/workplace/devices') && method === 'GET') {
      data = [device()];
    } else if (path.endsWith('/admin/workplace/device-providers')) {
      data = [
        {
          capability: 'MDM',
          providerCode: 'mdm-adapter',
          state: 'CONFIGURED_UNVERIFIED',
          configurationVersion: 2,
          observedConfigurationVersion: null,
          evidenceReference: null,
          sourceAt: null,
          receivedAt: null,
          lastSuccessAt: null,
          errorCode: null,
          version: 2,
          evaluatedAt: NOW,
        },
        {
          capability: 'GRAPH',
          providerCode: 'graph-adapter',
          state: 'HEALTHY',
          configurationVersion: 4,
          observedConfigurationVersion: 4,
          evidenceReference: 'evidence-graph-4',
          sourceAt: NOW,
          receivedAt: NOW,
          lastSuccessAt: NOW,
          errorCode: null,
          version: 4,
          evaluatedAt: NOW,
        },
      ];
    } else if (path.endsWith(`/admin/workplace/devices/${DEVICE_ID}/audit-events`)) {
      data = [
        {
          auditEventId: 'audit-19',
          actorUserId: 9001,
          action: 'DEVICE_BOUND',
          resourceType: 'DEVICE',
          resourceId: DEVICE_ID,
          correlationId: 'screen-19-correlation',
          occurredAt: NOW,
        },
      ];
    } else if (
      path.endsWith(`/admin/workplace/devices/${DEVICE_ID}/commands`) &&
      method === 'GET'
    ) {
      data = [];
    } else if (
      path.endsWith(`/admin/workplace/devices/${DEVICE_ID}/commands:preview`) &&
      method === 'POST'
    ) {
      const headers = request.headers();
      previewAttempts.push({
        idempotencyKey: headers['idempotency-key'],
        correlationId: headers['x-correlation-id'],
        body: request.postData(),
      });
      if (previewFailuresRemaining > 0) {
        previewFailuresRemaining -= 1;
        await route.fulfill({
          status: 503,
          json: { code: 'SCREEN_19_PREVIEW_NETWORK_FAILURE' },
        });
        return;
      }
      const previewInput = request.postDataJSON() as { commandType?: string };
      lastCommandType = previewInput.commandType ?? 'FORCE_SYNC';
      data = {
        previewId: PREVIEW_ID,
        deviceId: DEVICE_ID,
        commandType: lastCommandType,
        expectedDeviceVersion: 4,
        payload: {},
        impact: ['Refresh schedule and policy projections'],
        eligible: true,
        limitations: [],
        expiresAt: '2026-09-16T03:10:00Z',
        createdAt: NOW,
      };
    } else if (
      path.endsWith(`/admin/workplace/devices/${DEVICE_ID}/commands`) &&
      method === 'POST'
    ) {
      commandPosts += 1;
      commandIdempotencyKeys.push(request.headers()['idempotency-key']);
      status = 202;
      data = {
        commandId: COMMAND_ID,
        deviceId: DEVICE_ID,
        actorUserId: 9001,
        commandType: lastCommandType,
        state: 'ACCEPTED',
        reason: '운영 장애 복구를 위한 검증된 동기화',
        resultCode: null,
        providerOperationReference: 'mdm-operation-19',
        version: 1,
        recoveryByGetOnly: false,
        statusHref: `/v1/admin/workplace/devices/commands/${COMMAND_ID}`,
        correlationId: 'screen-19-correlation',
        acceptedAt: NOW,
        completedAt: null,
        updatedAt: NOW,
      };
    } else if (
      path.endsWith(`/admin/workplace/devices/commands/${COMMAND_ID}`) &&
      method === 'GET'
    ) {
      receiptGets += 1;
      data = {
        commandId: COMMAND_ID,
        deviceId: DEVICE_ID,
        actorUserId: 9001,
        commandType: lastCommandType,
        state: 'RESULT_UNKNOWN',
        reason: '운영 장애 복구를 위한 검증된 동기화',
        resultCode: null,
        providerOperationReference: 'mdm-operation-19',
        version: 2,
        recoveryByGetOnly: true,
        statusHref: `/v1/admin/workplace/devices/commands/${COMMAND_ID}`,
        correlationId: 'screen-19-correlation',
        acceptedAt: NOW,
        completedAt: null,
        updatedAt: NOW,
      };
    } else if (path.endsWith(`/device/workplace/devices/${DEVICE_ID}/projection`)) {
      data = projection;
    } else {
      await route.fulfill({
        status: 404,
        json: { code: 'SCREEN_19_FIXTURE_MISSING', path, method },
      });
      return;
    }
    await route.fulfill({ status, json: { data } });
  });
  return {
    setRouteOutcome: (value: 'GUIDED' | 'GRAPH_MISSING') => {
      routeOutcome = value;
    },
    setProjection: (value: unknown) => {
      projection = value;
    },
    commandCounts: () => ({ commandPosts, receiptGets }),
    failNextPreview: () => {
      previewFailuresRemaining += 1;
    },
    previewAttempts: () => [...previewAttempts],
    commandIdempotencyKeys: () => [...commandIdempotencyKeys],
    accessCommandCounts: () => ({ accessExecutePosts, accessExecuteHeaders }),
    resetAccessPass: () => {
      accessPass = null;
      accessPassVersion = 0;
      accessCommandType = 'ISSUE';
    },
  };

  function accessProvider(capability: 'NFC' | 'SPEED_GATE') {
    const observedAt = new Date().toISOString();
    return {
      capability,
      providerCode: capability === 'NFC' ? 'verified-nfc' : 'verified-gate',
      state: 'HEALTHY',
      configurationVersion: 8,
      observedConfigurationVersion: 8,
      evidenceReference: `evidence:${capability.toLowerCase()}`,
      sourceAt: observedAt,
      receivedAt: observedAt,
      lastSuccessAt: observedAt,
      errorCode: null,
      version: 2,
      evaluatedAt: observedAt,
    };
  }

  function accessPassFixture(state: 'ACTIVE' | 'REVOKED', version: number) {
    const observedAt = new Date().toISOString();
    return {
      passId: ACCESS_PASS_ID,
      sourceBookingId: '19000000-0000-4000-8000-000000000015',
      siteId: SITE_ID,
      floorId: FLOOR_ID,
      resourceId: DESTINATION_ID,
      destinationPoiId: DESTINATION_ID,
      state,
      credentialLastFour: `7C2${version}`,
      pairingAvailable: state === 'ACTIVE',
      nfcEnabled: state === 'ACTIVE',
      qrEnabled: state === 'ACTIVE',
      nfcProviderCode: state === 'ACTIVE' ? 'verified-nfc' : null,
      nfcProviderConfigurationVersion: state === 'ACTIVE' ? 8 : null,
      nfcProviderEvidenceReference: state === 'ACTIVE' ? 'evidence:nfc' : null,
      qrProviderCode: state === 'ACTIVE' ? 'verified-gate' : null,
      qrProviderConfigurationVersion: state === 'ACTIVE' ? 8 : null,
      qrProviderEvidenceReference: state === 'ACTIVE' ? 'evidence:speed_gate' : null,
      version,
      issuedAt: observedAt,
      expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
      revokedAt: state === 'REVOKED' ? observedAt : null,
      updatedAt: observedAt,
    };
  }

  function accessCommand(
    oneTimeCredential: string | null,
    pairingCode: string | null,
    replayed: boolean
  ) {
    const observedAt = new Date().toISOString();
    return {
      receipt: {
        commandId: ACCESS_COMMAND_ID,
        passId: ACCESS_PASS_ID,
        commandType: accessCommandType,
        state: 'SUCCEEDED',
        reason: '예약된 회의실 출입',
        resultCode: null,
        version: 1,
        recoveryByGetOnly: replayed,
        statusHref: `/v1/workplace/navigation/access-pass/commands/${ACCESS_COMMAND_ID}`,
        correlationId: 'screen-19-access-correlation',
        acceptedAt: observedAt,
        completedAt: observedAt,
        updatedAt: observedAt,
      },
      pass: accessPass,
      oneTimeCredential,
      pairingCode,
      replayed,
    };
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  ).toBe(true);
}

async function expectNoSeriousAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(
    results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? '')
    )
  ).toEqual([]);
}

async function confirmAccessPassCommand(page: Page, reason: string) {
  const dialog = page.getByRole('dialog', { name: '출입 패스 변경 영향 확인' });
  await expect(dialog).toBeVisible();
  await page.getByLabel('업무 사유').fill(reason);
  await page.getByLabel('영향을 확인했으며 이 작업을 실행합니다.').check();
  await page.getByRole('button', { name: '확인 후 실행' }).click();
  await expect(dialog).toHaveCount(0);
}

test.describe('Screen 19 indoor navigation and device experience', () => {
  test.setTimeout(75_000);
  test('uses published routes and explicit graph fallback at 1440, 1280, 390, and 320', async ({
    page,
  }) => {
    await installHarness(page);
    const api = await installApi(page);
    for (const width of [1440, 1280, 390, 320]) {
      await page.setViewportSize({ width, height: width <= 390 ? 780 : 900 });
      api.setRouteOutcome(width === 320 ? 'GRAPH_MISSING' : 'GUIDED');
      await page.goto(`/__screen19?view=wayfinding&siteId=${SITE_ID}`);
      await page.getByRole('button', { name: '경로 찾기' }).click();
      if (width === 320) {
        await expect(page.getByRole('heading', { name: '대체 안내' })).toBeVisible();
        await expect(
          page.getByText('게시된 실내 지도가 없어 경로를 표시할 수 없습니다.')
        ).toBeVisible();
        await expect(page.locator('ol')).toHaveCount(0);
      } else {
        await expect(page.getByRole('heading', { name: '경로 요약' })).toBeVisible();
        await expect(page.getByText('게시 지도 r7')).toBeVisible();
      }
      await expectNoHorizontalOverflow(page);
      await expectNoSeriousAxeViolations(page);
    }
    await page.setViewportSize({ width: 320, height: 780 });
    await page.goto(`/__screen19?view=wayfinding&siteId=${SITE_ID}`);
    const refreshButton = page.getByRole('button', { name: '새로고침' });
    await expect(refreshButton).toBeVisible();
    await refreshButton.focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('combobox', { name: '출발지' })).toBeFocused();
  });

  test('runs preview-confirm-receipt and RESULT_UNKNOWN GET-only recovery once', async ({
    page,
  }) => {
    await installHarness(page);
    const api = await installApi(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/__screen19?view=devices');
    await page.getByRole('button', { name: '원격 작업' }).click();
    api.failNextPreview();
    await page.getByRole('button', { name: '영향 미리보기' }).click();
    await expect(
      page.getByText('영향을 확인하지 못했습니다. 명령은 실행되지 않았습니다.')
    ).toBeVisible();
    await page.getByRole('button', { name: '영향 미리보기' }).click();
    await expect(page.getByText('Refresh schedule and policy projections')).toBeVisible();
    expect(api.previewAttempts()).toHaveLength(2);
    expect(api.previewAttempts()[1]).toEqual(api.previewAttempts()[0]);

    await page.getByRole('button', { name: '영향 미리보기' }).click();
    await expect.poll(() => api.previewAttempts().length).toBe(3);
    expect(api.previewAttempts()[2]?.idempotencyKey).not.toBe(
      api.previewAttempts()[1]?.idempotencyKey
    );
    expect(api.previewAttempts()[2]?.correlationId).not.toBe(
      api.previewAttempts()[1]?.correlationId
    );

    await page.getByRole('button', { name: '미리보기 취소' }).click();
    await expect(page.getByText('Refresh schedule and policy projections')).toHaveCount(0);
    await page.getByRole('button', { name: '영향 미리보기' }).click();
    await expect(page.getByText('Refresh schedule and policy projections')).toBeVisible();
    expect(api.previewAttempts()).toHaveLength(4);
    expect(api.previewAttempts()[3]?.idempotencyKey).not.toBe(
      api.previewAttempts()[2]?.idempotencyKey
    );

    await page.getByLabel('사유').fill('운영 장애 복구를 위한 검증된 동기화');
    await page.getByLabel('영향을 확인했으며 이 작업을 실행합니다.').check();
    await page.getByRole('button', { name: '명령 실행' }).click();
    await expect(
      page.getByText('전송 결과가 불명확합니다. 원 명령을 다시 보내지 말고 상태만 조회하세요.')
    ).toBeVisible({ timeout: 8_000 });
    expect(api.commandCounts().commandPosts).toBe(1);
    expect(api.commandCounts().receiptGets).toBeGreaterThan(0);
    expect(api.commandIdempotencyKeys()[0]).not.toBe(api.previewAttempts()[3]?.idempotencyKey);
    await page.getByRole('button', { name: '상태 재조회' }).click();
    expect(api.commandCounts().commandPosts).toBe(1);
    await expectNoSeriousAxeViolations(page);
  });

  test('opens queryless wayfinding and completes one-time pass issue, rotate, QR, and revoke on desktop and mobile', async ({
    page,
  }) => {
    await installHarness(page);
    const api = await installApi(page);

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/__screen19?view=wayfinding');
    await expect(page.getByRole('heading', { name: '경로 요약' })).toBeVisible();
    await expect(page.getByTestId('workplace-access-pass')).toBeVisible();
    await page.getByRole('button', { name: '원타임 패스 발급' }).click();
    await confirmAccessPassCommand(page, '예약된 회의실 출입');
    await expect(page.getByText('8N5K Q7RM 2W41')).toBeVisible();
    await page.getByRole('button', { name: '키오스크 QR 인식' }).click();
    await expect(page.locator('svg[aria-label="키오스크에서 스캔"]')).toBeVisible();
    await page.getByRole('button', { name: '닫기' }).click();
    await page.getByRole('button', { name: '보안 토큰 재발급' }).click();
    await confirmAccessPassCommand(page, '노출 가능성이 있어 토큰 교체');
    await expect(page.getByText('8N5K Q7RM 2W42')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAxeViolations(page);

    api.resetAccessPass();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/__screen19?view=wayfinding');
    await expect(page.getByRole('heading', { name: '경로 요약' })).toBeVisible();
    await page.getByRole('button', { name: '원타임 패스 발급' }).click();
    await confirmAccessPassCommand(page, '모바일 출입 패스 발급');
    await expect(page.getByText('DWP 모바일 원타임 패스')).toBeVisible();
    await page.getByRole('button', { name: '긴급 회수' }).click();
    await confirmAccessPassCommand(page, '모바일 기기 분실로 즉시 회수');
    await expect(page.getByText('회수됨')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAxeViolations(page);

    const commands = api.accessCommandCounts();
    expect(commands.accessExecutePosts).toBe(4);
    expect(
      commands.accessExecuteHeaders.every(
        (headers) =>
          headers['x-dwp-active-access-mode'] === 'ELEVATED' && Boolean(headers['idempotency-key'])
      )
    ).toBe(true);
    expect(
      new Set(commands.accessExecuteHeaders.map((headers) => headers['idempotency-key'])).size
    ).toBe(4);
  });

  test('separates 16:9 room panel, status board, masking, freshness, and safety takeover', async ({
    page,
  }) => {
    await installHarness(page);
    const api = await installApi(page);
    await page.setViewportSize({ width: 390, height: 780 });
    api.setProjection(roomProjection());
    await page.goto(`/__screen19?view=room-panel&deviceId=${DEVICE_ID}`);
    await expect(page.getByTestId('workplace-room-panel')).toBeVisible();
    await expect(page.getByText('비공개 일정')).toBeVisible();
    await expect(page.getByText('극비 프로젝트 회의')).toHaveCount(0);
    await expect(page.getByText('원문 사용자')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    api.setProjection(boardProjection());
    await page.goto(`/__screen19?view=status-board&deviceId=${DEVICE_ID}&locale=en`);
    await expect(page.getByTestId('workplace-status-board')).toBeVisible();
    await expect(page.getByText('20m right')).toBeVisible();
    await expect(page.getByText('This display is using stale information.')).toBeVisible();

    await page.setViewportSize({ width: 320, height: 780 });
    api.setProjection(roomProjection(true));
    await page.goto(`/__screen19?view=room-panel&deviceId=${DEVICE_ID}`);
    await expect(page.getByRole('alert')).toContainText('즉시 대피하세요');
    await expect(page.getByText('안전 운영자 ···45')).toBeVisible();
    await expect(page.getByText('918745')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAxeViolations(page);
  });
});
