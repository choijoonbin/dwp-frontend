import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';

export const PiiLoadingSkeleton = () => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' },
      gap: 2,
    }}
  >
    {[1, 2].map((i) => (
      <Card key={i} variant="outlined">
        <CardHeader
          avatar={<Skeleton variant="circular" width={24} height={24} />}
          title={<Skeleton width="40%" />}
          subheader={<Skeleton width="60%" />}
        />
        <CardContent>
          <Stack spacing={1.5}>
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} variant="rounded" height={56} />
            ))}
          </Stack>
        </CardContent>
      </Card>
    ))}
  </Box>
);
