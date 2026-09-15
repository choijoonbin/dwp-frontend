export const APPROVAL_STITCH_REQUIRED_DIFFERENCES = [
  'DWP_SHELL',
  'AUTHORITATIVE_DATA',
  'FAIL_CLOSED_SECURITY',
  'NO_PIXEL_IDENTITY',
] as const;

export type ApprovalStitchDifferenceKey = (typeof APPROVAL_STITCH_REQUIRED_DIFFERENCES)[number];

export const APPROVAL_STITCH_INTENTIONAL_DIFFERENCES: Readonly<
  Record<ApprovalStitchDifferenceKey, string>
> = {
  DWP_SHELL:
    'Stitch의 예시 shell 대신 현재 DWP 전역 header, Product Surface sidebar, route와 responsive shell을 사용한다.',
  AUTHORITATIVE_DATA:
    'Stitch의 회사명, 사용자, 금액, 점수와 readiness 예시는 복제하지 않고 owner API의 현재 데이터만 표시한다.',
  FAIL_CLOSED_SECURITY:
    'Stitch가 활성 상태로 그린 작업도 현재 capability, resource, version, freshness와 step-up 증거가 없으면 닫는다.',
  NO_PIXEL_IDENTITY:
    'Stitch source와 DWP 구현은 픽셀 동일하다고 주장하지 않는다. DWP 구현의 픽셀 회귀는 별도 승인 snapshot이 소유한다.',
};

export interface ApprovalOwnerSpecContract {
  readonly path: string;
  readonly verificationTokens: readonly string[];
}

export interface ApprovalApprovedFrameContract {
  readonly apr: `APR-${string}`;
  readonly title: string;
  readonly route: string;
  readonly routeRegistrationToken: string;
  readonly frameRouteOverrides?: readonly {
    readonly frameId: string;
    readonly route: string;
    readonly routeRegistrationToken: string;
  }[];
  readonly frameIds: readonly string[];
  readonly ownerSpecs: readonly ApprovalOwnerSpecContract[];
  readonly screenshotEvidence: readonly string[];
  readonly requiredViewportEvidence: readonly ('desktop' | 'mobile')[];
  readonly differenceKeys: readonly ApprovalStitchDifferenceKey[];
}

const differenceKeys = APPROVAL_STITCH_REQUIRED_DIFFERENCES;

function menuSnapshots(routeId: string) {
  return [
    `e2e/menu-visual-baseline.spec.ts-snapshots/${routeId}-chromium-darwin.png`,
    `e2e/menu-visual-baseline.spec.ts-snapshots/${routeId}-mobile-darwin.png`,
  ] as const;
}

