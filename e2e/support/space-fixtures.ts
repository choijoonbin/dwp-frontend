import { expect, type Page } from '@playwright/test';

import { mockAuthenticatedRuntime } from './runtime-access';

export function envelope(data: unknown) {
  return JSON.stringify({ status: 'SUCCESS', message: 'OK', success: true, data });
}

export const SPACE_SUMMARY = {
  spaceId: 'a1000000-0000-0000-0000-000000000001',
  spaceKey: 'company-square',
  nameKo: 'SKAX 타운스퀘어',
  nameEn: 'SKAX Town Square',
  summaryKo: '전사 소식과 질문, 구성원 참여가 모이는 열린 공간입니다.',
  summaryEn: 'An open company space for news, questions, and participation.',
  purposeType: 'COMMUNITY',
  visibility: 'OPEN',
  dataClassification: 'INTERNAL',
  memberRole: 'VIEWER',
  memberCount: 2,
  contentCount: 2,
  unreadCount: 1,
  iconKey: 'building-2',
  accentToken: 'cobalt',
  coverAssetUrl: null,
  lifecycleState: 'ACTIVE',
  lastActivityAt: '2026-08-18T09:30:00Z',
  version: 1,
};

export const DIRECTORY_SPACES = [
  SPACE_SUMMARY,
  {
    ...SPACE_SUMMARY,
    spaceId: 'a1000000-0000-0000-0000-000000000002',
    spaceKey: 'ai-transformation',
    nameKo: 'AI 전환 프로그램과 조직 간 의사결정 및 검증 근거 협업',
    nameEn: 'AI Transformation Program for Cross-Organization Decisions and Validation Evidence',
    summaryEn: 'Connect initiatives, decisions, and validation evidence across delivery teams.',
    purposeType: 'PROJECT',
    visibility: 'REQUEST',
    memberRole: null,
    memberCount: 3,
    unreadCount: 0,
    accentToken: 'violet',
  },
  {
    ...SPACE_SUMMARY,
    spaceId: 'a1000000-0000-0000-0000-000000000003',
    spaceKey: 'customer-zero-operations',
    nameKo: 'Customer Zero 운영실',
    nameEn: 'CustomerZeroOperationsAndIncidentResponseAcrossRegionalDeliveryTeams',
    summaryEn: 'Operate service response and prevention actions. '.repeat(6),
    purposeType: 'OPERATIONS',
    visibility: 'PRIVATE',
    memberRole: null,
    unreadCount: 0,
    accentToken: 'amber',
  },
  {
    ...SPACE_SUMMARY,
    spaceId: 'a1000000-0000-0000-0000-000000000004',
    spaceKey: 'engineering-guild',
    nameKo: '엔지니어링 길드',
    nameEn: 'Engineering Guild',
    summaryEn: 'Share engineering practices.',
    memberRole: 'CONTRIBUTOR',
    unreadCount: 0,
    accentToken: 'teal',
  },
  {
    ...SPACE_SUMMARY,
    spaceId: 'a1000000-0000-0000-0000-000000000005',
    spaceKey: 'executive-briefing',
    nameKo: '경영 브리핑',
    nameEn: 'Executive Briefing',
    summaryEn: 'Restricted briefings for named audiences.',
    purposeType: 'LEADERSHIP',
    visibility: 'HIDDEN',
    memberRole: null,
    memberCount: 1,
    unreadCount: 0,
    accentToken: 'crimson',
  },
];

export const SPACE_TEMPLATE = {
  templateId: 'b1000000-0000-0000-0000-000000000001',
  templateKey: 'expert-community',
  nameKo: '전문가 커뮤니티',
  nameEn: 'Expert community',
  descriptionKo: '전문 지식과 사례를 축적합니다.',
  descriptionEn: 'Build a governed body of expert knowledge and practice.',
  purposeType: 'COMMUNITY',
  creationMode: 'APPROVAL',
  defaultVisibility: 'REQUEST',
  defaultDataClassification: 'INTERNAL',
  iconKey: 'messages-square',
  accentToken: 'cobalt',
  lifecycleState: 'PUBLISHED',
  currentVersion: 1,
  version: 1,
};

type SpaceSession = {
  locale?: 'en' | 'ko';
  roles?: string[];
  preferences?: {
    mode?: 'light' | 'dark';
    highContrast?: boolean;
    reduceMotion?: boolean;
  };
  permissions?: Array<{
    resourceType: string;
    resourceKey: string;
    permissionCode: string;
    effect: 'ALLOW';
  }>;
};

