import { Clock3, History, UserRound } from 'lucide-react';
import {
  formatDate,
  resolveSupportedLocale,
  type SupportedLocale,
} from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { MessagingMeetingHistoryItem } from '@dwp-frontend/shared-utils/api/messaging-meeting-api';

function durationLabel(seconds: number, minuteLabel: (count: number) => string) {
  return minuteLabel(Math.max(1, Math.round(seconds / 60)));
}

function dateTimeLabel(value: string, locale: SupportedLocale) {
  return formatDate(value, { dateStyle: 'medium', timeStyle: 'short' }, locale);
}

export function MessagingMeetingHistory({
  items,
  loading,
  language,
  labels,
}: {
  items: MessagingMeetingHistoryItem[];
  loading: boolean;
  language: string;
  labels: {
    title: string;
    description: string;
    empty: string;
    endedBy: (name: string) => string;
    minutes: (count: number) => string;
  };
}) {
  const locale = resolveSupportedLocale(language);
  return (
    <Box sx={{ pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <History size={17} color="var(--dwp-product-accent)" />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={820}>
            {labels.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {labels.description}
          </Typography>
        </Box>
      </Stack>
      {loading ? (
        <Stack spacing={0.75} sx={{ mt: 1.25 }}>
          <Skeleton variant="rounded" height={54} />
          <Skeleton variant="rounded" height={54} />
        </Stack>
      ) : items.length ? (
        <Stack divider={<Divider flexItem />} sx={{ mt: 1 }}>
          {items.map((item) => (
            <Stack
              key={item.sessionId}
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 0.5, sm: 1.5 }}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              sx={{ py: 1.05 }}
            >
              <Stack
                direction="row"
                spacing={0.8}
                alignItems="center"
                sx={{ minWidth: 0, flex: 1 }}
              >
                <UserRound size={15} />
                <Typography variant="body2" fontWeight={740} noWrap>
                  {item.startedByName}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {dateTimeLabel(item.startedAt, locale)}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Clock3 size={14} />
                <Typography variant="caption" color="text.secondary">
                  {durationLabel(item.durationSeconds, labels.minutes)}
                </Typography>
                {item.endedByName && item.endedByName !== item.startedByName ? (
                  <Typography variant="caption" color="text.secondary">
                    {labels.endedBy(item.endedByName)}
                  </Typography>
                ) : null}
              </Stack>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
          {labels.empty}
        </Typography>
      )}
    </Box>
  );
}
