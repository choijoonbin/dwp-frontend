import type { Page } from '@playwright/test';
import { MEETING_VISUAL_ID, MEETING_VISUAL_SUMMARY } from './video-meeting-visual-fixtures';

/** Representative governed metadata only, deliberately not a synthetic AI response. */
export async function mockPreparationDesignMetadata(page: Page) {
  const names = ['김민아', '최준빈', '박수석', '정유진', '이준호', '윤서진'];
  const roster = names.map((displayName, index) => ({
    participantId: '71000000-0000-4000-8000-' + String(index + 101).padStart(12, '0'),
    displayName,
    response: index < 4 ? 'ACCEPTED' : 'PENDING',
    invitationRevision: 1,
    respondedAt: index < 4 ? '2026-08-31T03:00:00Z' : null,
    version: index < 4 ? 1 : 0,
    mine: index === 0,
  }));
  await page.route('**/api/meetings/v1/meetings/' + MEETING_VISUAL_ID, (route) =>
    route.fulfill({
      json: {
        status: 'SUCCESS',
        success: true,
        data: {
          ...MEETING_VISUAL_SUMMARY,
          title: '분기 제품 출시 의사결정 (Q3 Final Go/No-Go)',
          description:
            '이번 분기 출시 범위와 보안 검증 결과를 확인하고, 최종 승인자와 실행 일정을 결정합니다.',
          organizerName: '김민아',
          lifecycleState: 'LIVE',
          participantRole: 'ORGANIZER',
          canHost: true,
          canModerate: true,
          version: 8,
        },
      },
    })
  );
  await page.route('**/api/meetings/v1/meetings/' + MEETING_VISUAL_ID + '/preparation', (route) =>
    route.fulfill({
      json: {
        status: 'SUCCESS',
        success: true,
        data: {
          meetingId: MEETING_VISUAL_ID,
          meetingVersion: 8,
          agendaVersion: 1,
          materialsVersion: 3,
          invitationRevision: 1,
          agendaItems: [
            {
              itemId: '71000000-0000-4000-8000-000000000001',
              position: 0,
              title: '출시 결정 · 범위 및 변경 스펙 확인',
              objective: 'v2.4 핵심 기능과 보안 패치의 승인 범위를 확정합니다.',
              ownerUserId: 42,
              ownerDisplayName: '김민아',
              plannedMinutes: 15,
            },
            {
              itemId: '71000000-0000-4000-8000-000000000002',
              position: 1,
              title: '보안·성능 위험 최종 검토',
              objective: '부하 시험 결과와 장애 복구 조건을 함께 검토합니다.',
              ownerUserId: 43,
              ownerDisplayName: '박수석',
              plannedMinutes: 15,
            },
            {
              itemId: '71000000-0000-4000-8000-000000000003',
              position: 2,
              title: '배포 승인자 일정 확정 및 결재',
              objective: '출시 승인과 후속 업무의 담당자·기한을 결정합니다.',
              ownerUserId: 42,
              ownerDisplayName: '김민아',
              plannedMinutes: 15,
            },
          ],
          materials: [
            'Q3 출시 계획 및 승인 기준.pdf',
            '부하 시험 결과와 복구 전략.pdf',
            '릴리스 체크리스트.pdf',
          ].map((displayName, index) => ({
            materialId: '71000000-0000-4000-8000-' + String(index + 201).padStart(12, '0'),
            displayName,
            contentType: 'application/pdf',
            referenceProvider: 'DWP_FILES',
            opaqueReference: null,
            sourceVersion: 'v1',
            classification: 'CONFIDENTIAL',
            sizeBytes: 102400,
            contentSha256: null,
            retentionUntil: '2027-01-01T00:00:00Z',
            accessVerificationState: 'PENDING_REVALIDATION',
            version: 1,
          })),
          myResponse: roster[0],
          invitationResponses: roster,
          invitationCounts: { accepted: 4, tentative: 0, declined: 0, pending: 2 },
          myPreparation: {
            agendaVersion: 1,
            version: 0,
            preparedAgendaItemIds: [],
            updatedAt: null,
          },
          canEditAgenda: true,
          canManageMaterials: true,
          canRespond: true,
          canPrepare: true,
          observedAt: '2026-08-31T04:20:00Z',
        },
      },
    })
  );
}
