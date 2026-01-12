import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

export const Entry = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" sx={{ mb: 1 }}>
            DWP Remote Module Starter
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            새로운 비즈니스 모듈의 시작점입니다.
          </Typography>
        </Box>

        <Card sx={{ p: 5, minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' }}>
          <Stack spacing={2} alignItems="center">
            <Typography variant="h6">내용을 채워주세요</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
              apps/remotes/[모듈명]/src/entry.tsx 파일을 수정하여<br />
              비즈니스 로직 개발을 시작하세요.
            </Typography>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
};
