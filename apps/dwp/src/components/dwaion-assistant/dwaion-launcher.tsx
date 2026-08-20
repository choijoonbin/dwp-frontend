import { useRef, useState } from 'react';
import { keyframes } from '@emotion/react';
import { useTranslation } from 'react-i18next';
import { ActionIconButton } from '@dwp-frontend/design-system';

import type { AskPageContext } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';

import type { PopoverActions } from '@mui/material/Popover';

import { DwaionPanel } from './dwaion-panel';

type DwaionLauncherProps = {
  firstName?: string;
  pageContext?: AskPageContext;
  suggestionKeys?: readonly string[];
  onOpenWorkspace?: (query?: string, conversationId?: string) => void;
  onOpenGuide?: () => void;
  onOpenContacts?: () => void;
  onOpenStatus: () => void;
};

const mascotFloat = keyframes`
  0%, 100% { transform: translate3d(0, 1px, 0) rotate(-1deg); }
  30% { transform: translate3d(0, -7px, 0) rotate(1.2deg); }
  55% { transform: translate3d(0, -4px, 0) rotate(-0.5deg); }
  78% { transform: translate3d(0, -9px, 0) rotate(1.4deg); }
`;

const mascotGreeting = keyframes`
  0%, 58%, 80%, 100% { transform: rotate(0deg) scale(1); }
  62% { transform: rotate(-7deg) scale(1.045); }
  66% { transform: rotate(6deg) scale(1.035); }
  70% { transform: rotate(-4deg) scale(1.045); }
  74% { transform: rotate(3deg) scale(1.025); }
`;

const auraPulse = keyframes`
  0%, 100% {
    opacity: 0.42;
    transform: scale(0.86);
    box-shadow: 0 0 0 0 rgba(80, 224, 255, 0);
  }
  50% {
    opacity: 1;
    transform: scale(1.06);
    box-shadow: 0 0 18px 2px rgba(80, 224, 255, 0.24);
  }
`;

