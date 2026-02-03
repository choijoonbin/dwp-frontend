/**
 * Error State with Retry CTA — 엔터프라이즈급 통일
 * @see SynapseX 운영형 UX 마감 - 전 화면 공통
 */

import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

type ErrorStateWithRetryProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  is403?: boolean;
};

export const ErrorStateWithRetry = ({
  title,
  message,
  onRetry,
  is403 = false,
}: ErrorStateWithRetryProps) => {
  const displayTitle = title ?? (is403 ? '권한 부족' : 'Failed to load');
  const displayMessage =
    message ??
    (is403
      ? '이 리소스에 대한 접근 권한이 없거나 가드레일 위반으로 차단되었습니다.'
      : 'Unknown error');

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Card variant="outlined">
        <CardContent sx={{ p: 6, textAlign: 'center' }}>
          <Iconify
            icon={is403 ? 'solar:lock-bold-duotone' : 'solar:danger-triangle-bold-duotone'}
            width={48}
            sx={{ color: is403 ? 'warning.main' : 'error.main', mb: 2 }}
          />
          <Typography variant="h6" sx={{ mb: 1 }}>
            {displayTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {displayMessage}
          </Typography>
          {onRetry && !is403 && (
            <Button
              variant="outlined"
              onClick={onRetry}
              startIcon={<Iconify icon="solar:refresh-bold" width={18} />}
            >
              Retry
            </Button>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
