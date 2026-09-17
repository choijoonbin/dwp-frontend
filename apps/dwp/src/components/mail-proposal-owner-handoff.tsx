import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ActionButton } from '@dwp-frontend/design-system';
import { cancelMailProposalHandoff, getMailProposalHandoff } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { MailProposalHandoff, MailProposalMutationBinding } from '@dwp-frontend/shared-utils';

export type MailProposalOwner = 'CALENDAR' | 'HCM' | 'MAIL' | 'WORK';

type OwnerContext = Readonly<{
  proposalId: string;
  commandId: string;
  returnTo: string;
  focus: string;
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const HANDOFF_PARAMETERS = ['proposalId', 'commandId', 'returnTo', 'focus'] as const;
const TERMINAL_POLL_ATTEMPTS = 8;
const TERMINAL_POLL_INTERVAL_MS = 500;

function safeInternalRoute(value: unknown) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
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

function ownerForRoute(value: string | null | undefined): MailProposalOwner | null {
  const safe = safeInternalRoute(value);
  if (!safe) return null;
  const pathname = new URL(safe, 'https://dwp.invalid').pathname;
  if (pathname === '/calendar' || pathname.startsWith('/calendar/')) return 'CALENDAR';
  if (pathname === '/hr' || pathname.startsWith('/hr/')) return 'HCM';
  if (pathname === '/mail' || pathname.startsWith('/mail/')) return 'MAIL';
  if (pathname === '/work' || pathname.startsWith('/work/')) return 'WORK';
  return null;
}

export function hasMailProposalOwnerHandoff(params: URLSearchParams) {
  return HANDOFF_PARAMETERS.some((name) => params.has(name));
}

export function readMailProposalOwnerContext(params: URLSearchParams): OwnerContext | null {
  const proposalId = params.get('proposalId')?.trim() ?? '';
  const commandId = params.get('commandId')?.trim() ?? '';
  const returnTo = safeInternalRoute(params.get('returnTo'));
  const focus = params.get('focus')?.trim() ?? '';
  if (
    !UUID_PATTERN.test(proposalId) ||
    !UUID_PATTERN.test(commandId) ||
    !returnTo ||
    new URL(returnTo, 'https://dwp.invalid').pathname !== '/mail/actions' ||
    focus !== `mail-proposal-${proposalId}`
  ) {
    return null;
  }
  return { proposalId, commandId, returnTo, focus };
}

export function mailProposalOwnerReturnPath(context: OwnerContext) {
  const safe = safeInternalRoute(context.returnTo);
  if (!safe) return null;
  const parsed = new URL(safe, 'https://dwp.invalid');
  if (parsed.pathname !== '/mail/actions') return null;
  parsed.searchParams.set('proposalId', context.proposalId);
  parsed.searchParams.set('focus', context.focus);
  return `${parsed.pathname}?${parsed.searchParams.toString()}${parsed.hash}`;
}

function verifiedHandoff(
  context: OwnerContext | null,
  handoff: MailProposalHandoff | undefined,
  owner: MailProposalOwner
) {
  if (
    !context ||
    !handoff ||
    handoff.proposalId !== context.proposalId ||
    handoff.commandId !== context.commandId ||
    handoff.returnTo !== context.returnTo ||
    handoff.focus !== context.focus ||
    ownerForRoute(handoff.ownerRoute) !== owner
  ) {
    return undefined;
  }
  return handoff;
}

function waitForNextPoll() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, TERMINAL_POLL_INTERVAL_MS));
}

