import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MyTeam } from './my-team';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      `${key}${values?.count === undefined ? '' : `:${String(values.count)}`}`,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
}));

vi.mock('@dwp-frontend/shared-utils', () => ({
  getHrTeam: vi.fn(),
}));

vi.mock('../../components/use-product-surface-request-scope', () => ({
  useProductSurfaceRequestScope: () => ({
    ready: true,
    contextScopeKey: 'scope:team',
    cacheKey: ['team'],
    queryMeta: {},
  }),
}));

vi.mock('../../components/product-page-shortcut-access', () => ({
  PRODUCT_PAGE_SHORTCUT_TARGETS: {
    hcmTeamTime: {},
    hcmTeamAbsence: {},
    hcmDirectory: {},
    hcmOrganization: {},
  },
  useProductPageShortcutAccess: () => ({ disclosed: true }),
  appendProductPageShortcutScope: (href: string) => href,
}));

vi.mock('../../components/person-avatar', () => ({
  PersonAvatar: ({ name }: { name: string }) => createElement('span', null, name),
}));

vi.mock('../../components/hcm-query-state', () => ({
  HcmQueryState: () => createElement('div', null, 'query-state'),
}));

describe('MyTeam', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.useQuery.mockReturnValue({
      data: {
        manager: {
          personId: 'manager-1',
          displayName: 'Manager Kim',
          directReportCount: 1,
        },
        members: [
          {
            personId: 'person-1',
            displayName: 'Employee Lee',
            businessTitle: 'Engineer',
            organizationName: 'Product',
            directReportCount: 0,
          },
        ],
        timePendingCount: 2,
        absencePendingCount: 1,
        dataBoundary: 'TEAM',
      },
      dataUpdatedAt: new Date('2026-10-06T05:00:00Z').getTime(),
      isLoading: false,
      isError: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('renders scoped freshness, separate approval destinations, and the team roster', () => {
    const html = renderToStaticMarkup(createElement(MyTeam));

    expect(html).toContain('data-testid="hr-team-scope-context"');
    expect(html).toContain('Manager Kim');
    expect(html).toContain('home.needsAttention.count:2');
    expect(html).toContain('home.needsAttention.count:1');
    expect(html).toContain('home.needsAttention.reviewTime');
    expect(html).toContain('home.needsAttention.reviewLeave');
    expect(html).toContain('Employee Lee');
    expect(html).toContain('home.profile.open');
  });
});