export const APPROVAL_APPROVED_FRAME_CONTRACTS = [
  {
    apr: 'APR-01',
    title: '개인 전자결재 홈',
    route: '/approvals/home',
    routeRegistrationToken: "path: '/approvals/home'",
    frameIds: ['STITCH-001'],
    ownerSpecs: [
      {
        path: 'e2e/approval-home-publishing.spec.ts',
        verificationTokens: [
          "page.goto('/approvals/home')",
          "name: '전자결재 홈'",
          "outputPath('approval-home.png')",
        ],
      },
    ],
    screenshotEvidence: menuSnapshots('approvals-home'),
    requiredViewportEvidence: ['desktop', 'mobile'],
    differenceKeys,
  },
  {
    apr: 'APR-02',
    title: '결재함 Action Center',
    route: '/approvals/inbox',
    routeRegistrationToken: "path: '/approvals/inbox'",
    frameIds: ['STITCH-002', 'STITCH-003', 'STITCH-004', 'STITCH-005'],
    ownerSpecs: [
      {
        path: 'e2e/approval-command-center-resilience.spec.ts',
        verificationTokens: [
          "page.goto('/approvals/inbox')",
          'data-approval-command-center-heading',
          "outputPath('approval-inbox.png')",
        ],
      },
    ],
    screenshotEvidence: menuSnapshots('approvals-inbox'),
    requiredViewportEvidence: ['desktop', 'mobile'],
    differenceKeys,
  },
  {
    apr: 'APR-03',
    title: '결재 상세와 결정',
    route: '/approvals/inbox',
    routeRegistrationToken: "path: '/approvals/inbox'",
    frameIds: ['STITCH-006', 'STITCH-007', 'STITCH-008', 'STITCH-009', 'STITCH-026'],
    ownerSpecs: [
      {
        path: 'e2e/approval-command-center-resilience.spec.ts',
        verificationTokens: [
          "page.goto('/approvals/inbox?task=approval-task-1')",
          'approval-detail-320-forced-200.png',
          '고객 분석 환경 접근 연장',
        ],
      },
      {
        path: 'e2e/approval-task-documents.spec.ts',
        verificationTokens: ['/approvals/inbox?task=', 'JSON 다운로드', '결재함 댓글'],
      },
    ],
    screenshotEvidence: menuSnapshots('approvals-inbox'),
    requiredViewportEvidence: ['desktop', 'mobile'],
    differenceKeys,
  },
  {
    apr: 'APR-04',
    title: '모바일 triage와 batch',
    route: '/approvals/inbox',
    routeRegistrationToken: "path: '/approvals/inbox'",
    frameIds: ['STITCH-010', 'STITCH-011', 'STITCH-012'],
    ownerSpecs: [
      {
        path: 'e2e/approval-command-center-resilience.spec.ts',
        verificationTokens: [
          'setViewportSize({ width: 320',
          'approval-detail-320-forced-200.png',
          'documentElement.scrollWidth',
        ],
      },
    ],
    screenshotEvidence: menuSnapshots('approvals-inbox'),
    requiredViewportEvidence: ['mobile'],
    differenceKeys,
  },
  {
    apr: 'APR-05',
    title: '게시 양식 선택과 기안',
    route: '/approvals/requests/new',
    routeRegistrationToken: "path: '/approvals/requests/new'",
    frameIds: ['STITCH-013', 'STITCH-014', 'STITCH-015'],
    ownerSpecs: [
      {
        path: 'e2e/approval-request-lifecycle.spec.ts',
        verificationTokens: [
          "page.goto('/approvals/requests/new')",
          "name: '새 결재 작성'",
          "name: '결재 경로 안내'",
        ],
      },
      {
        path: 'e2e/approval-request-typed.spec.ts',
        verificationTokens: ['typed-request-preflight.png', "name: '결재 상신'"],
      },
    ],
    screenshotEvidence: menuSnapshots('approvals-new'),
    requiredViewportEvidence: ['desktop', 'mobile'],
    differenceKeys,
  },
  {
    apr: 'APR-06',
    title: '상신 전 검증과 결재선',
    route: '/approvals/requests/new',
    routeRegistrationToken: "path: '/approvals/requests/new'",
    frameIds: ['STITCH-016', 'STITCH-017', 'STITCH-018'],
    ownerSpecs: [
      {
        path: 'e2e/approval-request-lifecycle.spec.ts',
        verificationTokens: ["name: '상신 전 통제'", '409', '503'],
      },
      {
        path: 'e2e/approval-request-typed.spec.ts',
        verificationTokens: ['typed-request-preflight.png', 'violations.filter'],
      },
    ],
    screenshotEvidence: menuSnapshots('approvals-new'),
    requiredViewportEvidence: ['desktop', 'mobile'],
    differenceKeys,
  },
  {
    apr: 'APR-07',
    title: '임시 저장과 충돌 복구',
    route: '/approvals/requests/drafts',
    routeRegistrationToken: "path: '/approvals/requests/drafts'",
    frameIds: ['STITCH-019', 'STITCH-020', 'STITCH-021'],
    ownerSpecs: [
      {
        path: 'e2e/approval-request-draft-recovery.spec.ts',
        verificationTokens: [
          "page.goto('/approvals/requests/drafts')",
          "outputPath('draft-workspace.png')",
          'UTF-8 JSON',
        ],
      },
    ],
    screenshotEvidence: menuSnapshots('approvals-drafts'),
    requiredViewportEvidence: ['desktop', 'mobile'],
    differenceKeys,
  },
  {
    apr: 'APR-08',
    title: '내가 올린 결재와 보완',
    route: '/approvals/requests/submitted',
    routeRegistrationToken: "path: '/approvals/requests/submitted'",
    frameIds: ['STITCH-022'],
    ownerSpecs: [
      {
        path: 'e2e/approval-request-lifecycle.spec.ts',
        verificationTokens: [
          "page.goto('/approvals/requests/submitted')",
          '/approvals/requests/needs-info?request=',
          '결재를 회수할까요?',
        ],
      },
      {
        path: 'e2e/approval-request-search.spec.ts',
        verificationTokens: ["outputPath('request-search.png')", '서버 조건·페이지'],
      },
    ],
    screenshotEvidence: menuSnapshots('approvals-submitted'),
    requiredViewportEvidence: ['desktop'],
    differenceKeys,
  },
  {
    apr: 'APR-09',
    title: '처리 완료와 요청 보관',
    route: '/approvals/requests/archive',
    routeRegistrationToken: "path: '/approvals/requests/archive'",
    frameIds: ['STITCH-023'],
    ownerSpecs: [
      {
        path: 'e2e/approval-request-search.spec.ts',
        verificationTokens: [
          "page.goto('/approvals/requests/archive')",
          '완료 보관함',
          '읽기 전용',
        ],
      },
      {
        path: 'e2e/approval-request-documents.spec.ts',
        verificationTokens: [
          '/approvals/requests/archive?request=',
          'JSON 다운로드',
          'UTF8 바이트',
        ],
      },
    ],
    screenshotEvidence: menuSnapshots('approvals-archive'),
    requiredViewportEvidence: ['desktop'],
    differenceKeys,
  },
  {
    apr: 'APR-10',
    title: '결재 위임과 대결',
    route: '/approvals/delegations',
    routeRegistrationToken: "path: '/approvals/delegations'",
    frameIds: ['STITCH-024', 'STITCH-025'],
    ownerSpecs: [
      {
        path: 'e2e/approval-delegation-workspace.spec.ts',
        verificationTokens: [
          "page.goto('/approvals/delegations')",
          "outputPath('delegation-inspector.png')",
          'delegation-320-text200.png',
        ],
      },
    ],
    screenshotEvidence: menuSnapshots('approvals-delegations'),
    requiredViewportEvidence: ['desktop', 'mobile'],
    differenceKeys,
  },
  {
    apr: 'APR-11',
    title: '관리자 결재 운영 개요',
    route: '/approvals/admin/overview',
    routeRegistrationToken: "path: '/approvals/admin/overview'",
    frameIds: ['STITCH-027', 'STITCH-028'],
    ownerSpecs: [
      {
        path: 'e2e/approval-admin-overview.spec.ts',
        verificationTokens: [
          "name: '결재 운영 개요'",
          "name: '관리 바로가기'",
          'documentElement.scrollWidth',
        ],
      },
    ],
    screenshotEvidence: menuSnapshots('approvals-admin-overview'),
    requiredViewportEvidence: ['desktop', 'mobile'],
    differenceKeys,
  },
  {
    apr: 'APR-12',
    title: '양식 카탈로그와 버전 거버넌스',
    route: '/approvals/admin/forms',
    routeRegistrationToken: "path: '/approvals/admin/forms'",
    frameIds: ['STITCH-029', 'STITCH-030'],
    ownerSpecs: [
      {
        path: 'e2e/approval-admin-workspace.spec.ts',
        verificationTokens: [
          "page.goto('/approvals/admin/forms')",
          "name: '양식 카탈로그'",
          '양식 참조 조회 실패',
        ],
      },
    ],
    screenshotEvidence: menuSnapshots('approvals-forms'),
    requiredViewportEvidence: ['desktop', 'mobile'],
    differenceKeys,
  },
  {
    apr: 'APR-13',
    title: '양식 빌더와 미리보기',
    route: '/approvals/admin/forms',
    routeRegistrationToken: "path: '/approvals/admin/forms'",
    frameIds: ['STITCH-031', 'STITCH-032', 'STITCH-033', 'STITCH-040'],
    ownerSpecs: [
      {
        path: 'e2e/approval-form-typed-studio.spec.ts',
        verificationTokens: [
          'typed-form-builder-original-layout.png',
          'typed-form-admin-user-preview.png',
          '미리보기 검증',
        ],
      },
    ],
    screenshotEvidence: menuSnapshots('approvals-forms'),
    requiredViewportEvidence: ['desktop', 'mobile'],
    differenceKeys,
  },
  {
    apr: 'APR-14',
    title: 'Workflow Routing Studio',
    route: '/approvals/admin/workflows',
    routeRegistrationToken: "path: '/approvals/admin/workflows'",
    frameIds: ['STITCH-034', 'STITCH-035'],
    ownerSpecs: [
      {
        path: 'e2e/approval-workflow-typed-studio.spec.ts',
        verificationTokens: [
          "page.goto('/approvals/admin/workflows')",
          'typed-workflow-inspector.png',
          'typed-workflow-320-text200.png',
        ],
      },
    ],
    screenshotEvidence: menuSnapshots('approvals-workflows'),
    requiredViewportEvidence: ['desktop', 'mobile'],
    differenceKeys,
  },
  {
    apr: 'APR-15',
    title: '정책 SoD SLA 거버넌스',
    route: '/approvals/admin/policies',
    routeRegistrationToken: "path: '/approvals/admin/policies'",
    frameIds: ['STITCH-036', 'STITCH-037'],
    ownerSpecs: [
      {
        path: 'e2e/approval-policy-workspace.spec.ts',
        verificationTokens: [
          "page.goto('/approvals/admin/policies')",
          'APR15-${mode}-comparison',
          'APR15-${mode}-text200-viewport',
        ],
      },
    ],
    screenshotEvidence: menuSnapshots('approvals-policies'),
    requiredViewportEvidence: ['desktop', 'mobile'],
    differenceKeys,
  },
  {
    apr: 'APR-16',
    title: '운영 복구와 서명 준비',
    route: '/approvals/admin/operations',
    routeRegistrationToken: "path: '/approvals/admin/operations'",
    frameIds: ['STITCH-038', 'STITCH-039'],
    frameRouteOverrides: [
      {
        frameId: 'STITCH-039',
        route: '/approvals/admin/signatures',
        routeRegistrationToken: "path: '/approvals/admin/signatures'",
      },
    ],
    ownerSpecs: [
      {
        path: 'e2e/approval-operations-workbench.spec.ts',
        verificationTokens: [
          '/approvals/admin/operations?scope=',
          'ops-${appearance}-viewport.png',
          'ops-${appearance}-sla-inspector-viewport.png',
        ],
      },
      {
        path: 'e2e/approval-signature-source.spec.ts',
        verificationTokens: [
          "page.goto('/approvals/admin/signatures')",
          'approval-signature-source13-320-200-forced-colors',
          'documentElement.scrollWidth',
        ],
      },
    ],
    screenshotEvidence: [
      ...menuSnapshots('approvals-operations'),
      ...menuSnapshots('approvals-signatures'),
    ],
    requiredViewportEvidence: ['desktop', 'mobile'],
    differenceKeys,
  },
] as const satisfies readonly ApprovalApprovedFrameContract[];

export const APPROVAL_STITCH_QUARANTINED_FRAME_IDS = ['STITCH-041'] as const;
export const APPROVAL_STITCH_SOURCE_IS_PIXEL_BASELINE = false;
