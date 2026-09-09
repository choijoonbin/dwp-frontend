import { expect, test, type Page } from '@playwright/test';
import { withMeetingDocumentCapture } from './support/meeting-document-capture';
import {
  mockScheduleWorkspace,
  scheduleResponse,
  SCHEDULE_TEMPLATE_ID,
} from './support/meeting-schedule-fixtures';
import {
  mockMeetingVisualSession,
  MEETING_VISUAL_SUMMARY,
} from './support/video-meeting-visual-fixtures';
import {
  expectNoBlockingA11y,
  expectNoHorizontalOverflow,
} from './support/video-meeting-visual-accessibility';
import en from '../libs/shared-i18n/src/locales/en/meetings.json' with { type: 'json' };

// Review captures are implementation evidence, NOT automatic approval against the Stitch source.
// Original U02/U03 desktop/mobile frames remain immutable and require direct human/agent comparison.
const titles = [
  '분기 제품 출시 의사결정 (Q3 Final Go/No-Go)',
  '플랫폼 디자인 시스템 싱크',
  '1:1 정기 체크인',
  '인프라 운영 정기 점검',
];
const agenda = ['출시 범위 및 스펙 확인', '보안·성능 위험 검토', '배포 승인자 일정 확정'];
const ids = titles.map(
  (_, index) => '81000000-0000-4000-8000-' + String(401 + index).padStart(12, '0')
);
const participantId = '82000000-0000-4000-8000-000000000042';
const prep = (index: number, accepted = false) => {
  const response = {
    participantId,
    displayName: '김민아',
    response: index === 3 && !accepted ? 'NEEDS_RESPONSE' : 'ACCEPTED',
    invitationRevision: 2,
    respondedAt: index === 0 ? null : accepted ? '2026-09-04T04:00:00Z' : null,
    version: accepted ? 1 : 0,
    mine: true,
  };
  return {
    meetingId: ids[index],
    meetingVersion: 7,
    agendaVersion: 2,
    materialsVersion: 0,
    invitationRevision: 2,
    agendaItems: agenda.map((title, position) => ({
      itemId: '89000000-0000-4000-8000-' + String(position + 1).padStart(12, '0'),
      position,
      title,
      objective: [
        '발표 아티팩트 v2.1 점검',
        '부하 테스트 메트릭 및 비용 추적',
        '최종 롤아웃 일정 확정',
      ][position],
      plannedMinutes: 15,
      ownerUserId: null,
      ownerDisplayName: null,
    })),
    materials:
      index === 0
        ? ['Q3 제품 로드맵 v1.4.pdf', '클라우드 보안 점검 결과.docx'].map((displayName, n) => ({
            materialId: '85000000-0000-4000-8000-' + String(n + 1).padStart(12, '0'),
            displayName,
            contentType: 'application/pdf',
            referenceProvider: 'DWP_FILES',
            opaqueReference: null,
            sourceVersion: null,
            classification: 'INTERNAL',
            sizeBytes: null,
            contentSha256: null,
            retentionUntil: '2026-10-04T00:00:00Z',
            accessVerificationState: 'PENDING_REVALIDATION',
            version: 0,
          }))
        : [],
    myResponse: response,
    invitationResponses:
      index === 0
        ? [
            response,
            ...Array.from({ length: 7 }, (_, n) => ({
              ...response,
              participantId: '82000000-0000-4000-8000-' + String(43 + n).padStart(12, '0'),
              displayName: ['박수석', '최준빈', '정서우', '김태호', '이도현', '강태훈', '장지훈'][
                n
              ],
              mine: false,
              response: n === 6 ? 'NEEDS_RESPONSE' : 'ACCEPTED',
            })),
          ]
        : [response],
    invitationCounts: {
      accepted: index === 3 && !accepted ? 0 : 7,
      tentative: 0,
      declined: 0,
      pending: index === 3 && !accepted ? 1 : 1,
    },
    myPreparation: { agendaVersion: 2, version: 0, preparedAgendaItemIds: [], updatedAt: null },
    canEditAgenda: index === 0,
    canManageMaterials: index === 0,
    canRespond: index === 3,
    canPrepare: true,
    observedAt: '2026-09-04T04:00:00Z',
  };
};
async function mine(page: Page, locale: 'ko' | 'en' = 'ko', dark = false, paginated = false) {
  await mockMeetingVisualSession(page, { locale, colorScheme: dark ? 'dark' : 'light' });
  const calls: Array<Record<string, unknown>> = [];
  let accepted = false;
  let revoked = false;
  await page.route('**/api/meetings/v1/meetings**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const index = ids.findIndex((id) => path.includes(id));
    const meetings = titles.map((title, n) => ({
      ...MEETING_VISUAL_SUMMARY,
      meetingId: ids[n],
      title,
      agenda: agenda.join('\n'),
      description:
        n === 0 ? '프로덕션 릴리스 컷오프 전 품질 게이트와 최종 리스크를 검토합니다.' : null,
      startsAt: `2026-09-0${n === 3 ? 5 : 4}T0${5 + n}:00:00Z`,
      endsAt: `2026-09-0${n === 3 ? 5 : 4}T0${5 + n}:45:00Z`,
      durationMinutes: 45,
      canHost: n === 0,
      organizerName: n === 0 ? '김민아' : '최준빈',
      organizerUserId: n === 0 ? 42 : 43,
      participantRole: n === 0 ? 'ORGANIZER' : 'ATTENDEE',
    }));
    if (path.endsWith('/invitation-response')) {
      calls.push(route.request().postDataJSON());
      accepted = true;
      return scheduleResponse(route, prep(index, true));
    }
    if (path.endsWith('/preparation'))
      return scheduleResponse(route, revoked ? null : prep(index, accepted), revoked ? 403 : 200);
    if (path.endsWith('/schedule'))
      return scheduleResponse(route, {
        meetingId: ids[index],
        lifecycleState: 'SCHEDULED',
        startsAt: meetings[index].startsAt,
        endsAt: meetings[index].endsAt,
        timeZone: 'Asia/Seoul',
        meetingVersion: 7,
        seriesId: index === 0 ? '86000000-0000-4000-8000-000000000001' : null,
        occurrenceIndex: index === 0 ? 12 : null,
        occurrenceCount: index === 0 ? 24 : null,
        frequency: index === 0 ? 'WEEKLY' : null,
        recurrenceInterval: index === 0 ? 1 : null,
        seriesVersion: index === 0 ? 3 : null,
        exceptionState: 'NONE',
        invitationRevision: 2,
        deliveryState: 'DELIVERED',
      });
    if (path.endsWith('/content-plan'))
      return scheduleResponse(route, {
        meetingId: ids[index],
        planId: '87000000-0000-4000-8000-000000000001',
        recordingRequested: false,
        transcriptionRequested: false,
        aiSummaryRequested: false,
        e2eeEnabled: false,
        state: 'DISABLED',
        blockers: [],
        dependencies: {
          egressAvailable: false,
          storageAvailable: false,
          kmsAvailable: false,
          auditAvailable: false,
          speechToTextAvailable: false,
          languageModelAvailable: false,
        },
        consent: { requiredAcknowledgements: 0, receivedAcknowledgements: 0, complete: true },
        version: 0,
        updatedAt: '2026-09-04T04:00:00Z',
      });
    if (index >= 0) return scheduleResponse(route, meetings[index]);
    return scheduleResponse(route, {
      items: meetings,
      total: paginated ? 24 : 4,
      page: paginated ? Number(new URL(route.request().url()).searchParams.get('page')) : 0,
      pageSize: 10,
    });
  });
  return {
    calls,
    revoke: () => {
      revoked = true;
    },
  };
}

