import { useId } from 'react';
import {
  BellRing,
  BookOpenCheck,
  CalendarCheck2,
  CheckSquare2,
  FileClock,
  MessageSquareText,
  Send,
  UsersRound,
} from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { LucideIcon } from 'lucide-react';
import type { OwnerWidgetDefinitionKey } from './owner-widget-contracts';
import type { NormalizedOwnerWidget } from './owner-widget-view-model';

export type OwnerWidgetRendererVariant = 'CLASSIC' | 'FLOW';

export type OwnerWidgetLabelKey =
  | `ownerWidgets.title.${OwnerWidgetDefinitionKey}`
  | 'ownerWidgets.action.openSource'
  | 'ownerWidgets.metric.pending'
  | 'ownerWidgets.metric.dueToday'
  | 'ownerWidgets.metric.overdue'
  | 'ownerWidgets.metric.inFlight'
  | 'ownerWidgets.metric.meetingsToday'
  | 'ownerWidgets.metric.meetingMinutes'
  | 'ownerWidgets.metric.totalUnread'
  | 'ownerWidgets.metric.urgentUnread'
  | 'ownerWidgets.metric.unreadSignals'
  | 'ownerWidgets.metric.pendingRequests'
  | 'ownerWidgets.metric.reviewQueue'
  | 'ownerWidgets.metric.unreadConversations'
  | 'ownerWidgets.metric.mentions'
  | 'ownerWidgets.metric.requiredLearning'
  | 'ownerWidgets.metric.activeGoals'
  | 'ownerWidgets.metric.teamPending'
  | 'ownerWidgets.metric.teamTimePending'
  | 'ownerWidgets.metric.teamAbsencePending'
  | 'ownerWidgets.meta.attendees'
  | 'ownerWidgets.meta.unread'
  | 'ownerWidgets.meta.actionable'
  | 'ownerWidgets.meta.urgent'
  | 'ownerWidgets.empty.verified';

export type OwnerWidgetLabelResolver = (
  key: OwnerWidgetLabelKey,
  values?: Readonly<Record<string, string | number>>
) => string;

export type OwnerWidgetRendererProps = Readonly<{
  widget: NormalizedOwnerWidget;
  variant: OwnerWidgetRendererVariant;
  label: OwnerWidgetLabelResolver;
  locale?: string;
  maxItems?: number;
  onOpenSource?: (sourceRoute: string) => void;
}>;

type Metric = Readonly<{ key: string; label: OwnerWidgetLabelKey; value: number }>;
type Row = Readonly<{
  key: string;
  title: string;
  detail?: string;
  meta?: string;
  timestamp?: string;
}>;

const ICON_BY_DEFINITION: Readonly<Record<OwnerWidgetDefinitionKey, LucideIcon>> = {
  'approval.focus-queue': CheckSquare2,
  'approval.my-requests': FileClock,
  'meetings.next-prep': CalendarCheck2,
  'meetings.followup-candidates': CalendarCheck2,
  'notification.app-badges': BellRing,
  'notification.response-queue': BellRing,
  'space.change-feed': MessageSquareText,
  'space.response-queue': MessageSquareText,
  'messaging.response-queue': Send,
  'messaging.change-feed': Send,
  'hr.edu': BookOpenCheck,
  'hr.team-pulse': UsersRound,
};

function boundedItemBudget(value: number | undefined): number {
  return Number.isSafeInteger(value) && (value ?? 0) > 0 ? Math.min(value!, 10) : 3;
}

