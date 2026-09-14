import { useTranslation } from 'react-i18next';
import { ActionButton } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { WorkplaceResource, WorkplaceResourceType } from '@dwp-frontend/shared-utils';

export const WORKPLACE_CATALOG_RESOURCE_TYPES: readonly WorkplaceResourceType[] = [
  'ROOM',
  'DESK',
  'LOCKER',
  'PARKING',
  'FOCUS_POD',
  'PHONE_BOOTH',
  'EQUIPMENT',
];

export function WorkplaceLocationCatalogSummary({
  resources,
  selectedType,
  onTypeChange,
}: {
  resources: readonly WorkplaceResource[];
  selectedType: WorkplaceResourceType | 'ALL';
  onTypeChange: (value: WorkplaceResourceType | 'ALL') => void;
}) {
  const { t } = useTranslation('rooms');
  const groups = WORKPLACE_CATALOG_RESOURCE_TYPES.map((type) => ({
    type,
    count: resources.filter((resource) => resource.type === type).length,
  })).filter((item) => item.count > 0 || item.type === selectedType);
  return (
    <Box
      component="section"
      aria-label={t('workplace.admin.locations.catalogSummary')}
      sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}
    >
      <Typography component="h2" variant="subtitle2" sx={{ mb: 0.75 }}>
        {t('workplace.admin.locations.catalogSummary')}
      </Typography>
      <Stack gap={0.25}>
        <ActionButton
          intent={selectedType === 'ALL' ? 'primary' : 'quiet'}
          aria-pressed={selectedType === 'ALL'}
          size="small"
          onClick={() => onTypeChange('ALL')}
          sx={{ justifyContent: 'space-between', gap: 1 }}
        >
          <span>{t('workplace.explore.allTypes')}</span>
          <span>{resources.length}</span>
        </ActionButton>
        {groups.map(({ type, count }) => (
          <ActionButton
            key={type}
            intent={selectedType === type ? 'primary' : 'quiet'}
            aria-pressed={selectedType === type}
            size="small"
            onClick={() => onTypeChange(type)}
            sx={{ justifyContent: 'space-between', gap: 1 }}
          >
            <span>{t(`workplace.resourceTypes.${type}`)}</span>
            <span>{count}</span>
          </ActionButton>
        ))}
      </Stack>
    </Box>
  );
}
