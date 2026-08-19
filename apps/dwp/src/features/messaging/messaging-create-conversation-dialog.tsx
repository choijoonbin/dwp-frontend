import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Hash, MessagesSquare } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createMessagingConversation, searchMessagingPeople } from '@dwp-frontend/shared-utils';
import {
  ActionButton,
  AutocompleteMultiField,
  ContentDialog,
  FormField,
} from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import type { MessagingPerson } from '@dwp-frontend/shared-utils';

type ConversationType = 'GROUP' | 'CHANNEL';

export function MessagingCreateConversationDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}) {
  const { t } = useTranslation('messaging');
  const [type, setType] = useState<ConversationType>('GROUP');
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [peopleQuery, setPeopleQuery] = useState('');
  const [debouncedPeopleQuery, setDebouncedPeopleQuery] = useState('');
  const [members, setMembers] = useState<MessagingPerson[]>([]);
  const attemptRef = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);
  const people = useQuery({
    queryKey: ['messaging', 'people', 'create-conversation', debouncedPeopleQuery],
    queryFn: () => searchMessagingPeople(debouncedPeopleQuery),
    enabled: open,
    staleTime: 20_000,
    retry: 1,
  });
  const mutation = useMutation({
    mutationFn: createMessagingConversation,
    onSuccess: (created) => {
      attemptRef.current = null;
      onCreated(created.conversation.conversationId);
    },
  });
  const resetMutation = mutation.reset;

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedPeopleQuery(peopleQuery.trim()), 220);
    return () => window.clearTimeout(timeout);
  }, [peopleQuery]);

  useEffect(() => {
    if (open) return;
    setType('GROUP');
    setName('');
    setTopic('');
    setPeopleQuery('');
    setMembers([]);
    attemptRef.current = null;
    resetMutation();
  }, [open, resetMutation]);

  const trimmedName = name.trim();
  const validName = type === 'CHANNEL' ? trimmedName.length >= 2 : trimmedName.length >= 1;
  const validMembers = type === 'CHANNEL' || members.length > 0;
  const canSubmit = validName && validMembers && !mutation.isPending;
  const supportingText = useMemo(
    () => (type === 'CHANNEL' ? t('create.channelDescription') : t('create.groupDescription')),
    [t, type]
  );

  const submit = () => {
    if (!canSubmit) return;
    const payload = {
      name: trimmedName,
      topic: topic.trim() || null,
      type,
      memberUserIds: members.map((person) => person.userId).sort((left, right) => left - right),
    };
    const fingerprint = JSON.stringify(payload);
    if (!attemptRef.current || attemptRef.current.fingerprint !== fingerprint) {
      attemptRef.current = { fingerprint, idempotencyKey: crypto.randomUUID() };
    }
    mutation.mutate({ ...payload, idempotencyKey: attemptRef.current.idempotencyKey });
  };

  return (
    <ContentDialog
      open={open}
      title={t('create.title')}
      description={t('create.description')}
      closeLabel={t('actions.close')}
      onClose={onClose}
      busy={mutation.isPending}
      maxWidth="sm"
    >
      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Stack spacing={2}>
          <Box>
            <Typography variant="body2" fontWeight={750} sx={{ mb: 0.75 }}>
              {t('create.typeLabel')}
            </Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={type}
              onChange={(_, next: ConversationType | null) => {
                if (next) setType(next);
              }}
            >
              <ToggleButton value="GROUP" sx={{ gap: 0.75 }}>
                <MessagesSquare size={16} />
                {t('create.group')}
              </ToggleButton>
              <ToggleButton value="CHANNEL" sx={{ gap: 0.75 }}>
                <Hash size={16} />
                {t('create.channel')}
              </ToggleButton>
            </ToggleButtonGroup>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.75 }}
            >
              {supportingText}
            </Typography>
          </Box>

          <FormField
            autoFocus
            fullWidth
            required
            label={type === 'CHANNEL' ? t('create.channelName') : t('create.groupName')}
            value={name}
            inputProps={{ maxLength: type === 'CHANNEL' ? 80 : 120 }}
            onChange={(event) => setName(event.target.value)}
          />
          <FormField
            fullWidth
            multiline
            minRows={2}
            maxRows={5}
            label={t('create.topic')}
            value={topic}
            inputProps={{ maxLength: 1_200 }}
            onChange={(event) => setTopic(event.target.value)}
          />
          <AutocompleteMultiField<MessagingPerson>
            label={t('create.members')}
            required={type === 'GROUP'}
            value={members}
            options={people.data ?? []}
            loading={people.isLoading}
            inputValue={peopleQuery}
            onInputChange={(_, value) => setPeopleQuery(value)}
            onChange={(_, value) => setMembers(value)}
            getOptionLabel={(person) => `${person.displayName} (${person.emailAddress})`}
            isOptionEqualToValue={(option, value) => option.userId === value.userId}
            supportingText={t('create.membersDescription')}
            textFieldProps={{ placeholder: t('create.membersPlaceholder') }}
          />

          {mutation.isError && <Alert severity="error">{t('create.error')}</Alert>}

          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <ActionButton intent="quiet" disabled={mutation.isPending} onClick={onClose}>
              {t('actions.cancel')}
            </ActionButton>
            <ActionButton
              type="submit"
              intent="primary"
              disabled={!canSubmit}
              loading={mutation.isPending}
              loadingLabel={t('create.creating')}
            >
              {t('create.submit')}
            </ActionButton>
          </Stack>
        </Stack>
      </Box>
    </ContentDialog>
  );
}
