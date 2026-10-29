import { useTranslation } from 'react-i18next';
import { Accessibility, Bell, Eye, Keyboard, MessageSquareText, Palette } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  getMessagingDisplayPreference,
  updateMessagingDisplayPreference,
  useToast,
} from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  ErrorState,
  foundationTokens,
  LoadingState,
  PageCanvas,
  useAppearance,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import { MessagingPageHeading } from './messaging-components';
import { MESSAGING_DISPLAY_QUERY_KEY } from './messaging-display-model';
import { MessagingPrivacyPanel } from './messaging-privacy-panel';
import { usePersonalPreference } from '../../providers/personal-preference-provider';

import type {
  MessagingDisplayDensity,
  MessagingDisplayLayout,
  MessagingDisplayPreference,
  MessagingDisplayTheme,
} from '@dwp-frontend/shared-utils';
import type { ReactNode } from 'react';

export function MessagingSettings() {
  const { t } = useTranslation('messaging');
  const navigate = useNavigate();

  return (
    <PageCanvas topInset="compact">
      <MessagingPageHeading
        eyebrow={t('settingsPage.eyebrow')}
        title={t('settingsPage.title')}
        description={t('settingsPage.description')}
      />
      <Box
        sx={{
          mt: 2.5,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1.35fr) minmax(320px, 1fr)' },
          alignItems: 'start',
          gap: 2,
        }}
      >
        <Stack spacing={2}>
          <SettingsSection
            icon={<Palette size={18} aria-hidden="true" />}
            title={t('settingsPage.appearance.title')}
            description={t('settingsPage.appearance.description')}
          >
            <MessagingGlobalAppearanceSettings />
          </SettingsSection>
          <SettingsSection
            icon={<Accessibility size={18} aria-hidden="true" />}
            title={t('settingsPage.accessibility.title')}
            description={t('settingsPage.accessibility.description')}
          >
            <MessagingAccessibilitySettings />
          </SettingsSection>
          <SettingsSection
            icon={<Keyboard size={18} aria-hidden="true" />}
            title={t('settingsPage.shortcuts.title')}
            description={t('settingsPage.shortcuts.description')}
          >
            <ShortcutList />
          </SettingsSection>
        </Stack>
        <Stack spacing={2}>
          <SettingsSection
            icon={<Bell size={18} aria-hidden="true" />}
            title={t('settingsPage.notifications.title')}
            description={t('settingsPage.notifications.description')}
          >
            <Stack spacing={1.25}>
              <Typography variant="body2" color="text.secondary">
                {t('settingsPage.notifications.globalDescription')}
              </Typography>
              <ActionButton
                intent="secondary"
                startIcon={<Bell size={16} aria-hidden="true" />}
                onClick={() => navigate('/notifications/settings')}
              >
                {t('settingsPage.notifications.manageGlobal')}
              </ActionButton>
              <Typography variant="caption" color="text.secondary">
                {t('settingsPage.notifications.perConversation')}
              </Typography>
            </Stack>
          </SettingsSection>
          <SettingsSection
            icon={<Eye size={18} aria-hidden="true" />}
            title={t('settingsPage.privacy.title')}
            description={t('settingsPage.privacy.description')}
          >
            <MessagingPrivacyPanel />
          </SettingsSection>
          <SettingsSection
            icon={<MessageSquareText size={18} aria-hidden="true" />}
            title={t('settingsPage.presence.title')}
            description={t('settingsPage.presence.description')}
          >
            <Box component="p" sx={{ m: 0, typography: 'body2', color: 'text.secondary' }}>
              {t('settingsPage.presence.currentContract')}
            </Box>
          </SettingsSection>
        </Stack>
      </Box>
    </PageCanvas>
  );
}

function SettingsSection({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.surface + 'px',
        bgcolor: 'background.paper',
        p: { xs: 1.5, sm: 2 },
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Box sx={{ color: 'primary.main', display: 'flex', pt: 0.2 }}>{icon}</Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>
      </Stack>
      <Box sx={{ mt: 2 }}>{children}</Box>
    </Box>
  );
}

