import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Palette, Pin, Settings2, ShieldCheck, SlidersHorizontal, Star } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionIconButton, FormDialog, SelectField } from '@dwp-frontend/design-system';
import {
  getMessagingConversationSettings,
  MESSAGING_API_CAPABILITIES,
  updateMessagingConversationSettings,
  useToast,
} from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import { MessagingDisplayPreferencePanel } from './messaging-display-preference-panel';
import { MessagingPrivacyPanel } from './messaging-privacy-panel';

import type {
  MessagingConversation,
  MessagingConversationSettings as ConversationSettings,
  MessagingMember,
} from '@dwp-frontend/shared-utils';

export function MessagingConversationSettings({
  conversation,
  currentMember,
}: {
  conversation: MessagingConversation;
  currentMember?: MessagingMember;
}) {
  const { t } = useTranslation('messaging');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<'GENERAL' | 'DISPLAY' | 'PRIVACY'>('GENERAL');
  const preferencesAvailable = MESSAGING_API_CAPABILITIES.conversationPreferences;
  const settingsQuery = useQuery({
    queryKey: ['messaging', 'conversation-settings', conversation.conversationId],
    queryFn: () => getMessagingConversationSettings(conversation.conversationId),
    enabled: open && preferencesAvailable,
    staleTime: 30_000,
    retry: 1,
  });
  const updateMutation = useMutation({
    mutationFn: updateMessagingConversationSettings,
    onSuccess: async (settings) => {
      queryClient.setQueryData(
        ['messaging', 'conversation-settings', conversation.conversationId],
        settings
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['messaging', 'conversation', conversation.conversationId],
        }),
        queryClient.invalidateQueries({ queryKey: ['messaging', 'conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['messaging', 'home'] }),
      ]);
      toast.success(t('conversation.settings.saved'));
    },
    onError: () => toast.error(t('conversation.settings.saveError')),
  });
  const settings = settingsQuery.data;
  const updateSettings = (changes: Partial<ConversationSettings>) => {
    if (!settings || updateMutation.isPending) return;
    updateMutation.mutate({ ...settings, ...changes });
  };

  return (
    <>
      <ActionIconButton
        label={t('conversation.settings.open')}
        onClick={() => setOpen(true)}
        sx={{ flexShrink: 0 }}
      >
        <Settings2 size={17} />
      </ActionIconButton>
      <FormDialog
        open={open}
        title={t('conversation.settings.title')}
        description={t('conversation.settings.description')}
        cancelLabel={t('conversation.settings.close')}
        submitLabel={t('conversation.settings.close')}
        onClose={() => setOpen(false)}
        onSubmit={() => undefined}
        showSubmit={false}
        mobileFullScreen
        maxWidth="sm"
      >
        <Stack spacing={1.5}>
          <Tabs
            value={section}
            onChange={(_, value: 'GENERAL' | 'DISPLAY' | 'PRIVACY') => setSection(value)}
            variant="fullWidth"
            aria-label={t('conversation.settings.sectionsLabel')}
            sx={{
              '& .MuiTab-root.Mui-focusVisible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: '-2px',
              },
            }}
          >
            <Tab
              disableRipple
              value="GENERAL"
              icon={<SlidersHorizontal size={16} />}
              iconPosition="start"
              label={t('conversation.settings.sections.general')}
            />
            <Tab
              disableRipple
              value="DISPLAY"
              icon={<Palette size={16} />}
              iconPosition="start"
              label={t('conversation.settings.sections.display')}
            />
            <Tab
              disableRipple
              value="PRIVACY"
              icon={<ShieldCheck size={16} />}
              iconPosition="start"
              label={t('privacy.tab')}
            />
          </Tabs>
          {section === 'PRIVACY' ? (
            <MessagingPrivacyPanel />
          ) : section === 'DISPLAY' ? (
            <MessagingDisplayPreferencePanel conversation={conversation} />
          ) : (
            <>
              {!preferencesAvailable ? (
                <Alert severity="info">{t('conversation.settings.connectionRequired')}</Alert>
              ) : settingsQuery.isError ? (
                <Alert severity="error">{t('conversation.settings.loadError')}</Alert>
              ) : null}
              <Stack spacing={1.25} divider={<Divider flexItem />}>
                <PreferenceToggle
                  icon={<Star size={17} />}
                  label={t('conversation.settings.favorite')}
                  description={t('conversation.settings.favoriteDescription')}
                  checked={settings?.favorite ?? conversation.favorite}
                  disabled={!preferencesAvailable || !settings || updateMutation.isPending}
                  onChange={(checked) => updateSettings({ favorite: checked })}
                />
                <PreferenceToggle
                  icon={<Pin size={17} />}
                  label={t('conversation.settings.pinned')}
                  description={t('conversation.settings.pinnedDescription')}
                  checked={settings?.pinned ?? conversation.pinned}
                  disabled={!preferencesAvailable || !settings || updateMutation.isPending}
                  onChange={(checked) => updateSettings({ pinned: checked })}
                />
                <Stack direction="row" spacing={1.25} alignItems="flex-start">
                  <Box sx={{ color: 'text.secondary', pt: 1.2 }}>
                    <Bell size={17} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <SelectField
                      label={t('conversation.settings.notifications')}
                      value={
                        settings?.notificationLevel ?? currentMember?.notificationLevel ?? 'DEFAULT'
                      }
                      disabled={!preferencesAvailable || !settings || updateMutation.isPending}
                      onValueChange={(value) => {
                        if (value) updateSettings({ notificationLevel: value });
                      }}
                      options={(['DEFAULT', 'ALL', 'MENTIONS', 'MUTE'] as const).map((value) => ({
                        value,
                        label: t(`conversation.settings.notificationLevels.${value}`),
                      }))}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {t('conversation.settings.notificationsDescription')}
                    </Typography>
                  </Box>
                </Stack>
              </Stack>
            </>
          )}
        </Stack>
      </FormDialog>
    </>
  );
}

function PreferenceToggle({
  icon,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Box sx={{ color: 'text.secondary', pt: 0.65 }}>{icon}</Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
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
        <Typography variant="caption" color="text.secondary">
          {description}
        </Typography>
      </Box>
    </Stack>
  );
}
