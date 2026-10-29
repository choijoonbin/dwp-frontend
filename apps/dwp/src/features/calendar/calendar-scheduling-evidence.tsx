import { useTranslation } from 'react-i18next';
import { Building2, DatabaseZap } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  CalendarSchedulingRoomRecommendationV2,
  CalendarSchedulingSourceEvidenceV2,
} from '@dwp-frontend/shared-utils';

function sourceColor(status: CalendarSchedulingSourceEvidenceV2['status']) {
  if (status === 'HEALTHY') return 'success' as const;
  if (status === 'PARTIAL') return 'warning' as const;
  return 'error' as const;
}

export function CalendarSchedulingEvidence({
  sources,
  rooms,
  selectedResourceId,
  applyingResourceId,
  roomActionsDisabled = false,
  onApplyRoom,
}: Readonly<{
  sources: readonly CalendarSchedulingSourceEvidenceV2[];
  rooms: readonly CalendarSchedulingRoomRecommendationV2[];
  selectedResourceId?: string;
  applyingResourceId?: string | null;
  roomActionsDisabled?: boolean;
  onApplyRoom?: (room: CalendarSchedulingRoomRecommendationV2) => void;
}>) {
  const { t, i18n } = useTranslation('calendar');
  return (
    <Box
      component="section"
      aria-label={t('schedulingAssistant.evidenceTitle')}
      sx={{ mt: 2, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
    >
      <Box sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <DatabaseZap size={16} aria-hidden="true" />
          <Typography component="h3" variant="subtitle2" fontWeight={800}>
            {t('schedulingAssistant.sourcesTitle')}
          </Typography>
        </Stack>
        {sources.length ? (
          <Stack component="ul" spacing={0.75} sx={{ p: 0, m: '12px 0 0', listStyle: 'none' }}>
            {sources.map((source, index) => {
              const sourceTypeKey = `schedulingAssistant.sourceTypes.${source.sourceType}`;
              const sourceReasonKey = source.reasonCode
                ? `schedulingAssistant.sourceReasons.${source.reasonCode}`
                : null;
              return (
                <Stack
                  component="li"
                  key={`${source.sourceType}:${index}`}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={0.75}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                >
                  <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }}>
                    {i18n.exists(sourceTypeKey, { ns: 'calendar' })
                      ? t(sourceTypeKey)
                      : t('schedulingAssistant.sourceTypeFallback')}
                  </Typography>
                  <Chip
                    size="small"
                    color={sourceColor(source.status)}
                    variant="outlined"
                    label={t(`schedulingAssistant.sourceStatus.${source.status}`)}
                  />
                  {sourceReasonKey ? (
                    <Typography variant="caption" color="text.secondary">
                      {i18n.exists(sourceReasonKey, { ns: 'calendar' })
                        ? t(sourceReasonKey)
                        : t('schedulingAssistant.sourceReasonFallback')}
                    </Typography>
                  ) : null}
                </Stack>
              );
            })}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('schedulingAssistant.noSourceEvidence')}
          </Typography>
        )}
      </Box>
      <Divider />
      <Box sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Building2 size={16} aria-hidden="true" />
          <Typography component="h3" variant="subtitle2" fontWeight={800}>
            {t('schedulingAssistant.recommendedRooms')}
          </Typography>
        </Stack>
        {rooms.length ? (
          <Stack spacing={0.75} sx={{ mt: 1 }}>
            {rooms.map((room) => {
              const actionable = room.eligible && Boolean(onApplyRoom);
              const reasonCode = room.reasonCodes[0] ?? room.eligibilityReason;
              const reasonKey = `schedulingAssistant.roomReasons.${reasonCode}`;
              return (
                <Box
                  key={room.room.resourceId}
                  sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 1 }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={700}>
                      {room.room.name} · {t('resources.capacity', { count: room.room.capacity })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {i18n.exists(reasonKey, { ns: 'calendar' })
                        ? t(reasonKey)
                        : t('schedulingAssistant.roomReasonFallback')}
                    </Typography>
                  </Box>
                  {actionable ? (
                    <ActionButton
                      intent={room.room.resourceId === selectedResourceId ? 'primary' : 'secondary'}
                      size="small"
                      loading={applyingResourceId === room.room.resourceId}
                      disabled={roomActionsDisabled}
                      aria-pressed={room.room.resourceId === selectedResourceId}
                      aria-label={t(
                        room.room.resourceId === selectedResourceId
                          ? 'schedulingAssistant.roomSelectedLabel'
                          : 'schedulingAssistant.applyRoomLabel',
                        { room: room.room.name }
                      )}
                      onClick={() => onApplyRoom?.(room)}
                    >
                      {t(
                        room.room.resourceId === selectedResourceId
                          ? 'schedulingAssistant.roomSelected'
                          : 'schedulingAssistant.applyRoom'
                      )}
                    </ActionButton>
                  ) : (
                    <Chip
                      size="small"
                      color={room.eligible ? 'success' : 'error'}
                      variant="outlined"
                      label={t(
                        room.eligible
                          ? 'schedulingAssistant.roomStatus.ELIGIBLE'
                          : 'schedulingAssistant.roomStatus.INELIGIBLE'
                      )}
                    />
                  )}
                </Box>
              );
            })}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('schedulingAssistant.noRooms')}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
