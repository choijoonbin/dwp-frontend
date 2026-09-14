import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Accessibility, Clock3, MapPin, ShieldCheck, UsersRound } from 'lucide-react';
import { useAuth } from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  DetailInspector,
  getProductExperienceProfile,
  resolveProductExperienceTones,
  PRODUCT_EXPERIENCE_SOFT_OPACITY,
} from '@dwp-frontend/design-system';
import { useAppearance } from '@dwp-frontend/design-system/appearance';
import { alpha } from '@mui/material/styles';
import { formatDate } from '@dwp-frontend/shared-i18n';

import { InlineFeedback } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useRoomsCapabilities } from './rooms-capabilities';
import { WorkplaceFacilityRequestDialog } from './workplace-facility-request';
import { workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { WorkplaceResourcePhoto } from './workplace-resource-photo';
import { WorkplaceResourceWindowSummary } from './workplace-resource-window-summary';
import type { WorkplaceResourceWindowContext } from './workplace-resource-window-facts';

import type { WorkplaceResource, WorkplaceResourceType } from '@dwp-frontend/shared-utils';
import type { WorkplaceResourceAvailability } from './workplace-floor-plan';

type Props = {
  variant?: 'inline' | 'drawer';
  selectedStart?: string;
  selectedEnd?: string;
  timeZone?: string;
  windowContext?: WorkplaceResourceWindowContext;
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
  variant = 'drawer',
  selectedStart,
  selectedEnd,
  timeZone,
  windowContext,
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
  const capabilities = useRoomsCapabilities();
  const { preference } = useAppearance();
  const auth = useAuth();
  const identityKey = `${auth.user?.tenantId ?? 'anonymous'}:${auth.user?.userId ?? 'anonymous'}`;
  const [requestTarget, setRequestTarget] = useState<{
    identityKey: string;
    resourceId: string;
  } | null>(null);
  if (!resource || !status) return null;

  return (
    <>
      <DetailInspector
        open
        variant={variant}
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
        footer={
          <Stack spacing={1}>
            {blockedReason ? (
              <InlineFeedback
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
              </InlineFeedback>
            ) : null}
            <ActionButton
              intent="primary"
              disabled={!canBook}
              onClick={onBook}
              sx={{ minHeight: 44, width: 1 }}
            >
              {t('workplace.explore.bookResource')}
            </ActionButton>
            <Typography variant="caption" color="text.secondary">
              {t('workplace.explore.policyApplied')}
            </Typography>
          </Stack>
        }
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
        <Stack
          spacing={1.5}
          sx={
            variant === 'drawer'
              ? (theme) => {
                  const profile = getProductExperienceProfile('rooms');
                  const tones = resolveProductExperienceTones(profile, {
                    mode: theme.palette.mode,
                    highContrast: preference.highContrast,
                    canvas: theme.palette.background.paper,
                    sidebar: theme.palette.background.paper,
                  });
                  return {
                    '--dwp-product-accent': tones.accent,
                    '--dwp-product-soft':
                      theme.palette.mode === 'dark'
                        ? alpha(tones.accent, PRODUCT_EXPERIENCE_SOFT_OPACITY)
                        : profile.softSurface,
                  };
                }
              : undefined
          }
        >
          <WorkplaceResourcePhoto resourceId={resource.resourceId} alt={resource.name} />
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
              label={t(
                selectedStart && selectedEnd
                  ? 'workplace.explore.time'
                  : 'workplace.explore.bookingMode'
              )}
              value={
                selectedStart && selectedEnd
                  ? `${formatDate(selectedStart, { dateStyle: 'medium', timeStyle: 'short', timeZone })} – ${formatDate(selectedEnd, { timeStyle: 'short', timeZone })}`
                  : t(`workplace.bookingModes.${resource.mode}`)
              }
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
          <WorkplaceResourceWindowSummary
            resource={resource}
            context={windowContext}
            timeZone={timeZone}
          />
          <Divider />
          <ActionButton
            intent="secondary"
            disabled={!capabilities.canViewWorkplace || !capabilities.canCreateWorkplaceBooking}
            onClick={() => setRequestTarget({ identityKey, resourceId: resource.resourceId })}
            sx={{ minHeight: 44 }}
          >
            {t('workplace.experience.request')}
          </ActionButton>
        </Stack>
      </DetailInspector>
      <WorkplaceFacilityRequestDialog
        resourceId={
          requestTarget?.identityKey === identityKey &&
          requestTarget.resourceId === resource.resourceId
            ? requestTarget.resourceId
            : null
        }
        resourceName={resource.name}
        onClose={() => setRequestTarget(null)}
      />
    </>
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
    <Stack
      direction="row"
      gap={1}
      alignItems="flex-start"
      sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), minWidth: 0, p: 1.5 })}
    >
      <Box aria-hidden="true" sx={{ color: 'var(--dwp-product-accent)', mt: 0.25 }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body2" fontWeight="fontWeightBold">
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}
