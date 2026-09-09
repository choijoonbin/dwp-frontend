import { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';

import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import type { ReactNode } from 'react';

export function NotificationResponsiveCatalog({
  list,
  detail,
  detailOpen,
  onBack,
  backLabel,
  listLabel,
  detailLabel,
  desktopColumns,
  listMaxHeight,
  testId,
}: {
  list: ReactNode;
  detail: ReactNode;
  detailOpen: boolean;
  onBack: () => void;
  backLabel: string;
  listLabel: string;
  detailLabel: string;
  desktopColumns: string;
  listMaxHeight: number;
  testId: string;
}) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('lg'));
  const listRef = useRef<HTMLElement | null>(null);
  const detailRef = useRef<HTMLElement | null>(null);
  const previousDetailOpen = useRef(detailOpen);

  useEffect(() => {
    if (!mobile || previousDetailOpen.current === detailOpen) return;
    if (detailOpen) {
      detailRef.current?.focus();
    } else {
      listRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
    }
    previousDetailOpen.current = detailOpen;
  }, [detailOpen, mobile]);

  return (
    <Box
      data-testid={testId}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: desktopColumns },
        border: 1,
        borderColor: 'divider',
        borderRadius: 'shape.borderRadius',
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        ref={listRef}
        component="section"
        aria-label={listLabel}
        sx={{
          minWidth: 0,
          display: { xs: detailOpen ? 'none' : 'block', lg: 'block' },
          borderRight: { lg: 1 },
          borderColor: 'divider',
          maxHeight: { lg: listMaxHeight },
          overflowY: { lg: 'auto' },
        }}
      >
        {list}
      </Box>
      <Box
        ref={detailRef}
        component="section"
        aria-label={detailLabel}
        tabIndex={-1}
        sx={{
          minWidth: 0,
          display: { xs: detailOpen ? 'block' : 'none', lg: 'block' },
          outline: 0,
        }}
      >
        <Box
          sx={{
            display: { xs: 'block', lg: 'none' },
            px: 1.5,
            py: 1,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<ArrowLeft size={17} />}
            onClick={onBack}
          >
            {backLabel}
          </ActionButton>
        </Box>
        {detail}
      </Box>
    </Box>
  );
}