const template = {
  templateId: SCHEDULE_TEMPLATE_ID,
  scope: 'ORGANIZATION',
  name: titles[0],
  purpose:
    '2026 Q3 프로덕트 릴리스 대상 컴포넌트의 기능 무결성 평가 및 보안 취약점 점검을 진행합니다. 아티팩트 사전 점검 필수.',
  category: 'DECISION',
  durationMinutes: 45,
  agendaItems: agenda.map((title, index) => ({
    title,
    description: ['발표 아티팩트 v2.1 점검', '부하 테스트 메트릭 점검', '최종 롤아웃 일정 확정'][
      index
    ],
    role: ['박수석', '최준빈', '김민아'][index],
    durationMinutes: 15,
  })),
  favorite: true,
  canEdit: false,
  version: 2,
  updatedAt: '2026-09-04T00:00:00Z',
};
async function schedule(page: Page, locale: 'ko' | 'en' = 'ko', dark = false) {
  const state = await mockScheduleWorkspace(page, { locale, dark });
  await page.route('**/api/meetings/v1/templates**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/apply'))
      return scheduleResponse(route, {
        sourceTemplateId: SCHEDULE_TEMPLATE_ID,
        sourceTemplateVersion: 2,
        title: template.name,
        purpose: template.purpose,
        durationMinutes: 45,
        agendaItems: template.agendaItems,
        accessScope: 'INVITED',
        waitingRoomEnabled: true,
        defaultMicrophoneEnabled: false,
        defaultCameraEnabled: false,
        requiresPolicyRevalidation: true,
      });
    if (path.endsWith(SCHEDULE_TEMPLATE_ID)) return scheduleResponse(route, template);
    return scheduleResponse(route, { items: [template], total: 1, page: 0, pageSize: 30 });
  });
  return state;
}

