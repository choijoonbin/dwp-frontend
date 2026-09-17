import type { MailActionProposal, MailProposalHandoff } from '@dwp-frontend/shared-utils';
import { mailProposalOwnsRoute } from './mail-proposal-model';

const HANDOFF_PARAMETER_NAMES = ['proposalId', 'commandId', 'returnTo', 'focus'] as const;

function safeInternalRoute(value: unknown) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  ) {
    return null;
  }
  try {
    const parsed = new URL(value, 'https://dwp.invalid');
    return parsed.origin === 'https://dwp.invalid'
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : null;
  } catch {
    return null;
  }
}

function boundedIdentifier(value: unknown, maximum = 200) {
  return typeof value === 'string' && value.trim() && value.length <= maximum ? value.trim() : null;
}

function ownerPreparationRoute(proposal: MailActionProposal, ownerRoute: string) {
  const parsed = new URL(ownerRoute, 'https://dwp.invalid');
  if (proposal.type === 'CREATE_CALENDAR_EVENT') {
    parsed.pathname = '/calendar/schedule';
    parsed.searchParams.delete('action');
    parsed.searchParams.set('create', 'meeting');
  } else if (proposal.type === 'CREATE_TASK') {
    parsed.pathname = '/work/queue';
    parsed.searchParams.delete('action');
    parsed.searchParams.set('compose', 'task');
  } else if (proposal.type === 'CREATE_LEAVE_REQUEST') {
    parsed.pathname = '/hr/absence';
    parsed.searchParams.delete('action');
    parsed.searchParams.set('request', 'open');
  }
  return parsed;
}

export function mailProposalReturnRoute(proposalId: string) {
  const safeProposalId = boundedIdentifier(proposalId);
  if (!safeProposalId) return '/mail/actions';
  const search = new URLSearchParams({
    proposalId: safeProposalId,
    focus: `mail-proposal-${safeProposalId}`,
  });
  return `/mail/actions?${search.toString()}`;
}

export function mailProposalOwnerHandoffRoute(
  proposal: MailActionProposal,
  handoff: MailProposalHandoff,
  returnTo?: string
) {
  const proposalId = boundedIdentifier(handoff.proposalId);
  const commandId = boundedIdentifier(handoff.commandId);
  const ownerRoute = safeInternalRoute(handoff.ownerRoute);
  const safeReturnTo = safeInternalRoute(
    returnTo ?? handoff.returnTo ?? mailProposalReturnRoute(proposal.proposalId)
  );
  if (
    !proposalId ||
    proposalId !== proposal.proposalId ||
    !commandId ||
    !ownerRoute ||
    !safeReturnTo ||
    new URL(safeReturnTo, 'https://dwp.invalid').pathname !== '/mail/actions' ||
    !mailProposalOwnsRoute(proposal, ownerRoute)
  ) {
    return null;
  }
  const parsed = ownerPreparationRoute(proposal, ownerRoute);
  for (const parameter of HANDOFF_PARAMETER_NAMES) parsed.searchParams.delete(parameter);
  parsed.searchParams.set('proposalId', proposalId);
  parsed.searchParams.set('commandId', commandId);
  parsed.searchParams.set('returnTo', safeReturnTo);
  parsed.searchParams.set('focus', boundedIdentifier(handoff.focus) ?? 'owner-review');
  return `${parsed.pathname}?${parsed.searchParams.toString()}${parsed.hash}`;
}

export function mailReturnedProposalId(params: URLSearchParams) {
  return boundedIdentifier(params.get('proposalId'));
}
