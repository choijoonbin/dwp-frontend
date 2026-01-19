import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

export const AuditPage = () => (
  <Box sx={{ p: 3 }}>
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h4">감사 로그</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          시스템 사용 이력 및 감사 로그를 확인합니다.
        </Typography>
      </Stack>

      <Card sx={{ p: 3, minHeight: 400 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {/* TODO: 감사 로그 목록 테이블 구현 */}
          감사 로그 기능은 BE P0-3에서 API 확정 후 구현 예정입니다.
        </Typography>
      </Card>
    </Stack>
  </Box>
);
