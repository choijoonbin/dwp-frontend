import { describe, expect, it } from 'vitest';

import { mailProposalPresentation } from './mail-proposal-model';

import type { MailActionProposal } from '@dwp-frontend/shared-utils';

function proposal(overrides: Partial<MailActionProposal> = {}): MailActionProposal {
  return {
    proposalId: '50000000-0000-4000-8000-000000000001',
    threadId: '40000000-0000-4000-8000-000000000001',
    type: 'CREATE_CALENDAR_EVENT',
    actionContractVersion: 1,
    status: 'PROPOSED',
    title: 'Review customer meeting',
    summary: 'A proposed schedule was found in the conversation.',
    evidence: [{ rationale: 'The sender proposed a specific time.' }],
    proposedPayload: {
      startsAt: '2026-09-04T06:00:00Z',
      durationMinutes: 60,
      timeZone: 'Asia/Seoul',
      attendees: ['alex@example.com', 'mina@example.com'],
      requiresConfirmation: true,
    },
    confidence: 0.98,
    riskLevel: 'MEDIUM',
    requiredResourceKey: 'APP.CALENDAR',
    requiredPermissionCode: 'CREATE',
    targetRoute: '/calendar/schedule?action=create',
    expiresAt: '2026-09-10T00:00:00Z',
    version: 2,
    ...overrides,
  };
}

describe('mail proposal presentation', () => {
  it('builds a compact calendar preview from a governed payload', () => {
    const view = mailProposalPresentation(proposal(), Date.parse('2026-09-03T00:00:00Z'));

    expect(view).toMatchObject({
      actionKey: 'CALENDAR.EVENT.CREATE',
      reviewBlock: null,
      targetKey: 'calendar',
      tone: 'calendar',
      typeKey: 'calendarEvent',
      sourceSummary: 'The sender proposed a specific time.',
    });
    expect(view.fields).toEqual([
      { key: 'schedule', value: '2026-09-04T06:00:00Z', format: 'datetime' },
      { key: 'durationMinutes', value: 60, format: 'durationMinutes' },
      {
        key: 'attendees',
        value: ['alex@example.com', 'mina@example.com'],
        format: 'list',
      },
      { key: 'timeZone', value: 'Asia/Seoul', format: 'text' },
    ]);
  });

  it('lets a task adapter declare Jira or Notion details without changing the card component', () => {
    const view = mailProposalPresentation(
      proposal({
        type: 'CREATE_TASK',
        requiredResourceKey: 'APP.WORK',
        requiredPermissionCode: 'UPDATE',
        targetRoute: '/work?action=create',
        proposedPayload: {
          provider: 'Jira',
          projectKey: 'DWP',
          assigneeName: 'Mina Kim',
          priority: 'HIGH',
          requiresConfirmation: true,
        },
      }),
      Date.parse('2026-09-03T00:00:00Z')
    );

    expect(view.fields).toEqual([
      { key: 'provider', value: 'Jira', format: 'text' },
      { key: 'project', value: 'DWP', format: 'text' },
      { key: 'assignee', value: 'Mina Kim', format: 'text' },
      { key: 'priority', value: 'HIGH', format: 'text' },
    ]);
  });

  it.each([
    {
      type: 'DRAFT_REPLY' as const,
      resource: 'APP.MAIL',
      permission: 'CREATE',
      route: '/mail/inbox?compose=open',
      risk: 'LOW' as const,
      payload: { tone: 'PROFESSIONAL', language: 'KOREAN', requiresConfirmation: true },
      typeKey: 'replyDraft',
    },
    {
      type: 'CREATE_LEAVE_REQUEST' as const,
      resource: 'APP.HCM',
      permission: 'VIEW',
      route: '/hr/leave',
      risk: 'HIGH' as const,
      payload: { durationDays: 2, requiresConfirmation: true },
      typeKey: 'leaveRequest',
    },
    {
      type: 'ESCALATE_NOTIFICATION' as const,
      resource: 'APP.MAIL',
      permission: 'UPDATE',
      route: '/mail/inbox?urgency=high',
      risk: 'LOW' as const,
      payload: { channel: 'IN_APP', urgency: 'HIGH', requiresConfirmation: true },
      typeKey: 'notification',
    },
  ])('keeps the $type governed adapter reviewable when its contract matches', (entry) => {
    const view = mailProposalPresentation(
      proposal({
        type: entry.type,
        requiredResourceKey: entry.resource,
        requiredPermissionCode: entry.permission,
        targetRoute: entry.route,
        riskLevel: entry.risk,
        proposedPayload: entry.payload,
      }),
      Date.parse('2026-09-03T00:00:00Z')
    );

    expect(view.reviewBlock).toBeNull();
    expect(view.typeKey).toBe(entry.typeKey);
  });

  it.each([
    ['unsupportedVersion', { actionContractVersion: 2 }],
    ['expired', { expiresAt: '2026-09-01T00:00:00Z' }],
    ['expired', { expiresAt: 'not-a-date' }],
    ['handled', { status: 'ACCEPTED' as const }],
    ['policyMismatch', { requiredResourceKey: 'APP.MAIL' }],
    ['policyMismatch', { requiredPermissionCode: 'UPDATE' }],
    ['policyMismatch', { riskLevel: 'LOW' as const }],
    ['policyMismatch', { proposedPayload: { requiresConfirmation: true } }],
    ['policyMismatch', { proposedPayload: { requiresConfirmation: false } }],
  ])('fails closed with %s when the proposal is not safe to review', (reason, overrides) => {
    expect(
      mailProposalPresentation(proposal(overrides), Date.parse('2026-09-03T00:00:00Z')).reviewBlock
    ).toBe(reason);
  });

  it('omits malformed or overlong display values', () => {
    const view = mailProposalPresentation(
      proposal({
        proposedPayload: {
          startsAt: 'not-a-date',
          durationMinutes: -1,
          timeZone: 'x'.repeat(241),
          attendees: ['valid@example.com', 7, 'also@example.com'],
          requiresConfirmation: true,
        },
      })
    );

    expect(view.fields).toEqual([
      {
        key: 'attendees',
        value: ['valid@example.com', 'also@example.com'],
        format: 'list',
      },
    ]);
  });
});
