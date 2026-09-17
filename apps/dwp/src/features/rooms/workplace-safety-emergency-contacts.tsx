import { useQuery } from '@tanstack/react-query';
import { Phone, Radio, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getWorkplaceEmergencyContacts } from '@dwp-frontend/shared-utils';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { ActionButton, InlineFeedback, LoadingState } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';

import type {
  WorkplaceEmergencyContact,
  WorkplaceEmergencyContactKind,
} from '@dwp-frontend/shared-utils';

const KIND_ICONS: Record<WorkplaceEmergencyContactKind, React.ReactNode> = {
  HOTLINE: <Phone size={17} aria-hidden="true" />,
  RADIO: <Radio size={17} aria-hidden="true" />,
  PUBLIC_EMERGENCY: <ShieldAlert size={17} aria-hidden="true" />,
};

function contactName(contact: WorkplaceEmergencyContact, korean: boolean) {
  return korean ? contact.displayNameKo : contact.displayNameEn;
}

export function WorkplaceSafetyEmergencyContacts({ incidentId }: { incidentId: string }) {
  const { t, i18n } = useTranslation('rooms');
  const korean = resolveSupportedLocale(i18n.resolvedLanguage) === 'ko';
  const query = useQuery({
    queryKey: ['workplace', 'safety', 'user', incidentId, 'emergency-contacts'],
    queryFn: () => getWorkplaceEmergencyContacts(incidentId),
    retry: false,
  });

  return (
    <Box
      component="section"
      aria-labelledby="workplace-emergency-contacts-title"
      sx={(theme) => ({ ...workplaceMemberCard(theme), p: { xs: 1.5, md: 2 } })}
    >
      <Stack spacing={1.25}>
        <Box>
          <Typography
            id="workplace-emergency-contacts-title"
            component="h2"
            variant="subtitle1"
            fontWeight="fontWeightBold"
          >
            {t('workplace.safety.emergencyContacts.userTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('workplace.safety.emergencyContacts.userDescription')}
          </Typography>
        </Box>

        {query.isLoading ? (
          <LoadingState
            embedded
            variant="skeleton"
            skeletonRows={2}
            label={t('workplace.safety.emergencyContacts.loading')}
          />
        ) : query.isError ? (
          <InlineFeedback severity="error">
            {t('workplace.safety.emergencyContacts.loadError')}
          </InlineFeedback>
        ) : (query.data ?? []).length === 0 ? (
          <InlineFeedback severity="warning">
            {t('workplace.safety.emergencyContacts.notConfigured')}
          </InlineFeedback>
        ) : (
          (query.data ?? []).map((contact) => {
            const callable =
              contact.active &&
              contact.actionMode === 'TEL_URI' &&
              contact.directTelAllowed &&
              contact.providerState === 'READY' &&
              Boolean(contact.telUri);
            return (
              <Box
                key={contact.contactId}
                sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25 })}
              >
                <Stack spacing={0.75}>
                  <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                    {KIND_ICONS[contact.kind]}
                    <Typography fontWeight="fontWeightBold" sx={{ flex: 1, minWidth: 0 }}>
                      {contactName(contact, korean)}
                    </Typography>
                    <Chip
                      size="small"
                      color={contact.providerState === 'READY' ? 'success' : 'default'}
                      label={t(
                        `workplace.safety.emergencyContacts.providerStates.${contact.providerState}`
                      )}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {t(`workplace.safety.emergencyContacts.kinds.${contact.kind}`)}
                  </Typography>
                  {callable ? (
                    <ActionButton
                      component="a"
                      href={contact.telUri!}
                      intent={contact.kind === 'PUBLIC_EMERGENCY' ? 'danger' : 'secondary'}
                      startIcon={<Phone size={16} />}
                      aria-label={t('workplace.safety.emergencyContacts.callNamed', {
                        name: contactName(contact, korean),
                      })}
                    >
                      {t('workplace.safety.emergencyContacts.call')}
                    </ActionButton>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {contact.actionMode === 'GOVERNED_HANDOFF'
                        ? t('workplace.safety.emergencyContacts.commandCenterOnly')
                        : t('workplace.safety.emergencyContacts.unavailable')}
                    </Typography>
                  )}
                </Stack>
              </Box>
            );
          })
        )}
        <Typography variant="caption" color="text.secondary">
          {t('workplace.safety.emergencyContacts.privacyNotice')}
        </Typography>
      </Stack>
    </Box>
  );
}
