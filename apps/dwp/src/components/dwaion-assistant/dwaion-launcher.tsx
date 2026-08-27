import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { keyframes } from '@emotion/react';
import { ActionIconButton } from '@dwp-frontend/design-system';

import type { AskPageContext } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import useMediaQuery from '@mui/material/useMediaQuery';

import type { PopoverActions } from '@mui/material/Popover';

import { DwaionPanel } from './dwaion-panel';

const mascotFloat = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
`;

const mascotGreeting = keyframes`
  0%, 72%, 100% { transform: rotate(0deg) scale(1); }
  80% { transform: rotate(-2.5deg) scale(1.015); }
  88% { transform: rotate(2deg) scale(1.015); }
`;

type DwaionLauncherProps = {
  firstName?: string;
  pageContext?: AskPageContext;
  suggestionKeys?: readonly string[];
  onOpenWorkspace?: (query?: string, conversationId?: string) => boolean | Promise<boolean>;
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
  const [headerActions, setHeaderActions] = useState<HTMLElement | null>(null);
  const popoverActions = useRef<PopoverActions>(null);
  const compactHeaderDock = useMediaQuery('(max-width: 899.95px)', { noSsr: true });
  const open = Boolean(anchorEl);
  const panelId = 'dwaion-home-panel';
  const closePanel = () => setAnchorEl(null);

  useEffect(() => {
    if (!compactHeaderDock) {
      setHeaderActions(null);
      return undefined;
    }

    const resolveTarget = () => {
      const next = document.querySelector<HTMLElement>('[data-testid="shell-global-actions"]');
      setHeaderActions((current) => (current === next ? current : next));
    };
    resolveTarget();
    const observer = new MutationObserver(resolveTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [compactHeaderDock]);

  const headerDocked = compactHeaderDock && Boolean(headerActions);

  const launcherSize = headerDocked ? 44 : { xs: 48, sm: 56 };
  const placement = headerDocked ? 'header' : 'floating';
  const launcher = (
    <Box
      data-testid="dwaion-launcher"
      data-shell-auxiliary-layer=""
      data-shell-auxiliary-placement={placement}
      data-shell-auxiliary-edge={headerDocked ? 'header inline-end' : 'block-end inline-end'}
      sx={{
        position: headerDocked ? 'relative' : 'fixed',
        right: headerDocked
          ? 'auto'
          : {
              xs: 'calc(16px + env(safe-area-inset-right, 0px))',
              sm: 'calc(24px + env(safe-area-inset-right, 0px))',
            },
        bottom: headerDocked
          ? 'auto'
          : {
              xs: 'calc(16px + env(safe-area-inset-bottom, 0px))',
              sm: 'calc(24px + env(safe-area-inset-bottom, 0px))',
            },
        // Navigation drawers and modal surfaces must always own focus and pointer input.
        zIndex: headerDocked ? 'auto' : (theme) => theme.zIndex.drawer - 1,
        width: launcherSize,
        height: launcherSize,
        ml: headerDocked ? 0.25 : 0,
        flex: '0 0 auto',
        borderRadius: '50%',
        bgcolor: headerDocked ? 'transparent' : 'background.default',
        boxShadow: headerDocked
          ? 'none'
          : (theme) => `0 0 0 5px ${theme.palette.background.default}`,
        '@media (forced-colors: active)': {
          boxShadow: headerDocked ? 'none' : '0 0 0 3px Canvas',
        },
      }}
    >
      <ActionIconButton
        label={t(open ? 'dwaion.close' : 'dwaion.open')}
        tooltip={t(open ? 'dwaion.close' : 'dwaion.open')}
        tooltipPlacement={headerDocked ? 'bottom' : 'left'}
        aria-controls={open ? panelId : undefined}
        aria-expanded={open || undefined}
        aria-haspopup="dialog"
        disableRipple
        onClick={(event) => setAnchorEl(open ? null : event.currentTarget)}
        sx={(theme) => ({
          width: launcherSize,
          height: launcherSize,
          p: 0,
          overflow: 'visible',
          bgcolor: 'rgba(5, 18, 42, 0.94)',
          border: '1px solid',
          borderColor: 'rgba(178, 218, 255, 0.76)',
          boxShadow: headerDocked
            ? '0 4px 12px rgba(0, 13, 43, 0.2), inset 0 1px 0 rgba(255,255,255,0.18)'
            : '0 12px 30px rgba(0, 13, 43, 0.26), inset 0 1px 0 rgba(255,255,255,0.18)',
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
            width: launcherSize,
            height: launcherSize,
            animation: `${mascotFloat} 4.8s ease-in-out infinite`,
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        >
          <Box
            data-testid="dwaion-mascot-greeting"
            sx={{
              width: 1,
              height: 1,
              transformOrigin: '50% 72%',
              animation: open ? 'none' : `${mascotGreeting} 3.6s ease-in-out infinite`,
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
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
        anchorOrigin={{ vertical: headerDocked ? 'bottom' : 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: headerDocked ? 'top' : 'bottom', horizontal: 'right' }}
        marginThreshold={12}
        disableScrollLock
        slotProps={{
          paper: {
            sx: {
              width: { xs: 'calc(100vw - 24px)', sm: 420 },
              maxWidth: 420,
              mt: headerDocked ? 1.25 : 0,
              mb: headerDocked ? 0 : 1.25,
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

  if (compactHeaderDock && !headerActions) return null;
  return headerDocked && headerActions ? createPortal(launcher, headerActions) : launcher;
}
