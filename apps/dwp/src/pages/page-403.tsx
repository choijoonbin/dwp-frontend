import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

import { RouterLink } from 'src/routes/components';

import { CONFIG } from 'src/config-global';

import { Logo } from 'src/components/logo';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`403 Forbidden - ${CONFIG.appName}`}</title>

      <Logo sx={{ position: 'fixed', top: 20, left: 20 }} />

      <Container
        sx={{
          py: 10,
          flexGrow: 1,
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Typography variant="h3" sx={{ mb: 2 }}>
          403 Forbidden
        </Typography>

        <Typography sx={{ color: 'text.secondary', maxWidth: 480, textAlign: 'center' }}>
          접근 권한이 없습니다. 필요한 권한이 있다면 관리자에게 문의하세요.
        </Typography>

        <Box
          component="img"
          src="/assets/illustrations/illustration-404.svg"
          sx={{
            width: 320,
            height: 'auto',
            my: { xs: 5, sm: 10 },
          }}
        />

        <Button component={RouterLink} href="/" size="large" variant="contained" color="inherit">
          홈으로 돌아가기
        </Button>
      </Container>
    </>
  );
}
