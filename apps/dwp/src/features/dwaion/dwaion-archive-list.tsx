import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  MessageSquare,
  MoreVertical,
  ShieldCheck,
} from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionButton, ActionIconButton, foundationTokens } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import type { DwaionConversationSummary } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  conversationAnswerStatus,
  conversationAnswerSummary,
  conversationCopy,
} from './dwaion-conversation-copy';

function conversationReference(item: DwaionConversationSummary) {
  const compact = item.conversationId.replaceAll('-', '').slice(-8).toUpperCase();
  return `#CONV-${compact}`;
}

function agentLabel(item: DwaionConversationSummary, copy: ReturnType<typeof conversationCopy>) {
  if (item.agentKey === 'DWP_APPROVAL_EXPERT') return copy.approvalAgentShort;
  if (item.agentKey === 'DWP_ASSISTANT') return copy.defaultAgentShort;
  return item.agentKey ? copy.unknownAgent : copy.defaultAgentShort;
}

function retentionLabel(
  item: DwaionConversationSummary,
  copy: ReturnType<typeof conversationCopy>,
  locale: 'ko' | 'en'
) {
  if (item.legalHold) return copy.legalHoldActive;
  if (!item.retentionUntil) return copy.policyApplied;
  return copy.retainedUntil.replace(
    '{{date}}',
    formatDate(item.retentionUntil, { year: 'numeric', month: 'short', day: 'numeric' }, locale)
  );
}

function StatusChip({
  item,
  copy,
  locale,
}: {
  item: DwaionConversationSummary;
  copy: ReturnType<typeof conversationCopy>;
  locale: 'ko' | 'en';
}) {
  const fallback = item.lastAnswerStatus === 'ANSWER_GROUNDED_FALLBACK';
  const completed = item.lastAnswerStatus === 'COMPLETED';
  const answerStatus = conversationAnswerStatus(item.lastAnswerStatus, locale);
  const label = item.legalHold
    ? copy.legalHoldShort
    : answerStatus
      ? answerStatus.label
      : item.evidenceCount
        ? copy.verified
        : completed
          ? copy.completed
          : copy.saved;
  const icon = item.legalHold ? (
    <LockKeyhole size={14} />
  ) : fallback ? (
    <ShieldCheck size={14} />
  ) : (
    <CheckCircle2 size={14} />
  );

  return (
    <Chip
      size="small"
      icon={icon}
      label={
        <>
          {label}
          {!item.legalHold && !fallback && item.evidenceCount > 0 && (
            <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
              {` (${copy.grounded.replace('{{count}}', String(item.evidenceCount))})`}
            </Box>
          )}
        </>
      }
      sx={{
        height: 23,
        maxWidth: '100%',
        bgcolor: item.legalHold
          ? 'success.main'
          : fallback
            ? 'action.selected'
            : 'var(--dwp-product-soft)',
        color: item.legalHold ? 'success.contrastText' : 'primary.main',
        fontWeight: 'fontWeightBold',
        '& .MuiChip-icon': { color: 'inherit' },
        '& .MuiChip-label': { px: 0.85, overflow: 'hidden', textOverflow: 'ellipsis' },
      }}
    />
  );
}

