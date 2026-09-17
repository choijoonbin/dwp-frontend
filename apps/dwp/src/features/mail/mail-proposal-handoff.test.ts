import { describe, expect, it } from 'vitest';

import {
  mailProposalOwnerHandoffRoute,
  mailProposalReturnRoute,
  mailReturnedProposalId,
} from './mail-proposal-handoff';

import type { MailActionProposal, MailProposalHandoff } from '@dwp-frontend/shared-utils';

const proposal: MailActionProposal = {
  proposalId: 'proposal-1',
  threadId: 'thread-1',
  type: 'CREATE_CALENDAR_EVENT',
  actionContractVersion: 1,
  status: 'ACCEPTED',
  title: 'Schedule review',
  summary: 'Review in calendar.',
  evidence: [],
  proposedPayload: { durationMinutes: 30, timeZone: 'UTC', requiresConfirmation: true },
  confidence: 0.9,
  riskLevel: 'MEDIUM',
  requiredResourceKey: 'APP.CALENDAR',
  requiredPermissionCode: 'CREATE',
  targetRoute: '/calendar/schedule?action=create',
  version: 3,
};

const handoff: MailProposalHandoff = {
  proposalId: proposal.proposalId,
  commandId: 'command-1',
  ownerRoute: '/calendar/schedule?action=create&proposalId=forged',
  returnTo: '/mail/actions?proposalId=proposal-1',
  focus: 'mail-proposal-proposal-1',
  status: 'ACCEPTED',
  resultRef: null,
  version: 1,
};

describe('mail proposal owner handoff', () => {
  it('binds opaque command context and a canonical mail return route', () => {
    const route = mailProposalOwnerHandoffRoute(proposal, handoff);
    const parsed = new URL(route!, 'https://dwp.invalid');
    expect(parsed.pathname).toBe('/calendar/schedule');
    expect(parsed.searchParams.get('action')).toBeNull();
    expect(parsed.searchParams.get('create')).toBe('meeting');
    expect(parsed.searchParams.get('proposalId')).toBe('proposal-1');
    expect(parsed.searchParams.get('commandId')).toBe('command-1');
    expect(parsed.searchParams.get('returnTo')).toBe('/mail/actions?proposalId=proposal-1');
    expect(parsed.searchParams.get('focus')).toBe('mail-proposal-proposal-1');
  });

  it('rejects external, cross-owner, and mismatched proposal routes', () => {
    expect(
      mailProposalOwnerHandoffRoute(proposal, { ...handoff, ownerRoute: '//evil.example/review' })
    ).toBeNull();
    expect(
      mailProposalOwnerHandoffRoute(proposal, { ...handoff, ownerRoute: '/work?action=create' })
    ).toBeNull();
    expect(
      mailProposalOwnerHandoffRoute(proposal, { ...handoff, proposalId: 'another-proposal' })
    ).toBeNull();
    expect(
      mailProposalOwnerHandoffRoute(proposal, {
        ...handoff,
        returnTo: '/mail/actions-impersonated?proposalId=proposal-1',
      })
    ).toBeNull();
  });

  it('reads only bounded return identifiers', () => {
    expect(mailProposalReturnRoute('proposal/1')).toContain('proposalId=proposal%2F1');
    expect(mailReturnedProposalId(new URLSearchParams('proposalId=proposal-1'))).toBe('proposal-1');
    expect(mailReturnedProposalId(new URLSearchParams(`proposalId=${'x'.repeat(201)}`))).toBeNull();
  });

  it('routes task and leave proposals into their existing owner create flows', () => {
    const task = {
      ...proposal,
      type: 'CREATE_TASK' as const,
      requiredResourceKey: 'APP.WORK',
      requiredPermissionCode: 'UPDATE',
      targetRoute: '/work?action=create',
    };
    const taskRoute = new URL(
      mailProposalOwnerHandoffRoute(task, {
        ...handoff,
        ownerRoute: '/work?action=create',
      })!,
      'https://dwp.invalid'
    );
    expect(taskRoute.pathname).toBe('/work/queue');
    expect(taskRoute.searchParams.get('compose')).toBe('task');

    const leave = {
      ...proposal,
      type: 'CREATE_LEAVE_REQUEST' as const,
      requiredResourceKey: 'APP.HCM',
      requiredPermissionCode: 'VIEW',
      targetRoute: '/hr/leave?action=create',
    };
    const leaveRoute = new URL(
      mailProposalOwnerHandoffRoute(leave, {
        ...handoff,
        ownerRoute: '/hr/leave?action=create',
      })!,
      'https://dwp.invalid'
    );
    expect(leaveRoute.pathname).toBe('/hr/absence');
    expect(leaveRoute.searchParams.get('request')).toBe('open');
  });
});
