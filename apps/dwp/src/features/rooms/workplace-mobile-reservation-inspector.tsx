import { useEffect, useRef } from 'react';
import { ActionButton } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { workplaceMemberCard } from './workplace-member-surfaces';

import type { KeyboardEvent, ReactNode, RefObject } from 'react';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function visibleFocusTargets(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) =>
      element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true'
  );
}

export function WorkplaceMobileReservationInspector({
  children,
  closeLabel,
  fallbackFocusRef,
  label,
  onClose,
  openerRef,
}: {
  children: ReactNode;
  closeLabel: string;
  fallbackFocusRef: RefObject<HTMLElement | null>;
  label: string;
  onClose: () => void;
  openerRef: RefObject<HTMLElement | null>;
}) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const inspectorRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!mobile) return;
    const previousOverflow = document.body.style.overflow;
    const opener = openerRef.current;
    const fallback = fallbackFocusRef.current;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => {
        const returnTarget = opener?.isConnected ? opener : fallback;
        if (returnTarget?.isConnected) returnTarget.focus();
      });
    };
  }, [fallbackFocusRef, mobile, openerRef]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!mobile) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !inspectorRef.current) return;
    const targets = visibleFocusTargets(inspectorRef.current);
    if (!targets.length) return;
    const first = targets[0]!;
    const last = targets.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <Box
      component="div"
      ref={inspectorRef}
      role={mobile ? 'dialog' : 'complementary'}
      aria-modal={mobile ? true : undefined}
      aria-label={label}
      onKeyDown={handleKeyDown}
      sx={(currentTheme) => ({
        ...workplaceMemberCard(currentTheme),
        minWidth: 0,
        position: { xs: 'fixed', md: 'static' },
        inset: { xs: 'auto 0 0', md: 'auto' },
        maxHeight: { xs: 'calc(100dvh - 64px)', md: 'none' },
        overflowY: { xs: 'auto', md: 'visible' },
        zIndex: { xs: currentTheme.zIndex.drawer, md: 'auto' },
      })}
    >
      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          justifyContent: 'flex-end',
          position: 'sticky',
          top: 0,
          zIndex: 3,
          p: 0.5,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <ActionButton
          ref={closeRef}
          intent="quiet"
          size="small"
          onClick={onClose}
          sx={{ minHeight: 44 }}
        >
          {closeLabel}
        </ActionButton>
      </Box>
      {children}
    </Box>
  );
}
