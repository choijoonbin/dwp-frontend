import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, DoorOpen, LayoutTemplate, Settings2 } from 'lucide-react';
import {
  ActionButton,
  ErrorState,
  LoadingState,
  SectionHeader,
  foundationTokens,
} from '@dwp-frontend/design-system';
import { useAuth } from '@dwp-frontend/shared-utils';
import { getVideoMeetingTemplates } from '@dwp-frontend/shared-utils/api/video-meeting-templates-api';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

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
      <SectionHeader
        density="compact"
        glyph="plain"
        id="meeting-home-resources-title"
        icon={LayoutTemplate}
        title={t('home.resources.title')}
        meta={
          <ActionButton
            size="small"
            intent="quiet"
            onClick={() => navigate('/meetings/templates')}
            endIcon={<ArrowRight size={14} aria-hidden="true" />}
          >
            {t('actions.viewAll')}
          </ActionButton>
        }
      />
      <Box
        sx={{
          mt: 1.5,
          p: 2,
          border: 1,
          borderColor: 'divider',
          borderRadius: foundationTokens.radius.surface + 'px',
          bgcolor: 'background.paper',
        }}
      >
        {query.isLoading ? (
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
            {query.data.items.map((template) => (
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
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    height: '100%',
                    gap: 1,
                    p: 1.5,
                    minHeight: 100,
                    border: 1,
                    borderColor: 'divider',
                    whiteSpace: 'normal',
                  }}
                >
                  <LayoutTemplate size={18} aria-hidden="true" />
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{ overflowWrap: 'anywhere', textAlign: 'center' }}
                  >
                    {template.name}
                  </Typography>
                  <Typography component="span" variant="caption" color="text.secondary">
                    {t('units.minutes', { count: template.durationMinutes })}
                  </Typography>
                </ActionButton>
              </Box>
            ))}
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
        <Stack sx={{ mt: 2, pt: 1.5, borderTop: 1, borderColor: 'divider' }} gap={0.5}>
          <ActionButton
            intent="quiet"
            startIcon={<DoorOpen size={17} aria-hidden="true" />}
            endIcon={<ArrowRight size={14} aria-hidden="true" />}
            onClick={() => navigate('/meetings/mine?view=personal-room')}
            sx={{ justifyContent: 'flex-start', minHeight: 44 }}
          >
            {t('personalRoom.title')}
          </ActionButton>
          <ActionButton
            intent="quiet"
            startIcon={<Settings2 size={17} aria-hidden="true" />}
            onClick={() => navigate('/meetings/preferences')}
            sx={{ justifyContent: 'flex-start', minHeight: 44 }}
          >
            {t('context.preferences')}
          </ActionButton>
        </Stack>
      </Box>
    </Box>
  );
}
