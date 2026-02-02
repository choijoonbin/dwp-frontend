import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';

export const LoadingSkeleton = () => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, 1fr)' },
      gap: 2,
    }}
  >
    {[1, 2, 3].map((i) => (
      <Card key={i} variant="outlined">
        <CardHeader
          avatar={<Skeleton variant="circular" width={24} height={24} />}
          title={<Skeleton width="60%" />}
          subheader={<Skeleton width="80%" />}
        />
        <CardContent>
          <Stack spacing={1.5}>
            {[1, 2, 3].map((j) => (
              <Box
                key={j}
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  border: 1,
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Skeleton width={80} height={24} />
                <Skeleton variant="rounded" width={44} height={24} />
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>
    ))}
  </Box>
);
