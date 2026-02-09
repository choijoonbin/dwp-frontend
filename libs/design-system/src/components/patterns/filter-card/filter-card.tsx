import type { ReactNode } from 'react';
import type { Theme, SxProps } from '@mui/material/styles';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { Iconify } from '../../iconify';

// ----------------------------------------------------------------------

export type FilterCardProps = {
  /** 필터 제목 텍스트 */
  title: string;
  /** 선택된 필터 칩들 (ReactNode - 메뉴별 커스텀) */
  chips?: ReactNode;
  /** 초기화 버튼 라벨 */
  resetLabel?: string;
  /** 초기화 버튼 클릭 핸들러 */
  onReset?: () => void;
  /** 검색 버튼 라벨 */
  searchLabel?: string;
  /** 검색 버튼 클릭 핸들러 */
  onSearch?: () => void;
  /** 커스텀 필터 컨트롤 (기간, 검색, Select 등) */
  children: ReactNode;
  /** Card sx (여백 등) */
  sx?: SxProps<Theme>;
};

export const FilterCard = ({
  title,
  chips,
  resetLabel = '초기화',
  onReset,
  searchLabel = '검색',
  onSearch,
  children,
  sx,
}: FilterCardProps) => (
  <Card variant="outlined" sx={{ p: 2, ...sx }}>
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
      >
        <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1} sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          {chips}
        </Stack>
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          {onReset && (
            <Button
              variant="text"
              size="small"
              startIcon={<Iconify icon="solar:refresh-bold" width={16} />}
              onClick={onReset}
            >
              {resetLabel}
            </Button>
          )}
          {onSearch && (
            <Button
              variant="contained"
              size="small"
              startIcon={<Iconify icon="solar:magnifer-bold" width={16} />}
              onClick={onSearch}
            >
              {searchLabel}
            </Button>
          )}
        </Stack>
      </Stack>

      {children}
    </Stack>
  </Card>
);
