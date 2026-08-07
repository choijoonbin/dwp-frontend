import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

export default function HomePage() {
  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', pb: 3 }}>
        <Typography component="h1" variant="h4">
          DWP
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          New workspace
        </Typography>
      </Box>
    </Container>
  );
}
