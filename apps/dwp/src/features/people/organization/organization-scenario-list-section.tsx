import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { LoadingState } from '@dwp-frontend/design-system';
import { useDisplayDictionary } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { scenarioStatusColor } from './organization-scenario-drawer-model';

import type { OrganizationScenario } from '@dwp-frontend/shared-utils';

export function OrganizationScenarioListSection({
  scenarios,
  selectedScenarioId,
  loading,
  canCreate,
  onCreate,
  onSelect,
}: {
  scenarios: OrganizationScenario[];
  selectedScenarioId?: string;
  loading: boolean;
  canCreate: boolean;
  onCreate: () => void;
  onSelect: (scenarioId: string) => void;
}) {
  const { t } = useTranslation('workforce');
  const display = useDisplayDictionary();

  return (
    <Box sx={{ borderRight: { md: 1 }, borderBottom: { xs: 1, md: 0 }, borderColor: 'divider' }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ px: 1.5, py: 1.25 }}
      >
        <Typography variant="subtitle2">{t('orgChart.scenarios.list')}</Typography>
        <Tooltip title={t('orgChart.scenarios.create')}>
          <IconButton
            size="small"
            disabled={!canCreate}
            onClick={onCreate}
            aria-label={t('orgChart.scenarios.create')}
          >
            <Plus size={17} />
          </IconButton>
        </Tooltip>
      </Stack>
      <Divider />
      {loading ? (
        <LoadingState label={t('common:labels.loading')} size="compact" embedded />
      ) : (
        <List
          dense
          disablePadding
          sx={{ maxHeight: { xs: 180, md: 'calc(100vh - 150px)' }, overflow: 'auto' }}
        >
          {scenarios.map((scenario) => (
            <ListItemButton
              key={scenario.scenarioId}
              selected={scenario.scenarioId === selectedScenarioId}
              onClick={() => onSelect(scenario.scenarioId)}
              sx={{ alignItems: 'flex-start', py: 1.25 }}
            >
              <ListItemText
                primary={scenario.name}
                secondary={t('orgChart.scenarios.listItem', {
                  date: scenario.effectiveDate,
                  count: scenario.changes.length,
                })}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 650 }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
              <Chip
                size="small"
                variant="outlined"
                color={scenarioStatusColor(scenario.lifecycleState)}
                label={display('states', scenario.lifecycleState)}
                sx={{ ml: 0.5 }}
              />
            </ListItemButton>
          ))}
          {!scenarios.length && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              {t('orgChart.scenarios.empty')}
            </Typography>
          )}
        </List>
      )}
    </Box>
  );
}
