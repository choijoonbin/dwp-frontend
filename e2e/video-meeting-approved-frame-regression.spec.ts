import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { mockPersonalRoom } from './support/meeting-personal-room-fixtures';
import {
  mockApprovedAdmin,
  mockApprovedFollowUps,
  mockApprovedLiveRoom,
  mockApprovedTemplatesAndPreferences,
} from './support/meeting-approved-frame-evidence-fixtures';
import {
  MEETING_VISUAL_ID,
  mockMeetingVisualHome,
  mockMeetingVisualHomeReports,
  mockMeetingVisualMine,
  mockMeetingVisualPrejoin,
  mockMeetingVisualPublishedRecap,
  mockMeetingVisualSession,
} from './support/video-meeting-visual-fixtures';
import { MEETING_APPROVED_FRAMES } from './support/meeting-approved-frame-contract';

import type { MeetingApprovedFrameImplementationGolden } from './support/meeting-approved-frame-contract';
import type { Page } from '@playwright/test';

type ApprovedRuntimeScreen =
  'U01' | 'U02' | 'U05' | 'U06' | 'U07' | 'U08' | 'U09' | 'U10' | 'U11' | 'U12' | 'U13' | 'U14';

const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
const MOBILE_DOCUMENT_HEIGHT_LIMIT = 8_000;

const cases = [
  { screen: 'U01' },
  { screen: 'U02' },
  { screen: 'U05' },
  { screen: 'U06' },
  { screen: 'U07' },
  { screen: 'U08' },
  { screen: 'U09' },
  { screen: 'U10' },
  { screen: 'U11' },
  { screen: 'U12' },
  { screen: 'U13' },
  { screen: 'U14' },
] as const satisfies readonly {
  screen: ApprovedRuntimeScreen;
}[];

test.describe.configure({ mode: 'serial' });

async function ready(page: Page) {
  const main = page.locator('#dwp-main-content');
  await expect(main).toBeVisible({ timeout: 30_000 });
  await expect(main.locator('.MuiSkeleton-root')).toHaveCount(0, { timeout: 30_000 });
}

async function prepareApprovedState(page: Page, screen: ApprovedRuntimeScreen) {
  switch (screen) {
    case 'U01':
      await mockMeetingVisualSession(page, { locale: 'ko', colorScheme: 'light' });
      await mockMeetingVisualHome(page, 'SAMPLE');
      await mockMeetingVisualHomeReports(page);
      await page.goto('/meetings/home');
      break;
    case 'U02':
      await mockMeetingVisualSession(page, { locale: 'ko', colorScheme: 'light' });
      await mockMeetingVisualMine(page);
      await page.goto('/meetings/mine');
      break;
    case 'U05':
      await mockMeetingVisualSession(page, { locale: 'ko', colorScheme: 'light' });
      await mockMeetingVisualPrejoin(page);
      await page.goto(`/meetings/room/${MEETING_VISUAL_ID}`);
      await page.getByRole('button', { name: '카메라와 마이크 점검', exact: true }).click();
      break;
    case 'U06':
      await mockApprovedLiveRoom(page);
      await page.goto(`/meetings/room/${MEETING_VISUAL_ID}`);
      await page.getByRole('button', { name: '카메라와 마이크 점검', exact: true }).click();
      await page.getByRole('button', { name: '회의 참여', exact: true }).click();
      break;
    case 'U07':
      await mockMeetingVisualSession(page, { locale: 'ko', colorScheme: 'light' });
      await mockMeetingVisualPublishedRecap(page);
      await page.goto('/meetings/history');
      break;
    case 'U08':
      await mockMeetingVisualSession(page, { locale: 'ko', colorScheme: 'light' });
      await mockMeetingVisualPublishedRecap(page);
      await page.goto(`/meetings/history?meeting=${MEETING_VISUAL_ID}`);
      break;
    case 'U09':
      await mockApprovedFollowUps(page);
      await page.goto('/meetings/follow-ups');
      break;
    case 'U10':
      await mockApprovedTemplatesAndPreferences(page);
      await page.goto('/meetings/templates');
      break;
    case 'U11':
      await mockPersonalRoom(page, { locale: 'ko', colorScheme: 'light' });
      await page.goto('/meetings/mine?view=personal-room');
      break;
    case 'U12':
      await mockApprovedTemplatesAndPreferences(page);
      await page.goto('/meetings/preferences');
      break;
    case 'U13':
      await mockApprovedAdmin(page, true);
      await page.goto('/meetings/admin/operations');
      break;
    case 'U14':
      await mockApprovedAdmin(page, false);
      await page.goto('/meetings/admin/policies');
      break;
  }
  await ready(page);
}

