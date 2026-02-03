/**
 * Table Loading Skeleton — 엔터프라이즈급 통일
 * @see SynapseX 운영형 UX 마감 - 전 화면 공통
 */

import Table from '@mui/material/Table';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';

type TableLoadingSkeletonProps = {
  rows?: number;
  columns?: number;
};

export const TableLoadingSkeleton = ({
  rows = 5,
  columns = 6,
}: TableLoadingSkeletonProps) => (
  <Table size="small">
    <TableHead>
      <TableRow>
        {Array.from({ length: columns }).map((_, i) => (
          <TableCell key={i}>
            <Skeleton width={i === 0 ? 120 : 80} height={20} />
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
    <TableBody>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <TableRow key={rowIdx}>
          {Array.from({ length: columns }).map((_col, colIdx) => (
            <TableCell key={colIdx}>
              <Skeleton
                width={colIdx === 0 ? 140 : 70}
                height={24}
                variant={colIdx === 0 ? 'text' : 'rounded'}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);
