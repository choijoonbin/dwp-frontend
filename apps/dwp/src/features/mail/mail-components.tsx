import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Bot,
  CalendarPlus,
  CircleAlert,
  Clock3,
  MailPlus,
  Paperclip,
  Sparkles,
  Star,
  UserRoundPlus,
} from 'lucide-react';
import { ActionButton, ProgressMeter } from '@dwp-frontend/design-system';
import { formatRelativeTime, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type { ReactNode } from 'react';
import type { MailActionProposal, MailThread } from '@dwp-frontend/shared-utils';

export function MailPageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', md: 'center' }}
      spacing={2}
      sx={{ minWidth: 0 }}
    >
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && (
          <Typography variant="overline" sx={{ color: 'var(--dwp-product-accent)' }}>
            {eyebrow}
          </Typography>
        )}
        <Typography
          component="h1"
          variant="h4"
          fontWeight={800}
          sx={{ mt: eyebrow ? 0.25 : 0, '&:focus': { outline: 'none' } }}
        >
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.6, maxWidth: 760 }}>
          {description}
        </Typography>
      </Box>
      {actions}
    </Stack>
  );
}

export function MailMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number | string;
  detail: string;
  tone: string;
}) {
  return (
    <Box sx={{ px: 2.5, py: 2.25, minWidth: 0 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tone, flexShrink: 0 }} />
        <Typography variant="body2" color="text.secondary" fontWeight={650}>
          {label}
        </Typography>
      </Stack>
      <Typography component="p" variant="h4" fontWeight={800} sx={{ mt: 0.85 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
        {detail}
      </Typography>
    </Box>
  );
}

function initials(name: string) {
  const value = name.trim();
  if (!value) return '?';
  const words = value.split(/\s+/u);
  return words.length > 1
    ? `${words[0]?.[0] ?? ''}${words.at(-1)?.[0] ?? ''}`.toUpperCase()
    : value.slice(0, 2);
}

export function mailRelativeTime(value: string, language: string) {
  const date = new Date(value);
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000);
  const locale = resolveSupportedLocale(language);
  if (Math.abs(minutes) < 60) {
    return formatRelativeTime(minutes, 'minute', { numeric: 'auto' }, locale);
  }
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return formatRelativeTime(hours, 'hour', { numeric: 'auto' }, locale);
  }
  return formatRelativeTime(Math.round(hours / 24), 'day', { numeric: 'auto' }, locale);
}

