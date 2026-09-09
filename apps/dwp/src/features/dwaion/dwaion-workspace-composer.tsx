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
import { formatNumber, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { questionCharacterCount, questionValidation } from './dwaion-composer-validation';
import { conversationCopy } from './dwaion-conversation-copy';
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
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const copy = conversationCopy(locale);
  const validation = questionValidation(value);
  const valid = validation === 'valid';
  const invalid = validation === 'short' || validation === 'long';
  const characterCount = questionCharacterCount(value);
  const feedback = (
    <>
      <span>
        {copy.questionCount}: {formatNumber(characterCount, undefined, locale)} /{' '}
        {formatNumber(4000, undefined, locale)}
      </span>
      {invalid && <span> · {validation === 'short' ? copy.questionShort : copy.questionLong}</span>}
    </>
  );
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
        sx={{
          minHeight: compact ? 32 : 44,
          height: 'auto',
          maxWidth: '100%',
          '& .MuiChip-label': { px: 0.75, py: 0.5, whiteSpace: 'normal' },
        }}
      />
    );
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!loading && valid) onSubmit();
  };

  const keyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!loading && valid) onSubmit();
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
        px: { xs: compact ? 1 : 1.5, sm: 2 },
        pt: compact ? 0.75 : 1.75,
        pb: compact ? 0.75 : 1.25,
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
        '@media (forced-colors: active)': {
          borderColor: 'CanvasText',
          boxShadow: 'none',
        },
      }}
    >
      {compact && (
        <Stack
          direction="row"
          gap={0.5}
          useFlexGap
          sx={{
            display: { xs: 'flex', md: 'none' },
            mb: 0.5,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {sourceControls}
        </Stack>
      )}
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
        errorMessage={invalid ? feedback : undefined}
        supportingText={feedback}
        inputProps={{
          'aria-label': t('askPage.questionLabel'),
        }}
        variant="standard"
        InputProps={{ disableUnderline: true }}
        sx={{
          '& .MuiInputBase-root': { alignItems: 'flex-start', fontSize: 15 },
          '& textarea': { lineHeight: 1.55 },
          '& .MuiFormHelperText-root': {
            display: { xs: compact ? 'none' : 'block', sm: 'block' },
          },
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
          mt: compact ? 0.25 : 1,
          pt: compact ? 0.5 : 1,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Stack
          direction="row"
          spacing={0.6}
          useFlexGap
          flexWrap="wrap"
          alignItems="center"
          sx={{ minWidth: 0 }}
        >
          <ShieldCheck size={15} color="currentColor" aria-hidden="true" />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: { xs: compact ? 'none' : 'block', sm: 'block' } }}
          >
            {t('askPage.composer.scope')}
          </Typography>
          {!compact && (
            <Stack
              direction="row"
              gap={0.5}
              flexWrap="wrap"
              sx={{ display: { xs: 'none', md: 'flex' }, minWidth: 0 }}
            >
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
            disabled={!loading && !valid}
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
