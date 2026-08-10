import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Focus,
  Sparkles,
  TimerReset,
  UsersRound,
} from 'lucide-react';
import { useAuth, usePermissions } from '@dwp-frontend/shared-utils';
import { PageCanvas } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import { PageHeader, ReferenceModeChip, SectionHeading } from '../features/work-hub/workspace-ui';
import { activityEvents, scheduleItems, todayItems } from '../features/work-hub/reference-data';
import { AppLaunchpad } from '../features/home/app-launchpad';
import {
  HOME_APPS,
  isAppEntitled,
  launchpadStorageKey,
} from '../features/home/app-launchpad-model';

import type { Priority } from '../features/work-hub/reference-data';

const priorityColor: Record<Priority, 'error' | 'warning' | 'default'> = {
  high: 'error',
  medium: 'warning',
  low: 'default',
};

const scheduleTone = {
  meeting: 'primary.main',
  focus: 'success.main',
  deadline: 'warning.main',
} as const;

export default function HomePage() {
  const auth = useAuth();
  const { permissions } = usePermissions();
  const navigate = useNavigate();
  const firstName = auth.user?.displayName?.split(' ')[0] || 'there';
  const recentActivity = activityEvents.slice(0, 3);
  const entitledApps = useMemo(
    () => HOME_APPS.filter((app) => isAppEntitled(app, auth.user?.roles ?? [], permissions)),
    [auth.user?.roles, permissions]
  );
  const personalLayoutKey = launchpadStorageKey(auth.user?.tenantId ?? 0, auth.user?.userId ?? 0);

  return (
    <PageCanvas>
      <PageHeader
        eyebrow="Your workspace"
        title={`Welcome back, ${firstName}`}
        description="Your assigned apps and next actions, in one governed workspace."
        action={<ReferenceModeChip />}
      />

      <AppLaunchpad
        key={personalLayoutKey}
        apps={entitledApps}
        storageKey={personalLayoutKey}
        onLaunch={(app) => navigate(app.route)}
        onBrowseAll={() => navigate('/apps')}
      />

      <Box
        sx={{
          mt: 4,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Typography component="p" variant="overline" color="primary.main">
          Today
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Saturday, August 8 / Updated 09:10
        </Typography>
      </Box>

      <Box
        component="section"
        aria-labelledby="brief-heading"
        sx={{
          mt: 1,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1.65fr) minmax(320px, 1fr)' },
          color: '#F8FAFC',
          bgcolor: '#111923',
          border: 1,
          borderColor: '#293545',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <Box sx={{ p: { xs: 2.5, sm: 3, lg: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              icon={<Sparkles size={14} aria-hidden="true" />}
              label="AI generated / 6 verified sources"
              size="small"
              sx={{
                color: '#DCE8FF',
                borderColor: '#5876A3',
                bgcolor: '#18263A',
                '& .MuiChip-icon': { color: '#7EB7FF' },
              }}
              variant="outlined"
            />
            <Typography variant="caption" sx={{ color: '#AEBACC' }}>
              Updated 09:10
            </Typography>
          </Box>
          <Typography
            id="brief-heading"
            component="h2"
            variant="h5"
            sx={{ mt: 2.25, color: 'inherit' }}
          >
            Daily brief
          </Typography>
          <Typography
            component="p"
            sx={{ mt: 1, maxWidth: 720, fontSize: '1.125rem', lineHeight: 1.55, color: '#F8FAFC' }}
          >
            Two decisions before the 11:00 customer meeting. Approving software access now unblocks
            a new team member; the customer brief still has three unanswered questions.
          </Typography>

          <Box
            sx={{
              mt: 2.5,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
              gap: 1,
            }}
          >
            {[
              [TimerReset, 'Next deadline', '10:30', 'Software access'],
              [Focus, 'Protected focus', '90 min', '14:00–15:30'],
              [UsersRound, 'Meeting ready', '72%', '6 sources checked'],
            ].map(([Icon, label, value, detail]) => {
              const SignalIcon = Icon as typeof TimerReset;
              return (
                <Box
                  key={label as string}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '32px minmax(0, 1fr)',
                    gap: 1,
                    alignItems: 'center',
                    p: 1.25,
                    border: '1px solid #334155',
                    borderRadius: 1,
                    bgcolor: '#16212E',
                  }}
                >
                  <Box sx={{ color: '#8DB8FF', display: 'grid', placeItems: 'center' }}>
                    <SignalIcon size={18} strokeWidth={1.8} aria-hidden="true" />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" sx={{ color: '#AEBACC' }}>
                      {label as string}
                    </Typography>
                    <Typography component="p" variant="subtitle2" sx={{ color: '#FFFFFF' }}>
                      {value as string}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#AEBACC' }}>
                      {detail as string}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2.5 }}>
            <Button
              variant="contained"
              startIcon={<BriefcaseBusiness size={17} aria-hidden="true" />}
              onClick={() => navigate('/work?item=WK-1042')}
            >
              Review priority
            </Button>
            <Button
              variant="outlined"
              startIcon={<Sparkles size={17} aria-hidden="true" />}
              onClick={() =>
                navigate('/ask?q=What%20should%20I%20prepare%20before%20the%2011%3A00%20meeting%3F')
              }
              sx={{
                color: '#F8FAFC',
                borderColor: '#66778F',
                '&:hover': { borderColor: '#AFC8F2' },
              }}
            >
              Ask about today
            </Button>
          </Box>
        </Box>

        <Box
          sx={{
            p: { xs: 2.5, sm: 3, lg: 4 },
            borderLeft: { xs: 0, lg: '1px solid #293545' },
            borderTop: { xs: '1px solid #293545', lg: 0 },
            bgcolor: '#0D141D',
          }}
        >
          <Typography component="h3" variant="subtitle1" sx={{ color: '#FFFFFF' }}>
            Day rhythm
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.25, color: '#AEBACC' }}>
            Meetings are concentrated before lunch.
          </Typography>

          <Box
            role="img"
            aria-label="Day rhythm from 9 AM to 5 PM with meetings, focus time, and one deadline"
            sx={{ mt: 3 }}
          >
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 0.5 }}>
              {['09', '10', '11', '12', '13', '14', '15', '16', '17'].map((hour) => (
                <Typography
                  key={hour}
                  variant="caption"
                  sx={{ color: '#8391A5', textAlign: 'center' }}
                >
                  {hour}
                </Typography>
              ))}
            </Box>
            <Box
              sx={{
                mt: 1,
                height: 54,
                display: 'grid',
                gridTemplateColumns: 'repeat(18, 1fr)',
                gap: 0.5,
                alignItems: 'end',
              }}
            >
              {Array.from({ length: 18 }, (_, index) => {
                const meeting = [1, 4, 5].includes(index);
                const focus = [10, 11, 12].includes(index);
                const deadline = index === 17;
                return (
                  <Box
                    key={index}
                    sx={{
                      height: meeting ? 44 : focus ? 30 : deadline ? 52 : 8,
                      bgcolor: meeting
                        ? '#5B8DEF'
                        : focus
                          ? '#39B98A'
                          : deadline
                            ? '#E6A23C'
                            : '#273445',
                      borderRadius: 0.5,
                    }}
                  />
                );
              })}
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gap: 1.25, mt: 3 }}>
            {[
              ['#5B8DEF', 'Meetings', '2h 05m'],
              ['#39B98A', 'Focus', '1h 30m'],
              ['#E6A23C', 'Deadline', '17:00'],
            ].map(([color, label, value]) => (
              <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: 0.5, bgcolor: color }} />
                <Typography variant="body2" sx={{ flex: 1, color: '#CBD5E1' }}>
                  {label}
                </Typography>
                <Typography variant="body2" fontWeight={700} sx={{ color: '#FFFFFF' }}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          mt: 4,
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: 'minmax(0, 1.5fr) minmax(250px, 0.8fr) minmax(280px, 0.9fr)',
          },
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box
          component="section"
          aria-labelledby="priority-heading"
          sx={{ minWidth: 0, py: 2.5, pr: { lg: 3 } }}
        >
          <SectionHeading
            id="priority-heading"
            icon={CheckCircle2}
            title="Focus now"
            meta={
              <Typography variant="body2" color="text.secondary">
                {todayItems.length} items
              </Typography>
            }
          />
          <Box component="ol" sx={{ p: 0, mt: 2, mb: 0, listStyle: 'none' }}>
            {todayItems.map((item, index) => (
              <Box component="li" key={item.id} sx={{ borderTop: 1, borderColor: 'divider' }}>
                <ButtonBase
                  onClick={() => navigate(item.actionRoute)}
                  sx={{
                    width: 1,
                    minHeight: 78,
                    p: 1.5,
                    display: 'grid',
                    gridTemplateColumns: '32px minmax(0, 1fr) auto',
                    gap: 1.5,
                    alignItems: 'center',
                    textAlign: 'left',
                    bgcolor: index === 0 ? 'action.selected' : 'transparent',
                    borderLeft: 3,
                    borderLeftColor: index === 0 ? 'primary.main' : 'transparent',
                    transition: (theme) =>
                      theme.transitions.create(['background-color', 'border-color']),
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Typography variant="caption" color="text.secondary" fontWeight={800}>
                    {String(index + 1).padStart(2, '0')}
                  </Typography>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography component="h3" variant="subtitle2">
                        {item.title}
                      </Typography>
                      <Chip
                        label={item.priority}
                        color={priorityColor[item.priority]}
                        variant="outlined"
                        size="small"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.2 }}>
                      {item.reason}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.dueLabel} / {item.duration} / {item.source}
                    </Typography>
                  </Box>
                  <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" />
                </ButtonBase>
              </Box>
            ))}
          </Box>
        </Box>

        <Box
          component="section"
          aria-labelledby="schedule-heading"
          sx={{
            minWidth: 0,
            py: 2.5,
            px: { xs: 0, lg: 3 },
            borderLeft: { xs: 0, lg: 1 },
            borderTop: { xs: 1, lg: 0 },
            borderColor: 'divider',
          }}
        >
          <SectionHeading id="schedule-heading" icon={CalendarDays} title="Schedule" />
          <Box component="ol" sx={{ p: 0, mt: 2, mb: 0, listStyle: 'none' }}>
            {scheduleItems.map((item, index) => (
              <Box
                component="li"
                key={item.id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '52px 12px minmax(0, 1fr)',
                  gap: 1,
                  minHeight: 68,
                }}
              >
                <Typography variant="caption" fontWeight={800} sx={{ pt: 0.25 }}>
                  {item.time}
                </Typography>
                <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                  {index < scheduleItems.length - 1 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 10,
                        bottom: -4,
                        width: 1,
                        bgcolor: 'divider',
                      }}
                    />
                  )}
                  <Box
                    sx={{
                      position: 'relative',
                      width: 8,
                      height: 8,
                      mt: 0.5,
                      borderRadius: '50%',
                      bgcolor: scheduleTone[item.kind],
                    }}
                  />
                </Box>
                <Box>
                  <Typography component="h3" variant="subtitle2">
                    {item.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.detail}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        <Box
          component="section"
          aria-labelledby="activity-heading"
          sx={{
            minWidth: 0,
            py: 2.5,
            pl: { xs: 0, lg: 3 },
            borderLeft: { xs: 0, lg: 1 },
            borderTop: { xs: 1, lg: 0 },
            borderColor: 'divider',
          }}
        >
          <SectionHeading
            id="activity-heading"
            icon={Activity}
            title="Live activity"
            meta={
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'success.main' }} />
            }
          />
          <Box component="ul" sx={{ p: 0, mt: 2, mb: 0, listStyle: 'none' }}>
            {recentActivity.map((event) => (
              <Box
                component="li"
                key={event.id}
                sx={{ py: 1.5, borderTop: 1, borderColor: 'divider' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {event.time}
                  </Typography>
                  <Chip
                    label={event.actor}
                    size="small"
                    color={event.actor === 'agent' ? 'info' : 'default'}
                    variant="outlined"
                  />
                </Box>
                <Typography component="h3" variant="subtitle2" sx={{ mt: 0.75 }}>
                  {event.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {event.actorName} / {event.source}
                </Typography>
              </Box>
            ))}
          </Box>
          <Button
            variant="text"
            endIcon={<ArrowRight size={16} aria-hidden="true" />}
            onClick={() => navigate('/activity')}
            sx={{ mt: 1, px: 0 }}
          >
            View activity
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 2 }}>
        <Clock3 size={15} aria-hidden="true" />
        <Typography variant="caption" color="text.secondary">
          Last refreshed 09:10 / Reference data only
        </Typography>
      </Box>
    </PageCanvas>
  );
}
