import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, CalendarDays, Clock3, SunMedium } from 'lucide-react';
import { ActionButton, DateTimePickerField, FormDialog } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import {
  isValidMailSnoozeTime,
  resolveMailSnoozePreset,
  type MailSnoozePreset,
} from './mail-snooze-model';

import type { LucideIcon } from 'lucide-react';

const PRESETS: ReadonlyArray<{
  id: Exclude<MailSnoozePreset, 'CUSTOM'>;
  icon: LucideIcon;
}> = [
  { id: 'LATER_TODAY', icon: SunMedium },
  { id: 'TOMORROW', icon: CalendarClock },
  { id: 'NEXT_WEEK', icon: CalendarDays },
];

export function MailSnoozeDialog({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (until: string) => void | Promise<void>;
}) {
  const { t, i18n } = useTranslation('mail');
  const [preset, setPreset] = useState<MailSnoozePreset>('LATER_TODAY');
  const [until, setUntil] = useState<string | null>(null);
  const [openedAt, setOpenedAt] = useState(() => new Date());

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    const laterToday = resolveMailSnoozePreset('LATER_TODAY', now);
    const initialPreset = laterToday ? 'LATER_TODAY' : 'TOMORROW';
    setOpenedAt(now);
    setPreset(initialPreset);
    setUntil(laterToday ?? resolveMailSnoozePreset('TOMORROW', now));
  }, [open]);

  const valid = isValidMailSnoozeTime(until, openedAt);
  const formattedUntil = useMemo(() => {
    if (!valid || !until) return null;
    return formatDate(
      until,
      { dateStyle: 'medium', timeStyle: 'short' },
      resolveSupportedLocale(i18n.resolvedLanguage, i18n.language)
    );
  }, [i18n.language, i18n.resolvedLanguage, until, valid]);

  const selectPreset = (nextPreset: MailSnoozePreset) => {
    setPreset(nextPreset);
    if (nextPreset !== 'CUSTOM') {
      setUntil(resolveMailSnoozePreset(nextPreset, openedAt));
    }
  };

  return (
    <FormDialog
      open={open}
      title={t('snoozeDialog.title')}
      description={t('snoozeDialog.description')}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('snoozeDialog.submit')}
      submittingLabel={t('snoozeDialog.submitting')}
      busy={busy}
      submitDisabled={!valid}
      mobileFullScreen
      onClose={onClose}
      onSubmit={() => {
        if (valid && until) return onSubmit(until);
      }}
    >
      <Box
        role="group"
        aria-label={t('snoozeDialog.presetsLabel')}
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: 1,
        }}
      >
        {PRESETS.map((item) => {
          const Icon = item.icon;
          const presetValue = resolveMailSnoozePreset(item.id, openedAt);
          return (
            <ActionButton
              key={item.id}
              intent={preset === item.id ? 'primary' : 'secondary'}
              startIcon={<Icon size={16} />}
              aria-pressed={preset === item.id}
              disabled={!presetValue}
              onClick={() => selectPreset(item.id)}
              sx={{ justifyContent: 'flex-start', minWidth: 0 }}
            >
              {t(`snoozeDialog.presets.${item.id}`)}
            </ActionButton>
          );
        })}
      </Box>

      <Box sx={{ mt: 2 }}>
        <DateTimePickerField
          label={t('snoozeDialog.custom')}
          value={until}
          onValueChange={(value) => {
            setPreset('CUSTOM');
            setUntil(value);
          }}
          errorMessage={until && !valid ? t('snoozeDialog.futureRequired') : undefined}
          supportingText={!until ? t('snoozeDialog.customHelp') : undefined}
        />
      </Box>

      {formattedUntil && (
        <Alert severity="info" icon={<Clock3 size={18} />} sx={{ mt: 2 }}>
          <Typography variant="body2">
            {t('snoozeDialog.summary', { value: formattedUntil })}
          </Typography>
        </Alert>
      )}
    </FormDialog>
  );
}
