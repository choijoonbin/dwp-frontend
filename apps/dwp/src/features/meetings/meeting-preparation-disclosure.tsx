import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

/** Keep safeguards readable without making every mobile card a repeated notice. */
export function MeetingPreparationDisclosure({
  label,
  children,
  forceOpen = false,
}: {
  label: ReactNode;
  children: ReactNode;
  forceOpen?: boolean;
}) {
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const [expanded, setExpanded] = useState(forceOpen);
  useEffect(() => {
    if (forceOpen) setExpanded(true);
  }, [forceOpen]);
  return (
    <Box
      component="details"
      open={!compact || expanded}
      onToggle={(event) => {
        if (compact) setExpanded(event.currentTarget.open);
      }}
      sx={{
        minWidth: 0,
        '& > summary': {
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          cursor: 'pointer',
          listStyle: 'none',
          display: { xs: 'flex', md: 'none' },
          '&::-webkit-details-marker': { display: 'none' },
          '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
        },
      }}
    >
      <Box component="summary">
        <Typography component="span" variant="caption" fontWeight="fontWeightMedium">
          {label}
        </Typography>
        <ChevronDown size={15} aria-hidden="true" />
      </Box>
      {children}
    </Box>
  );
}
