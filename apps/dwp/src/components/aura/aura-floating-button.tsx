// ----------------------------------------------------------------------

import { useEffect } from 'react';
import { keyframes } from '@emotion/react';

import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';

import { useAuraStore, useAuraActions } from 'src/store/use-aura-store';

// ----------------------------------------------------------------------

const pulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(99, 73, 253, 0.7);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(99, 73, 253, 0);
  }
`;

const bounce = keyframes`
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
`;

export const AuraFloatingButton = () => {
  const theme = useTheme();
  const isOverlayOpen = useAuraStore((state) => state.isOverlayOpen);
  const hasNotification = useAuraStore((state) => state.hasNotification);
  const notificationCount = useAuraStore((state) => state.notificationCount);
  const { toggleOverlay } = useAuraActions();

  // Check for notifications periodically (example)
  useEffect(() => {
    // This would be replaced with actual notification logic
    // For now, we'll just set a demo notification
    const timer = setTimeout(() => {
      // Demo: Set notification after 5 seconds
      // In real implementation, this would check for AI suggestions
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: theme.zIndex.drawer + 200,
      }}
    >
      <Badge
        badgeContent={hasNotification ? notificationCount || '!' : 0}
        color="primary"
        overlap="circular"
        sx={{
          '& .MuiBadge-badge': {
            animation: hasNotification ? `${pulse} 2s infinite` : 'none',
          },
        }}
      >
        <IconButton
          onClick={toggleOverlay}
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            bgcolor: 'background.paper',
            boxShadow: theme.customShadows.z24,
            border: `2px solid ${theme.vars.palette.primary.main}`,
            position: 'relative',
            overflow: 'hidden',
            '&:hover': {
              animation: `${bounce} 0.3s ease-in-out`,
              boxShadow: `0 0 20px ${theme.vars.palette.primary.main}40`,
            },
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              padding: '2px',
              background: `linear-gradient(135deg, ${theme.vars.palette.primary.light}, ${theme.vars.palette.primary.main})`,
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              opacity: isOverlayOpen ? 1 : 0.5,
              transition: 'opacity 0.3s',
            },
          }}
        >
          <Box
            component="img"
            src="/assets/images/arua.gif"
            alt="Aura AI Assistant"
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '50%',
            }}
          />
        </IconButton>
      </Badge>
    </Box>
  );
};
