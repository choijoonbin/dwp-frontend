import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import {
  ActionButton,
  EmptyState,
  LoadingState,
  foundationTokens,
} from '@dwp-frontend/design-system';
import { getWorkplaceAdminResources } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ArrowUpRight, Map } from 'lucide-react';
import { WorkplaceAdminSection } from './workplace-admin-experience-ui';
import { useWorkplaceExperienceAuthority } from './workplace-experience-authority';
import { WorkplaceExperienceQueryError } from './workplace-experience-ui';
import type { WorkplaceFloor } from '@dwp-frontend/shared-utils';

export function WorkplaceAdminFloorPreview({
  floor,
  highlightedResourceIds = [],
  enabled,
}: {
  floor: WorkplaceFloor | null;
  highlightedResourceIds?: readonly string[];
  enabled: boolean;
}) {
  const { t } = useTranslation('rooms');
  const identity = useWorkplaceExperienceAuthority();
  const resourcesQuery = useQuery({
    queryKey: ['workplace', 'admin-floor-preview', identity, floor?.floorId],
    queryFn: () => getWorkplaceAdminResources(floor!.floorId),
    enabled: enabled && Boolean(floor),
    staleTime: 15_000,
    retry: false,
  });
  const mapHeight = floor ? (100 * floor.planHeight) / floor.planWidth : 100;
  const resources = enabled && !resourcesQuery.isError ? resourcesQuery.data : undefined;
  return (
    <WorkplaceAdminSection title={t('workplace.experience.polish.layoutPreview')} tone="soft">
      {floor && enabled ? (
        <Stack gap={1.25}>
          <Stack direction="row" alignItems="center" gap={0.75}>
            <Map size={16} aria-hidden="true" />
            <Typography fontWeight="fontWeightBold" variant="body2">
              {floor.name}
            </Typography>
          </Stack>
          {resourcesQuery.isLoading ? (
            <LoadingState
              embedded
              variant="skeleton"
              skeletonRows={1}
              skeletonHeight={140}
              label={t('workplace.experience.refreshing')}
            />
          ) : resourcesQuery.isError ? (
            <WorkplaceExperienceQueryError retry={() => void resourcesQuery.refetch()} />
          ) : resources ? (
            <>
              <Box
                component="svg"
                role="img"
                aria-label={`${floor.name} · ${t('workplace.experience.polish.mapResourceCount', { count: resources.length })}`}
                viewBox={`0 0 100 ${mapHeight}`}
                sx={{
                  width: '100%',
                  aspectRatio: `${floor.planWidth} / ${floor.planHeight}`,
                  minHeight: 130,
                  maxHeight: 150,
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: foundationTokens.radius.compact + 'px',
                }}
              >
                {resources.map((resource) => (
                  <Box
                    component="g"
                    sx={{
                      color: highlightedResourceIds.includes(resource.resourceId)
                        ? 'warning.main'
                        : 'primary.main',
                    }}
                    key={resource.resourceId}
                    transform={`translate(${resource.positionX} ${(resource.positionY * mapHeight) / 100}) rotate(${resource.rotationDegrees} ${resource.widthPercent / 2} ${(resource.heightPercent * mapHeight) / 200})`}
                  >
                    <rect
                      width={resource.widthPercent}
                      height={(resource.heightPercent * mapHeight) / 100}
                      rx=".5"
                      fill="currentColor"
                      stroke="currentColor"
                      strokeWidth=".5"
                      fillOpacity={0.16}
                    />
                    <title>{resource.name}</title>
                  </Box>
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t('workplace.experience.polish.configuredLayoutNotice')}
              </Typography>
              <Typography variant="caption">
                {t('workplace.experience.polish.mapResourceCount', { count: resources.length })}
              </Typography>
            </>
          ) : null}
          <ActionButton
            component={NavLink}
            to={`/workplace/admin/locations?site=${encodeURIComponent(floor.siteId)}&floor=${encodeURIComponent(floor.floorId)}`}
            intent="secondary"
            endIcon={<ArrowUpRight size={15} />}
          >
            {t('workplace.experience.polish.viewFloor')}
          </ActionButton>
        </Stack>
      ) : (
        <EmptyState title={t('workplace.experience.polish.previewDataUnavailable')} />
      )}
    </WorkplaceAdminSection>
  );
}