export function MailThreadListItem({
  thread,
  selected = false,
  onSelect,
  compact = false,
  disabled = false,
}: {
  thread: MailThread;
  selected?: boolean;
  onSelect: () => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  const { t, i18n } = useTranslation('mail');
  const participant = thread.participants[0];
  const urgent = thread.importance === 'URGENT';
  return (
    <Box
      component="button"
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      aria-busy={disabled || undefined}
      sx={(theme) => ({
        width: 1,
        minHeight: compact ? 86 : 104,
        px: compact ? 1.75 : 2,
        py: 1.5,
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
        gap: 1.25,
        alignItems: 'start',
        border: 0,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: selected
          ? 'var(--dwp-product-selection)'
          : thread.unread
            ? alpha(theme.palette.background.paper, 0.98)
            : alpha(theme.palette.background.paper, 0.72),
        color: 'text.primary',
        textAlign: 'left',
        cursor: disabled ? 'wait' : 'pointer',
        position: 'relative',
        '&::before': selected
          ? {
              content: '""',
              position: 'absolute',
              inset: '10px auto 10px 0',
              width: 3,
              bgcolor: 'var(--dwp-product-accent)',
              borderRadius: '0 3px 3px 0',
            }
          : undefined,
        '&:hover': { bgcolor: disabled ? undefined : 'action.hover' },
        '&:disabled': { opacity: 0.72 },
        '&:focus-visible': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: -2,
        },
      })}
    >
      <Avatar
        sx={{
          width: compact ? 34 : 38,
          height: compact ? 34 : 38,
          fontSize: 13,
          fontWeight: 750,
          bgcolor: urgent ? '#A73549' : 'var(--dwp-product-soft)',
          color: urgent ? '#fff' : 'var(--dwp-product-accent)',
        }}
      >
        {initials(participant?.name ?? thread.accountName)}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={thread.unread ? 800 : 650} noWrap>
            {participant?.name ?? thread.accountName}
          </Typography>
          {thread.sharedInboxName && (
            <Chip
              label={thread.sharedInboxName}
              size="small"
              variant="outlined"
              sx={{ height: 20 }}
            />
          )}
        </Stack>
        <Typography variant="body2" fontWeight={thread.unread ? 800 : 650} noWrap sx={{ mt: 0.4 }}>
          {thread.subject}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            mt: 0.35,
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: compact ? 1 : 2,
            overflow: 'hidden',
          }}
        >
          {thread.preview}
        </Typography>
        {!compact && thread.assignedName && (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.75 }}>
            <UserRoundPlus size={13} />
            <Typography variant="caption" color="text.secondary">
              {t('thread.assignedTo', { name: thread.assignedName })}
            </Typography>
          </Stack>
        )}
      </Box>
      <Stack alignItems="flex-end" spacing={0.75} sx={{ minWidth: 54 }}>
        <Typography variant="caption" color="text.secondary" whiteSpace="nowrap">
          {mailRelativeTime(thread.latestMessageAt, i18n.resolvedLanguage ?? i18n.language)}
        </Typography>
        <Stack direction="row" spacing={0.6} color="text.secondary">
          {thread.starred && <Star size={14} fill="currentColor" />}
          {thread.attachments && <Paperclip size={14} />}
          {thread.unread && (
            <Box
              aria-label={t('thread.unread')}
              sx={{ width: 8, height: 8, mt: 0.35, borderRadius: '50%', bgcolor: '#176B63' }}
            />
          )}
        </Stack>
      </Stack>
    </Box>
  );
}

const proposalIcons = {
  DRAFT_REPLY: MailPlus,
  CREATE_CALENDAR_EVENT: CalendarPlus,
  CREATE_LEAVE_REQUEST: Clock3,
  CREATE_TASK: CircleAlert,
  ESCALATE_NOTIFICATION: CircleAlert,
} as const;

export function MailProposalCard({
  proposal,
  onAccept,
  onDismiss,
  busy = false,
}: {
  proposal: MailActionProposal;
  onAccept: () => void;
  onDismiss: () => void;
  busy?: boolean;
}) {
  const { t } = useTranslation('mail');
  const Icon = proposalIcons[proposal.type];
  const confidence = Math.round(Number(proposal.confidence) * 100);
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        p: 2,
        minWidth: 0,
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 1,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'var(--dwp-product-soft)',
            color: 'var(--dwp-product-accent)',
            flexShrink: 0,
          }}
        >
          <Icon size={19} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" justifyContent="space-between" spacing={1}>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Sparkles size={14} color="var(--dwp-product-accent)" />
                <Typography variant="overline" color="text.secondary">
                  {t('proposal.assistant')}
                </Typography>
              </Stack>
              <Typography variant="body1" fontWeight={800} sx={{ mt: 0.3 }}>
                {proposal.title}
              </Typography>
            </Box>
            <Chip
              label={t(`proposal.risk.${proposal.riskLevel}`)}
              size="small"
              color={proposal.riskLevel === 'HIGH' ? 'warning' : 'default'}
              variant="outlined"
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.7 }}>
            {proposal.summary}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.25 }}>
            <Bot size={14} />
            <ProgressMeter
              label={t('proposal.confidence', { value: confidence })}
              value={confidence}
              valueLabel={`${confidence}%`}
              size="compact"
              sx={{ width: 160 }}
            />
          </Stack>
          <Stack direction="row" spacing={0.75} justifyContent="flex-end" sx={{ mt: 1.5 }}>
            <ActionButton intent="quiet" size="small" onClick={onDismiss} disabled={busy}>
              {t('proposal.dismiss')}
            </ActionButton>
            <ActionButton
              intent="primary"
              size="small"
              endIcon={<ArrowRight size={15} />}
              onClick={onAccept}
              disabled={busy}
            >
              {t('proposal.review')}
            </ActionButton>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
