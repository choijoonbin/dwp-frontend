import {
  ArrowUp,
  CalendarDays,
  FileCheck2,
  FileText,
  Gauge,
  ListChecks,
  Mail,
  PanelsTopLeft,
  ShieldCheck,
  Square,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionIconButton, FormField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { AskCitationSourceType } from '@dwp-frontend/shared-utils';
import type { LucideIcon } from 'lucide-react';

import { DwaionVoiceInputControl } from '../../components/dwaion-assistant/dwaion-voice-controls';

type DwaionWorkspaceComposerProps = {
  value: string;
  loading: boolean;
  autoFocus?: boolean;
  compact?: boolean;
  sourceScopes?: AskCitationSourceType[];
  availableSources?: AskCitationSourceType[];
  onToggleSource?: (source: AskCitationSourceType) => void;
  onCancel?: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

const SOURCE_ICONS: Record<AskCitationSourceType, LucideIcon> = {
  WORK_ITEM: PanelsTopLeft,
  MAIL: Mail,
  CALENDAR: CalendarDays,
  APPROVAL_TASK: ListChecks,
  APPROVAL_REQUEST: FileCheck2,
  APPROVAL_FORM: FileText,
  APPROVAL_OPERATION: Gauge,
};

export function DwaionWorkspaceComposer({
  value,
  loading,
  autoFocus,
  compact,
  sourceScopes = ['WORK_ITEM', 'MAIL', 'CALENDAR'],
  availableSources = ['WORK_ITEM', 'MAIL', 'CALENDAR'],
  onToggleSource,
  onCancel,
  onChange,
  onSubmit,
}: DwaionWorkspaceComposerProps) {
  const { t, i18n } = useTranslation('work');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!loading && value.trim()) onSubmit();
  };

  const keyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!loading && value.trim()) onSubmit();
  };

  return (
    <Box
      component="form"
      onSubmit={submit}
      data-testid="dwaion-workspace-composer"
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        px: { xs: 1.5, sm: 2 },
        pt: compact ? 1.25 : 1.75,
        pb: 1.25,
        boxShadow: compact
          ? '0 8px 20px rgba(19, 33, 68, 0.06)'
          : '0 18px 44px rgba(19, 33, 68, 0.09)',
        transition: (theme) =>
          theme.transitions.create(['border-color', 'box-shadow'], {
            duration: theme.transitions.duration.shorter,
          }),
        '&:focus-within': {
          borderColor: 'primary.main',
          boxShadow: '0 18px 44px rgba(35, 86, 214, 0.13)',
        },
      }}
    >
      <FormField
        autoFocus={autoFocus}
        fullWidth
        multiline
        minRows={compact ? 1 : 2}
        maxRows={5}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={keyDown}
        placeholder={t('askPage.composer.placeholder')}
        inputProps={{
          maxLength: 4000,
          'aria-label': t('askPage.questionLabel'),
        }}
        variant="standard"
        InputProps={{ disableUnderline: true }}
        sx={{
          '& .MuiInputBase-root': { alignItems: 'flex-start', fontSize: 15 },
          '& textarea': { lineHeight: 1.65 },
        }}
      />

      <Box
        sx={{
          mt: 1,
          pt: 1,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Stack direction="row" spacing={0.6} alignItems="center" sx={{ minWidth: 0 }}>
          <ShieldCheck size={15} color="currentColor" aria-hidden="true" />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: { xs: compact ? 'none' : 'block', sm: 'block' } }}
          >
            {t('askPage.composer.scope')}
          </Typography>
          {!compact && (
            <Stack direction="row" spacing={0.4} sx={{ display: { xs: 'none', md: 'flex' } }}>
              {availableSources.map((key) => {
                const Icon = SOURCE_ICONS[key];
                return (
                  <Chip
                    key={key}
                    icon={<Icon size={13} aria-hidden="true" />}
                    label={t(`askPage.sourceTypes.${key}`)}
                    size="small"
                    variant={sourceScopes.includes(key) ? 'filled' : 'outlined'}
                    color={sourceScopes.includes(key) ? 'primary' : 'default'}
                    clickable={Boolean(onToggleSource)}
                    onClick={() => onToggleSource?.(key)}
                    sx={{ height: 24, '& .MuiChip-label': { px: 0.75 } }}
                  />
                );
              })}
            </Stack>
          )}
        </Stack>

        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flex: '0 0 auto' }}>
          <DwaionVoiceInputControl
            namespace="work"
            locale={i18n.resolvedLanguage || i18n.language || 'en'}
            disabled={loading}
            onTranscript={(text) => onChange([value.trim(), text].filter(Boolean).join(' '))}
          />
          <ActionIconButton
            type={loading ? 'button' : 'submit'}
            label={loading ? t('askPage.composer.cancel') : t('askPage.composer.send')}
            tooltip={loading ? t('askPage.composer.cancel') : t('askPage.composer.sendHint')}
            intent="primary"
            disabled={!loading && !value.trim()}
            onClick={loading ? onCancel : undefined}
            sx={{ width: 44, height: 44, flex: '0 0 auto' }}
          >
            {loading ? (
              onCancel ? (
                <Square size={15} fill="currentColor" aria-hidden="true" />
              ) : (
                <CircularProgress size={17} color="inherit" aria-hidden="true" />
              )
            ) : (
              <ArrowUp size={18} strokeWidth={2} aria-hidden="true" />
            )}
          </ActionIconButton>
        </Stack>
      </Box>
    </Box>
  );
}
