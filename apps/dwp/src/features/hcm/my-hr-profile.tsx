import { useTranslation } from 'react-i18next';
import { ContactRound, ExternalLink, PencilLine, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ActionButton, EmptyState, ErrorState, LoadingState } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { getPerson, useAuth } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { PersonAvatar } from '../../components/person-avatar';
import { useHcmExperience } from './use-hcm-experience';

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={680} sx={{ mt: 0.35, overflowWrap: 'anywhere' }}>
        {value || '-'}
      </Typography>
    </Box>
  );
}

export function MyHrProfile() {
  const { t } = useTranslation('hcm');
  const navigate = useNavigate();
  const auth = useAuth();
  const experience = useHcmExperience();
  const personDetail = useQuery({
    queryKey: ['hcm', 'my-profile', experience.currentPerson?.personId],
    queryFn: () => getPerson(experience.currentPerson!.personId, undefined, 'directory'),
    enabled: Boolean(experience.currentPerson),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (experience.currentPersonQuery.isLoading) {
    return <LoadingState size="standard" label={t('myProfile.loading')} />;
  }
  if (experience.currentPersonQuery.isError) {
    return (
      <ErrorState
        size="standard"
        title={t('common.loadError')}
        description={t('myProfile.loadError')}
        retryLabel={t('common.retry')}
        onRetry={() => void experience.currentPersonQuery.refetch()}
        retrying={experience.currentPersonQuery.isFetching}
      />
    );
  }
  if (!experience.currentPerson) {
    return (
      <Paper variant="outlined">
        <EmptyState
          title={t('myProfile.notLinkedTitle')}
          description={t('myProfile.notLinkedDescription', { email: auth.user?.email || '-' })}
          action={
            <ActionButton intent="secondary" onClick={() => navigate('/hr/directory')}>
              {t('myProfile.openDirectory')}
            </ActionButton>
          }
        />
      </Paper>
    );
  }

  const person = experience.currentPerson;
  const detail = personDetail.data;
  const primaryAssignment = detail?.assignments.find((assignment) => assignment.primaryAssignment);
  const selfDisplayName = auth.user?.displayName || person.displayName;

  return (
    <Stack gap={2}>
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box
          sx={{
            px: { xs: 2, md: 2.5 },
            py: 2.25,
            display: 'flex',
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            bgcolor: 'background.paper',
          }}
        >
          <Stack direction="row" alignItems="center" gap={1.5} minWidth={0}>
            <PersonAvatar name={selfDisplayName} size={58} />
            <Box minWidth={0}>
              <Typography component="h2" variant="h5" noWrap>
                {selfDisplayName}
              </Typography>
              <Typography color="text.secondary" noWrap>
                {person.businessTitle || person.jobProfileName || auth.user?.jobTitle || '-'}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {[person.organizationName, person.locationName].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
            <Chip
              size="small"
              variant="outlined"
              color="success"
              icon={<ShieldCheck size={14} />}
              label={t('myProfile.directorySafe')}
            />
            <ActionButton
              intent="secondary"
              size="small"
              startIcon={<PencilLine size={15} />}
              onClick={() =>
                navigate(
                  '/services/discover?category=PEOPLE&service=people.personal-information-change&source=hr'
                )
              }
            >
              {t('myProfile.requestChange')}
            </ActionButton>
          </Stack>
        </Box>
        <Divider />
        <Box
          sx={{
            p: { xs: 2, md: 2.5 },
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
            gap: 2.5,
          }}
        >
          <Field label={t('myProfile.fields.email')} value={person.workEmail || auth.user?.email} />
          <Field label={t('myProfile.fields.manager')} value={person.managerDisplayName} />
          <Field label={t('myProfile.fields.workerType')} value={person.workerType} />
          <Field label={t('myProfile.fields.status')} value={person.workerStatus} />
        </Box>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        <Paper component="section" variant="outlined" sx={{ overflow: 'hidden' }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2, py: 1.6 }}>
            <ContactRound size={18} aria-hidden="true" />
            <Typography component="h2" variant="subtitle1" fontWeight={760}>
              {t('myProfile.employment.title')}
            </Typography>
          </Stack>
          <Divider />
          {personDetail.isLoading ? (
            <LoadingState size="compact" label={t('myProfile.employment.loading')} />
          ) : personDetail.isError ? (
            <ErrorState
              size="compact"
              title={t('common.loadError')}
              retryLabel={t('common.retry')}
              onRetry={() => void personDetail.refetch()}
              retrying={personDetail.isFetching}
            />
          ) : (
            <Box
              sx={{
                p: 2,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              <Field
                label={t('myProfile.fields.legalEmployer')}
                value={detail?.legalEmployerName}
              />
              <Field
                label={t('myProfile.fields.hireDate')}
                value={
                  detail?.originalHireDate
                    ? formatDate(detail.originalHireDate, { dateStyle: 'long' })
                    : undefined
                }
              />
              <Field
                label={t('myProfile.fields.assignment')}
                value={primaryAssignment?.assignmentKey}
              />
              <Field label={t('myProfile.fields.jobProfile')} value={person.jobProfileName} />
              <Field label={t('myProfile.fields.grade')} value={person.jobGradeName} />
              <Field label={t('myProfile.fields.location')} value={person.locationName} />
            </Box>
          )}
        </Paper>

        <Paper component="section" variant="outlined" sx={{ overflow: 'hidden' }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            sx={{ px: 2, py: 1.6 }}
          >
            <Typography component="h2" variant="subtitle1" fontWeight={760}>
              {t('myProfile.organization.title')}
            </Typography>
            <ActionButton
              intent="quiet"
              size="small"
              endIcon={<ExternalLink size={15} />}
              onClick={() =>
                navigate(
                  person.organizationId
                    ? `/hr/organization?mode=organizations&organization=${encodeURIComponent(person.organizationId)}`
                    : '/hr/organization'
                )
              }
            >
              {t('myProfile.organization.open')}
            </ActionButton>
          </Stack>
          <Divider />
          <Box
            sx={{
              p: 2,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <Field label={t('myProfile.fields.organization')} value={person.organizationName} />
            <Field label={t('myProfile.fields.organizationKey')} value={person.organizationKey} />
            <Field label={t('myProfile.fields.manager')} value={person.managerDisplayName} />
            <Field
              label={t('myProfile.fields.directReports')}
              value={String(person.directReportCount)}
            />
          </Box>
        </Paper>
      </Box>
    </Stack>
  );
}