async function expectApprovedStructure(page: Page, screen: ApprovedRuntimeScreen, mobile: boolean) {
  switch (screen) {
    case 'U01':
      await expect(page.getByTestId('meeting-day-lists')).toBeVisible();
      await expect(page.getByTestId('meeting-home-recent')).toBeVisible();
      break;
    case 'U02':
      await expect(page.getByTestId('my-meetings-list')).toBeVisible();
      await expect(page.getByTestId('my-meetings-inspector')).toBeVisible();
      break;
    case 'U05':
      await expect(page.locator('.dwp-meeting-prejoin__stage')).toBeVisible();
      await expect(page.locator('.dwp-meeting-prejoin__rail')).toBeVisible();
      break;
    case 'U06':
      await expect(page.locator('.dwp-video-meeting-room')).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('.dwp-video-meeting-room__interactions')).toBeVisible();
      if (mobile) {
        const liveKitStatus = page.locator('.lk-toast-connection-state');
        await expect(liveKitStatus).toBeVisible();
        const overlapsHeaderIdentity = await page.evaluate(() => {
          const identity = document.querySelector<HTMLElement>('.dwp-video-meeting-room__identity');
          const status = document.querySelector<HTMLElement>('.lk-toast-connection-state');
          if (!identity || !status) return true;
          const identityBox = identity.getBoundingClientRect();
          const statusBox = status.getBoundingClientRect();
          return !(
            statusBox.right <= identityBox.left ||
            statusBox.left >= identityBox.right ||
            statusBox.bottom <= identityBox.top ||
            statusBox.top >= identityBox.bottom
          );
        });
        expect(overlapsHeaderIdentity, 'U06: connection status must not overlap identity').toBe(
          false
        );
      }
      break;
    case 'U07':
      await expect(page.getByTestId('meeting-library-list')).toBeVisible();
      if (mobile) await expect(page.getByTestId('meeting-library-preview')).toBeHidden();
      else await expect(page.getByTestId('meeting-library-preview')).toBeVisible();
      break;
    case 'U08':
      await expect(page.getByTestId('meeting-recap-overview')).toBeVisible();
      await expect(page.getByTestId('meeting-recap-evidence-rail')).toBeVisible();
      break;
    case 'U09':
      await expect(page.getByTestId('meeting-follow-ups')).toBeVisible();
      await expect(page.locator('[data-testid^="follow-up-row-"]').first()).toBeVisible();
      break;
    case 'U10':
      await expect(page.getByTestId('meeting-templates')).toBeVisible();
      await expect(page.getByTestId('template-list')).toBeVisible();
      await expect(
        page.getByTestId('template-list').locator('.MuiCircularProgress-root')
      ).toHaveCount(0);
      if (!mobile) await expect(page.getByTestId('template-preview')).toContainText('출시 날짜');
      break;
    case 'U11':
      await expect(page.getByTestId('meeting-personal-room')).toBeVisible();
      await expect(page.locator('section[aria-labelledby="personal-room-current"]')).toBeVisible();
      break;
    case 'U12':
      await expect(page.getByTestId('meeting-preferences-workspace')).toBeVisible();
      await expect(page.locator('#meeting-preferences-advanced')).toBeVisible();
      break;
    case 'U13':
      await expect(page.getByTestId('meeting-admin-impact-primary')).toBeVisible();
      await expect(page.getByTestId('meeting-admin-service-readiness')).toBeVisible();
      break;
    case 'U14':
      await expect(page.getByRole('complementary')).toBeVisible();
      await expect(page.getByRole('region').first()).toBeVisible();
      break;
  }
}

async function expectNoHorizontalOverflow(page: Page, label: string, tolerancePx = 1) {
  const overflow = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>('#dwp-main-content');
    return {
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      main: main ? main.scrollWidth - main.clientWidth : 0,
    };
  });
  expect(overflow.document, `${label}: document overflow`).toBeLessThanOrEqual(tolerancePx);
  expect(overflow.main, `${label}: main overflow`).toBeLessThanOrEqual(tolerancePx);
}

