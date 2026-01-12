import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { CONFIG } from 'src/config-global';
import { DashboardContent } from 'src/layouts/dashboard/content';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`Mail - ${CONFIG.appName}`}</title>

      <DashboardContent maxWidth="lg">
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="h4">Mail</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              이 영역은 Host의 <code>Outlet</code> 위치이며, 추후 Module Federation Remote가 마운트될 자리입니다.
            </Typography>
          </Stack>

          <Card sx={{ p: 3 }}>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1">Remote 준비 상태</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                현재는 Remote 앱을 <b>독립 Vite 서버</b>로 실행할 수 있도록 <code>apps/remotes/mail</code>을
                생성해두었습니다.
              </Typography>

              <Box>
                <Button
                  variant="contained"
                  color="primary"
                  href="http://localhost:4201"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Mail Remote (dev)
                </Button>
              </Box>
            </Stack>
          </Card>
        </Stack>
      </DashboardContent>
    </>
  );
}

