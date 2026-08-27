import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton } from '@dwp-frontend/design-system';
import {
  getMessagingConversationDisplayPreference,
  getMessagingDisplayPreference,
  resetMessagingConversationDisplayPreference,
  updateMessagingConversationDisplayPreference,
  updateMessagingDisplayPreference,
  useToast,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import {
  MESSAGING_DISPLAY_QUERY_KEY,
  messagingConversationDisplayQueryKey,
} from './messaging-display-model';

import type {
  MessagingConversation,
  MessagingConversationDisplayDensity,
  MessagingConversationDisplayLayout,
  MessagingConversationDisplayTheme,
  MessagingDisplayDensity,
  MessagingDisplayLayout,
  MessagingDisplayTheme,
  MessagingTimestampMode,
} from '@dwp-frontend/shared-utils';

const FALLBACK_THEMES: MessagingDisplayTheme[] = ['DEFAULT', 'MIST', 'SAGE', 'ROSE'];

export function MessagingDisplayPreferencePanel({
  conversation,
}: {
  conversation: MessagingConversation;
}) {
  const { t } = useTranslation('messaging');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<'CONVERSATION' | 'GLOBAL'>('CONVERSATION');
  const globalQuery = useQuery({
    queryKey: MESSAGING_DISPLAY_QUERY_KEY,
    queryFn: getMessagingDisplayPreference,
    staleTime: 60_000,
  });
  const conversationQuery = useQuery({
    queryKey: messagingConversationDisplayQueryKey(conversation.conversationId),
    queryFn: () => getMessagingConversationDisplayPreference(conversation.conversationId),
    staleTime: 60_000,
  });
  const globalMutation = useMutation({
    mutationFn: updateMessagingDisplayPreference,
    onSuccess: async (preference) => {
      queryClient.setQueryData(MESSAGING_DISPLAY_QUERY_KEY, preference);
      await queryClient.invalidateQueries({
        queryKey: messagingConversationDisplayQueryKey(conversation.conversationId),
      });
      toast.success(t('conversation.display.saved'));
    },
    onError: () => toast.error(t('conversation.display.saveError')),
  });
  const conversationMutation = useMutation({
    mutationFn: updateMessagingConversationDisplayPreference,
    onSuccess: (preference) => {
      queryClient.setQueryData(
        messagingConversationDisplayQueryKey(conversation.conversationId),
        preference
      );
      toast.success(t('conversation.display.saved'));
    },
    onError: () => toast.error(t('conversation.display.saveError')),
  });
  const resetMutation = useMutation({
    mutationFn: () =>
      resetMessagingConversationDisplayPreference(
        conversation.conversationId,
        conversationQuery.data?.version ?? 0
      ),
    onSuccess: (preference) => {
      queryClient.setQueryData(
        messagingConversationDisplayQueryKey(conversation.conversationId),
        preference
      );
      toast.success(t('conversation.display.resetSuccess'));
    },
    onError: () => toast.error(t('conversation.display.saveError')),
  });
  const loading = globalQuery.isLoading || conversationQuery.isLoading;
  const failed = globalQuery.isError || conversationQuery.isError;
  const busy =
    globalMutation.isPending || conversationMutation.isPending || resetMutation.isPending;
  const global = globalQuery.data;
  const local = conversationQuery.data;
  const allowedThemes = global?.policy.allowedThemes ?? FALLBACK_THEMES;
  const conversationLayoutLocked =
    scope === 'CONVERSATION' && local?.policyReason === 'STRUCTURED_CONVERSATION';
  const conversationThemeLocked =
    scope === 'CONVERSATION' && local?.policyReason === 'RESTRICTED_CONVERSATION';

  const updateGlobal = (
    changes: Partial<{
      layoutMode: MessagingDisplayLayout;
      density: MessagingDisplayDensity;
      theme: MessagingDisplayTheme;
      showAvatars: boolean;
      timestampMode: MessagingTimestampMode;
      messagePreview: boolean;
    }>
  ) => {
    if (!global || busy) return;
    globalMutation.mutate({ ...global, ...changes });
  };
  const updateConversation = (
    changes: Partial<{
      layoutMode: MessagingConversationDisplayLayout;
      density: MessagingConversationDisplayDensity;
      theme: MessagingConversationDisplayTheme;
    }>
  ) => {
    if (!local || busy) return;
    conversationMutation.mutate({
      conversationId: conversation.conversationId,
      layoutMode: changes.layoutMode ?? local.layoutMode,
      density: changes.density ?? local.density,
      theme: changes.theme ?? local.theme,
      version: local.version,
    });
  };

  return (
    <Stack spacing={1.5}>
      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        value={scope}
        onChange={(_, value: 'CONVERSATION' | 'GLOBAL' | null) => value && setScope(value)}
        aria-label={t('conversation.display.scopeLabel')}
      >
        <ToggleButton value="CONVERSATION">
          {t('conversation.display.scopeConversation')}
        </ToggleButton>
        <ToggleButton value="GLOBAL">{t('conversation.display.scopeGlobal')}</ToggleButton>
      </ToggleButtonGroup>

      {loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 180 }} aria-busy="true">
          <CircularProgress size={24} />
        </Box>
      ) : failed || !global || !local ? (
        <Alert severity="error">{t('conversation.display.loadError')}</Alert>
      ) : (
        <>
          {local.policyLocked && scope === 'CONVERSATION' ? (
            <Alert severity="info">
              {t(`conversation.display.policy.${local.policyReason ?? 'STRUCTURED_CONVERSATION'}`)}
            </Alert>
          ) : null}
          <DisplayChoice
            label={t('conversation.display.layout')}
            description={t('conversation.display.layoutDescription')}
            value={
              scope === 'GLOBAL'
                ? global.layoutMode
                : conversationLayoutLocked
                  ? local.effectiveLayoutMode
                  : local.layoutMode
            }
            options={
              scope === 'GLOBAL'
                ? (['AUTO', 'CONVERSATIONAL', 'COLLABORATIVE'] as const)
                : (['INHERIT', 'AUTO', 'CONVERSATIONAL', 'COLLABORATIVE'] as const)
            }
            disabled={busy || conversationLayoutLocked}
            onChange={(value) =>
              scope === 'GLOBAL'
                ? updateGlobal({ layoutMode: value as MessagingDisplayLayout })
                : updateConversation({ layoutMode: value as MessagingConversationDisplayLayout })
            }
          />
          <DisplayChoice
            label={t('conversation.display.density')}
            description={t('conversation.display.densityDescription')}
            value={scope === 'GLOBAL' ? global.density : local.density}
            options={
              scope === 'GLOBAL'
                ? (['COMFORTABLE', 'COMPACT'] as const)
                : (['INHERIT', 'COMFORTABLE', 'COMPACT'] as const)
            }
            disabled={busy}
            onChange={(value) =>
              scope === 'GLOBAL'
                ? updateGlobal({ density: value as MessagingDisplayDensity })
                : updateConversation({ density: value as MessagingConversationDisplayDensity })
            }
          />
          <Box>
            <Typography variant="body2" fontWeight={780}>
              {t('conversation.display.theme')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('conversation.display.themeDescription')}
            </Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={
                scope === 'GLOBAL'
                  ? global.theme
                  : conversationThemeLocked
                    ? local.effectiveTheme
                    : local.theme
              }
              disabled={busy || conversationThemeLocked}
              onChange={(_, value: MessagingConversationDisplayTheme | null) => {
                if (!value) return;
                if (scope === 'GLOBAL') updateGlobal({ theme: value as MessagingDisplayTheme });
                else updateConversation({ theme: value });
              }}
              aria-label={t('conversation.display.theme')}
              sx={{ mt: 0.75, flexWrap: 'wrap', '& .MuiToggleButton-root': { flex: '1 1 30%' } }}
            >
              {scope === 'CONVERSATION' ? (
                <ToggleButton value="INHERIT">
                  {t('conversation.display.values.INHERIT')}
                </ToggleButton>
              ) : null}
              {allowedThemes.map((theme) => (
                <ToggleButton key={theme} value={theme} sx={{ gap: 0.65 }}>
                  <ThemeSwatch themeKey={theme} />
                  {t(`conversation.display.values.${theme}`)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {scope === 'GLOBAL' ? (
            <Stack spacing={0.25}>
              <PreferenceSwitch
                label={t('conversation.display.showAvatars')}
                checked={global.showAvatars}
                disabled={busy}
                onChange={(showAvatars) => updateGlobal({ showAvatars })}
              />
              <PreferenceSwitch
                label={t('conversation.display.alwaysTimestamps')}
                checked={global.timestampMode === 'ALWAYS'}
                disabled={busy}
                onChange={(always) => updateGlobal({ timestampMode: always ? 'ALWAYS' : 'SMART' })}
              />
              <PreferenceSwitch
                label={t('conversation.display.messagePreview')}
                checked={global.messagePreview}
                disabled={busy}
                onChange={(messagePreview) => updateGlobal({ messagePreview })}
              />
            </Stack>
          ) : (
            <ActionButton
              intent="quiet"
              startIcon={<RotateCcw size={15} />}
              disabled={busy || local.version === 0}
              onClick={() => resetMutation.mutate()}
              sx={{ alignSelf: 'flex-start' }}
            >
              {t('conversation.display.reset')}
            </ActionButton>
          )}
        </>
      )}
    </Stack>
  );
}

function DisplayChoice({
  label,
  description,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  options: readonly string[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation('messaging');
  return (
    <Box>
      <Typography variant="body2" fontWeight={780}>
        {label}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {description}
      </Typography>
      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        value={value}
        disabled={disabled}
        onChange={(_, next: string | null) => next && onChange(next)}
        aria-label={label}
        sx={{ mt: 0.75, flexWrap: 'wrap', '& .MuiToggleButton-root': { flex: '1 1 30%' } }}
      >
        {options.map((option) => (
          <ToggleButton key={option} value={option}>
            {t(`conversation.display.values.${option}`)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}

function PreferenceSwitch({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <FormControlLabel
      label={label}
      labelPlacement="start"
      control={
        <Switch
          size="small"
          checked={checked}
          disabled={disabled}
          onChange={(_, next) => onChange(next)}
        />
      }
      sx={{ width: 1, m: 0, justifyContent: 'space-between', gap: 1 }}
    />
  );
}

function ThemeSwatch({ themeKey }: { themeKey: MessagingDisplayTheme }) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={(theme) => ({
        width: 14,
        height: 14,
        borderRadius: '50%',
        border: 1,
        borderColor: 'divider',
        bgcolor: {
          DEFAULT: theme.palette.background.default,
          MIST: alpha(theme.palette.info.main, 0.22),
          SAGE: alpha(theme.palette.success.main, 0.22),
          ROSE: alpha(theme.palette.error.main, 0.18),
        }[themeKey],
      })}
    />
  );
}