async function expectNoBlockingA11y(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).include('#dwp-main-content').analyze();
  expect(
    results.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious'),
    `${label}: serious or critical accessibility violations`
  ).toEqual([]);
}

async function settleVisualLayout(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

async function expectMobileLandmarkOrder(
  page: Page,
  label: string,
  evidence: MeetingApprovedFrameImplementationGolden
) {
  const landmarks: Array<{ selector: string; top: number }> = [];
  for (const selector of evidence.orderedLandmarks) {
    const landmark = page.locator(selector).first();
    await expect(landmark, `${label}: ${selector} must be visible`).toBeVisible();
    const box = await landmark.boundingBox();
    expect(box, `${label}: ${selector} must own layout geometry`).not.toBeNull();
    landmarks.push({ selector, top: box?.y ?? Number.NEGATIVE_INFINITY });
  }
  for (let index = 1; index < landmarks.length; index += 1) {
    expect(
      landmarks[index].top,
      `${label}: ${landmarks[index].selector} must not precede ${landmarks[index - 1].selector}`
    ).toBeGreaterThanOrEqual(landmarks[index - 1].top - 1);
  }
}

async function expectMobileFirstFoldClearance(
  page: Page,
  label: string,
  evidence: MeetingApprovedFrameImplementationGolden
) {
  const { clearance } = evidence;
  if (!clearance.fixedOverlaySelector || !clearance.fixedOverlayContentSelector) return;
  const overlay = page.locator(clearance.fixedOverlaySelector).first();
  const content = page.locator(clearance.fixedOverlayContentSelector).first();
  await expect(overlay, `${label}: fixed navigation must be visible`).toBeVisible();
  await expect(content, `${label}: fixed navigation content clearance must exist`).toBeVisible();
  const overlayBox = await overlay.boundingBox();
  expect(overlayBox, `${label}: fixed navigation must own layout geometry`).not.toBeNull();
  const metrics = await page.evaluate(
    ({ overlaySelector, contentSelector }) => {
      const fixedOverlay = document.querySelector<HTMLElement>(overlaySelector);
      const contentRoot = document.querySelector<HTMLElement>(contentSelector);
      if (!fixedOverlay || !contentRoot) return null;
      return {
        viewportHeight: window.innerHeight,
        position: getComputedStyle(fixedOverlay).position,
        contentPaddingBottom: Number.parseFloat(getComputedStyle(contentRoot).paddingBottom),
      };
    },
    {
      overlaySelector: clearance.fixedOverlaySelector,
      contentSelector: clearance.fixedOverlayContentSelector,
    }
  );
  expect(metrics, `${label}: fixed navigation metrics`).not.toBeNull();
  expect(metrics?.position, `${label}: navigation position`).toBe('fixed');
  expect(
    Math.abs((overlayBox?.y ?? 0) + (overlayBox?.height ?? 0) - (metrics?.viewportHeight ?? 0)),
    `${label}: fixed navigation must end at the real viewport bottom`
  ).toBeLessThanOrEqual(1);
  expect(
    metrics?.contentPaddingBottom ?? 0,
    `${label}: document content must clear fixed navigation plus breathing room`
  ).toBeGreaterThanOrEqual((overlayBox?.height ?? 0) + 23);
}

async function prepareMobileCanonicalCapture(
  page: Page,
  label: string,
  evidence: MeetingApprovedFrameImplementationGolden
) {
  await expectMobileLandmarkOrder(page, label, evidence);
  await expectMobileFirstFoldClearance(page, label, evidence);
  if (evidence.captureClass === 'IMMERSIVE_VIEWPORT') {
    expect(
      await page.evaluate(() => window.innerHeight),
      `${label}: immersive viewport height`
    ).toBe(evidence.expectedRasterHeight);
    return evidence.expectedRasterHeight;
  }

  let targetHeight = await page.evaluate(() =>
    Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))
  );
  let converged = false;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    expect(targetHeight, `${label}: whole-document height lower bound`).toBeGreaterThan(
      MOBILE_VIEWPORT.height
    );
    expect(targetHeight, `${label}: whole-document height upper bound`).toBeLessThanOrEqual(
      MOBILE_DOCUMENT_HEIGHT_LIMIT
    );
    await page.setViewportSize({ width: MOBILE_VIEWPORT.width, height: targetHeight });
    await settleVisualLayout(page);
    const measuredHeight = await page.evaluate(() =>
      Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))
    );
    if (Math.abs(measuredHeight - targetHeight) <= 1) {
      targetHeight = measuredHeight;
      converged = true;
      break;
    }
    targetHeight = measuredHeight;
  }
  expect(converged, `${label}: whole-document height must converge`).toBe(true);
  expect(await page.evaluate(() => window.innerWidth), `${label}: canonical mobile width`).toBe(
    MOBILE_VIEWPORT.width
  );
  expect(await page.evaluate(() => window.innerHeight), `${label}: canonical document height`).toBe(
    targetHeight
  );
  expect(targetHeight, `${label}: contracted canonical document height`).toBe(
    evidence.expectedRasterHeight
  );
  await expectMobileLandmarkOrder(page, label, evidence);

  const lastContent = page.locator(evidence.clearance.lastContentSelector).last();
  await expect(lastContent, `${label}: last meaningful content must be visible`).toBeVisible();
  const lastContentBox = await lastContent.boundingBox();
  expect(lastContentBox, `${label}: last meaningful content geometry`).not.toBeNull();
  const overlayBox = evidence.clearance.fixedOverlaySelector
    ? await page.locator(evidence.clearance.fixedOverlaySelector).first().boundingBox()
    : null;
  const terminalY = overlayBox?.y ?? targetHeight;
  const trailingGap = terminalY - ((lastContentBox?.y ?? 0) + (lastContentBox?.height ?? 0));
  expect(
    trailingGap,
    `${label}: content must not run behind the terminal boundary`
  ).toBeGreaterThanOrEqual(-1);
  expect(trailingGap, `${label}: trailing whitespace must stay bounded`).toBeLessThanOrEqual(
    evidence.clearance.maxTrailingGapPx
  );
  if (overlayBox) {
    expect(
      Math.abs(overlayBox.y + overlayBox.height - targetHeight),
      `${label}: fixed navigation must move to the canonical document bottom exactly once`
    ).toBeLessThanOrEqual(1);
  }
  await expectNoHorizontalOverflow(
    page,
    `${label} whole document`,
    evidence.clearance.horizontalOverflowTolerancePx
  );
  return targetHeight;
}

