import { useTranslation } from 'react-i18next';
import { FilterBar, SelectField } from '@dwp-frontend/design-system';

import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import type { WorkHubFilters } from './work-hub-model';

const scopes: readonly WorkHubFilters['scope'][] = [
  'ACTIONABLE',
  'ALL',
  'TODAY',
  'WAITING',
  'COMPLETED',
];

export function WorkHubFilterControls({
  filters,
  sourceSystems,
  resultCount,
  onChange,
}: {
  filters: WorkHubFilters;
  sourceSystems: readonly string[];
  resultCount: number;
  onChange: (values: Record<string, string | null>) => void;
}) {
  const { t } = useTranslation('work');
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
  ];

  return (
    <FilterBar
      ariaLabel={t('workHub.filters.label')}
      searchLabel={t('workHub.filters.searchLabel')}
      searchPlaceholder={t('workHub.filters.searchPlaceholder')}
      searchValue={filters.query}
      onSearchChange={(value) => onChange({ q: value || null })}
      filters={
        <>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={filters.scope}
            onChange={(_event, value: WorkHubFilters['scope'] | null) =>
              value && onChange({ scope: value === 'ACTIONABLE' ? null : value })
            }
            aria-label={t('workHub.filters.scopeLabel')}
            sx={{ flexWrap: 'wrap' }}
          >
            {scopes.map((scope) => (
              <ToggleButton key={scope} value={scope}>
                {t(`workHub.scopes.${scope}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
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
            sx={{ minWidth: 150, width: { xs: 1, sm: 'auto' } }}
          />
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
            sx={{ minWidth: 150, width: { xs: 1, sm: 'auto' } }}
          />
        </>
      }
      activeFilters={activeFilters}
      resetLabel={t('workHub.filters.reset')}
      onReset={() => onChange({ q: null, scope: null, source: null, urgency: null })}
      resultLabel={t('workHub.filters.results', { count: resultCount })}
    />
  );
}
