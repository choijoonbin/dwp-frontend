import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  MailOpen,
  MessageSquareText,
  RotateCcw,
  Send,
  ShieldAlert,
  Star,
  UserRoundCheck,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  addMailComment,
  applyMailThreadAction,
  assignMailThread,
  decideMailProposal,
  getMailHome,
  getMailThread,
  getMailWritingAssets,
  HttpError,
  replyToMailThread,
  resolveIdempotentMutationIntent,
  snoozeMailThread,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  FormField,
  GuidedEmptyState,
  LoadingState,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { mailRelativeTime } from './mail-components';
import { mailComposeNavigationState } from './mail-compose-navigation';
import { MailDraftEditor } from './mail-draft-editor';
import { mailForwardDraft } from './mail-message-presentation';
import { MailProposalCard, MailProposalReviewDialog } from './mail-proposal-card';
import { mailReplyAllRecipients } from './mail-reply-recipients';
import { mailReplySignatureText, resolveMailReplySignature } from './mail-reply-signature';
import { useMailRuntimePreferences } from './mail-runtime-preferences';
import {
  clearMailRejectedReplyReview,
  clearMailSendAttempt,
  mailReplySendScope,
  mailSendCustodyOwner,
  mailSendErrorDisposition,
  readMailRejectedReplyReview,
  readMailSendAttempt,
  rememberMailRejectedReplyReview,
  rememberMailSendAttempt,
} from './mail-send-attempt';
import { MailSnoozeDialog } from './mail-snooze-dialog';
import { MailThreadLifecycleActions } from './mail-thread-lifecycle-actions';
import { MailThreadMessageCard } from './mail-thread-message-card';
import { useMailProposalHandoff } from './use-mail-proposal-handoff';

import type {
  IdempotentMutationIntent,
  MailActionProposal,
  MailRecipient,
  MailSharedInboxAction,
  MailThread,
  MailThreadAction,
  MailThreadDetail,
} from '@dwp-frontend/shared-utils';

function permitsSharedInboxAction(
  detail: MailThreadDetail | undefined,
  action: MailSharedInboxAction
) {
  if (!detail) return false;
  if (!detail.thread.sharedInboxId) return true;
  return detail.sharedInboxActions?.includes(action) === true;
}

type ReplySendPayload = Readonly<{
  threadId: string;
  body: string;
  mode: 'REPLY' | 'REPLY_ALL';
  recipients?: MailRecipient[];
}>;

