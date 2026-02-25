/**
 * 공통 패널 헤더 — 좌/중앙/우측 패널 헤더 통일 (통합 툴바 라인)
 * 규격: 높이 56px, 통일 배경(action.hover), 하단 보더 1px, 제목 폰트 subtitle2 + fontWeight 600
 */

import type { Theme, SxProps } from '@mui/material/styles';

import type { ReactNode } from 'react';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export type PanelHeaderProps = {
  /** 헤더 제목 (subtitle2, 굵게) */
  title?: ReactNode;
  /** 우측 영역 (필터 칩, 탭, 상태 배지 등) */
  children?: ReactNode;
  sx?: SxProps<Theme>;
};

const HEADER_HEIGHT = 56;
const PADDING_X = 2; // 16px

export const PanelHeader = ({ title, children, sx }: PanelHeaderProps) => (
  <Box
    sx={{
      height: HEADER_HEIGHT,
      minHeight: HEADER_HEIGHT,
      px: PADDING_X,
      borderBottom: 1,
      borderColor: 'divider',
      bgcolor: 'action.hover',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: title != null && children == null ? 'flex-start' : 'space-between',
      gap: 1,
      overflow: 'hidden',
      ...sx,
    }}
  >
    {title != null && (
      <Typography variant="subtitle2" color="text.secondary" sx={{ flexShrink: 0, fontWeight: 600 }}>
        {title}
      </Typography>
    )}
    {children}
  </Box>
);
