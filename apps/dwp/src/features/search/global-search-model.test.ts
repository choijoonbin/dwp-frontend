import { describe, expect, it } from 'vitest';

import { HOME_APPS } from '../home/app-launchpad-model';
import {
  createAskSearchItem,
  createGlobalSearchItems,
  filterGlobalSearchItems,
} from './global-search-model';

describe('global search model', () => {
  const workItems = [
    {
      id: 'WK-1042',
      title: 'Approve software access request',
      type: 'Approval' as const,
      priority: 'high' as const,
      status: 'due-soon' as const,
      due: 'Today, 10:30',
      sourceSystem: 'IT Service',
      owner: 'You',
    },
  ];
  const items = createGlobalSearchItems(HOME_APPS, workItems, undefined, {
    people: [
      {
        personId: 'person-1',
        displayName: '김민서',
        workEmail: 'minseo.kim@sk.com',
        businessTitle: '서비스 기획 리드',
        organizationName: 'Digital Workplace팀',
      },
    ],
    organizations: [
      {
        organizationId: 'org-1',
        organizationKey: 'DWP',
        name: 'Digital Workplace팀',
        organizationTypeName: '팀',
        totalHeadcount: 12,
      },
    ],
    audits: [
      {
        id: 'event-1',
        title: 'Access denied',
        description: 'Audit authorization event',
        route: '/admin/governance/audit-events?query=event-1',
        keywords: ['event-1', 'correlation-1'],
        source: 'Tenant audit',
      },
    ],
    tenants: [
      {
        tenantId: 'tenant-1',
        title: 'SKAX Digital Workplace',
        description: 'SKAX / ap-northeast-2',
        route: '/provider/tenants/tenant-1',
        keywords: ['skax', 'production'],
        source: 'Provider tenants',
      },
    ],
    catalogAssets: [
      {
        id: 'asset-1',
        title: 'ppl_workers',
        description: 'People workforce table',
        route: '/provider/data-governance?tab=catalog&asset=asset-1',
        keywords: ['asset-1', 'people'],
        source: 'Provider data catalog',
      },
    ],
  });

  it('combines applications, governed work, people, and organizations', () => {
    expect(filterGlobalSearchItems(items, 'finance purchasing')[0]?.title).toBe('Business ERP');
    expect(filterGlobalSearchItems(items, 'WK-1042')[0]?.title).toBe(
      'Approve software access request'
    );
    expect(filterGlobalSearchItems(items, 'minseo.kim')[0]?.kind).toBe('person');
    expect(filterGlobalSearchItems(items, 'org-1')[0]?.kind).toBe('organization');
    expect(filterGlobalSearchItems(items, 'correlation-1')[0]?.kind).toBe('audit');
    expect(filterGlobalSearchItems(items, 'production')[0]?.kind).toBe('tenant');
    expect(filterGlobalSearchItems(items, 'ppl_workers')[0]?.kind).toBe('catalog');
  });

  it('returns recommended destinations before a query is entered', () => {
    expect(filterGlobalSearchItems(items, '').map((item) => item.title)).toEqual([
      'Work',
      'Ask DWP',
      'Activity',
      'Browse all apps',
    ]);
  });

  it('builds an encoded Ask route for unmatched natural language', () => {
    expect(createAskSearchItem('summarize my next meeting').route).toBe(
      '/ask?q=summarize%20my%20next%20meeting'
    );
  });
});