export function MailThreadDetailPane({
  threadId,
  onBack,
  onUpdated,
  onDeleted,
}: {
  threadId?: string | null;
  onBack?: () => void;
  onUpdated?: (thread: MailThread) => void;
  onDeleted?: () => void;
}) {
  const { t, i18n } = useTranslation('mail');
  const auth = useAuth();
  const custodyOwner = mailSendCustodyOwner(auth.user);
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const initialReplyScope = threadId ? mailReplySendScope(custodyOwner, threadId) : null;
  const initialReplyAttempt = initialReplyScope
    ? readMailSendAttempt<ReplySendPayload>(initialReplyScope)
    : null;
  const initialRejectedReply =
    initialReplyScope && !initialReplyAttempt
      ? readMailRejectedReplyReview(initialReplyScope)
      : null;
  const [reply, setReply] = useState(
    initialReplyAttempt?.payload.body ?? initialRejectedReply?.body ?? ''
  );
  const [replyMode, setReplyMode] = useState<'REPLY' | 'REPLY_ALL'>(
    initialReplyAttempt?.payload.mode ?? initialRejectedReply?.mode ?? 'REPLY'
  );
  const [replyResolutionPending, setReplyResolutionPending] = useState(
    Boolean(initialReplyAttempt)
  );
  const [replyRejected, setReplyRejected] = useState(Boolean(initialRejectedReply));
  const [comment, setComment] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | ''>('');
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [proposalToAccept, setProposalToAccept] = useState<MailActionProposal | null>(null);
  const [loadedRemoteImages, setLoadedRemoteImages] = useState<Set<string>>(() => new Set());
  const [threadConflict, setThreadConflict] = useState(false);
  const replySignatureApplicationRef = useRef<string | null>(null);
  const replyIdentityRef = useRef<IdempotentMutationIntent | null>(
    initialReplyAttempt?.intent ?? null
  );
  const activeReplyScopeRef = useRef<string | null>(null);
  const activeReplyOwnerRef = useRef<string | null>(null);
  const currentThreadIdRef = useRef(threadId);
  const currentCustodyOwnerRef = useRef(custodyOwner);
  currentThreadIdRef.current = threadId;
  currentCustodyOwnerRef.current = custodyOwner;
  const query = useQuery({
    queryKey: ['mail', 'thread', threadId],
    queryFn: () => getMailThread(threadId!),
    enabled: Boolean(threadId),
    staleTime: 15_000,
    retry: 1,
    refetchInterval: (mailQuery) => {
      const detail = mailQuery.state.data;
      if (
        detail?.messages.some((message) =>
          ['QUEUED', 'SENDING', 'RETRYING'].includes(message.deliveryState)
        )
      ) {
        return 1_500;
      }
      return detail?.thread.sharedInboxId ? 5_000 : false;
    },
  });
  const replyAccountQuery = useQuery({
    queryKey: ['mail', 'home', 'reply-account', query.data?.thread.accountId],
    queryFn: () => getMailHome({ accountId: query.data!.thread.accountId }),
    enabled: Boolean(query.data?.thread.accountId),
    staleTime: 60_000,
    retry: 1,
  });
  const writingAssetsQuery = useQuery({
    queryKey: ['mail', 'writing-assets'],
    queryFn: () => getMailWritingAssets(),
    enabled: Boolean(threadId),
    staleTime: 30_000,
    retry: 1,
  });
  const runtimePreferences = useMailRuntimePreferences();
  const proposalHandoff = useMailProposalHandoff();
  useEffect(() => {
    setAssigneeId(query.data?.thread.assignedUserId ?? '');
  }, [query.data?.thread.assignedUserId, query.data?.thread.threadId]);
  useEffect(() => {
    const scope = threadId ? mailReplySendScope(custodyOwner, threadId) : null;
    const attempt = scope ? readMailSendAttempt<ReplySendPayload>(scope) : null;
    const rejected = scope && !attempt ? readMailRejectedReplyReview(scope) : null;
    replyIdentityRef.current = attempt?.intent ?? null;
    setReply(attempt?.payload.body ?? rejected?.body ?? '');
    setReplyMode(attempt?.payload.mode ?? rejected?.mode ?? 'REPLY');
    setReplyResolutionPending(Boolean(attempt));
    setReplyRejected(Boolean(rejected));
    replySignatureApplicationRef.current = null;
    setLoadedRemoteImages(new Set());
    setThreadConflict(false);
  }, [custodyOwner, threadId]);
  useEffect(() => {
    const accountId = query.data?.thread.accountId;
    if (!threadId || !accountId || !writingAssetsQuery.data) return;
    const signature = resolveMailReplySignature(writingAssetsQuery.data.signatures, accountId);
    const applicationKey = `${custodyOwner}:${threadId}:${signature?.signatureId ?? 'none'}`;
    if (replySignatureApplicationRef.current === applicationKey) return;
    replySignatureApplicationRef.current = applicationKey;
    if (!signature) return;
    const signatureText = mailReplySignatureText(signature);
    if (!signatureText) return;
    setReply((current) => (current.trim() ? current : signatureText));
  }, [custodyOwner, query.data?.thread.accountId, threadId, writingAssetsQuery.data]);
  useEffect(() => {
    const detail = query.data;
    if (!threadId || !detail?.thread.sharedInboxId) return;
    const canContinueReply =
      permitsSharedInboxAction(detail, 'REPLY') && permitsSharedInboxAction(detail, 'SEND_AS');
    if (!canContinueReply) {
      const scope = mailReplySendScope(custodyOwner, threadId);
      clearMailSendAttempt(scope);
      clearMailRejectedReplyReview(scope);
      replyIdentityRef.current = null;
      setReply('');
      setReplyMode('REPLY');
      setReplyResolutionPending(false);
      setReplyRejected(false);
    }
    if (!permitsSharedInboxAction(detail, 'COMMENT')) setComment('');
    if (!permitsSharedInboxAction(detail, 'ASSIGN')) setAssigneeId('');
  }, [custodyOwner, query.data, threadId]);
  const refresh = async (thread: MailThread) => {
    onUpdated?.(thread);
    await queryClient.invalidateQueries({ queryKey: ['mail'] });
  };
  const actionMutation = useMutation({
    onMutate: () => setThreadConflict(false),
    mutationFn: (action: MailThreadAction) =>
      applyMailThreadAction(threadId!, action, query.data!.thread.version),
    onSuccess: async (detail) => {
      queryClient.setQueryData(['mail', 'thread', threadId], detail);
      await refresh(detail.thread);
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 409) {
        setThreadConflict(true);
        void query.refetch();
      }
      toast.error(t('thread.actionError'));
    },
  });
  const snoozeMutation = useMutation({
    mutationFn: (until: string) => snoozeMailThread(threadId!, until, query.data!.thread.version),
    onSuccess: async (detail) => {
      setSnoozeOpen(false);
      queryClient.setQueryData(['mail', 'thread', threadId], detail);
      await refresh(detail.thread);
      toast.success(t('thread.snoozed'));
    },
    onError: () => toast.error(t('thread.actionError')),
  });
  const replyMutation = useMutation({
    mutationFn: () => {
      if (
        !permitsSharedInboxAction(query.data, 'REPLY') ||
        !permitsSharedInboxAction(query.data, 'SEND_AS')
      ) {
        throw new Error('Shared inbox reply permission is required.');
      }
      const scope = mailReplySendScope(custodyOwner, threadId!);
      const storedAttempt = readMailSendAttempt<ReplySendPayload>(scope);
      const replyAllRecipients = mailReplyAllRecipients(query.data!.messages, [
        auth.user?.email,
        replyAccountQuery.data?.accounts.find(
          (account) => account.accountId === query.data!.thread.accountId
        )?.emailAddress,
      ]);
      const payload = storedAttempt?.payload ?? {
        threadId: threadId!,
        body: reply.trim(),
        mode: replyMode,
        recipients: replyMode === 'REPLY_ALL' ? replyAllRecipients : undefined,
      };
      const replyIdentity =
        storedAttempt?.intent ?? resolveIdempotentMutationIntent(replyIdentityRef.current, payload);
      replyIdentityRef.current = replyIdentity;
      activeReplyScopeRef.current = scope;
      activeReplyOwnerRef.current = custodyOwner;
      clearMailRejectedReplyReview(scope);
      rememberMailSendAttempt(scope, { intent: replyIdentity, payload });
      return replyToMailThread(payload.threadId, payload.body, replyIdentity.key, {
        mode: payload.mode ?? 'REPLY',
        recipients: payload.recipients,
      });
    },
    onSuccess: async (detail) => {
      const completedScope = activeReplyScopeRef.current;
      const completedOwner = activeReplyOwnerRef.current;
      if (completedScope) clearMailSendAttempt(completedScope);
      if (completedScope) clearMailRejectedReplyReview(completedScope);
      activeReplyScopeRef.current = null;
      activeReplyOwnerRef.current = null;
      if (currentCustodyOwnerRef.current !== completedOwner) return;
      if (currentThreadIdRef.current === detail.thread.threadId) {
        setReplyResolutionPending(false);
        setReplyRejected(false);
        replyIdentityRef.current = null;
        setReply('');
        setReplyMode('REPLY');
      }
      queryClient.setQueryData(['mail', 'thread', detail.thread.threadId], detail);
      await refresh(detail.thread);
      toast.success(t('thread.replySent'));
    },
    onError: (error) => {
      const failedScope = activeReplyScopeRef.current;
      const failedOwner = activeReplyOwnerRef.current;
      const failedPrefix = failedOwner ? `${failedOwner}:reply:` : null;
      const failedThreadId =
        failedPrefix && failedScope?.startsWith(failedPrefix)
          ? failedScope.slice(failedPrefix.length)
          : null;
      if (mailSendErrorDisposition(error) === 'UNCONFIRMED') {
        if (currentCustodyOwnerRef.current !== failedOwner) return;
        if (currentThreadIdRef.current === failedThreadId) {
          setReplyResolutionPending(true);
        }
        toast.error(t('thread.replyOutcomeUnconfirmed'));
        return;
      }
      const rejectedAttempt = failedScope
        ? readMailSendAttempt<ReplySendPayload>(failedScope)
        : null;
      if (failedScope && rejectedAttempt && failedThreadId) {
        rememberMailRejectedReplyReview(failedScope, {
          threadId: failedThreadId,
          body: rejectedAttempt.payload.body,
          mode: rejectedAttempt.payload.mode,
          recipients: rejectedAttempt.payload.recipients,
        });
      }
      if (failedScope) clearMailSendAttempt(failedScope);
      activeReplyScopeRef.current = null;
      activeReplyOwnerRef.current = null;
      if (
        currentCustodyOwnerRef.current === failedOwner &&
        currentThreadIdRef.current === failedThreadId
      ) {
        replyIdentityRef.current = null;
        setReplyResolutionPending(false);
        if (rejectedAttempt) setReply(rejectedAttempt.payload.body);
        if (rejectedAttempt) setReplyMode(rejectedAttempt.payload.mode ?? 'REPLY');
        setReplyRejected(true);
      }
    },
  });
  const commentMutation = useMutation({
    mutationFn: () => {
      if (!permitsSharedInboxAction(query.data, 'COMMENT')) {
        throw new Error('Shared inbox comment permission is required.');
      }
      return addMailComment(threadId!, comment.trim());
    },
    onSuccess: async (detail) => {
      setComment('');
      queryClient.setQueryData(['mail', 'thread', threadId], detail);
      await refresh(detail.thread);
      toast.success(t('thread.commentAdded'));
    },
    onError: () => toast.error(t('thread.commentError')),
  });
  const assignmentMutation = useMutation({
    mutationFn: () => {
      if (!permitsSharedInboxAction(query.data, 'ASSIGN')) {
        throw new Error('Shared inbox assignment permission is required.');
      }
      const member = query.data?.sharedInboxMembers.find((item) => item.userId === assigneeId);
      if (!member || !query.data) throw new Error('Shared inbox assignee is required.');
      return assignMailThread(
        threadId!,
        member.userId,
        member.displayName,
        query.data.thread.version
      );
    },
    onSuccess: async (detail) => {
      queryClient.setQueryData(['mail', 'thread', threadId], detail);
      await refresh(detail.thread);
      toast.success(t('thread.assignmentSaved'));
    },
    onError: (error) => {
      if (error instanceof HttpError && error.status === 409) {
        setThreadConflict(true);
        void query.refetch();
      }
      toast.error(t('thread.assignmentError'));
    },
  });
  const proposalMutation = useMutation({
    mutationFn: ({
      proposal,
      decision,
    }: {
      proposal: MailActionProposal;
      decision: 'ACCEPT' | 'DISMISS';
    }) => decideMailProposal(proposal.proposalId, decision, proposal.version),
    onSuccess: async (proposal, variables) => {
      setProposalToAccept(null);
      await queryClient.invalidateQueries({ queryKey: ['mail'] });
      await query.refetch();
      if (variables.decision === 'ACCEPT') {
        toast.success(t('proposal.accepted'));
        proposalHandoff.mutate(proposal);
      } else {
        toast.success(t('proposal.dismissed'));
      }
    },
    onError: () => toast.error(t('proposal.error')),
  });

  const openForward = (message: MailThreadDetail['messages'][number]) => {
    const draft = mailForwardDraft(thread.subject, message, {
      forwardedMessage: t('thread.forwardedMessage', { defaultValue: 'Forwarded message' }),
      from: t('thread.from', { defaultValue: 'From' }),
      sentAt: t('thread.sentAt', { defaultValue: 'Date' }),
      subject: t('thread.subject', { defaultValue: 'Subject' }),
    });
    navigate('/mail/inbox?compose=open', {
      state: mailComposeNavigationState(
        draft,
        `${location.pathname}${location.search}${location.hash}`
      ),
    });
  };

  if (!threadId) {
    return (
      <Box sx={{ height: 1, minHeight: 360, display: 'grid', placeItems: 'center', p: 3 }}>
        <GuidedEmptyState
          kind="empty"
          title={t('thread.selectTitle')}
          description={t('thread.selectDescription')}
        />
      </Box>
    );
  }

  if (query.isLoading) {
    return <LoadingState label={t('common:labels.loading')} size="page" embedded />;
  }

  if (query.isError || !query.data) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={() => query.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('thread.loadError')}
        </Alert>
      </Box>
    );
  }

  const detail = query.data;
  const thread = detail.thread;
  const language = i18n.resolvedLanguage ?? i18n.language;
  const isSharedInbox = Boolean(thread.sharedInboxId);
  const canAssign = permitsSharedInboxAction(detail, 'ASSIGN');
  const canComment = permitsSharedInboxAction(detail, 'COMMENT');
  const canReply =
    permitsSharedInboxAction(detail, 'REPLY') && permitsSharedInboxAction(detail, 'SEND_AS');
  const hasRestrictedSharedInboxActions = isSharedInbox && (!canAssign || !canComment || !canReply);
  const replyAccountEmail = replyAccountQuery.data?.accounts.find(
    (account) => account.accountId === thread.accountId
  )?.emailAddress;
  const replyAllRecipients = mailReplyAllRecipients(detail.messages, [
    auth.user?.email,
    replyAccountEmail,
  ]);
  const replyAllAddsRecipients = replyAllRecipients.length > 1;

  if (thread.workflowState === 'DRAFT') {
    return (
      <MailDraftEditor
        key={`${custodyOwner}:${thread.threadId}`}
        detail={detail}
        onBack={onBack}
        onUpdated={onUpdated}
      />
    );
  }

  return (
    <Box sx={{ height: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          px: { xs: 1.5, md: 2.25 },
          py: 1.25,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          position: 'sticky',
          top: 0,
          zIndex: 2,
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'center' }}
          spacing={1}
        >
          <Stack direction="row" alignItems="center" spacing={0.5} useFlexGap flexWrap="wrap">
            {onBack && (
              <ActionIconButton label={t('actions.back')} onClick={onBack}>
                <ArrowLeft size={18} />
              </ActionIconButton>
            )}
            <ActionIconButton
              label={thread.unread ? t('thread.markRead') : t('thread.markUnread')}
              loading={actionMutation.isPending}
              onClick={() => actionMutation.mutate(thread.unread ? 'MARK_READ' : 'MARK_UNREAD')}
            >
              <MailOpen size={18} />
            </ActionIconButton>
            <ActionIconButton
              label={thread.starred ? t('thread.unstar') : t('thread.star')}
              loading={actionMutation.isPending}
              intent={thread.starred ? 'primary' : 'default'}
              onClick={() => actionMutation.mutate(thread.starred ? 'UNSTAR' : 'STAR')}
            >
              <Star size={18} fill={thread.starred ? 'currentColor' : 'none'} />
            </ActionIconButton>
            <ActionIconButton
              label={t('thread.snooze')}
              loading={snoozeMutation.isPending}
              onClick={() => setSnoozeOpen(true)}
            >
              <Clock3 size={18} />
            </ActionIconButton>
            {thread.workflowState === 'SNOOZED' && (
              <ActionButton
                intent="secondary"
                size="small"
                loading={actionMutation.isPending}
                startIcon={<RotateCcw size={15} />}
                onClick={() => actionMutation.mutate('REOPEN')}
              >
                {t('thread.showNow')}
              </ActionButton>
            )}
            <MailThreadLifecycleActions
              thread={thread}
              onUpdated={(updated) => {
                queryClient.invalidateQueries({ queryKey: ['mail', 'thread', threadId] });
                onUpdated?.(updated);
              }}
              onDeleted={() => onDeleted?.()}
            />
          </Stack>
          <Chip
            size="small"
            variant="outlined"
            label={t(`classification.${thread.classification}`)}
            sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
          />
        </Stack>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: { xs: 2, md: 3 } }}>
        {thread.externalSender && (
          <Alert severity="warning" icon={<ShieldAlert size={19} />} sx={{ mb: 2 }}>
            {t('thread.externalSender')}
          </Alert>
        )}
        {hasRestrictedSharedInboxActions && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('thread.sharedActionPermissionUnavailable')}
          </Alert>
        )}
        {threadConflict && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('thread.changedElsewhere', {
              defaultValue:
                'This conversation changed elsewhere. The latest version is now shown; review it before trying again.',
            })}
          </Alert>
        )}
        <Typography component="h2" variant="h5" fontWeight={800}>
          {thread.subject}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mt: 1 }}>
          {thread.sharedInboxName && <Chip size="small" label={thread.sharedInboxName} />}
          {thread.assignedName && (
            <Typography variant="caption" color="text.secondary">
              {t('thread.assignedTo', { name: thread.assignedName })}
            </Typography>
          )}
        </Stack>

        {thread.sharedInboxId && (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', sm: 'center' }}
            >
              {detail.sharedInboxMembers.length > 0 && (
                <>
                  <UserRoundCheck size={18} color="var(--dwp-product-accent)" />
                  <SelectField<number>
                    size="small"
                    label={t('thread.assignee')}
                    value={assigneeId}
                    placeholder={t('thread.assigneePlaceholder')}
                    disabled={!canAssign}
                    options={detail.sharedInboxMembers.map((member) => ({
                      value: member.userId,
                      label: `${member.displayName} · ${member.emailAddress}`,
                    }))}
                    sx={{ flex: 1 }}
                    onValueChange={setAssigneeId}
                  />
                  <ActionButton
                    intent="secondary"
                    disabled={!canAssign || !assigneeId || assigneeId === thread.assignedUserId}
                    loading={assignmentMutation.isPending}
                    onClick={() => assignmentMutation.mutate()}
                  >
                    {t('thread.assign')}
                  </ActionButton>
                </>
              )}
              <ActionButton
                intent={thread.workflowState === 'DONE' ? 'secondary' : 'primary'}
                disabled={!canAssign}
                loading={actionMutation.isPending}
                startIcon={
                  thread.workflowState === 'DONE' ? (
                    <RotateCcw size={15} />
                  ) : (
                    <CheckCircle2 size={15} />
                  )
                }
                onClick={() =>
                  actionMutation.mutate(thread.workflowState === 'DONE' ? 'REOPEN' : 'COMPLETE')
                }
              >
                {thread.workflowState === 'DONE'
                  ? t('thread.reopen', { defaultValue: 'Reopen' })
                  : t('thread.complete', { defaultValue: 'Complete' })}
              </ActionButton>
            </Stack>
          </Box>
        )}

        <Stack spacing={1.5} sx={{ mt: 2.5 }}>
          {detail.messages.map((message) => (
            <MailThreadMessageCard
              key={message.messageId}
              threadId={thread.threadId}
              message={message}
              language={language}
              remoteImagePolicy={runtimePreferences.data?.remoteImages ?? 'BLOCK'}
              remoteImagesManuallyAllowed={loadedRemoteImages.has(message.messageId)}
              onLoadRemoteImages={() =>
                setLoadedRemoteImages((current) => new Set([...current, message.messageId]))
              }
              onForward={() => openForward(message)}
            />
          ))}
        </Stack>

        {detail.proposals.length > 0 && (
          <Box component="section" sx={{ mt: 3 }}>
            <Typography component="h3" variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
              {t('thread.proposals')}
            </Typography>
            <Stack spacing={1}>
              {detail.proposals.map((proposal) => (
                <MailProposalCard
                  key={proposal.proposalId}
                  proposal={proposal}
                  busy={proposalMutation.isPending || proposalHandoff.isPending}
                  onAccept={() => setProposalToAccept(proposal)}
                  onDismiss={() => proposalMutation.mutate({ proposal, decision: 'DISMISS' })}
                />
              ))}
            </Stack>
          </Box>
        )}

        <Box component="section" sx={{ mt: 3 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <MessageSquareText size={17} color="var(--dwp-product-accent)" />
            <Typography component="h3" variant="subtitle2" fontWeight={800}>
              {t('thread.internalComments')}
            </Typography>
            <Chip size="small" label={t('thread.teamOnly')} variant="outlined" />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {t('thread.internalCommentsDescription')}
          </Typography>
          {detail.internalComments.length > 0 && (
            <Stack spacing={1} sx={{ mt: 1.25 }}>
              {detail.internalComments.map((item) => (
                <Box key={item.commentId} sx={{ display: 'flex', gap: 1.25, py: 0.75 }}>
                  <Avatar sx={{ width: 30, height: 30, fontSize: 12, bgcolor: 'primary.dark' }}>
                    {item.authorName.slice(0, 2)}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} alignItems="baseline">
                      <Typography variant="body2" fontWeight={750}>
                        {item.authorName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {mailRelativeTime(item.createdAt, language)}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 0.25, overflowWrap: 'anywhere' }}>
                      {item.body}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          )}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'stretch', sm: 'flex-end' }}
            sx={{ mt: 1.25 }}
          >
            <FormField
              size="small"
              label={t('thread.addComment')}
              value={comment}
              disabled={!canComment}
              inputProps={{ maxLength: 4000 }}
              onChange={(event) => setComment(event.target.value)}
            />
            <ActionButton
              intent="secondary"
              disabled={!canComment || !comment.trim()}
              loading={commentMutation.isPending}
              onClick={() => commentMutation.mutate()}
            >
              {t('thread.comment')}
            </ActionButton>
          </Stack>
        </Box>

        <Divider sx={{ my: 3 }} />
        <Box component="section">
          <Typography component="h3" variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
            {t('thread.reply')}
          </Typography>
          {replyResolutionPending && (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              {t('thread.replyRetrySameCommand')}
            </Alert>
          )}
          {replyRejected && (
            <Alert severity="error" sx={{ mb: 1.5 }}>
              {t('thread.replyRejectedReview')}
            </Alert>
          )}
          <SelectField<'REPLY' | 'REPLY_ALL'>
            size="small"
            label={t('thread.replyMode')}
            value={replyMode}
            disabled={!canReply || replyResolutionPending}
            options={[
              { value: 'REPLY', label: t('thread.reply') },
              {
                value: 'REPLY_ALL',
                label: t('thread.replyAll'),
                disabled: !replyAllAddsRecipients,
              },
            ]}
            supportingText={
              replyMode === 'REPLY_ALL'
                ? t('thread.replyAllRecipients', {
                    recipients: replyAllRecipients
                      .map((recipient) => recipient.name || recipient.email)
                      .join(', '),
                  })
                : undefined
            }
            sx={{ mb: 1.25, maxWidth: 460 }}
            onValueChange={(mode) => {
              if (!mode) return;
              if (threadId) {
                clearMailRejectedReplyReview(mailReplySendScope(custodyOwner, threadId));
              }
              setReplyRejected(false);
              setReplyMode(mode);
            }}
          />
          <FormField
            multiline
            minRows={4}
            maxRows={12}
            label={t('thread.replyPlaceholder')}
            value={reply}
            disabled={!canReply || replyResolutionPending}
            inputProps={{ maxLength: 100_000 }}
            onChange={(event) => {
              if (threadId) {
                clearMailRejectedReplyReview(mailReplySendScope(custodyOwner, threadId));
              }
              setReplyRejected(false);
              setReply(event.target.value);
            }}
          />
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
            spacing={1}
            sx={{ mt: 1 }}
          >
            <Typography variant="caption" color="text.secondary">
              {t('thread.replyIdentity', {
                name: auth.user?.displayName ?? t('home.member'),
              })}
            </Typography>
            <ActionButton
              intent="primary"
              startIcon={<Send size={16} />}
              disabled={!canReply || !reply.trim() || replyRejected}
              loading={replyMutation.isPending}
              onClick={() => replyMutation.mutate()}
            >
              {t(replyMode === 'REPLY_ALL' ? 'thread.sendReplyAll' : 'thread.sendReply')}
            </ActionButton>
          </Stack>
        </Box>
      </Box>

      <MailProposalReviewDialog
        proposal={proposalToAccept}
        busy={proposalMutation.isPending || proposalHandoff.isPending}
        onClose={() => setProposalToAccept(null)}
        onConfirm={() => {
          if (proposalToAccept) {
            proposalMutation.mutate({ proposal: proposalToAccept, decision: 'ACCEPT' });
          }
        }}
      />
      <MailSnoozeDialog
        open={snoozeOpen}
        busy={snoozeMutation.isPending}
        onClose={() => setSnoozeOpen(false)}
        onSubmit={(until) => snoozeMutation.mutate(until)}
      />
    </Box>
  );
}
