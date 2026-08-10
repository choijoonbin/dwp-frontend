import { ArrowUpRight, Megaphone, Pin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listAnnouncements } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import type { AnnouncementSeverity } from '@dwp-frontend/shared-utils';

const severityTone: Record<AnnouncementSeverity, { accent: string; surface: string }> = {
  INFO: { accent: '#2E68D5', surface: 'rgba(46,104,213,0.07)' },
  SUCCESS: { accent: '#17805C', surface: 'rgba(23,128,92,0.07)' },
  WARNING: { accent: '#A66300', surface: 'rgba(166,99,0,0.08)' },
  CRITICAL: { accent: '#B4232F', surface: 'rgba(180,35,47,0.08)' },
};

export function AnnouncementsWidget() {
  const navigate = useNavigate();
  const announcementsQuery = useQuery({
    queryKey: ['announcements'],
    queryFn: listAnnouncements,
    staleTime: 60 * 1000,
    retry: 1,
  });
  const announcements = announcementsQuery.data ?? [];

  if (announcements.length === 0) return null;

  return (
    <Box
      component="section"
      aria-labelledby="announcements-heading"
      sx={{ gridColumn: '1 / -1', borderTop: 1, borderBottom: 1, borderColor: 'divider' }}
    >
      <Box
        sx={{
          minHeight: 54,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Megaphone size={18} strokeWidth={1.8} aria-hidden="true" />
        <Typography id="announcements-heading" component="h2" variant="subtitle1">
          Announcements
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {announcements.length}
        </Typography>
      </Box>

      <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {announcements.map((announcement) => {
          const tone = severityTone[announcement.severity];
          const external = announcement.actionUrl?.startsWith('https://');
          return (
            <Box
              component="li"
              key={announcement.announcementId}
              sx={{
                minHeight: 76,
                px: { xs: 1.5, md: 2 },
                py: 1.5,
                display: 'grid',
                gridTemplateColumns: { xs: '4px minmax(0, 1fr)', sm: '4px minmax(0, 1fr) auto' },
                alignItems: 'center',
                gap: { xs: 1.5, md: 2 },
                bgcolor: tone.surface,
                '& + &': { borderTop: 1, borderColor: 'divider' },
              }}
            >
              <Box sx={{ width: 4, height: 38, borderRadius: 0.5, bgcolor: tone.accent }} />
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                  {announcement.pinned && <Pin size={14} strokeWidth={1.9} aria-label="Pinned" />}
                  <Typography component="h3" variant="subtitle2">
                    {announcement.title}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {announcement.message}
                </Typography>
              </Box>
              {announcement.actionLabel &&
                announcement.actionUrl &&
                (external ? (
                  <Button
                    size="small"
                    variant="text"
                    endIcon={<ArrowUpRight size={15} />}
                    href={announcement.actionUrl}
                    target="_blank"
                    rel="noreferrer"
                    sx={{ gridColumn: { xs: 2, sm: 3 }, justifySelf: 'start', textAlign: 'left' }}
                  >
                    {announcement.actionLabel}
                  </Button>
                ) : (
                  <Button
                    size="small"
                    variant="text"
                    endIcon={<ArrowUpRight size={15} />}
                    onClick={() => navigate(announcement.actionUrl as string)}
                    sx={{ gridColumn: { xs: 2, sm: 3 }, justifySelf: 'start', textAlign: 'left' }}
                  >
                    {announcement.actionLabel}
                  </Button>
                ))}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
