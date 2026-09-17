import { CalendarRange, Filter, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionButton, FormField, SelectField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberCard } from './workplace-member-surfaces';
import { WORKPLACE_PLANNING_RESOURCE_TYPES } from './workplace-space-planning-model';

import type { WorkplaceFloor, WorkplaceSite } from '@dwp-frontend/shared-utils';
import type { WorkplacePlanningScopeForm } from './workplace-space-planning-model';

export function WorkplaceSpacePlanningScope({
  form,
  sites,
  floors,
  timeZone,
  invalid,
  refreshing,
  blocked,
  onChange,
  onApply,
}: {
  form: WorkplacePlanningScopeForm;
  sites: readonly WorkplaceSite[];
  floors: readonly WorkplaceFloor[];
  timeZone: string | null;
  invalid: boolean;
  refreshing: boolean;
  blocked: boolean;
  onChange: <K extends keyof WorkplacePlanningScopeForm>(
    key: K,
    value: WorkplacePlanningScopeForm[K]
  ) => void;
  onApply: () => void;
}) {
  const { t } = useTranslation('rooms');
  return (
    <Box component="section" aria-labelledby="space-planning-scope-title" sx={workplaceMemberCard}>
      <Box p={{ xs: 1.5, md: 2 }}>
        <Stack direction="row" gap={1} alignItems="center" mb={1.5}>
          <Filter size={18} aria-hidden="true" />
          <Box>
            <Typography
              id="space-planning-scope-title"
              component="h2"
              variant="subtitle1"
              fontWeight={750}
            >
              {t('workplace.spacePlanning.scope.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('workplace.spacePlanning.scope.description')}
            </Typography>
            {timeZone ? (
              <Typography variant="caption" color="text.secondary" display="block">
                {t('workplace.spacePlanning.scope.timeZone', { value: timeZone })}
              </Typography>
            ) : null}
          </Box>
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              sm: 'repeat(2, minmax(0, 1fr))',
              xl: '1.3fr 1fr 1fr 1fr 1fr 1fr auto',
            },
            gap: 1,
            alignItems: 'start',
          }}
        >
          <SelectField
            label={t('workplace.spacePlanning.scope.site')}
            value={form.siteId}
            options={sites.map((site) => ({ value: site.siteId, label: site.name }))}
            placeholder={t('workplace.spacePlanning.scope.selectSite')}
            onValueChange={(value) => onChange('siteId', value)}
          />
          <SelectField
            label={t('workplace.spacePlanning.scope.floor')}
            value={form.floorId}
            options={[
              { value: '', label: t('workplace.spacePlanning.scope.allFloors') },
              ...floors.map((floor) => ({ value: floor.floorId, label: floor.name })),
            ]}
            disabled={!form.siteId}
            onValueChange={(value) => onChange('floorId', value)}
          />
          <FormField
            label={t('workplace.spacePlanning.scope.neighborhood')}
            value={form.neighborhood}
            inputProps={{ maxLength: 120 }}
            onChange={(event) => onChange('neighborhood', event.target.value)}
          />
          <SelectField
            label={t('workplace.spacePlanning.scope.resourceType')}
            value={form.resourceType}
            options={[
              { value: '', label: t('workplace.spacePlanning.scope.allResources') },
              ...WORKPLACE_PLANNING_RESOURCE_TYPES.map((value) => ({
                value,
                label: t(`workplace.spacePlanning.resourceTypes.${value}`),
              })),
            ]}
            onValueChange={(value) => onChange('resourceType', value)}
          />
          <FormField
            type="date"
            label={t('workplace.spacePlanning.scope.from')}
            value={form.from}
            slotProps={{ inputLabel: { shrink: true } }}
            onChange={(event) => onChange('from', event.target.value)}
          />
          <FormField
            type="date"
            label={t('workplace.spacePlanning.scope.to')}
            value={form.to}
            slotProps={{ inputLabel: { shrink: true } }}
            errorMessage={invalid ? t('workplace.spacePlanning.scope.invalidRange') : undefined}
            onChange={(event) => onChange('to', event.target.value)}
          />
          <ActionButton
            intent="primary"
            startIcon={refreshing ? <RefreshCw size={16} /> : <CalendarRange size={16} />}
            disabled={invalid || refreshing || blocked}
            onClick={onApply}
            sx={{ minHeight: 56, whiteSpace: 'nowrap' }}
          >
            {refreshing
              ? t('workplace.spacePlanning.scope.refreshing')
              : t('workplace.spacePlanning.scope.apply')}
          </ActionButton>
        </Box>
      </Box>
    </Box>
  );
}
