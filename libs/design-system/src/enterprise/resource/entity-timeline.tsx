import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';

export type EntityTimelineItem = {
  id: string;
  title: string;
  summary?: string;
  timestamp: string;
  source?: string;
  status?: string;
  icon?: React.ReactNode;
};

export type EntityTimelineProps = {
  ariaLabel: string;
  items: EntityTimelineItem[];
  selectedId?: string;
  onSelect?: (item: EntityTimelineItem) => void;
};

export function EntityTimeline({ ariaLabel, items, selectedId, onSelect }: EntityTimelineProps) {
  return (
    <Box component="ol" aria-label={ariaLabel} sx={{ m: 0, p: 0, listStyle: 'none' }}>
      {items.map((item, index) => {
        const content = (
          <Box
            sx={{
              width: 1,
              display: 'grid',
              gridTemplateColumns: '28px minmax(0, 1fr)',
              gap: 1.5,
              px: 2,
              py: 1.75,
              textAlign: 'left',
              bgcolor: selectedId === item.id ? 'action.selected' : 'transparent',
            }}
          >
            <Box
              sx={{
                position: 'relative',
                display: 'grid',
                placeItems: 'start center',
                color: 'primary.main',
                pt: 0.25,
              }}
            >
              {item.icon ?? (
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'currentColor',
                    mt: 0.75,
                  }}
                />
              )}
              {index < items.length - 1 && (
                <Box
                  aria-hidden="true"
                  sx={{ position: 'absolute', top: 22, bottom: -22, width: 1, bgcolor: 'divider' }}
                />
              )}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography component="h3" variant="subtitle2">
                  {item.title}
                </Typography>
                {item.status && <Chip size="small" variant="outlined" label={item.status} />}
              </Box>
              {item.summary && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {item.summary}
                </Typography>
              )}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.75 }}
              >
                {[item.timestamp, item.source].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
          </Box>
        );
        return (
          <Box component="li" key={item.id} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            {onSelect ? (
              <ButtonBase onClick={() => onSelect(item)} sx={{ width: 1 }}>
                {content}
              </ButtonBase>
            ) : (
              content
            )}
          </Box>
        );
      })}
    </Box>
  );
}
