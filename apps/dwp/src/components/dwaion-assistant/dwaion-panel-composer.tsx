import { ArrowUp, ShieldCheck, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionIconButton, FormField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { DwaionVoiceInputControl } from './dwaion-voice-controls';

type DwaionPanelComposerProps = {
  value: string;
  busy: boolean;
  enabled: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onSend: () => void;
  onCancel: () => void;
};

export function DwaionPanelComposer({
  value,
  busy,
  enabled,
  onChange,
  onSubmit,
  onSend,
  onCancel,
}: DwaionPanelComposerProps) {
  const { t, i18n } = useTranslation('home');

  return (
    <Box
      component="form"
      onSubmit={onSubmit}
      sx={{ px: 1.5, pt: 1.15, pb: 1.2, borderTop: 1, borderColor: 'divider', flex: '0 0 auto' }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto 44px',
          gap: 0.75,
          alignItems: 'end',
        }}
      >
        <FormField
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            const nativeEvent = event.nativeEvent as KeyboardEvent;
            if (event.key !== 'Enter' || event.shiftKey || nativeEvent.isComposing || busy) return;
            event.preventDefault();
            onSend();
          }}
          placeholder={
            enabled ? t('dwaion.composer.placeholder') : t('dwaion.composer.unavailable')
          }
          inputProps={{ 'aria-label': t('dwaion.composer.label'), maxLength: 4000 }}
          multiline
          maxRows={3}
          size="small"
          disabled={!enabled || busy}
          sx={{
            '& .MuiInputBase-root': { minHeight: 40, borderRadius: 1 },
            '& textarea': { lineHeight: 1.45 },
          }}
        />
        <DwaionVoiceInputControl
          namespace="home"
          locale={i18n.resolvedLanguage || i18n.language || 'en'}
          disabled={!enabled || busy}
          onTranscript={(text) => onChange([value.trim(), text].filter(Boolean).join(' '))}
        />
        <ActionIconButton
          label={busy ? t('dwaion.composer.cancel') : t('dwaion.composer.send')}
          intent="primary"
          type={busy ? 'button' : 'submit'}
          disabled={!busy && (!enabled || !value.trim())}
          onClick={busy ? onCancel : undefined}
          sx={{
            width: 44,
            height: 44,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': { bgcolor: 'primary.dark' },
          }}
        >
          {busy ? (
            <Square size={15} fill="currentColor" aria-hidden="true" />
          ) : (
            <ArrowUp size={18} aria-hidden="true" />
          )}
        </ActionIconButton>
      </Box>
      <Stack
        direction="row"
        alignItems="center"
        gap={0.55}
        sx={{ mt: 0.65, px: 0.25, color: 'text.secondary' }}
      >
        <ShieldCheck size={13} strokeWidth={1.8} aria-hidden="true" />
        <Typography variant="caption" sx={{ lineHeight: '15px' }}>
          {t('dwaion.governed')}
        </Typography>
      </Stack>
    </Box>
  );
}
