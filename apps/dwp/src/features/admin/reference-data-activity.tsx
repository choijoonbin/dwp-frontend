import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import {
  ManagementPanelError,
  ManagementPanelLoading,
} from '../../components/management-panel-state';
import { formatReferenceDateTime, referenceDataErrorMessage } from './reference-data-manager-model';

import type { PlatformAuditEvent } from '@dwp-frontend/shared-utils';

type ReferenceDataActivityProps = {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  activities: PlatformAuditEvent[];
};

export function ReferenceDataActivity({
  isLoading,
  isError,
  error,
  activities,
}: ReferenceDataActivityProps) {
  const { t } = useTranslation('admin');
  const theme = useTheme();

  const activityLabel = (event: PlatformAuditEvent) => {
    switch (event.action) {
      case 'reference-set.seeded':
        return t('referenceData.activity.actions.seeded');
      case 'reference-set.created':
        return t('referenceData.activity.actions.setCreated');
      case 'reference-set.updated':
        return t('referenceData.activity.actions.setUpdated');
      case 'reference-set.activated':
        return t('referenceData.activity.actions.setActivated');
      case 'reference-set.retired':
        return t('referenceData.activity.actions.setRetired');
      case 'reference-item.created':
        return t('referenceData.activity.actions.itemCreated');
      case 'reference-item.updated':
        return t('referenceData.activity.actions.itemUpdated');
      case 'reference-item.activated':
        return t('referenceData.activity.actions.itemActivated');
      case 'reference-item.retired':
        return t('referenceData.activity.actions.itemRetired');
      default:
        return event.action;
    }
  };

  return (
    <Box component="section" aria-label={t('referenceData.activity.title')}>
      <Box
        sx={{
          px: { xs: 2, md: 2.5 },
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography component="h3" variant="subtitle2">
          {t('referenceData.activity.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('referenceData.activity.description')}
        </Typography>
      </Box>
      {isLoading ? (
        <ManagementPanelLoading label={t('referenceData.activity.loading')} />
      ) : isError ? (
        <ManagementPanelError
          message={referenceDataErrorMessage(error, t('common.operationError'))}
        />
      ) : activities.length ? (
        <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {activities.map((event) => (
            <Box
              component="li"
              key={event.auditEventId}
              sx={{
                minHeight: 74,
                px: { xs: 2, md: 2.5 },
                py: 1.5,
                display: 'grid',
                gridTemplateColumns: {
                  xs: '36px minmax(0, 1fr)',
                  sm: '36px minmax(0, 1fr) auto auto',
                },
                alignItems: 'center',
                columnGap: 1.5,
                rowGap: 0.5,
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  color: 'primary.main',
                  borderRadius: 1,
                }}
              >
                <History size={16} strokeWidth={1.8} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={700} noWrap>
                  {activityLabel(event)}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ display: 'block' }}
                >
                  {event.targetId} ·{' '}
                  {event.actorType === 'SERVICE'
                    ? t('referenceData.activity.systemActor')
                    : t('referenceData.activity.userActor', { id: event.actorId })}
                </Typography>
              </Box>
              <Chip
                size="small"
                color={event.outcome === 'SUCCESS' ? 'success' : 'error'}
                variant="outlined"
                label={t(`referenceData.activity.outcomes.${event.outcome}`)}
                sx={{ gridColumn: { xs: '2', sm: 'auto' }, justifySelf: 'start' }}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ gridColumn: { xs: '2', sm: 'auto' }, whiteSpace: 'nowrap' }}
              >
                {formatReferenceDateTime(event.occurredAt)}
              </Typography>
            </Box>
          ))}
        </Box>
      ) : (
        <Box
          sx={{
            minHeight: 260,
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
            p: 3,
          }}
        >
          <Box>
            <History size={28} strokeWidth={1.5} color={theme.palette.text.disabled} />
            <Typography component="p" variant="subtitle2" sx={{ mt: 1 }}>
              {t('referenceData.activity.empty')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('referenceData.activity.emptyDescription')}
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}
