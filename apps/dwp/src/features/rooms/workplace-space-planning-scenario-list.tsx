import { Check, FilePlus2, GitCompareArrows } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionButton, EmptyState } from '@dwp-frontend/design-system';
import { formatDate, type SupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberCard } from './workplace-member-surfaces';

import type { WorkplacePlanningScenario } from '@dwp-frontend/shared-utils/api/workplace-planning-contract';

function stateColor(state: WorkplacePlanningScenario['state']) {
  if (state === 'PUBLISHED') return 'success';
  if (state === 'APPROVED') return 'info';
  if (state === 'SUBMITTED') return 'warning';
  return 'default';
}

export function WorkplaceSpacePlanningScenarioList({
  scenarios,
  selectedId,
  canManage,
  blocked,
  locale,
  timeZone,
  onSelect,
  onCreate,
}: {
  scenarios: readonly WorkplacePlanningScenario[];
  selectedId: string | null;
  canManage: boolean;
  blocked: boolean;
  locale: SupportedLocale;
  timeZone: string;
  onSelect: (scenarioId: string) => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation('rooms');
  return (
    <Box
      component="section"
      aria-labelledby="space-planning-scenarios-title"
      sx={workplaceMemberCard}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} p={1.5}>
        <Box>
          <Typography
            id="space-planning-scenarios-title"
            component="h2"
            variant="subtitle1"
            fontWeight={780}
          >
            {t('workplace.spacePlanning.scenarios.title')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('workplace.spacePlanning.scenarios.count', { count: scenarios.length })}
          </Typography>
        </Box>
        <ActionButton
          intent="primary"
          size="small"
          startIcon={<FilePlus2 size={15} />}
          disabled={!canManage || blocked}
          onClick={onCreate}
        >
          {t('workplace.spacePlanning.scenarios.new')}
        </ActionButton>
      </Stack>
      {scenarios.length === 0 ? (
        <EmptyState
          icon={<GitCompareArrows size={28} />}
          title={t('workplace.spacePlanning.scenarios.empty')}
          description={t('workplace.spacePlanning.scenarios.emptyDescription')}
          action={
            canManage && !blocked ? (
              <ActionButton intent="primary" onClick={onCreate}>
                {t('workplace.spacePlanning.scenarios.create')}
              </ActionButton>
            ) : undefined
          }
        />
      ) : (
        <List disablePadding aria-label={t('workplace.spacePlanning.scenarios.title')}>
          {scenarios.map((scenario) => {
            const selected = scenario.scenarioId === selectedId;
            return (
              <ListItem key={scenario.scenarioId} disablePadding>
                <ListItemButton
                  selected={selected}
                  disabled={blocked}
                  aria-label={`${scenario.name} · ${t(
                    `workplace.spacePlanning.scenarioStates.${scenario.state}`
                  )} · ${t('workplace.spacePlanning.scenarios.version', {
                    value: scenario.version,
                  })}`}
                  onClick={() => onSelect(scenario.scenarioId)}
                  sx={{
                    py: 1.25,
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    alignItems: 'flex-start',
                  }}
                >
                  <Stack direction="row" gap={1} width="100%" minWidth={0}>
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 28,
                        height: 28,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: 1,
                        bgcolor: selected ? 'primary.main' : 'action.hover',
                        color: selected ? 'primary.contrastText' : 'text.secondary',
                        flex: '0 0 auto',
                      }}
                    >
                      {selected ? <Check size={15} /> : <GitCompareArrows size={15} />}
                    </Box>
                    <Box minWidth={0} flex={1}>
                      <Stack
                        direction="row"
                        gap={0.75}
                        justifyContent="space-between"
                        alignItems="flex-start"
                      >
                        <Typography
                          variant="body2"
                          fontWeight={750}
                          sx={{ overflowWrap: 'anywhere' }}
                        >
                          {scenario.name}
                        </Typography>
                        <Chip
                          size="small"
                          variant="outlined"
                          color={stateColor(scenario.state)}
                          label={t(`workplace.spacePlanning.scenarioStates.${scenario.state}`)}
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                        {t('workplace.spacePlanning.scenarios.version', {
                          value: scenario.version,
                        })}{' '}
                        ·{' '}
                        {formatDate(scenario.updatedAt, { dateStyle: 'medium', timeZone }, locale)}{' '}
                        · {timeZone}
                      </Typography>
                      {scenario.description ? (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {scenario.description}
                        </Typography>
                      ) : null}
                    </Box>
                  </Stack>
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      )}
    </Box>
  );
}