export function DwaionArchiveList({
  items,
  selectedId,
  onSelect,
  onDelete,
  onRename,
  onOpen,
}: {
  items: DwaionConversationSummary[];
  selectedId?: string;
  onSelect: (item: DwaionConversationSummary) => void;
  onDelete: (item: DwaionConversationSummary, trigger: HTMLElement) => void;
  onRename: (item: DwaionConversationSummary, trigger: HTMLElement) => void;
  onOpen: () => void;
}) {
  const { t, i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const copy = conversationCopy(locale);
  const [menu, setMenu] = useState<{
    item: DwaionConversationSummary;
    anchor: HTMLElement;
  } | null>(null);
  const choose = (action: 'rename' | 'delete') => {
    if (!menu || (action === 'delete' && menu.item.legalHold)) return;
    const { item, anchor } = menu;
    setMenu(null);
    (action === 'rename' ? onRename : onDelete)(item, anchor);
  };

  return (
    <>
      <Stack
        component="ul"
        aria-label={copy.listLabel}
        spacing={{ xs: 1.25, md: 1 }}
        sx={{ listStyle: 'none', p: 0, m: 0 }}
      >
        {items.map((item) => {
          const selected = selectedId === item.conversationId;
          const sourceLabel = item.sourceSystems.length
            ? item.sourceSystems.join(' · ')
            : item.evidenceCount
              ? copy.sourceRecords.replace('{{count}}', String(item.evidenceCount))
              : copy.sourceOnOpen;
          const retention = retentionLabel(item, copy, locale);
          const summary = conversationAnswerSummary(
            item.summaryExcerpt,
            item.lastAnswerStatus,
            locale
          );
          return (
            <Box
              component="li"
              aria-current={selected ? 'true' : undefined}
              tabIndex={0}
              key={item.conversationId}
              data-testid="dwaion-archive-row"
              onClick={(event) => {
                if (!(event.target as HTMLElement).closest('a, button')) onSelect(item);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(item);
                }
              }}
              sx={{
                position: 'relative',
                minWidth: 0,
                bgcolor: item.legalHold ? 'var(--dwp-product-soft)' : 'background.paper',
                border: '1px solid',
                borderColor: selected
                  ? 'var(--dwp-product-accent)'
                  : item.legalHold
                    ? 'var(--dwp-product-accent-border)'
                    : 'divider',
                borderRadius:
                  foundationTokens.radius.surface + foundationTokens.radius.compact + 'px',
                px: { xs: 2, md: 2 },
                py: { xs: 1.35, md: 1.25 },
                cursor: 'pointer',
                boxShadow: (theme) => (selected ? theme.shadows[2] : theme.shadows[1]),
                transition: (theme) =>
                  theme.transitions.create(['border-color', 'box-shadow'], {
                    duration: theme.transitions.duration.shorter,
                  }),
                '&::before': selected
                  ? {
                      content: '""',
                      position: 'absolute',
                      insetInlineStart: -1,
                      top: 10,
                      bottom: 10,
                      width: 4,
                      borderRadius: () =>
                        `0 ${foundationTokens.radius.compact}px ${foundationTokens.radius.compact}px 0`,
                      bgcolor: 'primary.main',
                    }
                  : undefined,
                '&:hover, &:focus-visible': {
                  borderColor: 'primary.main',
                  boxShadow: (theme) => theme.shadows[2],
                  outline: 'none',
                },
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                <Stack
                  direction="row"
                  useFlexGap
                  flexWrap="wrap"
                  gap={0.65}
                  alignItems="center"
                  sx={{ minWidth: 0 }}
                >
                  <StatusChip item={item} copy={copy} locale={locale} />
                  <Chip
                    size="small"
                    label={t('dwaionArchive.messageCount', { count: item.messageCount })}
                    sx={{ display: { md: 'none' }, height: 23, bgcolor: 'action.hover' }}
                  />
                  <Chip
                    size="small"
                    label={agentLabel(item, copy)}
                    sx={{
                      display: { xs: 'none', md: 'flex' },
                      height: 23,
                      bgcolor: 'action.hover',
                    }}
                  />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: { xs: 'none', md: 'inline' },
                      fontFamily: foundationTokens.font.mono,
                    }}
                  >
                    {conversationReference(item)}
                  </Typography>
                </Stack>
                <Stack direction="row" gap={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
                  {selected && !item.legalHold && (
                    <Chip
                      size="small"
                      label={copy.latest}
                      sx={{
                        display: { xs: 'flex', md: 'none' },
                        height: 23,
                        bgcolor: 'action.selected',
                        color: 'primary.main',
                        fontWeight: 'fontWeightBold',
                      }}
                    />
                  )}
                  {item.legalHold && (
                    <LockKeyhole
                      size={18}
                      color="var(--dwp-semantic-success-main)"
                      aria-label={copy.deletionLocked}
                    />
                  )}
                  <Typography
                    component="time"
                    dateTime={item.lastMessageAt}
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: { xs: 'none', md: 'block' }, whiteSpace: 'nowrap' }}
                  >
                    {formatDate(
                      item.lastMessageAt,
                      {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      },
                      locale
                    )}
                  </Typography>
                </Stack>
              </Stack>

              <Stack
                direction={{ xs: 'column', md: 'row' }}
                justifyContent="space-between"
                alignItems={{ md: 'center' }}
                gap={{ xs: 0, md: 1.5 }}
                sx={{ mt: { xs: 0.55, md: 0.75 } }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    component="h2"
                    variant="subtitle1"
                    sx={{
                      fontWeight: 'fontWeightBold',
                      lineHeight: 'typography.subtitle1.lineHeight',
                      overflowWrap: 'anywhere',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {item.title}
                  </Typography>
                  {summary && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mt: 0.3,
                        display: { xs: 'none', md: 'block' },
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {summary}
                    </Typography>
                  )}
                </Box>
                <Stack
                  direction="row"
                  alignItems="center"
                  gap={0.5}
                  sx={{ display: { xs: 'none', md: 'flex' }, flexShrink: 0 }}
                >
                  <ActionButton
                    component={RouterLink}
                    to={`/dwaion/conversations/${encodeURIComponent(item.conversationId)}`}
                    aria-label={`${selected ? t('dwaionArchive.continue') : copy.open}: ${item.title}`}
                    onClick={onOpen}
                    intent={selected ? 'primary' : 'secondary'}
                    endIcon={<ArrowRight size={15} />}
                    sx={{
                      minHeight: 38,
                      whiteSpace: 'nowrap',
                      borderRadius: foundationTokens.radius.surface + 'px',
                    }}
                  >
                    {selected ? copy.continue : copy.open}
                  </ActionButton>
                  <ActionIconButton
                    size="small"
                    label={`${copy.manage}: ${item.title}`}
                    aria-haspopup="menu"
                    aria-expanded={menu?.item.conversationId === item.conversationId}
                    onClick={(event) => setMenu({ item, anchor: event.currentTarget })}
                    sx={{ minWidth: 38, minHeight: 38 }}
                  >
                    <MoreVertical size={18} />
                  </ActionIconButton>
                </Stack>
              </Stack>

              <Stack
                direction="row"
                alignItems="center"
                gap={0.6}
                sx={{ display: { md: 'none' }, mt: 0.75, minWidth: 0, color: 'text.secondary' }}
              >
                <Typography
                  component="time"
                  dateTime={item.lastMessageAt}
                  variant="caption"
                  sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {formatDate(
                    item.lastMessageAt,
                    {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    },
                    locale
                  )}
                </Typography>
                <Typography component="span" variant="caption" aria-hidden="true">
                  ·
                </Typography>
                <ShieldCheck size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
                <Typography variant="caption" noWrap sx={{ minWidth: 0 }}>
                  {sourceLabel}
                </Typography>
              </Stack>

              <Stack
                direction="row"
                alignItems="center"
                gap={0.65}
                sx={{ display: { md: 'none' }, mt: 1.25, width: '100%' }}
              >
                <ActionButton
                  component={RouterLink}
                  to={`/dwaion/conversations/${encodeURIComponent(item.conversationId)}`}
                  aria-label={`${selected ? t('dwaionArchive.continue') : copy.open}: ${item.title}`}
                  onClick={onOpen}
                  intent={selected ? 'primary' : 'secondary'}
                  endIcon={<ArrowRight size={15} />}
                  sx={{
                    minHeight: 44,
                    flex: 1,
                    whiteSpace: 'nowrap',
                    borderRadius: foundationTokens.radius.surface * 125 + 'px',
                  }}
                >
                  {selected ? copy.continue : copy.open}
                </ActionButton>
                {item.legalHold && (
                  <Chip
                    icon={<ShieldCheck size={15} />}
                    label={copy.retentionGuide}
                    sx={{ height: 44, bgcolor: 'action.selected', color: 'text.primary' }}
                  />
                )}
                <ActionIconButton
                  size="small"
                  label={`${copy.manage}: ${item.title}`}
                  aria-haspopup="menu"
                  aria-expanded={menu?.item.conversationId === item.conversationId}
                  onClick={(event) => setMenu({ item, anchor: event.currentTarget })}
                  sx={{ minWidth: 44, minHeight: 44 }}
                >
                  <MoreVertical size={18} />
                </ActionIconButton>
              </Stack>

              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                gap={1}
                sx={{ mt: 0.65, color: 'text.secondary', display: { xs: 'none', md: 'flex' } }}
              >
                <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
                  <Typography
                    variant="caption"
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.45, whiteSpace: 'nowrap' }}
                  >
                    <MessageSquare size={14} />
                    {t('dwaionArchive.messageCount', { count: item.messageCount })}
                  </Typography>
                  <Typography variant="caption" noWrap sx={{ minWidth: 0 }}>
                    {sourceLabel}
                  </Typography>
                </Stack>
                <Typography
                  variant="caption"
                  noWrap
                  sx={{
                    flexShrink: 0,
                    color: item.legalHold ? 'error.main' : 'text.secondary',
                    fontWeight: item.legalHold ? 'fontWeightBold' : 'fontWeightRegular',
                  }}
                >
                  {retention}
                </Typography>
              </Stack>
            </Box>
          );
        })}
      </Stack>
      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => choose('rename')} sx={{ minHeight: 44 }}>
          {copy.rename}
        </MenuItem>
        {menu && !menu.item.legalHold && (
          <MenuItem onClick={() => choose('delete')} sx={{ minHeight: 44 }}>
            {copy.remove}
          </MenuItem>
        )}
        {menu?.item.legalHold && (
          <MenuItem disabled sx={{ minHeight: 44 }}>
            {copy.deletionLocked}
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