function MessagingGlobalAppearanceSettings() {
  const { t } = useTranslation('messaging');
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: MESSAGING_DISPLAY_QUERY_KEY,
    queryFn: getMessagingDisplayPreference,
    staleTime: 60_000,
    retry: 1,
  });
  const mutation = useMutation({
    mutationFn: updateMessagingDisplayPreference,
    onSuccess: (preference) => {
      queryClient.setQueryData(MESSAGING_DISPLAY_QUERY_KEY, preference);
      toast.success(t('conversation.display.saved'));
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: MESSAGING_DISPLAY_QUERY_KEY });
      toast.error(t('conversation.display.saveError'));
    },
  });

  if (query.isPending)
    return <LoadingState embedded label={t('common:labels.loading')} size="standard" />;
  if (query.isError || !query.data)
    return (
      <ErrorState
        size="compact"
        title={t('conversation.display.loadError')}
        retryLabel={t('actions.retry')}
        retrying={query.isFetching}
        onRetry={() => void query.refetch()}
      />
    );

  const preference = query.data;
  const update = (changes: Partial<MessagingDisplayPreference>) => {
    if (mutation.isPending) return;
    mutation.mutate({ ...preference, ...changes });
  };
  const allowedThemes = preference.policy.allowedThemes;

  return (
    <Stack spacing={2} aria-busy={mutation.isPending}>
      <PreferenceChoice
        label={t('conversation.display.layout')}
        value={preference.layoutMode}
        options={['AUTO', 'CONVERSATIONAL', 'COLLABORATIVE']}
        disabled={mutation.isPending}
        onChange={(layoutMode) => update({ layoutMode: layoutMode as MessagingDisplayLayout })}
      />
      <PreferenceChoice
        label={t('conversation.display.density')}
        value={preference.density}
        options={['COMFORTABLE', 'COMPACT']}
        disabled={mutation.isPending}
        onChange={(density) => update({ density: density as MessagingDisplayDensity })}
      />
      <PreferenceChoice
        label={t('conversation.display.theme')}
        value={preference.theme}
        options={allowedThemes}
        disabled={mutation.isPending}
        onChange={(theme) => update({ theme: theme as MessagingDisplayTheme })}
      />
      <Stack spacing={0.25}>
        <PreferenceSwitch
          label={t('conversation.display.showAvatars')}
          checked={preference.showAvatars}
          disabled={mutation.isPending}
          onChange={(showAvatars) => update({ showAvatars })}
        />
        <PreferenceSwitch
          label={t('conversation.display.alwaysTimestamps')}
          checked={preference.timestampMode === 'ALWAYS'}
          disabled={mutation.isPending}
          onChange={(always) => update({ timestampMode: always ? 'ALWAYS' : 'SMART' })}
        />
        <PreferenceSwitch
          label={t('conversation.display.messagePreview')}
          checked={preference.messagePreview}
          disabled={mutation.isPending}
          onChange={(messagePreview) => update({ messagePreview })}
        />
      </Stack>
    </Stack>
  );
}

function MessagingAccessibilitySettings() {
  const { t } = useTranslation('messaging');
  const appearance = useAppearance();
  const personalPreference = usePersonalPreference();

  if (personalPreference.isLoading) {
    return <LoadingState embedded label={t('settingsPage.accessibility.loading')} />;
  }
  if (personalPreference.loadFailed) {
    return (
      <ErrorState
        size="compact"
        title={t('settingsPage.accessibility.loadError')}
        retryLabel={t('actions.retry')}
        onRetry={personalPreference.retry}
      />
    );
  }

  return (
    <Stack spacing={1.25} aria-busy={personalPreference.isSaving}>
      <Box>
        <PreferenceSwitch
          label={t('settingsPage.accessibility.highContrast')}
          checked={appearance.preference.highContrast}
          disabled={personalPreference.isSaving || !appearance.policy.userControls.highContrast}
          onChange={(highContrast) =>
            personalPreference.update({ accessibility: { highContrast } })
          }
        />
        <Box component="p" sx={{ m: 0, typography: 'caption', color: 'text.secondary' }}>
          {t('settingsPage.accessibility.highContrastDescription')}
        </Box>
      </Box>
      <Box>
        <PreferenceSwitch
          label={t('settingsPage.accessibility.reduceMotion')}
          checked={appearance.preference.reduceMotion}
          disabled={personalPreference.isSaving || !appearance.policy.userControls.reduceMotion}
          onChange={(reduceMotion) =>
            personalPreference.update({ accessibility: { reduceMotion } })
          }
        />
        <Box component="p" sx={{ m: 0, typography: 'caption', color: 'text.secondary' }}>
          {t('settingsPage.accessibility.reduceMotionDescription')}
        </Box>
      </Box>
    </Stack>
  );
}

function PreferenceChoice({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation('messaging');
  return (
    <Box>
      <Typography variant="body2" fontWeight="fontWeightBold">
        {label}
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
          onChange={(_, value) => onChange(value)}
        />
      }
      sx={{ width: 1, m: 0, gap: 1.5, justifyContent: 'space-between' }}
    />
  );
}

function ShortcutList() {
  const { t } = useTranslation('messaging');
  const shortcuts = [
    ['⌘/Ctrl K', t('settingsPage.shortcuts.search')],
    ['/', t('settingsPage.shortcuts.filter')],
    ['Enter', t('settingsPage.shortcuts.send')],
    ['Shift Enter', t('settingsPage.shortcuts.newLine')],
  ];
  return (
    <Stack component="dl" spacing={1} sx={{ m: 0 }}>
      {shortcuts.map(([key, description]) => (
        <Stack
          key={key}
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={2}
        >
          <Typography component="dt" variant="body2" color="text.secondary">
            {description}
          </Typography>
          <Box
            component="dd"
            sx={{
              m: 0,
              px: 0.8,
              py: 0.35,
              border: 1,
              borderColor: 'divider',
              borderRadius: foundationTokens.radius.compact + 'px',
              bgcolor: 'action.hover',
              fontFamily: foundationTokens.font.mono,
              fontSize: 'caption.fontSize',
              whiteSpace: 'nowrap',
            }}
          >
            {key}
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}