function formatTimestamp(value: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function metrics(widget: NormalizedOwnerWidget): readonly Metric[] {
  switch (widget.definitionKey) {
    case 'approval.focus-queue':
      return [
        {
          key: 'pending',
          label: 'ownerWidgets.metric.pending',
          value: widget.payload.pendingCount,
        },
        {
          key: 'due-today',
          label: 'ownerWidgets.metric.dueToday',
          value: widget.payload.dueTodayCount,
        },
        {
          key: 'overdue',
          label: 'ownerWidgets.metric.overdue',
          value: widget.payload.overdueCount,
        },
      ];
    case 'approval.my-requests':
      return [
        {
          key: 'in-flight',
          label: 'ownerWidgets.metric.inFlight',
          value: widget.payload.inFlightCount,
        },
      ];
    case 'meetings.next-prep':
    case 'meetings.followup-candidates':
      return [
        {
          key: 'meetings-today',
          label: 'ownerWidgets.metric.meetingsToday',
          value: widget.payload.meetingsToday,
        },
        {
          key: 'meeting-minutes',
          label: 'ownerWidgets.metric.meetingMinutes',
          value: widget.payload.meetingMinutesToday,
        },
      ];
    case 'notification.app-badges':
      return [];
    case 'notification.response-queue':
      return [
        {
          key: 'total-unread',
          label: 'ownerWidgets.metric.totalUnread',
          value: widget.payload.items.reduce((sum, item) => sum + item.totalUnread, 0),
        },
        {
          key: 'urgent-unread',
          label: 'ownerWidgets.metric.urgentUnread',
          value: widget.payload.items.reduce((sum, item) => sum + item.urgentUnread, 0),
        },
      ];
    case 'space.change-feed':
      return [
        {
          key: 'unread-signals',
          label: 'ownerWidgets.metric.unreadSignals',
          value: widget.payload.unreadSignals,
        },
      ];
    case 'space.response-queue':
      return [
        {
          key: 'pending-requests',
          label: 'ownerWidgets.metric.pendingRequests',
          value: widget.payload.pendingRequests,
        },
        {
          key: 'review-queue',
          label: 'ownerWidgets.metric.reviewQueue',
          value: widget.payload.reviewQueue,
        },
      ];
    case 'messaging.response-queue':
    case 'messaging.change-feed':
      return [
        {
          key: 'unread-conversations',
          label: 'ownerWidgets.metric.unreadConversations',
          value: widget.payload.unreadConversations,
        },
        { key: 'mentions', label: 'ownerWidgets.metric.mentions', value: widget.payload.mentions },
      ];
    case 'hr.edu':
      return [
        {
          key: 'required-learning',
          label: 'ownerWidgets.metric.requiredLearning',
          value: widget.payload.requiredLearningCount,
        },
        {
          key: 'active-goals',
          label: 'ownerWidgets.metric.activeGoals',
          value: widget.payload.activeGoalCount,
        },
      ];
    case 'hr.team-pulse':
      return [
        {
          key: 'team-pending',
          label: 'ownerWidgets.metric.teamPending',
          value: widget.payload.teamPendingCount,
        },
        {
          key: 'team-time-pending',
          label: 'ownerWidgets.metric.teamTimePending',
          value: widget.payload.teamTimePendingCount,
        },
        {
          key: 'team-absence-pending',
          label: 'ownerWidgets.metric.teamAbsencePending',
          value: widget.payload.teamAbsencePendingCount,
        },
      ];
  }
}

function rows(
  widget: NormalizedOwnerWidget,
  label: OwnerWidgetLabelResolver,
  locale?: string
): readonly Row[] {
  switch (widget.definitionKey) {
    case 'approval.focus-queue':
    case 'approval.my-requests':
      return widget.payload.items.map((item) => ({
        key: item.id,
        title: item.title,
        detail: item.requestNumber,
        meta: `${item.priority} · ${item.status}`,
        timestamp: item.dueAt ? formatTimestamp(item.dueAt, locale) : undefined,
      }));
    case 'meetings.next-prep':
    case 'meetings.followup-candidates':
      return widget.payload.items.map((item) => ({
        key: item.id,
        title: item.title,
        detail: item.state,
        meta: label('ownerWidgets.meta.attendees', { count: item.attendeeCount }),
        timestamp: item.startsAt ? formatTimestamp(item.startsAt, locale) : undefined,
      }));
    case 'notification.app-badges':
      return [];
    case 'notification.response-queue':
      return widget.payload.items.map((item) => ({
        key: item.appKey,
        title: item.appKey,
        detail: label('ownerWidgets.meta.actionable', { count: item.actionableUnread }),
        meta: label('ownerWidgets.meta.urgent', { count: item.urgentUnread }),
        timestamp: formatTimestamp(item.lastActivityAt, locale),
      }));
    case 'space.change-feed':
      return widget.payload.items.map((item) => ({
        key: item.id,
        title: item.title,
        detail: item.spaceName,
        meta: item.activityType,
        timestamp: formatTimestamp(item.occurredAt, locale),
      }));
    case 'space.response-queue':
      return widget.payload.items.map((item) => ({
        key: item.id,
        title: item.name,
        detail: item.memberRole,
        meta: label('ownerWidgets.meta.unread', { count: item.unreadCount }),
      }));
    case 'messaging.response-queue':
    case 'messaging.change-feed':
      return widget.payload.items.map((item) => ({
        key: item.id,
        title: item.name,
        detail: item.type,
        meta: label('ownerWidgets.meta.unread', { count: item.unreadCount }),
        timestamp: item.lastActivityAt ? formatTimestamp(item.lastActivityAt, locale) : undefined,
      }));
    case 'hr.edu':
    case 'hr.team-pulse':
      return [];
  }
}

function MetricGrid({
  values,
  label,
}: {
  values: readonly Metric[];
  label: OwnerWidgetLabelResolver;
}) {
  if (values.length === 0) return null;
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(values.length, 3)}, minmax(0, 1fr))`,
        gap: 1,
      }}
    >
      {values.map((metric) => (
        <Box
          key={metric.key}
          sx={{ minWidth: 0, p: 1, bgcolor: 'action.hover', borderRadius: 1.5 }}
        >
          <Typography component="dd" variant="subtitle2" sx={{ m: 0, fontWeight: 750 }}>
            {metric.value.toLocaleString()}
          </Typography>
          <Typography component="dt" variant="caption" color="text.secondary" sx={{ m: 0 }}>
            {label(metric.label)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function ItemList({ values }: { values: readonly Row[] }) {
  if (values.length === 0) return null;
  return (
    <Stack component="ul" gap={0.75} sx={{ p: 0, m: 0, listStyle: 'none' }}>
      {values.map((row) => (
        <Box
          component="li"
          key={row.key}
          sx={{ minWidth: 0, py: 0.75, borderTop: 1, borderColor: 'divider' }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={1}>
            <Typography variant="body2" fontWeight={650} noWrap>
              {row.title}
            </Typography>
            {row.timestamp && (
              <Typography variant="caption" color="text.secondary" sx={{ flex: '0 0 auto' }}>
                {row.timestamp}
              </Typography>
            )}
          </Stack>
          {(row.detail || row.meta) && (
            <Stack direction="row" gap={0.75} mt={0.25} minWidth={0}>
              {row.detail && (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {row.detail}
                </Typography>
              )}
              {row.meta && (
                <Typography variant="caption" color="text.secondary" noWrap>
                  {row.meta}
                </Typography>
              )}
            </Stack>
          )}
        </Box>
      ))}
    </Stack>
  );
}

export function OwnerWidgetRenderer({
  widget,
  variant,
  label,
  locale,
  maxItems,
  onOpenSource,
}: OwnerWidgetRendererProps) {
  const headingId = useId();
  if (widget.surface === 'APP_DOCK') return null;
  const Icon = ICON_BY_DEFINITION[widget.definitionKey];
  const visibleRows = rows(widget, label, locale).slice(0, boundedItemBudget(maxItems));
  const values = metrics(widget);
  return (
    <Box
      component="article"
      aria-labelledby={headingId}
      data-owner-widget={widget.definitionKey}
      data-owner-widget-variant={variant.toLowerCase()}
      sx={{
        minWidth: 0,
        height: '100%',
        p: variant === 'FLOW' ? { xs: 2, md: 2.5 } : 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.home.radius.card,
        boxShadow: foundationTokens.home.shadow.quietCard,
      }}
    >
      <Stack direction="row" alignItems="center" gap={1.25}>
        <Box
          aria-hidden="true"
          sx={{
            width: 36,
            height: 36,
            flex: '0 0 auto',
            display: 'grid',
            placeItems: 'center',
            color: 'primary.main',
            bgcolor: 'action.hover',
            borderRadius: foundationTokens.home.radius.card,
          }}
        >
          <Icon size={19} />
        </Box>
        <Typography id={headingId} component="h3" variant="subtitle1" fontWeight={750}>
          {label(`ownerWidgets.title.${widget.definitionKey}`)}
        </Typography>
      </Stack>
      <MetricGrid values={values} label={label} />
      <ItemList values={visibleRows} />
      {values.length === 0 && visibleRows.length === 0 && (
        <Typography variant="body2" color="text.secondary" role="status">
          {label('ownerWidgets.empty.verified')}
        </Typography>
      )}
      {widget.sourceAction && onOpenSource && (
        <ActionButton
          intent="quiet"
          onClick={() => onOpenSource(widget.sourceRoute)}
          sx={{ mt: 'auto', minHeight: 44, alignSelf: 'flex-start' }}
        >
          {label('ownerWidgets.action.openSource')}
        </ActionButton>
      )}
    </Box>
  );
}
