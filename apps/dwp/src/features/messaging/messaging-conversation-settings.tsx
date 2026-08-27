import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Palette, Pin, Settings2, SlidersHorizontal, Star, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionIconButton, SelectField } from '@dwp-frontend/design-system';
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
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import { MessagingDisplayPreferencePanel } from './messaging-display-preference-panel';

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
  const titleId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [section, setSection] = useState<'GENERAL' | 'DISPLAY'>('GENERAL');
  const preferencesAvailable = MESSAGING_API_CAPABILITIES.conversationPreferences;
  const settingsQuery = useQuery({
    queryKey: ['messaging', 'conversation-settings', conversation.conversationId],
    queryFn: () => getMessagingConversationSettings(conversation.conversationId),
    enabled: Boolean(anchor) && preferencesAvailable,
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
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{ flexShrink: 0 }}
      >
        <Settings2 size={17} />
      </ActionIconButton>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-modal': true,
            'aria-labelledby': titleId,
            sx: {
              mt: 0.75,
              width: 'min(430px, calc(100vw - 24px))',
              maxHeight: 'min(720px, calc(100dvh - 32px))',
              overflowY: 'auto',
              borderRadius: 1,
              boxShadow: '0 22px 58px rgba(15, 23, 42, 0.18)',
            },
          },
        }}
      >
        <Stack spacing={1.5} sx={{ p: 2 }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography id={titleId} variant="subtitle1" fontWeight={850}>
                {t('conversation.settings.title')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('conversation.settings.description')}
              </Typography>
            </Box>
            <ActionIconButton
              label={t('conversation.settings.close')}
              onClick={() => setAnchor(null)}
              sx={{ flexShrink: 0 }}
            >
              <X size={17} />
            </ActionIconButton>
          </Stack>
          <Tabs
            value={section}
            onChange={(_, value: 'GENERAL' | 'DISPLAY') => setSection(value)}
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
          </Tabs>
          {section === 'DISPLAY' ? (
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
      </Popover>
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
