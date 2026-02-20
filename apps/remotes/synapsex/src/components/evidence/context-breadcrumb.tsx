/**
 * Context Breadcrumb
 * 규정 청크의 계층 경로를 [장 > 조 > 항] 형태로 표시
 */

import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import { alpha, useTheme } from '@mui/material/styles';

import {
  type HierarchyPath,
  type HierarchyPathItem,
  HIERARCHY_LEVEL_LABELS,
} from './types';

// ----------------------------------------------------------------------

interface ContextBreadcrumbProps {
  path: HierarchyPath;
  /** 각 레벨 클릭 시 해당 위치로 스크롤 이동 */
  onNavigate?: (item: HierarchyPathItem, index: number) => void;
  /** 컴팩트 모드 (작은 폰트) */
  compact?: boolean;
}

export function ContextBreadcrumb({ path, onNavigate, compact = false }: ContextBreadcrumbProps) {
  const theme = useTheme();

  if (!path || path.length === 0) return null;

  const levelColors: Record<string, string> = {
    CHAPTER: theme.palette.primary.main,
    ARTICLE: theme.palette.info.main,
    CLAUSE: theme.palette.success.main,
    PARAGRAPH: theme.palette.warning.main,
  };

  return (
    <Stack
      direction="row"
      alignItems="center"
      flexWrap="wrap"
      sx={{
        gap: 0.5,
        py: 0.5,
        px: 1,
        borderRadius: 1,
        bgcolor: alpha(theme.palette.primary.main, 0.04),
        border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
      }}
    >
      <Iconify
        icon="solar:book-2-bold-duotone"
        width={compact ? 14 : 16}
        sx={{ color: 'primary.main', flexShrink: 0 }}
      />
      {path.map((item, idx) => {
        const prefix = HIERARCHY_LEVEL_LABELS[item.level];
        const label = item.number ? `제${item.number}${prefix}` : prefix;
        const color = levelColors[item.level] || theme.palette.text.primary;
        const isClickable = Boolean(onNavigate && item.anchorId);

        const content = (
          <Stack direction="row" alignItems="center" spacing={0.25}>
            <Typography
              variant={compact ? 'caption' : 'body2'}
              sx={{
                fontWeight: 600,
                color,
                cursor: isClickable ? 'pointer' : 'default',
                '&:hover': isClickable
                  ? { textDecoration: 'underline' }
                  : {},
              }}
            >
              {label}
            </Typography>
            {item.title && (
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', fontWeight: 400 }}
              >
                ({item.title})
              </Typography>
            )}
          </Stack>
        );

        return (
          <Stack key={idx} direction="row" alignItems="center" spacing={0.5}>
            {idx > 0 && (
              <Iconify
                icon="solar:alt-arrow-right-linear"
                width={12}
                sx={{ color: 'text.disabled' }}
              />
            )}
            {isClickable ? (
              <Tooltip title="원문 위치로 이동" arrow>
                <ButtonBase
                  onClick={() => onNavigate?.(item, idx)}
                  sx={{ borderRadius: 0.5, px: 0.5 }}
                >
                  {content}
                </ButtonBase>
              </Tooltip>
            ) : (
              <Box sx={{ px: 0.25 }}>{content}</Box>
            )}
          </Stack>
        );
      })}
    </Stack>
  );
}