test('U02 source composition and governed invitation response', async ({
  page,
  isMobile,
}, testInfo) => {
  const state = await mine(page);
  await page.setViewportSize({ width: isMobile ? 390 : 1440, height: 900 });
  await page.goto('/meetings/mine');
  await expect(page.getByRole('button', { name: titles[0], exact: true })).toBeVisible();
  await expect(page.getByText('초대 응답 8명 중 7명 수락').first()).toBeVisible();
  await expect(page.getByText('내 응답을 기다리는 초대 1건')).toBeVisible();
  if (isMobile) {
    const agenda = page.getByRole('list', { name: '목적 및 안건', exact: true }).first();
    await expect(agenda.getByRole('listitem')).toHaveCount(3);
    const first = agenda.getByRole('listitem').first();
    await expect
      .poll(async () => {
        const title = await first
          .getByText('출시 범위 및 스펙 확인', { exact: true })
          .boundingBox();
        const duration = await first.getByText('15분', { exact: true }).boundingBox();
        return title && duration ? Math.abs(title.y - duration.y) : 100;
      })
      .toBeLessThan(4);
  }
  await expectNoHorizontalOverflow(page, 'U02');
  await expectNoBlockingA11y(page, 'U02');
  await page.screenshot({ path: testInfo.outputPath(`U02-${isMobile ? 'M' : 'D'}-viewport.png`) });
  await withMeetingDocumentCapture(page, async () => {
    await page.screenshot({
      path: testInfo.outputPath(`U02-${isMobile ? 'M' : 'D'}-document.png`),
      fullPage: true,
    });
  });
  if (isMobile) await page.getByRole('button', { name: titles[0], exact: true }).click();
  await expect(page.getByTestId('meeting-schedule-management')).toBeVisible();
  if (isMobile)
    await page
      .getByRole('dialog')
      .getByRole('button', { name: '닫기', exact: true })
      .first()
      .click();
  await page.getByRole('tab', { name: '초대 응답 1', exact: true }).click();
  await page.getByRole('button', { name: '참석 수락', exact: true }).last().click();
  await expect.poll(() => state.calls.length).toBe(1);
  expect(state.calls[0]).toMatchObject({
    response: 'ACCEPTED',
    expectedInvitationRevision: 2,
    expectedVersion: 0,
  });
});

