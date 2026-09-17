import { useTranslation } from 'react-i18next';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  PersonalPreferenceConflict,
  PersonalPreferenceConflictChoice,
} from './personal-preference-conflict';

const conflictFieldTranslationKeys: Record<string, string> = {
  'appearance.mode': 'settings.colorMode.title',
  'appearance.density': 'settings.density.title',
  'accessibility.highContrast': 'settings.highContrast.title',
  'accessibility.reduceMotion': 'settings.reduceMotion.title',
  'accessibility.underlineLinks': 'settings.underlineLinks.title',
  'accessibility.reduceTransparency': 'settings.reduceTransparency.title',
  'regional.timeZone': 'settings.timeZone.title',
  'regional.dateFormat': 'settings.dateFormat.title',
  'regional.timeFormat': 'settings.timeFormat.title',
  'regional.firstDayOfWeek': 'settings.firstDayOfWeek.title',
  'regional.numberFormat': 'settings.numberFormat.title',
};

export function PersonalPreferenceConflictDialog({
  conflict,
  choices,
  onChoice,
  onResolve,
}: {
  conflict: { conflicts: PersonalPreferenceConflict[] } | null;
  choices: Readonly<Record<string, PersonalPreferenceConflictChoice>>;
  onChoice: (path: string, choice: PersonalPreferenceConflictChoice) => void;
  onResolve: (choices: Readonly<Record<string, PersonalPreferenceConflictChoice>>) => void;
}) {
  const { t } = useTranslation('account');

  const valueLabel = (path: string, value: unknown) => {
    if (value === undefined || value === null)
      return t('personalPreferences.conflict.valueMissing');
    if (typeof value === 'boolean') {
      return t(
        value
          ? 'personalPreferences.conflict.valueEnabled'
          : 'personalPreferences.conflict.valueDisabled'
      );
    }
    if (typeof value !== 'string') return JSON.stringify(value);
    if (path === 'appearance.mode') return t(`options.colorMode.${value}`);
    if (path === 'appearance.density') return t(`options.density.${value}`);
    if (path === 'regional.timeZone') return t(`options.timeZone.${value.replace(/\//g, '_')}`);
    if (path === 'regional.dateFormat') return t(`options.dateFormat.${value}`);
    if (path === 'regional.timeFormat') return t(`options.timeFormat.${value}`);
    if (path === 'regional.firstDayOfWeek') return t(`options.firstDayOfWeek.${value}`);
    if (path === 'regional.numberFormat') return t(`options.numberFormat.${value}`);
    return value;
  };

  return (
    <Dialog
      open={Boolean(conflict)}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
      aria-labelledby="personal-preference-conflict-title"
    >
      <DialogTitle id="personal-preference-conflict-title">
        {t('personalPreferences.conflict.title')}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          {t('personalPreferences.conflict.description')}
        </Typography>
        <Stack gap={1.5} sx={{ mt: 2 }}>
          {(conflict?.conflicts ?? []).map((item) => (
            <Box
              key={item.path}
              component="section"
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}
            >
              <Typography component="h3" variant="subtitle2">
                {t(conflictFieldTranslationKeys[item.path] ?? item.path)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('personalPreferences.conflict.previousValue', {
                  value: valueLabel(item.path, item.baseValue),
                })}
              </Typography>
              <RadioGroup
                value={choices[item.path] ?? 'local'}
                onChange={(_, value) =>
                  onChoice(item.path, value as PersonalPreferenceConflictChoice)
                }
                aria-label={t('personalPreferences.conflict.fieldChoice', {
                  field: t(conflictFieldTranslationKeys[item.path] ?? item.path),
                })}
                sx={{ mt: 1 }}
              >
                <FormControlLabel
                  value="local"
                  control={<Radio size="small" />}
                  label={t('personalPreferences.conflict.keepMine', {
                    value: valueLabel(item.path, item.localValue),
                  })}
                />
                <FormControlLabel
                  value="remote"
                  control={<Radio size="small" />}
                  label={t('personalPreferences.conflict.useLatest', {
                    value: valueLabel(item.path, item.remoteValue),
                  })}
                />
              </RadioGroup>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, flexWrap: 'wrap' }}>
        <ActionButton
          intent="secondary"
          onClick={() =>
            onResolve(
              Object.fromEntries(
                (conflict?.conflicts ?? []).map((item) => [item.path, 'remote' as const])
              )
            )
          }
        >
          {t('personalPreferences.conflict.useLatestAll')}
        </ActionButton>
        <ActionButton intent="primary" onClick={() => onResolve(choices)}>
          {t('personalPreferences.conflict.saveChoices')}
        </ActionButton>
      </DialogActions>
    </Dialog>
  );
}
