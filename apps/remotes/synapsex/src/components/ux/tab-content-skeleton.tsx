/**
 * Tab Content Skeleton — 탭 내부용 로딩 스켈레톤
 * @see docs/job/PROMPT_B_Frontend_Cases_TabsBind_P1_v2.txt
 */

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';

type TabContentSkeletonProps = {
  cards?: number;
};

export const TabContentSkeleton = ({ cards = 3 }: TabContentSkeletonProps) => (
  <Box sx={{ p: 2 }}>
    <Stack spacing={2}>
      {Array.from({ length: cards }).map((_, i) => (
        <Card key={i} variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="100%" height={20} />
            <Skeleton variant="text" width="80%" height={20} />
            <Skeleton variant="rounded" width="100%" height={8} sx={{ mt: 1 }} />
          </Stack>
        </Card>
      ))}
    </Stack>
  </Box>
);
