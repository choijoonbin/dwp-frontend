import { Check, CircleAlert, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { formatDate } from '@dwp-frontend/shared-i18n';

import type { CommunicationFeedScope, CommunicationItem } from '@dwp-frontend/shared-utils';

export function storyDate(value?: string | null) {
  return value ? formatDate(value, { dateStyle: 'medium' }) : '-';
}

export function RequiredRail({
  items,
  scope,
}: {
  items: CommunicationItem[];
  scope: CommunicationFeedScope;
}) {
  const { t } = useTranslation('communications');
  return (
    <Box component="aside" aria-labelledby="required-news-title" sx={{ minWidth: 0 }}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Box
          sx={{
            width: 34,
            height: 34,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 1,
            bgcolor: '#FFF0E2',
            color: '#A94E00',
          }}
        >
          <CircleAlert size={18} aria-hidden="true" />
        </Box>
        <Box>
          <Typography id="required-news-title" component="h2" variant="subtitle1">
            {t('page.requiredTitle')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('page.requiredDescription')}
          </Typography>
        </Box>
      </Stack>
      <Stack gap={1.25} sx={{ mt: 2 }}>
        {items.length === 0 ? (
          <Box sx={{ py: 4, px: 2, borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
            <Check size={20} color="#18794E" aria-hidden="true" />
            <Typography variant="body2" fontWeight={700} sx={{ mt: 1 }}>
              {t('page.allCaughtUp')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('page.requiredEmpty')}
            </Typography>
          </Box>
        ) : (
          items.slice(0, 4).map((item) => (
            <Box
              key={item.communicationId}
              component={Link}
              to={`/communications/${scope}/${item.communicationId}`}
              sx={{
                p: 1.5,
                border: 1,
                borderColor: 'divider',
                borderLeft: '4px solid #E89727',
                borderRadius: 1,
                bgcolor: 'background.paper',
                color: 'text.primary',
                textDecoration: 'none',
                '&:hover': { borderColor: '#E89727', boxShadow: '0 10px 24px rgba(15,23,42,0.08)' },
              }}
            >
              <Typography component="h3" variant="subtitle2">
                {item.title}
              </Typography>
              <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 1 }}>
                <Clock3 size={13} color="#A94E00" aria-hidden="true" />
                <Typography variant="caption" color="text.secondary">
                  {item.acknowledgementDueAt
                    ? t('story.acknowledgementDue', { date: storyDate(item.acknowledgementDueAt) })
                    : t('page.required')}
                </Typography>
              </Stack>
            </Box>
          ))
        )}
      </Stack>
    </Box>
  );
}

export function FeedLoading() {
  return (
    <Stack gap={2} aria-busy="true">
      <Skeleton variant="rounded" height={460} />
      <Skeleton variant="rounded" height={178} />
      <Skeleton variant="rounded" height={178} />
    </Stack>
  );
}