for (const approvedCase of cases) {
  test(`${approvedCase.screen} executes the approved semantic state at exact desktop/mobile width`, async ({
    page,
  }, testInfo) => {
    const mobile = testInfo.project.name === 'mobile';
    await page.setViewportSize({
      width: mobile ? MOBILE_VIEWPORT.width : 1440,
      height: mobile ? MOBILE_VIEWPORT.height : 960,
    });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    const diagnostics: string[] = [];
    page.on('pageerror', ({ message }) => diagnostics.push(`pageerror: ${message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') diagnostics.push(`console: ${message.text()}`);
    });

    await prepareApprovedState(page, approvedCase.screen);
    const approvedFrame = MEETING_APPROVED_FRAMES.find(
      ({ screen, mode }) =>
        screen === approvedCase.screen && mode === (mobile ? 'mobile' : 'desktop')
    );
    expect(approvedFrame, `${approvedCase.screen}: exact runtime contract`).toBeDefined();
    if (!approvedFrame) return;
    await expectApprovedStructure(page, approvedCase.screen, mobile);
    await expectNoHorizontalOverflow(
      page,
      `${approvedCase.screen} ${mobile ? 'mobile' : 'desktop'}`
    );
    await expectNoBlockingA11y(page, `${approvedCase.screen} ${mobile ? 'mobile' : 'desktop'}`);
    expect(diagnostics, `${approvedCase.screen}: clean runtime`).toEqual([]);
    if (mobile) {
      await prepareMobileCanonicalCapture(
        page,
        `${approvedCase.screen} mobile`,
        approvedFrame.implementationGolden
      );
    }
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.scrollingElement?.scrollTo(0, 0);
      for (const element of document.querySelectorAll<HTMLElement>('*')) {
        if (element.scrollTop !== 0) element.scrollTop = 0;
        if (element.scrollLeft !== 0) element.scrollLeft = 0;
      }
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page).toHaveScreenshot(approvedFrame.implementationGolden.screenshotName, {
      animations: 'disabled',
      caret: 'hide',
      fullPage: !mobile && approvedCase.screen !== 'U06',
      maxDiffPixelRatio: 0.002,
      timeout: 30_000,
    });
  });
}
