import type { ReactNode } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

export type DataTableProps = {
  title?: string;
  toolbar?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyNode?: ReactNode;
  children: ReactNode;
};

export function DataTable({
  title,
  toolbar,
  loading,
  empty,
  emptyNode,
  children,
}: DataTableProps) {
  return (
    <Card>
      {(title || toolbar) && (
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {title && <Typography variant="h6">{title}</Typography>}
          {toolbar && <Box>{toolbar}</Box>}
        </Box>
      )}

      <Box sx={{ overflowX: 'auto' }}>
        {loading ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Loading...
            </Typography>
          </Box>
        ) : empty ? (
          emptyNode || (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                No data available
              </Typography>
            </Box>
          )
        ) : (
          children
        )}
      </Box>
    </Card>
  );
}
