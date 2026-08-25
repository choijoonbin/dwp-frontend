import { useState } from 'react';
import { Check, CircleAlert, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { CommunicationFeedScope } from '@dwp-frontend/shared-utils';
import type { CommunicationActionRailItem } from './communication-action-rail-model';

type CommunicationActionRailProps = {
  items: readonly CommunicationActionRailItem[];
  scope: CommunicationFeedScope;
};

function storyDate(value: string) {
  return formatDate(value, { dateStyle: 'medium' });
}

export function CommunicationActionRail({ items, scope }: CommunicationActionRailProps) {
  const { t } = useTranslation('communications');
  const [expanded, setExpanded] = useState(false);
  const hasCritical = items.some(({ kind }) => kind === 'CRITICAL');
  const visibleItems = expanded ? items : items.slice(0, 4);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);

  return (
    <Box
      component="aside"
      aria-labelledby="communication-action-rail-title"
      data-testid="communications-action-rail"
      sx={{ minWidth: 0 }}
    >
      <Stack direction="row" alignItems="center" gap={1}>
        <Box
          sx={{
            width: 34,
            height: 34,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 1,
            bgcolor: hasCritical ? '#FEECEB' : '#FFF0E2',
            color: hasCritical ? '#B42318' : '#A94E00',
          }}
        >
          <CircleAlert size={18} aria-hidden="true" />
        </Box>
        <Box>
          <Typography id="communication-action-rail-title" component="h2" variant="subtitle1">
            {t(hasCritical ? 'page.actionTitle' : 'page.requiredTitle')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t(hasCritical ? 'page.actionDescription' : 'page.requiredDescription')}
          </Typography>
        </Box>
      </Stack>

      <Stack
        id="communication-action-list"
        component="ol"
        gap={1.25}
        sx={{ mt: 2, p: 0, listStyle: 'none' }}
      >
        {items.length === 0 ? (
          <Box component="li" sx={{ py: 4, px: 2, borderBlock: 1, borderColor: 'divider' }}>
            <Check size={20} color="#18794E" aria-hidden="true" />
            <Typography variant="body2" fontWeight={700} sx={{ mt: 1 }}>
              {t('page.allCaughtUp')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('page.requiredEmpty')}
            </Typography>
          </Box>
        ) : (
          visibleItems.map(({ item, kind }) => {
            const critical = kind === 'CRITICAL';
            const pendingAcknowledgement =
              item.acknowledgementRequired && !item.readerState.acknowledged;
            const accent = critical ? '#D92D20' : '#E89727';
            return (
              <Box component="li" key={item.communicationId}>
                <Box
                  component={Link}
                  to={`/communications/${scope}/${item.communicationId}`}
                  data-communication-action-kind={kind}
                  sx={{
                    p: 1.5,
                    display: 'block',
                    border: 1,
                    borderColor: 'divider',
                    borderLeft: `4px solid ${accent}`,
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    textDecoration: 'none',
                    '&:hover': {
                      borderColor: accent,
                      boxShadow: '0 10px 24px rgba(15,23,42,0.08)',
                    },
                    '&:focus-visible': {
                      outline: '3px solid var(--dwp-focus-ring, currentColor)',
                      outlineOffset: 2,
                    },
                  }}
                >
                  <Typography
                    variant="caption"
                    color={critical ? 'error.main' : 'warning.main'}
                    fontWeight={750}
                  >
                    {t(
                      critical
                        ? pendingAcknowledgement
                          ? 'page.criticalRequired'
                          : 'page.critical'
                        : 'page.required'
                    )}
                  </Typography>
                  <Typography component="h3" variant="subtitle2" sx={{ mt: 0.25 }}>
                    {item.title}
                  </Typography>
                  <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 1 }}>
                    <Clock3 size={13} color={accent} aria-hidden="true" />
                    <Typography variant="caption" color="text.secondary">
                      {pendingAcknowledgement
                        ? item.acknowledgementDueAt
                          ? t('story.acknowledgementDue', {
                              date: storyDate(item.acknowledgementDueAt),
                            })
                          : t('page.required')
                        : t('page.criticalUnread')}
                    </Typography>
                  </Stack>
                </Box>
              </Box>
            );
          })
        )}
      </Stack>
      {items.length > 4 && (
        <ActionButton
          intent="quiet"
          size="small"
          aria-controls="communication-action-list"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          sx={{ mt: 1, minHeight: 44 }}
        >
          {expanded
            ? t('page.showFewerActions')
            : t('page.showMoreActions', { count: hiddenCount })}
        </ActionButton>
      )}
    </Box>
  );
}
