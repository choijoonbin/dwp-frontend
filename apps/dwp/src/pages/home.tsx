import { useNavigate } from 'react-router-dom';
import {
  AppWindow,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import { scheduleItems, todayItems } from '../features/work-hub/reference-data';

import type { Priority } from '../features/work-hub/reference-data';

const priorityColor: Record<Priority, 'error' | 'warning' | 'default'> = {
  high: 'error',
  medium: 'warning',
  low: 'default',
};

export default function HomePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const firstName = auth.user?.displayName?.split(' ')[0] || 'there';

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1.5,
        }}
      >
        <Box>
          <Typography component="h1" variant="h4">
            Today
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Saturday, August 8 / Good morning, {firstName}
          </Typography>
        </Box>
        <Chip label="Reference data" variant="outlined" size="small" />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 2fr) minmax(280px, 1fr)' },
          gap: { xs: 4, lg: 5 },
          mt: 4,
        }}
      >
        <Box component="section" aria-labelledby="priority-heading" sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Typography id="priority-heading" component="h2" variant="h6">
              Priority now
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {todayItems.length} items
            </Typography>
          </Box>
          <Divider sx={{ mt: 1 }} />

          <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none' }}>
            {todayItems.map((item) => (
              <Box component="li" key={item.id} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <ButtonBase
                  onClick={() => navigate(item.actionRoute)}
                  sx={{
                    width: 1,
                    minHeight: 88,
                    py: 2,
                    px: { xs: 0, sm: 1 },
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'minmax(0, 1fr) auto',
                      sm: '110px minmax(0, 1fr) auto',
                    },
                    gap: { xs: 1, sm: 2 },
                    textAlign: 'left',
                    alignItems: 'center',
                    borderRadius: 1,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                    <Chip
                      label={item.priority}
                      color={priorityColor[item.priority]}
                      variant="outlined"
                      size="small"
                    />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography component="p" variant="subtitle2">
                        {item.title}
                      </Typography>
                      <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                        <Chip
                          label={item.priority}
                          color={priorityColor[item.priority]}
                          variant="outlined"
                          size="small"
                        />
                      </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
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

        <Box component="section" aria-labelledby="schedule-heading" sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarDays size={19} strokeWidth={1.8} aria-hidden="true" />
            <Typography id="schedule-heading" component="h2" variant="h6">
              Schedule
            </Typography>
          </Box>
          <Divider sx={{ mt: 1 }} />
          <Box component="ol" sx={{ p: 0, m: 0, listStyle: 'none' }}>
            {scheduleItems.map((item) => (
              <Box
                component="li"
                key={item.id}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '64px minmax(0, 1fr)',
                  gap: 1.5,
                  py: 2,
                }}
              >
                <Typography variant="body2" fontWeight={700}>
                  {item.time}
                </Typography>
                <Box sx={{ minWidth: 0 }}>
                  <Typography component="p" variant="subtitle2">
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.detail}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      <Box
        component="section"
        aria-labelledby="brief-heading"
        sx={{ mt: { xs: 4, md: 5 }, py: 3, borderTop: 1, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '220px minmax(0, 1fr)' },
            gap: { xs: 2, md: 4 },
          }}
        >
          <Box>
            <Chip
              icon={<Sparkles size={15} aria-hidden="true" />}
              label="AI generated preview"
              color="info"
              variant="outlined"
              size="small"
            />
            <Typography id="brief-heading" component="h2" variant="h6" sx={{ mt: 1.25 }}>
              Daily brief
            </Typography>
            <Typography variant="caption" color="text.secondary">
              09:10 / 6 reference sources
            </Typography>
          </Box>
          <Box>
            <Typography>
              Two items need attention before the 11:00 customer meeting. The software access
              approval is blocking a new team member, and the briefing notes have three unresolved
              questions. Benefits enrollment closes at 17:00.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
              <Button
                variant="contained"
                startIcon={<BriefcaseBusiness size={17} aria-hidden="true" />}
                onClick={() => navigate('/work')}
              >
                Open work
              </Button>
              <Button
                variant="outlined"
                startIcon={<Sparkles size={17} aria-hidden="true" />}
                onClick={() => navigate('/ask')}
              >
                Ask about this
              </Button>
              <Button
                variant="text"
                startIcon={<AppWindow size={17} aria-hidden="true" />}
                onClick={() => navigate('/apps')}
              >
                Open apps
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 2 }}>
        <Clock3 size={15} aria-hidden="true" />
        <Typography variant="caption" color="text.secondary">
          Last refreshed 09:10
        </Typography>
      </Box>
    </Container>
  );
}
