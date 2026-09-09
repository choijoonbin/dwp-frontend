import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { ActionButton, FormField, SelectField } from '@dwp-frontend/design-system';
import { Search, Star, SlidersHorizontal } from 'lucide-react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import InputAdornment from '@mui/material/InputAdornment';

import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import type { WorkHubFilters } from './work-hub-model';

const scopes: readonly WorkHubFilters['scope'][] = [
  'ALL',
  'ACTIONABLE',
  'IN_PROGRESS',
  'WAITING',
  'COMPLETED',
];

export function WorkHubFilterControls({
  filters,
  sourceSystems,
  showAssignmentRoleFilter,
  resultCount,
  onChange,
  counts,
  sort = 'urgency',
  density = 'comfortable',
}: {
  filters: WorkHubFilters;
  sourceSystems: readonly string[];
  showAssignmentRoleFilter: boolean;
  resultCount: number;
  onChange: (values: Record<string, string | null>) => void;
  counts?: Partial<Record<WorkHubFilters['scope'], number>>;
  sort?: string;
  density?: string;
}) {
  const { t } = useTranslation('work');
  const [expanded, setExpanded] = useState(false);
  const activeFilters = [
    ...(filters.sourceSystem
      ? [
          {
            key: 'source',
            label: t(`workHub.sources.${filters.sourceSystem}`, {
              defaultValue: t('workHub.sources.OTHER'),
            }),
            onRemove: () => onChange({ source: null }),
          },
        ]
      : []),
    ...(filters.urgency
      ? [
          {
            key: 'urgency',
            label: t(`workHub.urgency.${filters.urgency}`),
            onRemove: () => onChange({ urgency: null }),
          },
        ]
      : []),
    ...(showAssignmentRoleFilter && filters.assignmentRole
      ? [
          {
            key: 'assignmentRole',
            label: t(`workHub.assignment.filters.${filters.assignmentRole}`),
            onRemove: () => onChange({ assignmentRole: null }),
          },
        ]
      : []),
  ];

  return (
    <Paper
      component="section"
      aria-label={t('workHub.filters.label')}
      variant="outlined"
      sx={{ p: 1.25, borderRadius: (theme) => `${theme.shape.borderRadius}px` }}
    >
      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
        <FormField
          size="small"
          label={t('workHub.filters.searchLabel')}
          placeholder={t('workHub.filters.searchPlaceholder')}
          value={filters.query}
          onChange={(event) => onChange({ q: event.target.value || null })}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={17} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ flex: '1 1 190px', minWidth: 160 }}
        />
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filters.scope}
          onChange={(_event, value: WorkHubFilters['scope'] | null) =>
            value && onChange({ scope: value })
          }
          aria-label={t('workHub.filters.scopeLabel')}
          sx={{
            flexWrap: { xs: 'nowrap', md: 'wrap' },
            maxWidth: 1,
            overflowX: 'auto',
            flex: { xs: '1 1 100%', md: '0 1 auto' },
            '& .MuiToggleButton-root': {
              border: 0,
              borderRadius: (theme) => `${theme.shape.borderRadius}px`,
              minHeight: 44,
              px: 1.25,
              whiteSpace: 'nowrap',
            },
          }}
        >
          {scopes.map((scope) => (
            <ToggleButton key={scope} value={scope}>
              {t(`workHub.scopes.${scope}`)}
              {counts?.[scope] !== undefined && ` (${counts[scope]})`}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <ActionButton
          size="small"
          intent={filters.scope === 'TODAY' ? 'primary' : 'secondary'}
          startIcon={<Star size={16} />}
          onClick={() => onChange({ scope: 'TODAY' })}
          sx={{ '@media (max-width:899.95px)': { minHeight: 44 } }}
        >
          {t('workHub.scopes.TODAY')}
          {counts?.TODAY !== undefined && ` (${counts.TODAY})`}
        </ActionButton>
        <ActionButton
          intent="quiet"
          size="small"
          startIcon={<SlidersHorizontal size={16} />}
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          sx={{ '@media (max-width:899.95px)': { minHeight: 44 } }}
        >
          {t('workHub.filters.refine')}
          {activeFilters.length > 0 && ` (${activeFilters.length})`}
        </ActionButton>
      </Stack>
      <Stack
        direction="row"
        gap={1}
        alignItems="center"
        flexWrap="wrap"
        sx={{ mt: 1, display: expanded ? 'flex' : 'none' }}
      >
        <SelectField
          size="small"
          label={t('workHub.filters.sourceLabel')}
          value={filters.sourceSystem ?? 'ALL'}
          options={[
            { value: 'ALL', label: t('workHub.filters.allSources') },
            ...sourceSystems.map((source) => ({
              value: source,
              label: t(`workHub.sources.${source}`, {
                defaultValue: t('workHub.sources.OTHER'),
              }),
            })),
          ]}
          onValueChange={(value) => onChange({ source: value === 'ALL' ? null : String(value) })}
          sx={{ minWidth: 130, flex: { xs: '1 1 130px', sm: '0 1 160px' } }}
        />
        {showAssignmentRoleFilter && (
          <SelectField
            size="small"
            label={t('workHub.assignment.filters.label')}
            value={filters.assignmentRole ?? 'ALL'}
            options={['ALL', 'ASSIGNEE', 'REQUESTER'].map((value) => ({
              value,
              label: t(`workHub.assignment.filters.${value}`),
            }))}
            onValueChange={(value) =>
              onChange({ assignmentRole: value === 'ALL' ? null : String(value) })
            }
            sx={{ minWidth: 140, flex: { xs: '1 1 140px', sm: '0 1 180px' } }}
          />
        )}
        <SelectField
          size="small"
          label={t('workHub.filters.urgencyLabel')}
          value={filters.urgency ?? 'ALL'}
          options={[
            { value: 'ALL', label: t('workHub.filters.allUrgencies') },
            ...(['OVERDUE', 'DUE_SOON', 'SCHEDULED', 'NO_DUE_DATE'] as const).map((urgency) => ({
              value: urgency,
              label: t(`workHub.urgency.${urgency}`),
            })),
          ]}
          onValueChange={(value) => onChange({ urgency: value === 'ALL' ? null : String(value) })}
          sx={{ minWidth: 130, flex: { xs: '1 1 130px', sm: '0 1 160px' } }}
        />
        <SelectField
          size="small"
          label={t('workHub.filters.sort')}
          value={sort}
          options={['urgency', 'due', 'updated', 'title'].map((value) => ({
            value,
            label: t(`workHub.filters.sortOptions.${value}`),
          }))}
          onValueChange={(value) => onChange({ sort: String(value) })}
          sx={{ minWidth: 140, flex: { xs: '1 1 140px', sm: '0 1 190px' } }}
        />
        <SelectField
          size="small"
          label={t('workHub.filters.density')}
          value={density}
          options={['comfortable', 'compact'].map((value) => ({
            value,
            label: t(`workHub.filters.densityOptions.${value}`),
          }))}
          onValueChange={(value) => onChange({ density: String(value) })}
          sx={{ minWidth: 115, flex: { xs: '1 1 115px', sm: '0 1 130px' } }}
        />
        <Box sx={{ flex: 1 }} />
        <Box
          component="span"
          role="status"
          sx={{ fontSize: 'caption.fontSize', color: 'text.secondary' }}
        >
          {t('workHub.filters.results', { count: resultCount })}
        </Box>
        {(activeFilters.length > 0 || filters.query) && (
          <ActionButton
            size="small"
            intent="quiet"
            onClick={() => onChange({ q: null, source: null, urgency: null, assignmentRole: null })}
            sx={{ '@media (max-width:899.95px)': { minHeight: 44 } }}
          >
            {t('workHub.filters.reset')}
          </ActionButton>
        )}
      </Stack>
    </Paper>
  );
}
