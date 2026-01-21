// ----------------------------------------------------------------------

import { memo, useMemo } from 'react';
import { useCodesByResourceQuery, getSelectOptionsByGroup } from '@dwp-frontend/shared-utils';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import FormControlLabel from '@mui/material/FormControlLabel';

import type { ResourceFormState } from '../types';

// ----------------------------------------------------------------------

type TrackingConfigSectionProps = {
  formData: ResourceFormState;
  validationErrors: Record<string, string>;
  onFormChange: <K extends keyof ResourceFormState>(field: K, value: ResourceFormState[K]) => void;
};

/**
 * TrackingConfigSection: 이벤트 추적 설정 UI
 * - trackingEnabled 켜면 eventActions 필수 선택 유도
 * - trackingEnabled 끄면 eventActions 선택 비활성화
 */
export const TrackingConfigSection = memo(({
  formData,
  validationErrors,
  onFormChange,
}: TrackingConfigSectionProps) => {
  // Get event action codes from CodeUsage API
  const { data: codeMap, isLoading: codesLoading } = useCodesByResourceQuery('menu.admin.resources');
  const eventActionOptions = useMemo(() => {
    // Try UI_ACTION first, fallback to EVENT_TYPE
    const uiActions = getSelectOptionsByGroup(codeMap, 'UI_ACTION');
    if (uiActions.length > 0) return uiActions;
    return getSelectOptionsByGroup(codeMap, 'EVENT_TYPE');
  }, [codeMap]);

  const handleTrackingEnabledChange = (enabled: boolean) => {
    onFormChange('trackingEnabled', enabled);
    // If disabling tracking, clear event actions
    if (!enabled) {
      onFormChange('eventActions', []);
    }
  };

  return (
    <Stack spacing={2}>
      <FormControlLabel
        control={
          <Switch checked={formData.trackingEnabled} onChange={(e) => handleTrackingEnabledChange(e.target.checked)} />
        }
        label="이벤트 추적 활성화"
      />
      {formData.trackingEnabled && (
        <Autocomplete
          multiple
          options={eventActionOptions.map((opt) => opt.value)}
          getOptionLabel={(option) => eventActionOptions.find((opt) => opt.value === option)?.label || option}
          value={formData.eventActions}
          onChange={(_e, newValue) => onFormChange('eventActions', newValue)}
          disabled={codesLoading || eventActionOptions.length === 0}
          renderInput={(params) => (
            <TextField
              {...params}
              label="이벤트 액션 *"
              required={formData.trackingEnabled}
              error={!!validationErrors.eventActions}
              helperText={
                validationErrors.eventActions ||
                (codesLoading
                  ? '코드 로딩 중...'
                  : eventActionOptions.length === 0
                    ? '코드 매핑 필요 (UI_ACTION 또는 EVENT_TYPE)'
                    : '추적할 이벤트 액션을 선택하세요')
              }
            />
          )}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => {
              const label = eventActionOptions.find((opt) => opt.value === option)?.label || option;
              return <Chip label={label} {...getTagProps({ index })} key={option} size="small" />;
            })
          }
        />
      )}
    </Stack>
  );
});

TrackingConfigSection.displayName = 'TrackingConfigSection';
