import { useTranslation } from 'react-i18next';
import { ArrowLeft, MailPlus, Pencil, Star, Trash2 } from 'lucide-react';
import { ActionButton, ActionIconButton, GuidedEmptyState } from '@dwp-frontend/design-system';

import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { MailContact } from '@dwp-frontend/shared-utils';

const AVATAR_TONES = ['success.dark', 'info.dark', 'error.dark', 'warning.dark'] as const;

function initials(value: string) {
  const words = value.trim().split(/\s+/u);
  return words.length > 1
    ? `${words[0]?.[0] ?? ''}${words.at(-1)?.[0] ?? ''}`.toUpperCase()
    : value.slice(0, 2).toUpperCase();
}

function toneFor(value: string) {
  const index = [...value].reduce((sum, character) => sum + character.codePointAt(0)!, 0);
  return AVATAR_TONES[index % AVATAR_TONES.length];
}

export function MailAddressBookContactWorkspace({
  contacts,
  selectedId,
  onSelect,
  onBack,
  onCompose,
  onEdit,
  onArchive,
}: {
  contacts: MailContact[];
  selectedId: string | null;
  onSelect: (contact: MailContact) => void;
  onBack: () => void;
  onCompose: (contact: MailContact) => void;
  onEdit: (contact: MailContact) => void;
  onArchive: (contact: MailContact) => void;
}) {
  const { t } = useTranslation('mail');
  if (!contacts.length) {
    return (
      <GuidedEmptyState
        kind="empty"
        title={t('addressBook.contact.emptyTitle')}
        description={t('addressBook.contact.emptyDescription')}
      />
    );
  }
  const selected = contacts.find((contact) => contact.contactId === selectedId) ?? null;
  return (
    <Box
      component="section"
      aria-labelledby="mail-contact-list-title"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(320px, .95fr) minmax(300px, 1.05fr)' },
        borderBlock: 1,
        borderColor: 'divider',
        minHeight: 420,
      }}
    >
      <Box sx={{ minWidth: 0, display: { xs: selected ? 'none' : 'block', md: 'block' } }}>
        <Typography
          id="mail-contact-list-title"
          component="h2"
          variant="h6"
          fontWeight="fontWeightBold"
          sx={{ px: 1.5, py: 1.25 }}
        >
          {t('addressBook.contact.listTitle')}
        </Typography>
        {contacts.map((contact) => (
          <Box
            key={contact.contactId}
            sx={{
              minHeight: 76,
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              alignItems: 'center',
              borderTop: 1,
              borderColor: 'divider',
              bgcolor:
                selectedId === contact.contactId ? 'var(--dwp-product-selection)' : undefined,
            }}
          >
            <Box
              component="button"
              type="button"
              aria-pressed={selectedId === contact.contactId}
              onClick={() => onSelect(contact)}
              sx={(theme) => ({
                appearance: 'none',
                border: 0,
                bgcolor: 'transparent',
                color: 'text.primary',
                textAlign: 'left',
                minWidth: 0,
                minHeight: 75,
                px: 1.5,
                py: 1.1,
                display: 'grid',
                gridTemplateColumns: 'auto minmax(0, 1fr)',
                alignItems: 'center',
                gap: 1.5,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
                '&:focus-visible': {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: -2,
                },
              })}
            >
              <Avatar
                sx={{
                  bgcolor: toneFor(contact.displayName),
                  width: 40,
                  height: 40,
                  fontSize: 'caption.fontSize',
                }}
              >
                {initials(contact.displayName)}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                >
                  <Typography fontWeight="fontWeightBold">{contact.displayName}</Typography>
                  {contact.favorite && (
                    <Box component="span" sx={{ display: 'inline-flex', color: 'warning.dark' }}>
                      <Star size={14} fill="currentColor" />
                    </Box>
                  )}
                </Stack>
                <Typography variant="body2" noWrap>
                  {contact.emailAddress}
                </Typography>
                {(contact.organizationName || contact.jobTitle) && (
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {[contact.organizationName, contact.jobTitle].filter(Boolean).join(' · ')}
                  </Typography>
                )}
              </Box>
            </Box>
            <ActionIconButton label={t('addressBook.contact.edit')} onClick={() => onEdit(contact)}>
              <Pencil size={17} />
            </ActionIconButton>
          </Box>
        ))}
      </Box>
      <Box
        sx={{
          minWidth: 0,
          borderLeft: { md: 1 },
          borderColor: 'divider',
          display: { xs: selected ? 'block' : 'none', md: 'block' },
        }}
      >
        {selected ? (
          <ContactDetail
            contact={selected}
            onBack={onBack}
            onCompose={() => onCompose(selected)}
            onEdit={() => onEdit(selected)}
            onArchive={() => onArchive(selected)}
          />
        ) : (
          <GuidedEmptyState
            kind="empty"
            title={t('addressBook.contact.selectTitle')}
            description={t('addressBook.contact.selectDescription')}
          />
        )}
      </Box>
    </Box>
  );
}

function ContactDetail({
  contact,
  onBack,
  onCompose,
  onEdit,
  onArchive,
}: {
  contact: MailContact;
  onBack: () => void;
  onCompose: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const { t } = useTranslation('mail');
  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>
      <ActionButton
        intent="quiet"
        startIcon={<ArrowLeft size={16} />}
        onClick={onBack}
        sx={{ display: { md: 'none' }, mb: 1.5 }}
      >
        {t('actions.back')}
      </ActionButton>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Avatar sx={{ bgcolor: toneFor(contact.displayName), width: 52, height: 52 }}>
          {initials(contact.displayName)}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h3" variant="h6" fontWeight="fontWeightBold">
            {contact.displayName}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {contact.emailAddress}
          </Typography>
        </Box>
      </Stack>
      <Box component="dl" sx={{ m: 0, mt: 2.5, display: 'grid', gap: 1.25 }}>
        {[
          [t('addressBook.contact.organization'), contact.organizationName],
          [t('addressBook.contact.jobTitle'), contact.jobTitle],
          [t('addressBook.contact.phone'), contact.phoneNumber],
        ].map(([label, value]) => (
          <Box key={label}>
            <Typography component="dt" variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0, mt: 0.25 }}>
              {value || '—'}
            </Typography>
          </Box>
        ))}
      </Box>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 3 }}>
        <ActionButton intent="primary" startIcon={<MailPlus size={16} />} onClick={onCompose}>
          {t('addressBook.contact.compose')}
        </ActionButton>
        <ActionButton intent="secondary" startIcon={<Pencil size={16} />} onClick={onEdit}>
          {t('addressBook.contact.edit')}
        </ActionButton>
        <ActionButton intent="quiet" startIcon={<Trash2 size={16} />} onClick={onArchive}>
          {t('addressBook.archive')}
        </ActionButton>
      </Stack>
    </Box>
  );
}
