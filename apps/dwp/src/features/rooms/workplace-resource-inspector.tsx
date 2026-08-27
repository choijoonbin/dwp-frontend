import { useTranslation } from 'react-i18next';
import { Accessibility, Clock3, MapPin, ShieldCheck, UsersRound } from 'lucide-react';
import { ActionButton, DetailInspector } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { WorkplaceResource, WorkplaceResourceType } from '@dwp-frontend/shared-utils';
import type { WorkplaceResourceAvailability } from './workplace-floor-plan';

type Props = {
  resource: WorkplaceResource | null;
  status: WorkplaceResourceAvailability | null;
  siteName: string;
  floorName: string;
  typeLabels: Record<WorkplaceResourceType, string>;
  statusLabels: Record<WorkplaceResourceAvailability, string>;
  bookingEligibilityLabel: string;
  bookingEligible: boolean;
  canBook: boolean;
  blockedReason?: string;
  retrying?: boolean;
  onRetry?: () => void;
  onBook: () => void;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
};

export function WorkplaceResourceInspector({
  resource,
  status,
  siteName,
  floorName,
  typeLabels,
  statusLabels,
  bookingEligibilityLabel,
  bookingEligible,
  canBook,
  blockedReason,
  retrying = false,
  onRetry,
  onBook,
  onClose,
  onPrevious,
  onNext,
  previousDisabled,
  nextDisabled,
}: Props) {
  const { t } = useTranslation('rooms');
  if (!resource || !status) return null;

  return (
    <DetailInspector
      open
      variant="drawer"
      width={440}
      title={resource.name}
      subtitle={[siteName, floorName, resource.neighborhood].filter(Boolean).join(' · ')}
      closeLabel={t('actions.close')}
      previousLabel={t('workplace.explore.previousResource')}
      nextLabel={t('workplace.explore.nextResource')}
      onPrevious={onPrevious}
      onNext={onNext}
      previousDisabled={previousDisabled}
      nextDisabled={nextDisabled}
      onClose={onClose}
      status={
        <Stack direction="row" gap={0.75} useFlexGap flexWrap="wrap">
          <Chip size="small" variant="outlined" label={statusLabels[status]} />
          <Chip
            size="small"
            variant="outlined"
            color={bookingEligible ? 'success' : 'default'}
            label={bookingEligibilityLabel}
          />
        </Stack>
      }
    >
      <Stack spacing={2.25}>
        <Stack direction="row" gap={0.75} useFlexGap flexWrap="wrap">
          <Chip size="small" label={typeLabels[resource.type]} />
          <Chip size="small" variant="outlined" label={resource.code} />
          <Chip
            size="small"
            variant="outlined"
            label={t(`workplace.bookingModes.${resource.mode}`)}
          />
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.25,
          }}
        >
          <InspectorFact
            icon={<MapPin size={16} />}
            label={t('workplace.explore.location')}
            value={[siteName, floorName].filter(Boolean).join(' · ')}
          />
          <InspectorFact
            icon={<UsersRound size={16} />}
            label={t('workplace.explore.capacityLabel')}
            value={t('workplace.explore.capacity', { count: resource.capacity })}
          />
          <InspectorFact
            icon={<Clock3 size={16} />}
            label={t('workplace.explore.bookingMode')}
            value={t(`workplace.bookingModes.${resource.mode}`)}
          />
          <InspectorFact
            icon={resource.accessible ? <Accessibility size={16} /> : <ShieldCheck size={16} />}
            label={t('workplace.explore.accessibility')}
            value={t(
              resource.accessible
                ? 'workplace.explore.accessibleSupported'
                : 'workplace.explore.accessibilityUnknown'
            )}
          />
        </Box>

        {resource.features.length > 0 && (
          <Box>
            <Typography variant="overline" color="text.secondary">
              {t('workplace.explore.features')}
            </Typography>
            <Stack direction="row" gap={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }}>
              {resource.features.map((value) => (
                <Chip
                  key={value}
                  size="small"
                  variant="outlined"
                  label={t(`features.${value}`, { defaultValue: value })}
                />
              ))}
            </Stack>
          </Box>
        )}

        <Divider />
        {blockedReason && (
          <Alert
            severity="info"
            action={
              onRetry ? (
                <ActionButton intent="quiet" loading={retrying} onClick={onRetry}>
                  {t('actions.retry')}
                </ActionButton>
              ) : undefined
            }
          >
            {blockedReason}
          </Alert>
        )}
        <ActionButton intent="primary" disabled={!canBook} onClick={onBook}>
          {t('workplace.explore.bookResource')}
        </ActionButton>
        <Typography variant="caption" color="text.secondary">
          {t('workplace.explore.policyApplied')}
        </Typography>
      </Stack>
    </DetailInspector>
  );
}

function InspectorFact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Stack direction="row" gap={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
      <Box aria-hidden="true" sx={{ color: 'var(--dwp-product-accent)', mt: 0.25 }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={700}>
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}