export function DwaionLauncher({
  firstName,
  pageContext,
  suggestionKeys,
  onOpenWorkspace,
  onOpenGuide,
  onOpenContacts,
  onOpenStatus,
}: DwaionLauncherProps) {
  const { t } = useTranslation('home');
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const popoverActions = useRef<PopoverActions>(null);
  const open = Boolean(anchorEl);
  const panelId = 'dwaion-home-panel';
  const closePanel = () => setAnchorEl(null);

  return (
    <Box
      data-testid="dwaion-launcher"
      sx={{
        position: 'fixed',
        right: { xs: 'max(14px, env(safe-area-inset-right))', sm: 24 },
        bottom: { xs: 'max(14px, env(safe-area-inset-bottom))', sm: 24 },
        zIndex: (theme) => theme.zIndex.snackbar - 1,
        width: { xs: 64, sm: 74 },
        height: { xs: 64, sm: 74 },
      }}
    >
      <ActionIconButton
        label={t(open ? 'dwaion.close' : 'dwaion.open')}
        tooltip={t(open ? 'dwaion.close' : 'dwaion.open')}
        tooltipPlacement="left"
        aria-controls={open ? panelId : undefined}
        aria-expanded={open || undefined}
        aria-haspopup="dialog"
        disableRipple
        onClick={(event) => setAnchorEl(open ? null : event.currentTarget)}
        sx={{
          width: { xs: 64, sm: 74 },
          height: { xs: 64, sm: 74 },
          p: 0,
          overflow: 'visible',
          bgcolor: 'rgba(5, 18, 42, 0.94)',
          border: '1px solid rgba(178, 218, 255, 0.76)',
          boxShadow: '0 12px 30px rgba(0, 13, 43, 0.26), inset 0 1px 0 rgba(255,255,255,0.18)',
          transition: (theme) =>
            theme.transitions.create(['background-color', 'border-color', 'box-shadow'], {
              duration: theme.transitions.duration.shorter,
            }),
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 4,
            borderRadius: '50%',
            border: '1px solid rgba(80, 224, 255, 0.48)',
            animation: `${auraPulse} 2.8s ease-in-out infinite`,
            pointerEvents: 'none',
          },
          '&:hover': {
            bgcolor: 'rgba(7, 25, 56, 0.98)',
            borderColor: 'rgba(205, 235, 255, 0.96)',
            boxShadow: '0 16px 34px rgba(0, 13, 43, 0.32), 0 0 0 4px rgba(58, 179, 255, 0.12)',
          },
          '&:focus-visible': { outline: '3px solid #8DB8FF', outlineOffset: 3 },
          '@media (forced-colors: active)': {
            bgcolor: 'ButtonFace',
            borderColor: 'ButtonText',
            '&::before': { display: 'none' },
          },
          '@media (prefers-reduced-motion: reduce)': {
            transition: 'none',
            '&::before': { animation: 'none' },
          },
        }}
      >
        <Box
          data-testid="dwaion-mascot-motion"
          sx={{
            width: { xs: 68, sm: 80 },
            height: { xs: 68, sm: 80 },
            animation: `${mascotFloat} ${open ? '5s' : '3.6s'} ease-in-out infinite`,
            '@media (prefers-reduced-motion: reduce)': { animation: 'none', transform: 'none' },
          }}
        >
          <Box
            data-testid="dwaion-mascot-greeting"
            sx={{
              width: 1,
              height: 1,
              transformOrigin: '50% 72%',
              animation: open ? 'none' : `${mascotGreeting} 7.2s ease-in-out infinite`,
              '@media (prefers-reduced-motion: reduce)': { animation: 'none', transform: 'none' },
            }}
          >
            <Box
              component="img"
              data-testid="dwaion-mascot"
              src="/assets/assistants/dwaion-link-v1.png"
              alt=""
              draggable={false}
              sx={{
                display: 'block',
                width: 1,
                height: 1,
                maxWidth: 'none',
                objectFit: 'contain',
                userSelect: 'none',
                filter: 'drop-shadow(0 8px 10px rgba(0, 17, 55, 0.3))',
                transition: (theme) =>
                  theme.transitions.create('transform', {
                    duration: theme.transitions.duration.shorter,
                  }),
                '.MuiIconButton-root:hover &': { transform: 'translateY(-3px) scale(1.06)' },
                '@media (prefers-reduced-motion: reduce)': {
                  transition: 'none',
                  transform: 'none',
                },
              }}
            />
          </Box>
        </Box>
      </ActionIconButton>

      <Popover
        id={panelId}
        action={popoverActions}
        open={open}
        anchorEl={anchorEl}
        onClose={closePanel}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        marginThreshold={12}
        disableScrollLock
        slotProps={{
          paper: {
            sx: {
              width: { xs: 'calc(100vw - 24px)', sm: 420 },
              maxWidth: 420,
              mb: 1.25,
              overflow: 'hidden',
              border: 1,
              borderColor: 'rgba(102, 132, 171, 0.34)',
              borderRadius: 2,
              bgcolor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(15, 23, 38, 0.98)' : 'rgba(255,255,255,0.98)',
              backgroundImage: 'none',
              backdropFilter: 'blur(24px) saturate(1.08)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.08)',
              boxShadow: '0 24px 64px rgba(11, 24, 52, 0.26)',
              '@media (prefers-reduced-transparency: reduce)': {
                bgcolor: 'background.paper',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
              },
              '@media (forced-colors: active)': {
                bgcolor: 'Canvas',
                borderColor: 'CanvasText',
                backdropFilter: 'none',
              },
            },
          },
        }}
      >
        <DwaionPanel
          firstName={firstName}
          pageContext={pageContext}
          suggestionKeys={suggestionKeys}
          onClose={closePanel}
          onOpenWorkspace={onOpenWorkspace}
          onOpenGuide={onOpenGuide}
          onOpenContacts={onOpenContacts}
          onOpenStatus={onOpenStatus}
          onSizeChange={() => popoverActions.current?.updatePosition()}
        />
      </Popover>
    </Box>
  );
}
