/**
 * Tab Error State — 탭 내부용 compact error + retry
 * @see docs/job/PROMPT_B_Frontend_Cases_TabsBind_P1_v2.txt
 */

import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

type TabErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

export const TabErrorState = ({
  title,
  message,
  onRetry,
}: TabErrorStateProps) => {
  const { t } = useTranslation('common');
  return (
  <Box
    sx={{
      py: 6,
      px: 2,
      textAlign: 'center',
      borderRadius: 1,
      border: 1,
      borderColor: 'divider',
      bgcolor: 'action.hover',
    }}
  >
    <Iconify
      icon="solar:danger-triangle-bold-duotone"
      width={40}
      sx={{ color: 'error.main', mb: 1 }}
    />
    <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
      {title}
    </Typography>
    <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
      {message}
    </Typography>
    {onRetry && (
      <Button
        variant="outlined"
        size="small"
        onClick={onRetry}
        startIcon={<Iconify icon="solar:refresh-bold" width={16} />}
      >
        {t('error.errorState.retry')}
      </Button>
    )}
  </Box>
  );
};
