import { useRef, useState } from 'react';
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
        right: {
          xs: 'calc(16px + env(safe-area-inset-right, 0px))',
          sm: 'calc(24px + env(safe-area-inset-right, 0px))',
        },
        bottom: {
          xs: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          sm: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        },
        // Dialogs and their backdrops must always own focus and pointer input.
        zIndex: (theme) => theme.zIndex.modal - 1,
        width: { xs: 48, sm: 56 },
        height: { xs: 48, sm: 56 },
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
        sx={(theme) => ({
          width: { xs: 48, sm: 56 },
          height: { xs: 48, sm: 56 },
          p: 0,
          overflow: 'visible',
          bgcolor: 'rgba(5, 18, 42, 0.94)',
          border: '1px solid',
          borderColor: 'rgba(178, 218, 255, 0.76)',
          boxShadow: '0 12px 30px rgba(0, 13, 43, 0.26), inset 0 1px 0 rgba(255,255,255,0.18)',
          transition: theme.transitions.create(['background-color', 'border-color', 'box-shadow'], {
            duration: theme.transitions.duration.shorter,
          }),
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 4,
            borderRadius: '50%',
            border: '1px solid rgba(80, 224, 255, 0.48)',
            pointerEvents: 'none',
          },
          '&:hover': {
            bgcolor: 'rgba(7, 25, 56, 0.98)',
            borderColor: 'rgba(205, 235, 255, 0.96)',
            boxShadow: '0 16px 34px rgba(0, 13, 43, 0.32), 0 0 0 4px rgba(58, 179, 255, 0.12)',
          },
          '&:focus-visible': {
            outline: '3px solid var(--dwp-focus-ring, #8DB8FF)',
            outlineOffset: 3,
          },
          '@media (forced-colors: active)': {
            bgcolor: 'ButtonFace',
            borderColor: 'ButtonText',
            boxShadow: 'none',
            '&::before': { display: 'none' },
          },
          '@media (prefers-reduced-motion: reduce)': {
            transition: 'none',
            '&::before': { animation: 'none' },
          },
        })}
      >
        <Box
          data-testid="dwaion-mascot-motion"
          sx={{
            width: { xs: 48, sm: 56 },
            height: { xs: 48, sm: 56 },
          }}
        >
          <Box
            data-testid="dwaion-mascot-greeting"
            sx={{
              width: 1,
              height: 1,
              transformOrigin: '50% 72%',
            }}
          >
            <Box
              component="img"
              data-testid="dwaion-mascot"
              src="/assets/assistants/dwaion-link-v1.png"
              alt=""
              draggable={false}
              sx={(theme) => ({
                display: 'block',
                width: 1,
                height: 1,
                maxWidth: 'none',
                objectFit: 'contain',
                userSelect: 'none',
                filter: 'drop-shadow(0 8px 10px rgba(0, 17, 55, 0.3))',
                transition: theme.transitions.create('transform', {
                  duration: theme.transitions.duration.shorter,
                }),
                '.MuiIconButton-root:hover &': { transform: 'translateY(-3px) scale(1.06)' },
                '@media (prefers-reduced-motion: reduce)': {
                  transition: 'none',
                  transform: 'none',
                },
              })}
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