export async function mockSpaceSession(page: Page, options: SpaceSession = {}) {
  await mockAuthenticatedRuntime(page);
  // Scope the current authority contract to Space tests until the shared legacy fixture migrates.
  await page.route('**/api/auth/product-surface-contexts', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        contractVersion: '2',
        decisionRevision: 'space-directory-fixture-v2',
        sourceRevisions: {
          auth: 'auth-fixture',
          policy: 'policy-fixture',
          productRelationship: 'relationship-fixture',
          targetPopulation: 'population-fixture',
          support: null,
          tenantControl: 'tenant-fixture',
        },
        activeAccessMode: 'NORMAL',
        generatedAt: '2026-10-27T00:00:00Z',
        contexts: [],
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
          state: '000',
          flags: { contextShadow: false, capabilityEnforcement: false, surfaceUi: false },
          cohort: 'baseline',
          opaqueRevision: `rollout-${productKey}-fixture`,
          authorityStatus: 'NOT_EVALUATED',
        })),
      }),
    })
  );
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        userId: 42,
        personPublicId: 'person-42',
        displayName: 'Mina Kim',
        jobTitle: 'Network Operations Lead',
        email: 'mina.kim@sk.com',
        tenantId: 1,
        tenantCode: 'SKAX',
        identityPlane: 'TENANT',
        tenantName: 'SKAX',
        preferredLocale: options.locale ?? 'en',
        tenantDefaultLocale: 'en',
        roles: options.roles ?? ['WORKSPACE_MEMBER'],
        groups: [{ groupRef: 'SKAX_ALL_EMPLOYEES', displayName: 'All employees' }],
        resourceRoles: [],
      }),
    })
  );
  await page.route('**/api/auth/permissions', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope(
        options.permissions ?? [
          {
            resourceType: 'APP',
            resourceKey: 'APP.SPACES',
            permissionCode: 'VIEW',
            effect: 'ALLOW',
          },
        ]
      ),
    })
  );
  await page.route('**/api/auth/csrf', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }),
    })
  );
  await page.route('**/api/platform/v1/tenant-branding', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({ organizationName: 'SKAX', logoUrl: null, version: 1 }),
    })
  );
  await page.route('**/api/platform/v1/personal-preferences**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: envelope({
        schemaVersion: 1,
        customized: false,
        preferences: {
          appearance: { mode: options.preferences?.mode ?? 'light', density: 'standard' },
          accessibility: {
            highContrast: options.preferences?.highContrast ?? false,
            reduceMotion: options.preferences?.reduceMotion ?? false,
          },
        },
        version: 0,
        updatedAt: null,
      }),
    })
  );
}

export async function mockDirectorySession(page: Page, options: SpaceSession = {}) {
  await mockSpaceSession(page, options);
  // Keep every Space request inside the fixture, including accidental writes.
  // Each test installs its directory response after this fallback.
  await page.route('**/api/spaces/v1/**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') return route.fulfill({ status: 405 });
    if (pathname === '/api/spaces/v1/access-requests') {
      return route.fulfill({ contentType: 'application/json', body: envelope([]) });
    }
    const space = DIRECTORY_SPACES.find(
      (candidate) => pathname === `/api/spaces/v1/spaces/${candidate.spaceKey}`
    );
    if (!space) return route.fulfill({ status: 404 });
    return route.fulfill({
      contentType: 'application/json',
      body: envelope({
        space,
        contentPolicy: 'OWNER_REVIEW',
        appPolicy: 'OWNER_REVIEW',
        aiPolicy: 'MEMBER_SCOPED',
        canContribute: space.memberRole === 'CONTRIBUTOR',
        canModerate: false,
        canManage: false,
        featuredContent: [],
        apps: [],
        activity: [],
      }),
    });
  });
}

export function directoryCards(page: Page) {
  return page.locator('main a[href^="/spaces/"][href$="/overview"]');
}

export async function expectNoDirectoryEmptyState(page: Page) {
  await expect(
    page.getByRole('heading', {
      name: /^(No spaces match your search|No spaces are available to discover)$/,
    })
  ).toHaveCount(0);
  await expect(page.getByLabel('0 results', { exact: true })).toHaveCount(0);
}

export function deferredDirectoryResponse() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
