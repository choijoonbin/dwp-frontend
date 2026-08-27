import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { surfaceLabel } from './saved-view-custody-ui';

import type { SavedViewOwnershipNameConflict } from '@dwp-frontend/shared-utils';

export const SavedViewNameConflictNotice = forwardRef<
  HTMLDivElement,
  {
    conflicts?: SavedViewOwnershipNameConflict[];
    targetName?: string | null;
    savedViewName?: string | null;
    surfaceKey?: string | null;
    runtime?: boolean;
  }
>(function SavedViewNameConflictNotice(
  { conflicts = [], targetName, savedViewName, surfaceKey, runtime = false },
  ref
) {
  const { t } = useTranslation('admin');

  return (
    <Alert
      ref={ref}
      tabIndex={-1}
      severity="warning"
      aria-live="assertive"
      sx={{ '&:focus-visible': { outline: '3px solid', outlineColor: 'warning.main' } }}
    >
      <Stack gap={1}>
        <Typography variant="body2" fontWeight={700}>
          {runtime
            ? t('savedViewCustody.nameConflicts.runtimeTitle', { target: targetName ?? '-' })
            : t('savedViewCustody.nameConflicts.title', {
                count: conflicts.length,
                target: targetName ?? '-',
              })}
        </Typography>
        {(savedViewName || conflicts.length > 0) && (
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {runtime ? (
              <Typography component="li" variant="body2">
                {t('savedViewCustody.nameConflicts.runtimeItem', {
                  name: savedViewName,
                  surface: surfaceKey ? surfaceLabel(surfaceKey, t) : '-',
                })}
              </Typography>
            ) : (
              conflicts.map((conflict) => (
                <Typography component="li" variant="body2" key={conflict.incomingSavedViewId}>
                  {t('savedViewCustody.nameConflicts.item', {
                    incoming: conflict.incomingName,
                    existing: conflict.existingTargetName,
                    surface: surfaceLabel(conflict.surfaceKey, t),
                  })}
                </Typography>
              ))
            )}
          </Box>
        )}
        <Typography variant="body2">{t('savedViewCustody.nameConflicts.guidance')}</Typography>
      </Stack>
    </Alert>
  );
});