test('U03 source composition preserves compact editable timeboxes and four-step flow', async ({
  page,
  isMobile,
}, testInfo) => {
  await schedule(page);
  await page.setViewportSize({ width: isMobile ? 390 : 1440, height: 900 });
  await page.goto(
    `/meetings/mine?view=schedule&templateId=${SCHEDULE_TEMPLATE_ID}&templateVersion=2`
  );
  await expect(page.getByRole('textbox', { name: '회의 제목', exact: true })).toHaveValue(
    titles[0]
  );
  await expect(page.getByRole('button', { name: '의제 1번 편집' })).toBeVisible();
  await expect(page.getByTestId('schedule-template-selection')).toContainText(titles[0]);
  await expect(page.getByTestId('schedule-template-selection')).toContainText('버전 2');
  await expect(page.getByRole('textbox', { name: '안건 제목', exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page, 'U03');
  await expectNoBlockingA11y(page, 'U03');
  await page.screenshot({ path: testInfo.outputPath(`U03-${isMobile ? 'M' : 'D'}-viewport.png`) });
  await withMeetingDocumentCapture(page, async () => {
    await page.screenshot({
      path: testInfo.outputPath(`U03-${isMobile ? 'M' : 'D'}-document.png`),
      fullPage: true,
    });
  });
  await page.getByRole('button', { name: '의제 1번 편집' }).click();
  await page.getByRole('textbox', { name: '안건 제목', exact: true }).fill('실제 수정한 의제');
  await page.getByRole('button', { name: '편집 완료', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '01. 실제 수정한 의제', exact: true })
  ).toBeVisible();
});

test('U03 template chooser revalidates and applies only after explicit confirmation', async ({
  page,
}) => {
  await schedule(page, 'en');
  await page.goto('/meetings/mine?view=schedule');
  await page.getByRole('textbox', { name: 'Meeting title', exact: true }).fill('Current draft');
  await page.getByRole('button', { name: 'Choose an operating template', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('button', { name: new RegExp(titles[0].replace(/[()]/gu, '\\$&'), 'u') })
    .click();
  await expect(page.getByTestId('meeting-schedule-workspace').locator('input').first()).toHaveValue(
    'Current draft'
  );
  await dialog.getByRole('button', { name: 'Apply to this draft', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Meeting title', exact: true })).toHaveValue(
    titles[0]
  );
  await expect(page.getByRole('button', { name: 'Edit agenda item 3', exact: true })).toBeVisible();
  await expect(page.getByTestId('schedule-template-selection')).toContainText(titles[0]);
});

test('U03 applied template identity is withdrawn on changed revision and revoked access', async ({
  page,
}) => {
  await schedule(page, 'en');
  await page.goto(
    `/meetings/mine?view=schedule&templateId=${SCHEDULE_TEMPLATE_ID}&templateVersion=2`
  );
  await expect(page.getByTestId('schedule-template-selection')).toContainText(titles[0]);
  await page.route('**/api/meetings/v1/templates/' + SCHEDULE_TEMPLATE_ID, (route) =>
    scheduleResponse(route, {
      ...template,
      name: 'New revision must not replace the selected name',
      version: 3,
    })
  );
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByTestId('schedule-template-selection')).toHaveCount(0);
  await expect(page.getByText('New revision must not replace the selected name')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Meeting title', exact: true })).toHaveValue(
    titles[0]
  );
  await page.route('**/api/meetings/v1/templates/' + SCHEDULE_TEMPLATE_ID, (route) =>
    scheduleResponse(route, null, 403)
  );
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('textbox', { name: 'Meeting title', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('schedule-template-selection')).toHaveCount(0);
});

test('U03 template revalidation failure preserves the current draft and revoked access removes it', async ({
  page,
}) => {
  await schedule(page, 'en');
  await page.goto('/meetings/mine?view=schedule');
  await page
    .getByRole('textbox', { name: 'Meeting title', exact: true })
    .fill('Private current draft');
  await page.getByRole('button', { name: 'Choose an operating template', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /Q3 Final/u }).click();
  await page.route('**/api/meetings/v1/templates/' + SCHEDULE_TEMPLATE_ID, (route) =>
    scheduleResponse(route, null, 503)
  );
  await dialog.getByRole('button', { name: 'Apply to this draft', exact: true }).click();
  await expect(dialog.getByText(/Your draft was not changed/u)).toBeVisible();
  await expect(page.getByTestId('meeting-schedule-workspace').locator('input').first()).toHaveValue(
    'Private current draft'
  );
  await page.route('**/api/meetings/v1/templates/' + SCHEDULE_TEMPLATE_ID, (route) =>
    scheduleResponse(route, null, 403)
  );
  await dialog.getByRole('button', { name: 'Apply to this draft', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Meeting title', exact: true })).toHaveCount(0);
  await expect(page.getByText('Private current draft')).toHaveCount(0);
});

test('U03 changed source revision requires a new explicit source review', async ({ page }) => {
  await schedule(page, 'en');
  const applied: string[] = [];
  await page.route('**/api/meetings/v1/templates/' + SCHEDULE_TEMPLATE_ID, (route) =>
    scheduleResponse(route, { ...template, version: 3, name: 'Changed source' })
  );
  await page.route('**/api/meetings/v1/templates/' + SCHEDULE_TEMPLATE_ID + '/apply', (route) => {
    applied.push(route.request().url());
    return scheduleResponse(route, null, 409);
  });
  await page.goto('/meetings/mine?view=schedule');
  await page
    .getByRole('textbox', { name: 'Meeting title', exact: true })
    .fill('Keep my current draft');
  await page.getByRole('button', { name: 'Choose an operating template', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /Q3 Final/u }).click();
  await dialog.getByRole('button', { name: 'Apply to this draft', exact: true }).click();
  await expect(dialog.getByText(/Your draft was not changed/u)).toBeVisible();
  expect(applied).toEqual([]);
  await expect(page.getByTestId('meeting-schedule-workspace').locator('input').first()).toHaveValue(
    'Keep my current draft'
  );
});

test('U03 recent meeting copy reads the selected current preparation and preserves the draft boundary', async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    'The approved mobile wizard has no recent-copy command; desktop owns this entry point.'
  );
  await schedule(page, 'en');
  const recent = {
    ...MEETING_VISUAL_SUMMARY,
    meetingId: ids[0],
    title: 'Recent governed review',
    agenda: 'Only current authorized structure',
    durationMinutes: 45,
  };
  await page.route(/\/api\/meetings\/v1\/meetings(?:\?.*)?$/u, (route) =>
    scheduleResponse(route, { items: [recent], total: 1, page: 0, pageSize: 10 })
  );
  await page.route('**/api/meetings/v1/meetings/' + ids[0], (route) =>
    scheduleResponse(route, recent)
  );
  await page.route('**/api/meetings/v1/meetings/' + ids[0] + '/preparation', (route) =>
    scheduleResponse(route, prep(0))
  );
  await page.goto('/meetings/mine?view=schedule');
  await page.getByRole('textbox', { name: 'Meeting title', exact: true }).fill('Current meeting');
  await page.getByRole('button', { name: 'Copy a recent meeting', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /Recent governed review/u }).click();
  await dialog.getByRole('button', { name: 'Apply to this draft', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Meeting title', exact: true })).toHaveValue(
    recent.title
  );
  await expect(
    page.getByRole('textbox', { name: 'Purpose and preparation notes', exact: true })
  ).toHaveValue(recent.agenda);
  await expect(page.getByRole('button', { name: 'Edit agenda item 3', exact: true })).toBeVisible();
});

for (const menu of ['U02', 'U03'] as const) {
  test(`${menu} 1280-390-320 dark forced-colors and 200-percent text remain usable`, async ({
    page,
  }, testInfo) => {
    if (menu === 'U02') await mine(page, 'ko', true);
    else await schedule(page, 'ko', true);
    await page.goto(
      menu === 'U02'
        ? '/meetings/mine'
        : `/meetings/mine?view=schedule&templateId=${SCHEDULE_TEMPLATE_ID}&templateVersion=2`
    );
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      if (menu === 'U02')
        await expect(page.getByTestId('my-meetings-inspector')).toHaveCount(width >= 1200 ? 1 : 0);
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const main = document.querySelector<HTMLElement>('#dwp-main-content');
              return main ? main.scrollWidth - main.clientWidth : 0;
            }),
          { message: `${menu} ${width} settled responsive layout` }
        )
        .toBeLessThanOrEqual(1);
      await expectNoHorizontalOverflow(page, `${menu} ${width}`);
      await expectNoBlockingA11y(page, `${menu} ${width}`);
    }
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await expectNoHorizontalOverflow(page, `${menu} 200 percent`);
    await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await expectNoHorizontalOverflow(page, `${menu} forced colors`);
    await expectNoBlockingA11y(page, `${menu} forced colors`);
    await page.screenshot({
      path: testInfo.outputPath(`${menu}-320-forced-200.png`),
      fullPage: true,
    });
  });
}

test('My Meetings restores search, page and selection after preparation and schedule navigation', async ({
  page,
}, testInfo) => {
  await page.setViewportSize(
    testInfo.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 960 }
  );
  await mockScheduleWorkspace(page, { locale: 'en' });
  await mine(page, 'en', false, true);
  const filters = new URLSearchParams({
    page: '2',
    q: 'Q3',
    time: 'ALL',
    role: 'HOST',
    date: '2026-09-04',
    series: 'RECURRING',
    meeting: ids[0],
  });
  const expectListContext = async () => {
    await expect(page).toHaveURL(
      (url) =>
        !url.searchParams.has('view') &&
        [...filters].every(([key, value]) => url.searchParams.get(key) === value)
    );
    await expect(
      page.getByTestId('my-meetings-list').getByRole('heading', { name: titles[0] })
    ).toBeVisible();
    await expect(page.getByTestId('my-meetings-page-status')).toContainText('3');
  };
  await page.goto('/meetings/mine?' + filters);
  await expectListContext();
  const prepare = page
    .getByTestId('my-meetings-list')
    .getByRole('button', { name: en.home.focus.prepare, exact: true });
  await prepare.click();
  await expect(page).toHaveURL((url) => url.searchParams.get('view') === 'preparation');
  await page.getByRole('button', { name: en.preparation.back, exact: true }).click();
  await expectListContext();
  await page.getByRole('button', { name: en.home.schedule.action, exact: true }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get('view') === 'schedule');
  await page.getByRole('button', { name: en.actions.cancel, exact: true }).first().click();
  await expectListContext();
  await page.reload();
  await expectListContext();
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: en.mine.filters.label, exact: true }).click();
  }
  await expect(
    page.getByRole('textbox', { name: en.mine.filters.search, exact: true })
  ).toHaveValue('Q3');
  await expectNoHorizontalOverflow(page, 'U02 restored context');
  await expectNoBlockingA11y(page, 'U02 restored context');
  await page.screenshot({ path: testInfo.outputPath('U02-restored-context.png'), fullPage: true });
});
