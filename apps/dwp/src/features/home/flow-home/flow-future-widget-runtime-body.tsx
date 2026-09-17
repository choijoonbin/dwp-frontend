import { useTranslation } from 'react-i18next';
import { ActionButton } from '@dwp-frontend/design-system';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';
import { formatDate, formatNumber, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { NormalizedOwnerWidget } from '../runtime/owner-widgets';

function RuntimeMetric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <Box
      sx={{
        p: 1,
        minWidth: 0,
        bgcolor: 'action.hover',
        borderRadius: foundationTokens.home.radius.control,
      }}
    >
      <Typography variant="subtitle2" fontWeight={foundationTokens.home.typography.weightEmphasis}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

function RuntimeItem({
  detail,
  title,
  itemKey,
}: Readonly<{ detail: string; title: string; itemKey: string }>) {
  return (
    <Box
      component="li"
      key={itemKey}
      sx={{
        p: 1,
        bgcolor: 'background.default',
        borderRadius: foundationTokens.home.radius.compactCard,
      }}
    >
      <Typography variant="body2" fontWeight={foundationTokens.home.typography.weightSemibold}>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {detail}
      </Typography>
    </Box>
  );
}

export function FlowFutureWidgetRuntimeBody({
  widget,
  locale,
  onOpenSource,
}: Readonly<{
  widget: NormalizedOwnerWidget;
  locale?: string;
  onOpenSource?: (route: string) => void;
}>) {
  const { t } = useTranslation('home');
  const resolvedLocale = resolveSupportedLocale(locale);
  const count = (value: number) => formatNumber(value, undefined, resolvedLocale);
  const at = (value: string) =>
    formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }, resolvedLocale);
  let body: React.ReactNode;

  switch (widget.definitionKey) {
    case 'meetings.next-prep':
      body = (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
            <RuntimeMetric
              label={t('ownerWidgets.metric.meetingsToday')}
              value={count(widget.payload.meetingsToday)}
            />
            <RuntimeMetric
              label={t('ownerWidgets.metric.meetingMinutes')}
              value={count(widget.payload.meetingMinutesToday)}
            />
          </Box>
          <Stack component="ul" gap={0.75} sx={{ p: 0, m: 0, listStyle: 'none' }}>
            {widget.payload.items.slice(0, 3).map((item) => (
              <RuntimeItem
                key={item.id}
                itemKey={item.id}
                title={item.title}
                detail={`${item.startsAt ? at(item.startsAt) : item.state} · ${t(
                  'ownerWidgets.meta.attendees',
                  { count: item.attendeeCount }
                )}`}
              />
            ))}
          </Stack>
        </>
      );
      break;
    case 'space.change-feed':
      body = (
        <>
          <RuntimeMetric
            label={t('ownerWidgets.metric.unreadSignals')}
            value={count(widget.payload.unreadSignals)}
          />
          <Stack component="ul" gap={0.75} sx={{ p: 0, m: 0, listStyle: 'none' }}>
            {widget.payload.items.slice(0, 3).map((item) => (
              <RuntimeItem
                key={item.id}
                itemKey={item.id}
                title={item.title}
                detail={`${item.spaceName} · ${at(item.occurredAt)}`}
              />
            ))}
          </Stack>
        </>
      );
      break;
    case 'hr.edu':
      body = (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
          <RuntimeMetric
            label={t('ownerWidgets.metric.requiredLearning')}
            value={count(widget.payload.requiredLearningCount)}
          />
          <RuntimeMetric
            label={t('ownerWidgets.metric.activeGoals')}
            value={count(widget.payload.activeGoalCount)}
          />
        </Box>
      );
      break;
    case 'workplace.booking':
      body = (
        <>
          <RuntimeMetric
            label={t('ownerWidgets.metric.visibleBookings')}
            value={count(widget.payload.visibleCount)}
          />
          <Stack component="ul" gap={0.75} sx={{ p: 0, m: 0, listStyle: 'none' }}>
            {widget.payload.items.slice(0, 3).map((item) => (
              <RuntimeItem
                key={item.bookingId}
                itemKey={item.bookingId}
                title={item.resourceName}
                detail={`${item.siteName} · ${item.floorName} · ${at(item.startsAt)}`}
              />
            ))}
          </Stack>
        </>
      );
      break;
    case 'dwaion.artifact':
      body = null;
      break;
    default:
      body = null;
  }

  return (
    <>
      {body}
      {widget.sourceAction && onOpenSource ? (
        <ActionButton
          intent="quiet"
          onClick={() => onOpenSource(widget.sourceRoute)}
          sx={{ mt: 'auto', minHeight: 44, alignSelf: 'flex-start' }}
        >
          {t('ownerWidgets.action.openSource')}
        </ActionButton>
      ) : null}
    </>
  );
}
