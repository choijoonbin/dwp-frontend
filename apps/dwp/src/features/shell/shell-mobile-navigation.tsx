import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system/components/actions/action-icon-button';

import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';

type ShellMobileNavigationOptions = {
  headerTestId: string;
  mainId?: string;
};

export type ShellMobileNavigationController = {
  open: boolean;
  openFrom: (trigger: HTMLButtonElement) => void;
  dismiss: () => void;
  navigate: () => void;
};

export function focusDesktopNavigationContext(mainId = 'dwp-main-content'): HTMLElement | null {
  const main = document.getElementById(mainId);
  const target =
    document.querySelector<HTMLElement>('[id$="-desktop-navigation"] [aria-current="page"]') ??
    main?.querySelector<HTMLElement>('h1') ??
    main;
  if (!target) return null;
  if (!target.matches('a, button, input, select, textarea, [tabindex]')) target.tabIndex = -1;
  target.focus({ preventScroll: true });
  return target;
}

export function useShellMobileNavigation({
  headerTestId,
  mainId = 'dwp-main-content',
}: ShellMobileNavigationOptions): ShellMobileNavigationController {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef(false);
  const openRef = useRef(false);

  const openFrom = useCallback((trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    restoreFocusRef.current = false;
    openRef.current = true;
    setOpen(true);
  }, []);

  const dismiss = useCallback(() => {
    restoreFocusRef.current = true;
    openRef.current = false;
    setOpen(false);
  }, []);

  const navigate = useCallback(() => {
    restoreFocusRef.current = false;
    openRef.current = false;
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const background = [
      document.querySelector<HTMLElement>(`[data-testid="${headerTestId}"]`),
      document.getElementById(mainId),
      ...document.querySelectorAll<HTMLElement>('[data-shell-auxiliary-layer]'),
    ].filter((element): element is HTMLElement => Boolean(element));
    const previousInertState = background.map((element) => ({
      element,
      inert: element.hasAttribute('inert'),
    }));

    for (const element of background) element.setAttribute('inert', '');

    return () => {
      for (const { element, inert } of previousInertState) {
        if (!inert) element.removeAttribute('inert');
      }
    };
  }, [headerTestId, mainId, open]);

  useEffect(() => {
    if (open || !restoreFocusRef.current) return undefined;

    restoreFocusRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      const trigger = triggerRef.current;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const desktop = window.matchMedia('(min-width:1200px)');
    let focusFrame: number | undefined;
    const closeForDesktop = (matches: boolean) => {
      if (!matches || !openRef.current) return;
      openRef.current = false;
      restoreFocusRef.current = false;
      setOpen(false);
      focusFrame = window.requestAnimationFrame(() => {
        focusDesktopNavigationContext(mainId);
      });
    };
    const onChange = (event: MediaQueryListEvent) => closeForDesktop(event.matches);
    closeForDesktop(desktop.matches);
    desktop.addEventListener('change', onChange);
    return () => {
      desktop.removeEventListener('change', onChange);
      if (focusFrame !== undefined) window.cancelAnimationFrame(focusFrame);
    };
  }, [mainId]);

  return { open, openFrom, dismiss, navigate };
}

type ShellMobileNavigationDrawerProps = {
  children: ReactNode;
  controlsId: string;
  label: string;
  onDismiss: () => void;
  open: boolean;
  testId: string;
  width: number;
};

export function ShellMobileNavigationDrawer({
  children,
  controlsId,
  label,
  onDismiss,
  open,
  testId,
  width,
}: ShellMobileNavigationDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onDismiss}
      ModalProps={{ disableRestoreFocus: true }}
      slotProps={{
        paper: {
          id: controlsId,
          'aria-label': label,
          sx: { width, height: '100dvh', overflow: 'hidden' },
        },
      }}
    >
      <Box data-testid={testId} sx={{ height: 1, minHeight: 0 }}>
        {children}
      </Box>
    </Drawer>
  );
}

export function ShellMobileNavigationCloseButton({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation('shell');

  return (
    <ActionIconButton
      label={t('navigation.close')}
      tooltipPlacement="bottom"
      tooltipDisablePortal
      onClick={onDismiss}
      sx={{ width: 40, height: 40, flex: '0 0 40px' }}
    >
      <X size={19} strokeWidth={1.8} aria-hidden="true" />
    </ActionIconButton>
  );
}
