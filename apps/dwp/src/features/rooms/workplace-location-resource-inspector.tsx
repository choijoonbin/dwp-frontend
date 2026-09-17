import { useTranslation } from 'react-i18next';
import { ActionButton } from '@dwp-frontend/design-system';
import { ChevronDown, Pencil, MapPin, UsersRound } from 'lucide-react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { WorkplaceResourcePhoto, WorkplaceResourceMediaEditor } from './workplace-resource-photo';
import { WorkplaceResourceClosurePanel } from './workplace-resource-closure-panel';
import { WorkplaceResourceQrPrint } from './workplace-resource-qr-print';
import { useWorkplaceGovernanceTargetScope } from './workplace-governance-target-scope';
import type { WorkplaceResource, WorkplaceSite, WorkplaceFloor } from '@dwp-frontend/shared-utils';

export function WorkplaceLocationResourceInspector({
  resource,
  site,
  floor,
  canEdit,
  onEdit,
}: {
  resource: WorkplaceResource;
  site: WorkplaceSite;
  floor: WorkplaceFloor;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const { t } = useTranslation('rooms');
  const governance = useWorkplaceGovernanceTargetScope();
  const editAllowed =
    canEdit &&
    governance.ready &&
    resource.siteId === site.siteId &&
    resource.floorId === floor.floorId &&
    floor.siteId === site.siteId &&
    governance.allowsTarget('CATALOG_MANAGE', site.siteId, floor.floorId);
  return (
    <Box
      component="aside"
      data-testid="workplace-location-resource-inspector"
      aria-labelledby="workplace-location-resource-title"
      sx={(theme) => ({
        ...workplaceMemberCard(theme),
        '& .MuiAlert-root': { flexWrap: 'wrap' },
        '& .MuiAlert-message': { minWidth: 0, overflowWrap: 'anywhere', overflow: 'visible' },
        '& .MuiAlert-action': { flexBasis: '100%', ml: 0, mr: 0, justifyContent: 'flex-end' },
      })}
    >
      <Stack gap={1.5} sx={{ p: 2 }}>
        <Stack direction="row" alignItems="start" justifyContent="space-between" gap={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" color="primary.main">
              {t('workplace.admin.locations.resourceDetail')}
            </Typography>
            <Typography
              component="h2"
              id="workplace-location-resource-title"
              variant="h6"
              sx={{ overflowWrap: 'anywhere' }}
            >
              {resource.name}
            </Typography>
          </Box>
          <Chip
            size="small"
            variant="outlined"
            label={t(`admin.resources.states.${resource.state}`)}
          />
        </Stack>
        <WorkplaceResourcePhoto resourceId={resource.resourceId} alt={resource.name} admin />
        <Stack direction="row" gap={0.75} flexWrap="wrap">
          <Chip size="small" label={t(`workplace.resourceTypes.${resource.type}`)} />
          <Chip size="small" label={t(`workplace.bookingModes.${resource.mode}`)} />
        </Stack>
        <Stack gap={1.5} sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5 })}>
          <Stack direction="row" gap={1}>
            <MapPin size={17} />
            <Typography variant="body2">
              {site.name} · {floor.name}
            </Typography>
          </Stack>
          <Stack direction="row" gap={1}>
            <UsersRound size={17} />
            <Typography variant="body2">
              {t('workplace.explore.capacity', { count: resource.capacity })}
            </Typography>
          </Stack>
        </Stack>
        {resource.features.length ? (
          <Stack direction="row" gap={0.75} flexWrap="wrap">
            {resource.features.map((feature) => (
              <Chip
                key={feature}
                size="small"
                variant="outlined"
                label={t(`features.${feature}`, { defaultValue: feature })}
              />
            ))}
          </Stack>
        ) : null}
        <Box component="section" aria-label={t('workplace.admin.locations.coordinates')}>
          <Typography variant="overline" color="text.secondary">
            {t('workplace.admin.locations.coordinates')}
          </Typography>
          <Box
            component="dl"
            sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 0.75, m: 0 }}
          >
            <Typography component="dt" variant="caption">
              {t('workplace.admin.locations.positionX')}
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0 }}>
              {resource.positionX}%
            </Typography>
            <Typography component="dt" variant="caption">
              {t('workplace.admin.locations.positionY')}
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0 }}>
              {resource.positionY}%
            </Typography>
          </Box>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
          <ActionButton
            intent="primary"
            startIcon={<Pencil size={17} />}
            disabled={!editAllowed}
            onClick={onEdit}
            sx={{ minHeight: 44, flex: 1 }}
          >
            {t('actions.edit')}
          </ActionButton>
          <WorkplaceResourceQrPrint
            resource={resource}
            site={site}
            floor={floor}
            disabled={!editAllowed}
          />
        </Stack>
        <Accordion
          disableGutters
          elevation={0}
          sx={{ borderTop: 1, borderColor: 'divider', '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ChevronDown size={16} />} sx={{ px: 0 }}>
            <Typography variant="body2" fontWeight="fontWeightBold">
              {t('workplace.admin.locations.photoManagement')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0 }}>
            {editAllowed ? (
              <WorkplaceResourceMediaEditor resourceId={resource.resourceId} name={resource.name} />
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t('permissions.adminUpdateRestricted')}
              </Typography>
            )}
          </AccordionDetails>
        </Accordion>
        <Accordion
          disableGutters
          elevation={0}
          sx={{ borderTop: 1, borderColor: 'divider', '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ChevronDown size={16} />} sx={{ px: 0 }}>
            <Typography variant="body2" fontWeight="fontWeightBold">
              {t('workplace.experience.closure')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0 }}>
            <WorkplaceResourceClosurePanel resource={resource} timeZone={site.timeZone} />
          </AccordionDetails>
        </Accordion>
      </Stack>
    </Box>
  );
}