export function useMailProposalOwnerHandoff(owner: MailProposalOwner) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [completionProposalId, setCompletionProposalId] = useState<string | null>(null);
  const [completionReadError, setCompletionReadError] = useState(false);
  const serializedSearch = searchParams.toString();
  const requested = useMemo(
    () => hasMailProposalOwnerHandoff(new URLSearchParams(serializedSearch)),
    [serializedSearch]
  );
  const context = useMemo(
    () => readMailProposalOwnerContext(new URLSearchParams(serializedSearch)),
    [serializedSearch]
  );
  const query = useQuery({
    queryKey: ['mail', 'proposal-handoff', context?.proposalId],
    queryFn: () => getMailProposalHandoff(context!.proposalId),
    enabled: Boolean(context),
    staleTime: 0,
    retry: 1,
  });
  const handoff = verifiedHandoff(context, query.data, owner);
  const active = handoff?.status === 'ACCEPTED';
  const completionStarted = completionProposalId === context?.proposalId;
  const binding = useMemo<MailProposalMutationBinding | undefined>(
    () =>
      active && context && handoff
        ? {
            proposalId: context.proposalId,
            commandId: context.commandId,
            version: handoff.version,
          }
        : undefined,
    [active, context, handoff]
  );
  const cancellation = useMutation({
    mutationFn: async () => {
      if (!context || !handoff || handoff.status !== 'ACCEPTED') {
        throw new Error('The Mail proposal owner cancellation is invalid.');
      }
      return cancelMailProposalHandoff(context.proposalId, {
        commandId: context.commandId,
        version: handoff.version,
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['mail', 'proposal-handoff', updated.proposalId], updated);
    },
  });
  const returnToActionCenter = useCallback(() => {
    if (!context) return false;
    const route = mailProposalOwnerReturnPath(context);
    if (!route) return false;
    navigate(route, { replace: true });
    return true;
  }, [context, navigate]);
  const refreshHandoff = useCallback(async () => {
    if (!context) throw new Error('The Mail proposal owner context is unavailable.');
    const refreshed = await queryClient.fetchQuery({
      queryKey: ['mail', 'proposal-handoff', context.proposalId],
      queryFn: () => getMailProposalHandoff(context.proposalId),
      staleTime: 0,
    });
    const verified = verifiedHandoff(context, refreshed, owner);
    if (!verified) throw new Error('The Mail proposal owner receipt is invalid.');
    return verified;
  }, [context, owner, queryClient]);
  const refreshCompletion = useCallback(async () => {
    setCompletionReadError(false);
    try {
      const refreshed = await refreshHandoff();
      return refreshed.status !== 'ACCEPTED' && returnToActionCenter();
    } catch {
      setCompletionReadError(true);
      return false;
    }
  }, [refreshHandoff, returnToActionCenter]);
  const waitForTerminalAndReturn = useCallback(async () => {
    if (!context || !handoff || handoff.status !== 'ACCEPTED') return false;
    setCompletionProposalId(context.proposalId);
    setCompletionReadError(false);
    for (let attempt = 0; attempt < TERMINAL_POLL_ATTEMPTS; attempt += 1) {
      try {
        const refreshed = await refreshHandoff();
        if (refreshed.status !== 'ACCEPTED') return returnToActionCenter();
      } catch {
        setCompletionReadError(true);
        return false;
      }
      if (attempt + 1 < TERMINAL_POLL_ATTEMPTS) await waitForNextPoll();
    }
    return false;
  }, [context, handoff, refreshHandoff, returnToActionCenter]);
  return {
    requested,
    context,
    handoff,
    binding,
    active,
    ready: Boolean(binding),
    completionStarted,
    blocksSubmission: requested && (!active || cancellation.isPending || completionStarted),
    loading: query.isLoading,
    invalid: requested && (!context || Boolean(query.data && !handoff)),
    loadError: query.isError,
    completionReadError,
    busy: cancellation.isPending,
    retryLoad: query.refetch,
    refreshCompletion,
    waitForTerminalAndReturn,
    cancelAndReturn: async () => {
      try {
        await cancellation.mutateAsync();
        return returnToActionCenter();
      } catch {
        setCompletionReadError(false);
        try {
          const refreshed = await refreshHandoff();
          if (refreshed.status !== 'ACCEPTED') return returnToActionCenter();
        } catch {
          // The recovery notice provides a read-only status retry. Never repeat an
          // owner mutation after an ambiguous cancellation response.
        }
        setCompletionReadError(true);
        return false;
      }
    },
    returnToActionCenter,
  };
}

type OwnerHandoff = ReturnType<typeof useMailProposalOwnerHandoff>;

export function MailProposalOwnerHandoffNotice({ handoff }: { handoff: OwnerHandoff }) {
  const { t } = useTranslation('mail');
  if (!handoff.requested) return null;
  if (handoff.loading) {
    return <Alert severity="info">{t('proposal.owner.loading')}</Alert>;
  }
  if (handoff.invalid || handoff.loadError || !handoff.handoff) {
    return (
      <Alert
        severity="error"
        action={
          handoff.context ? (
            <ActionButton intent="quiet" size="small" onClick={() => void handoff.retryLoad()}>
              {t('actions.retry')}
            </ActionButton>
          ) : undefined
        }
      >
        {t('proposal.owner.invalid')}
      </Alert>
    );
  }
  if (handoff.completionReadError) {
    return (
      <Alert
        severity="error"
        action={
          <ActionButton
            intent="quiet"
            size="small"
            disabled={handoff.busy}
            onClick={() => void handoff.refreshCompletion()}
          >
            {t('proposal.owner.refresh')}
          </ActionButton>
        }
      >
        {t('proposal.owner.completionReadError')}
      </Alert>
    );
  }
  const terminal = !handoff.active;
  return (
    <Alert
      severity={terminal ? (handoff.handoff.status === 'EXECUTED' ? 'success' : 'info') : 'info'}
      action={
        terminal ? (
          <ActionButton intent="quiet" size="small" onClick={handoff.returnToActionCenter}>
            {t('proposal.owner.return')}
          </ActionButton>
        ) : handoff.completionStarted ? (
          <ActionButton
            intent="quiet"
            size="small"
            disabled={handoff.busy}
            onClick={() => void handoff.refreshCompletion()}
          >
            {t('proposal.owner.refresh')}
          </ActionButton>
        ) : (
          <ActionButton
            intent="quiet"
            size="small"
            disabled={handoff.busy}
            onClick={() => void handoff.cancelAndReturn()}
          >
            {t('proposal.owner.cancel')}
          </ActionButton>
        )
      }
    >
      <Stack spacing={0.25}>
        <Typography variant="body2" fontWeight={750}>
          {t(
            terminal
              ? `proposal.handoff.status.${handoff.handoff.status}`
              : handoff.completionStarted
                ? 'proposal.owner.pending'
                : 'proposal.owner.review'
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('proposal.handoff.command', { commandId: handoff.handoff.commandId })}
        </Typography>
      </Stack>
    </Alert>
  );
}
