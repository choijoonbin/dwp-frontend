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
  presentation?: 'workspace' | 'home';
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
  presentation = 'workspace',
  sourceScopes = ['WORK_ITEM', 'MAIL', 'CALENDAR'],
  availableSources = ['WORK_ITEM', 'MAIL', 'CALENDAR'],
  onToggleSource,
  onCancel,
  onChange,
  onSubmit,
}: DwaionWorkspaceComposerProps) {
  const { t, i18n } = useTranslation('work');
  const home = presentation === 'home';
  const sourceControls = availableSources.map((key) => {
    const Icon = SOURCE_ICONS[key];
    const selected = sourceScopes.includes(key);
    return (
      <Chip
        key={key}
        icon={<Icon size={13} aria-hidden="true" />}
        label={t(`askPage.sourceTypes.${key}`)}
        size="small"
        variant={selected && !home ? 'filled' : 'outlined'}
        color={selected ? 'primary' : 'default'}
        clickable={Boolean(onToggleSource)}
        aria-pressed={onToggleSource ? selected : undefined}
        disabled={Boolean(onToggleSource) && selected && sourceScopes.length === 1}
        onClick={() => onToggleSource?.(key)}
        sx={{ height: { xs: 32, md: 24 }, '& .MuiChip-label': { px: 0.75 } }}
      />
    );
  });

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
        borderColor: home ? 'primary.light' : 'divider',
        borderRadius: home ? 1.5 : 1,
        px: { xs: 1.5, sm: 2 },
        pt: compact ? 1.25 : 1.75,
        pb: 1.25,
        boxShadow: (theme) => theme.shadows[home ? 1 : compact ? 1 : 2],
        transition: (theme) =>
          theme.transitions.create(['border-color', 'box-shadow'], {
            duration: theme.transitions.duration.shorter,
          }),
        '&:focus-within': {
          borderColor: 'primary.main',
          boxShadow: (theme) => theme.shadows[2],
        },
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        '@media (forced-colors: active)': { borderColor: 'CanvasText', boxShadow: 'none' },
      }}
    >
      <FormField
        autoFocus={autoFocus}
        fullWidth
        multiline
        minRows={compact ? 1 : home ? 3 : 2}
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

      {!compact && (
        <Stack
          direction="row"
          gap={0.75}
          useFlexGap
          flexWrap="wrap"
          sx={{ mt: 1.5, display: { xs: 'flex', md: 'none' } }}
        >
          {sourceControls}
        </Stack>
      )}
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
              {sourceControls}
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
