import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Clock3,
  MailOpen,
  MessageSquareText,
  Paperclip,
  RotateCcw,
  Send,
  ShieldAlert,
  Star,
  UserRoundCheck,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  addMailComment,
  applyMailThreadAction,
  assignMailThread,
  decideMailProposal,
  getMailThread,
  replyToMailThread,
  retryMailDelivery,
  snoozeMailThread,
  useAuth,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  FormField,
  GuidedEmptyState,
  SelectField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { mailRelativeTime, MailProposalCard } from './mail-components';
import { MailDraftEditor } from './mail-draft-editor';
import { MailSnoozeDialog } from './mail-snooze-dialog';
import { MailThreadLifecycleActions } from './mail-thread-lifecycle-actions';

import type { MailActionProposal, MailThread, MailThreadAction } from '@dwp-frontend/shared-utils';

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
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const [comment, setComment] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | ''>('');
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [proposalToAccept, setProposalToAccept] = useState<MailActionProposal | null>(null);
  const query = useQuery({
    queryKey: ['mail', 'thread', threadId],
    queryFn: () => getMailThread(threadId!),
    enabled: Boolean(threadId),
    staleTime: 15_000,
    retry: 1,
    refetchInterval: (mailQuery) => {
      const detail = mailQuery.state.data;
      return detail?.messages.some((message) =>
        ['QUEUED', 'SENDING', 'RETRYING'].includes(message.deliveryState)
      )
        ? 1_500
        : false;
    },
  });
  useEffect(() => {
    setAssigneeId(query.data?.thread.assignedUserId ?? '');
  }, [query.data?.thread.assignedUserId, query.data?.thread.threadId]);
  const refresh = async (thread: MailThread) => {
    onUpdated?.(thread);
    await queryClient.invalidateQueries({ queryKey: ['mail'] });
  };
  const actionMutation = useMutation({
    mutationFn: (action: MailThreadAction) =>
      applyMailThreadAction(threadId!, action, query.data!.thread.version),
    onSuccess: async (detail) => {
      queryClient.setQueryData(['mail', 'thread', threadId], detail);
      await refresh(detail.thread);
    },
    onError: () => toast.error(t('thread.actionError')),
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
    mutationFn: () => replyToMailThread(threadId!, reply.trim(), crypto.randomUUID()),
    onSuccess: async (detail) => {
      setReply('');
      queryClient.setQueryData(['mail', 'thread', threadId], detail);
      await refresh(detail.thread);
      toast.success(t('thread.replySent'));
    },
    onError: () => toast.error(t('thread.replyError')),
  });
  const commentMutation = useMutation({
    mutationFn: () => addMailComment(threadId!, comment.trim()),
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
    onError: () => toast.error(t('thread.assignmentError')),
  });
  const retryMutation = useMutation({
    mutationFn: (messageId: string) => retryMailDelivery(threadId!, messageId),
    onSuccess: async (detail) => {
      queryClient.setQueryData(['mail', 'thread', threadId], detail);
      await refresh(detail.thread);
      toast.success(t('delivery.retryQueued'));
    },
    onError: () => toast.error(t('delivery.retryError')),
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
        if (proposal.targetRoute) navigate(proposal.targetRoute);
      } else {
        toast.success(t('proposal.dismissed'));
      }
    },
    onError: () => toast.error(t('proposal.error')),
  });

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
    return (
      <Box sx={{ height: 1, minHeight: 360, display: 'grid', placeItems: 'center' }}>
        <CircularProgress size={26} />
      </Box>
    );
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

  if (thread.workflowState === 'DRAFT') {
    return (
      <MailDraftEditor
        key={thread.threadId}
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

        {thread.sharedInboxId && detail.sharedInboxMembers.length > 0 && (
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
              <UserRoundCheck size={18} color="var(--dwp-product-accent)" />
              <SelectField<number>
                size="small"
                label={t('thread.assignee')}
                value={assigneeId}
                placeholder={t('thread.assigneePlaceholder')}
                options={detail.sharedInboxMembers.map((member) => ({
                  value: member.userId,
                  label: `${member.displayName} · ${member.emailAddress}`,
                }))}
                sx={{ flex: 1 }}
                onValueChange={setAssigneeId}
              />
              <ActionButton
                intent="secondary"
                disabled={!assigneeId || assigneeId === thread.assignedUserId}
                loading={assignmentMutation.isPending}
                onClick={() => assignmentMutation.mutate()}
              >
                {t('thread.assign')}
              </ActionButton>
            </Stack>
          </Box>
        )}

        <Stack spacing={1.5} sx={{ mt: 2.5 }}>
          {detail.messages.map((message) => {
            const outgoing = message.direction === 'OUTBOUND' || message.direction === 'DRAFT';
            return (
              <Box
                key={message.messageId}
                sx={{
                  width: { xs: 1, lg: 'min(92%, 820px)' },
                  ml: outgoing ? 'auto' : 0,
                  border: 1,
                  borderColor: outgoing ? 'transparent' : 'divider',
                  bgcolor: outgoing ? 'var(--dwp-product-soft)' : 'background.paper',
                  borderRadius: 1,
                  p: 2,
                }}
              >
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Avatar sx={{ width: 34, height: 34, fontSize: 13, bgcolor: 'primary.dark' }}>
                    {message.senderName.slice(0, 2)}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" fontWeight={800} noWrap>
                      {message.senderName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {message.senderEmail} · {mailRelativeTime(message.sentAt, language)}
                    </Typography>
                  </Box>
                </Stack>
                <Typography
                  variant="body2"
                  sx={{
                    mt: 1.5,
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.75,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {message.body}
                </Typography>
                {message.attachments.length > 0 && (
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1.5 }}>
                    <Paperclip size={15} />
                    <Typography variant="caption" fontWeight={650}>
                      {String(message.attachments[0]?.name ?? t('thread.attachment'))}
                    </Typography>
                  </Stack>
                )}
                {outgoing && (
                  <Stack
                    direction="row"
                    spacing={1}
                    justifyContent="flex-end"
                    alignItems="center"
                    sx={{ mt: 1.5 }}
                  >
                    <Chip
                      size="small"
                      variant="outlined"
                      color={
                        message.deliveryState === 'FAILED'
                          ? 'error'
                          : message.deliveryState === 'SENT'
                            ? 'success'
                            : 'default'
                      }
                      label={t(`delivery.state.${message.deliveryState}`)}
                    />
                    {message.deliveryState === 'FAILED' && (
                      <ActionButton
                        intent="quiet"
                        size="small"
                        startIcon={<RotateCcw size={14} />}
                        loading={retryMutation.isPending}
                        onClick={() => retryMutation.mutate(message.messageId)}
                      >
                        {t('delivery.retry')}
                      </ActionButton>
                    )}
                  </Stack>
                )}
              </Box>
            );
          })}
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
                  busy={proposalMutation.isPending}
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
              inputProps={{ maxLength: 4000 }}
              onChange={(event) => setComment(event.target.value)}
            />
            <ActionButton
              intent="secondary"
              disabled={!comment.trim()}
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
          <FormField
            multiline
            minRows={4}
            maxRows={12}
            label={t('thread.replyPlaceholder')}
            value={reply}
            inputProps={{ maxLength: 100_000 }}
            onChange={(event) => setReply(event.target.value)}
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
              disabled={!reply.trim()}
              loading={replyMutation.isPending}
              onClick={() => replyMutation.mutate()}
            >
              {t('thread.sendReply')}
            </ActionButton>
          </Stack>
        </Box>
      </Box>

      <ConfirmDialog
        open={Boolean(proposalToAccept)}
        title={proposalToAccept?.title ?? t('proposal.confirmTitle')}
        description={t('proposal.confirmDescription', {
          summary: proposalToAccept?.summary ?? '',
        })}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('proposal.confirm')}
        confirmingLabel={t('proposal.confirming')}
        busy={proposalMutation.isPending}
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
