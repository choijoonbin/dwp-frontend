import type { DwaionProposal } from '@dwp-frontend/shared-utils';

export type ProposalSnoozeOption = 'TWO_HOURS' | 'TOMORROW' | 'NEXT_WEEK';

export function proposalSnoozeTime(option: ProposalSnoozeOption, now = new Date()): string {
  const target = new Date(now);
  if (option === 'TWO_HOURS') target.setHours(target.getHours() + 2);
  if (option === 'TOMORROW') {
    target.setDate(target.getDate() + 1);
    target.setHours(9, 0, 0, 0);
  }
  if (option === 'NEXT_WEEK') {
    const daysUntilMonday = (8 - target.getDay()) % 7 || 7;
    target.setDate(target.getDate() + daysUntilMonday);
    target.setHours(9, 0, 0, 0);
  }
  return target.toISOString();
}

export function proposalCanDecide(proposal: DwaionProposal): boolean {
  return proposal.state === 'PENDING' || proposal.state === 'SNOOZED';
}

export function proposalIsHighPriority(proposal: DwaionProposal): boolean {
  return proposal.priority === 'HIGH' || proposal.priority === 'URGENT';
}
