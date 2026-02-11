/**
 * 통합관제센터 Empty State — 아이콘 + 설명 + CTA 최대 2개 (Primary outline + Secondary ghost)
 * 카드별 목적에 맞는 CTA만 노출. "케이스 보기"는 페이지 상단 전역 1곳만 사용.
 */

import { Link } from 'react-router-dom';
import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

export type DashboardEmptyStateAction = {
  label: string;
  /** 라우트 경로 (Link 사용) */
  to?: string;
  onClick?: () => void;
  variant: 'primary' | 'secondary';
  icon?: string;
};

export type DashboardEmptyStateProps = {
  icon?: string;
  title: string;
  description: string;
  /** 최대 2개. Primary 1 + Secondary 1. 카드 목적에 맞는 CTA만. */
  actions?: DashboardEmptyStateAction[];
  compact?: boolean;
};

export const DashboardEmptyState = ({
  icon = 'solar:database-outline',
  title,
  description,
  actions = [],
  compact = true,
}: DashboardEmptyStateProps) => {
  const actionList = actions.slice(0, 2);

  return (
    <Box
      sx={{
        py: compact ? 2.5 : 4,
        px: 2,
        textAlign: 'center',
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'action.hover',
        minHeight: compact ? 'auto' : 120,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Iconify icon={icon} width={compact ? 32 : 40} sx={{ color: 'text.disabled', mb: 1 }} />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1.5 }}>
        {description}
      </Typography>
      {actionList.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="center">
          {actionList.map((action, idx) => {
            const isPrimary = action.variant === 'primary';
            const btn = (
              <Button
                key={idx}
                component={action.to ? Link : 'button'}
                to={action.to}
                variant={isPrimary ? 'outlined' : 'text'}
                size="small"
                onClick={action.onClick}
                startIcon={
                  action.icon ? <Iconify icon={action.icon} width={16} /> : undefined
                }
                sx={!isPrimary ? { color: 'text.secondary' } : undefined}
              >
                {action.label}
              </Button>
            );
            return btn;
          })}
        </Stack>
      )}
    </Box>
  );
};
