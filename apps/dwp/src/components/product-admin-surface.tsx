import { PageCanvas, ResourcePageHeader } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';

import type { ReactNode } from 'react';

export function ProductAdminSurface({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <PageCanvas>
      <ResourcePageHeader eyebrow={eyebrow} title={title} description={description} />
      <Box sx={{ mt: 3 }}>{children}</Box>
    </PageCanvas>
  );
}
