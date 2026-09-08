import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Gavel,
  LayoutTemplate,
  MessageSquare,
  Settings2,
  UsersRound,
} from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  ErrorState,
  LoadingState,
} from '@dwp-frontend/design-system';
import { useAuth } from '@dwp-frontend/shared-utils';
import { getVideoMeetingTemplates } from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { meetingHomeCard, meetingHomeInset } from './meeting-home-presentation';
import { MeetingHomePersonalRoom } from './meeting-home-personal-room';

/** The home is a gateway to real workspaces; previews never create a meeting or copy consent. */
export function MeetingHomeResources() {
  const { user, isAuthenticated } = useAuth();
  const scope = JSON.stringify([
    isAuthenticated,
    user?.identityPlane,
    user?.tenantId,
    user?.userId,
  ]);
  return (
    <MeetingHomeResourcesContent
      key={scope}
      scope={scope}
      enabled={
        isAuthenticated &&
        user?.identityPlane === 'TENANT' &&
        Number.isSafeInteger(user?.tenantId) &&
        Number(user?.tenantId) > 0 &&
        Number.isSafeInteger(user?.userId) &&
        Number(user?.userId) > 0
      }
    />
  );
}
function MeetingHomeResourcesContent({ scope, enabled }: { scope: string; enabled: boolean }) {
  const { t } = useTranslation('meetings');
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['meetings', 'home', 'resources', scope],
    queryFn: ({ signal }) =>
      getVideoMeetingTemplates({ scope: 'ALL', favoritesOnly: true, page: 0, pageSize: 3 }, signal),
    enabled,
    retry: false,
    gcTime: 0,
    staleTime: 30_000,
    meta: { accessSensitive: true },
  });
  if (!enabled) return null;
  return (
    <Box
      component="section"
      aria-labelledby="meeting-home-resources-title"
      data-testid="meeting-home-resources"
      sx={{ minWidth: 0 }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0 }}>
          <LayoutTemplate size={17} aria-hidden="true" />
          <Typography id="meeting-home-resources-title" component="h2" variant="subtitle2">
            {t('home.resources.title')}
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" gap={0.25}>
          <ActionButton
            size="small"
            intent="quiet"
            onClick={() => navigate('/meetings/templates')}
            endIcon={<ArrowRight size={14} aria-hidden="true" />}
          >
            {t('actions.viewAll')}
          </ActionButton>
          <ActionIconButton
            label={t('context.preferences')}
            onClick={() => navigate('/meetings/preferences')}
            size="small"
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            <Settings2 size={16} aria-hidden="true" />
          </ActionIconButton>
        </Stack>
      </Stack>
      <Box
        sx={(theme) => ({
          ...meetingHomeCard(theme),
          mt: 1,
          p: { xs: 0, md: 2 },
          [theme.breakpoints.down('md')]: {
            border: 0,
            boxShadow: 'none',
            backgroundColor: 'transparent',
          },
        })}
      >
        {query.isLoading || query.isFetching ? (
          <LoadingState label={t('templates.loading')} />
        ) : query.isError || !query.data ? (
          <ErrorState
            title={t('home.resources.loadError')}
            retryLabel={t('actions.retry')}
            onRetry={() => enabled && query.refetch()}
          />
        ) : query.data.items.length ? (
          <Box
            component="ul"
            sx={{
              listStyle: 'none',
              p: 0,
              m: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
              gap: 1,
            }}
          >
            {query.data.items.map((template) => {
              const Icon =
                template.category === 'DECISION'
                  ? Gavel
                  : template.category === 'ONE_ON_ONE'
                    ? MessageSquare
                    : template.category === 'GENERAL' || template.category === 'WEEKLY'
                      ? UsersRound
                      : LayoutTemplate;
              return (
                <Box component="li" key={template.templateId} sx={{ minWidth: 0 }}>
                  <ActionButton
                    intent="quiet"
                    onClick={() =>
                      navigate(
                        '/meetings/templates?' +
                          new URLSearchParams({
                            scope: template.scope,
                            template: template.templateId,
                          })
                      )
                    }
                    sx={(theme) => ({
                      ...meetingHomeInset(theme),
                      display: 'flex',
                      flexDirection: 'column',
                      width: '100%',
                      height: '100%',
                      gap: { xs: 0.5, md: 1 },
                      p: { xs: 0.75, md: 1 },
                      minHeight: { xs: 90, md: 100 },
                      whiteSpace: 'normal',
                    })}
                  >
                    <Box
                      component="span"
                      sx={(theme) => ({
                        ...meetingHomeInset(theme),
                        display: { xs: 'contents', md: 'grid' },
                        p: { md: 0.75 },
                        bgcolor: 'background.paper',
                        color: 'primary.main',
                      })}
                    >
                      <Icon size={18} aria-hidden="true" />
                    </Box>
                    <Typography
                      component="span"
                      variant="caption"
                      fontWeight="fontWeightBold"
                      sx={{ overflowWrap: 'anywhere', textAlign: 'center' }}
                    >
                      {template.name}
                    </Typography>
                    <Typography component="span" variant="caption" color="text.secondary">
                      {t('units.minutes', { count: template.durationMinutes })}
                    </Typography>
                  </ActionButton>
                </Box>
              );
            })}
          </Box>
        ) : (
          <Stack gap={1}>
            <Typography variant="body2" color="text.secondary">
              {t('home.resources.empty')}
            </Typography>
            <ActionButton intent="secondary" onClick={() => navigate('/meetings/templates')}>
              {t('home.resources.choose')}
            </ActionButton>
          </Stack>
        )}
        <Stack
          sx={{
            mt: { xs: 1, md: 2 },
            pt: { xs: 0, md: 1.5 },
            borderTopWidth: { xs: 0, md: 1 },
            borderTopStyle: 'solid',
            borderTopColor: 'divider',
          }}
          gap={0.5}
        >
          <MeetingHomePersonalRoom key={scope} scope={scope} enabled={enabled} />
        </Stack>
      </Box>
    </Box>
  );
}
