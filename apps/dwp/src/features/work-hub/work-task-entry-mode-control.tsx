import { FilePenLine, Link2, ListPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

export type WorkTaskEntryMode = 'new' | 'source' | 'edit';

const MODES = [
  { value: 'new', icon: ListPlus },
  { value: 'source', icon: Link2 },
  { value: 'edit', icon: FilePenLine },
] as const;

export function WorkTaskEntryModeControl({
  value,
  sourceIntent,
  disabled = false,
  onChange,
}: {
  value: WorkTaskEntryMode;
  sourceIntent: boolean;
  disabled?: boolean;
  onChange: (mode: Extract<WorkTaskEntryMode, 'new' | 'source'>) => void;
}) {
  const { t } = useTranslation('work');

  return (
    <ToggleButtonGroup
      exclusive
      fullWidth
      value={value}
      aria-label={t('workHub.taskForm.entryMode.label')}
      onChange={(_event, next: WorkTaskEntryMode | null) => {
        if (next === 'new' || next === 'source') onChange(next);
      }}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
        gap: 0.5,
        p: 0.5,
        bgcolor: 'action.hover',
        borderRadius: 2,
        '& .MuiToggleButtonGroup-grouped': {
          m: 0,
          border: 0,
          borderRadius: '8px !important',
        },
      }}
    >
      {MODES.map(({ value: option, icon: Icon }) => {
        const unavailable =
          disabled ||
          (value === 'edit'
            ? option !== 'edit'
            : option === 'edit' || (option === 'source' && !sourceIntent));
        return (
          <ToggleButton
            key={option}
            value={option}
            disabled={unavailable}
            data-testid={`work-task-entry-mode-${option}`}
            sx={{
              minWidth: 0,
              minHeight: 44,
              px: 1,
              py: 0.75,
              justifyContent: 'center',
              textTransform: 'none',
              '&.Mui-selected': {
                bgcolor: 'background.paper',
                color: 'text.primary',
                boxShadow: 1,
              },
            }}
          >
            <Stack direction="row" spacing={0.75} alignItems="center" minWidth={0}>
              <Icon size={16} aria-hidden="true" />
              <Box component="span" sx={{ overflowWrap: 'anywhere', lineHeight: 1.25 }}>
                {t(`workHub.taskForm.entryMode.${option}`)}
              </Box>
              {option === 'source' && sourceIntent ? (
                <Box
                  component="span"
                  aria-hidden="true"
                  sx={{
                    width: 6,
                    height: 6,
                    flex: '0 0 auto',
                    borderRadius: '50%',
                    bgcolor: 'success.main',
                  }}
                />
              ) : null}
            </Stack>
          </ToggleButton>
        );
      })}
    </ToggleButtonGroup>
  );
}
