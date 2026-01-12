import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { CONFIG } from 'src/config-global';
import { DashboardContent } from 'src/layouts/dashboard/content';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`Chat - ${CONFIG.appName}`}</title>

      <DashboardContent maxWidth="lg">
        <Stack spacing={2}>
          <Typography variant="h4">Chat</Typography>
          <Card sx={{ p: 3 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Chat Remote 모듈이 들어올 예정입니다.
            </Typography>
          </Card>
        </Stack>
      </DashboardContent>
    </>
  );
}

