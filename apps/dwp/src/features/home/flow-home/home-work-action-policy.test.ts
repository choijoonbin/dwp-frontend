import { describe, expect, it } from 'vitest';

import type { NormalizedHomeContribution } from '../contributions';
import {
  composeHomeWorkActions,
  filterHomeWorkActions,
  homeWorkActionCta,
  homeWorkActionFilterCounts,
  isCanonicalHomeWorkRoute,
} from './home-work-action-policy';

const NOW = '2026-09-16T01:00:00.000Z';

function contribution(
  id: string,
  override: Partial<NormalizedHomeContribution>
): NormalizedHomeContribution {
  return {
    id,
    providerKey: 'workspace-work',
    owner: { source: 'DWP_WORKSPACE', appKey: 'APP.WORK', appLabel: 'Work' },
    kind: 'ACTION',
    scope: 'ME',
    priority: 'MEDIUM',
    status: 'OPEN',
    title: id,
    description: null,
    count: 1,
    dueAt: null,
    route: `/work/queue?item=${id}`,
    deepLink: `/work/queue?item=${id}`,
    dedupeKey: `WORKSPACE:${id}`,
    sourceReference: id,
    sourceReferences: [id],
    generatedAt: NOW,
    freshness: { state: 'FRESH', expiresAt: null },
    privacy: { classification: 'INTERNAL', sensitive: false, redaction: 'NONE' },
    redacted: false,
    duplicateCount: 1,
    ...override,
  };
}

const approval = contribution('approval', {
  providerKey: 'approval-home',
  owner: { source: 'DWP_APPROVAL', appKey: 'APP.APPROVALS', appLabel: 'Approvals' },
  priority: 'HIGH',
  route: '/approvals/inbox?task=approval-task',
  deepLink: '/approvals/inbox?task=approval-task',
  dedupeKey: 'APPROVAL:approval-request',
});
const accessReview = contribution('access-review', {
  priority: 'HIGH',
  route: '/work/queue?item=f1111111-1111-4111-8111-111111111111',
  deepLink: '/work/queue?item=f1111111-1111-4111-8111-111111111111',
  dedupeKey: 'IDENTITY_GOVERNANCE:f1111111-1111-4111-8111-111111111111',
});
const personal = contribution('personal', {
  providerKey: 'personal-work',
  priority: 'LOW',
  route: '/work/queue?work=PERSONAL_TASK%3Ab1111111-1111-4111-8111-111111111111%3A',
  deepLink: '/work/queue?work=PERSONAL_TASK%3Ab1111111-1111-4111-8111-111111111111%3A',
  dedupeKey: 'PERSONAL_TASK:b1111111-1111-4111-8111-111111111111',
});
const supplement = contribution('supplement', {
  providerKey: 'service-requests',
  owner: {
    source: 'DWP_EMPLOYEE_SERVICES',
    appKey: 'APP.EMPLOYEE_SERVICES',
    appLabel: 'Services',
  },
  kind: 'RESPONSE',
  priority: 'HIGH',
  status: 'AWAITING_REQUESTER',
  route: '/work/queue?work=SERVICE_REQUEST%3Ad1111111-1111-4111-8111-111111111111%3A',
  deepLink: '/work/queue?work=SERVICE_REQUEST%3Ad1111111-1111-4111-8111-111111111111%3A',
  dedupeKey: 'SERVICE:d1111111-1111-4111-8111-111111111111',
});

describe('Home Work action-card policy', () => {
  it('classifies the reference actions without using display copy', () => {
    const items = [approval, accessReview, personal, supplement];

    expect(homeWorkActionFilterCounts(items)).toEqual({
      all: 4,
      urgentApproval: 1,
      accessReview: 1,
      personalTask: 1,
    });
    expect(filterHomeWorkActions(items, 'urgentApproval')).toEqual([approval]);
    expect(filterHomeWorkActions(items, 'accessReview')).toEqual([accessReview]);
    expect(filterHomeWorkActions(items, 'personalTask')).toEqual([personal]);
    expect(items.map(homeWorkActionCta)).toEqual([
      'approvalReview',
      'accessReview',
      'start',
      'supplement',
    ]);
  });

  it('moves only governed Work response routes and removes the duplicate response', () => {
    const foreign = contribution('foreign-response', {
      kind: 'RESPONSE',
      status: 'AWAITING_REQUESTER',
      dedupeKey: 'SERVICE:foreign',
      route: '/services/my/foreign',
      deepLink: '/services/my/foreign',
    });

    expect(
      composeHomeWorkActions([approval, accessReview, personal], [supplement, foreign])
    ).toEqual({
      actionItems: [approval, accessReview, personal, supplement],
      responseItems: [foreign],
    });
  });

  it('keeps a re-homed high-priority response inside the four-row card when tenants have more work', () => {
    const medium = contribution('medium', { priority: 'MEDIUM' });
    const low = contribution('low', { priority: 'LOW' });

    const result = composeHomeWorkActions(
      [approval, accessReview, personal, medium, low],
      [supplement]
    );

    expect(result.actionItems.slice(0, 4)).toContain(supplement);
    expect(result.responseItems).not.toContain(supplement);
  });

  it('rejects external, generic, and malformed routes', () => {
    expect(isCanonicalHomeWorkRoute('/work/queue?item=review-id')).toBe(true);
    expect(isCanonicalHomeWorkRoute('/work/queue?work=PERSONAL_TASK%3Atask-id%3A')).toBe(true);
    expect(isCanonicalHomeWorkRoute('/work/queue')).toBe(false);
    expect(isCanonicalHomeWorkRoute('/services/my/request-id')).toBe(false);
    expect(isCanonicalHomeWorkRoute('https://example.test/work/queue?item=review-id')).toBe(false);
  });
});
