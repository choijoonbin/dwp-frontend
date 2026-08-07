import { Link } from 'react-router-dom';
import { Logo } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

type StatusPageProps = {
  code: string;
  title: string;
};

export function StatusPage({ code, title }: StatusPageProps) {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 3 }}>
      <Logo isSingle={false} expandedText="DWP" sx={{ position: 'fixed', top: 24, left: 24 }} />
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h2">{code}</Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
          {title}
        </Typography>
        <Button component={Link} to="/" variant="contained">
          Home
        </Button>
      </Box>
    </Box>
  );
}
