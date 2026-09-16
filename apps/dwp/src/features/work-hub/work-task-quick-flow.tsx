import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export function WorkTaskQuickFlow({
  taskEntryActive,
  planReady,
  scheduling,
}: {
  taskEntryActive: boolean;
  planReady: boolean;
  scheduling: boolean;
}) {
  const { t } = useTranslation('work');
  const currentStep = scheduling ? 4 : planReady ? 3 : taskEntryActive ? 2 : 1;

  return (
    <Box
      component="ol"
      aria-label={t('workHub.taskForm.quickFlow.label')}
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 0.5,
        listStyle: 'none',
        m: 0,
        p: 0,
      }}
    >
      {(['queue', 'add', 'plan', 'schedule'] as const).map((step, index) => {
        const position = index + 1;
        return (
          <Box
            component="li"
            key={step}
            aria-current={position === currentStep ? 'step' : undefined}
            sx={{
              minWidth: 0,
              px: 0.5,
              py: 0.75,
              borderRadius: (theme) => `${theme.shape.borderRadius}px`,
              bgcolor: position === currentStep ? 'primary.main' : 'action.selected',
              color: position === currentStep ? 'primary.contrastText' : 'text.secondary',
              textAlign: 'center',
            }}
          >
            <Typography
              component="span"
              variant="caption"
              sx={{ display: 'block', fontWeight: 'fontWeightBold', overflowWrap: 'anywhere' }}
            >
              {t(`workHub.taskForm.quickFlow.steps.${step}`, { number: position })}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
