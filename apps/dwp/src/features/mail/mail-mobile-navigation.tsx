import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArchiveX,
  Cable,
  CircleGauge,
  House,
  Inbox,
  Menu,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type {
  ProductAreaMobileShellContext,
  ProductAreaMobileShellPresentation,
} from '../../layouts/product-area-layout';

type MailMobileDestination = Readonly<{
  key: string;
  path: string;
  view: string;
  icon: typeof House;
}>;

const USER_DESTINATIONS = [
  { key: 'home', path: '/mail/home', view: 'home', icon: House },
  { key: 'inbox', path: '/mail/inbox', view: 'inbox', icon: Inbox },
  { key: 'shared', path: '/mail/shared', view: 'shared', icon: UsersRound },
] as const satisfies readonly MailMobileDestination[];

const ADMIN_DESTINATIONS = [
  {
    key: 'operations',
    path: '/mail/admin/overview',
    view: 'admin-overview',
    icon: CircleGauge,
  },
  {
    key: 'connections',
    path: '/mail/admin/connections',
    view: 'admin-connections',
    icon: Cable,
  },
  {
    key: 'access',
    path: '/mail/admin/shared-inboxes',
    view: 'admin-shared-inboxes',
    icon: UsersRound,
  },
  {
    key: 'policies',
    path: '/mail/admin/policies',
    view: 'admin-policies',
    icon: ShieldCheck,
  },
] as const satisfies readonly MailMobileDestination[];

function isActivePath(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

function useMobileKeyboardOpen() {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const editing = document.activeElement?.matches(
        'textarea, input:not([type="checkbox"]):not([type="radio"]), [contenteditable="true"]'
      );
      setKeyboardOpen(Boolean(editing && viewport && window.innerHeight - viewport.height > 120));
    };

    viewport?.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);

  return keyboardOpen;
}

function MailMobileNavigation({ context }: { context: ProductAreaMobileShellContext }) {
  const { t } = useTranslation('mail');
  const keyboardOpen = useMobileKeyboardOpen();
  useEffect(() => {
    const property = '--dwp-mobile-fixed-footer-offset';
    const root = document.documentElement;
    const previous = root.style.getPropertyValue(property);
    if (keyboardOpen) root.style.removeProperty(property);
    else root.style.setProperty(property, 'calc(58px + env(safe-area-inset-bottom, 0px))');
    return () => {
      if (previous) root.style.setProperty(property, previous);
      else root.style.removeProperty(property);
    };
  }, [keyboardOpen]);
  const admin = context.pathname.startsWith('/mail/admin');
  const visibleNavigationPaths = new Set(context.visibleNavigationPaths);
  const destinations = (admin ? ADMIN_DESTINATIONS : USER_DESTINATIONS).filter(({ path }) =>
    visibleNavigationPaths.has(path)
  );
  const directPaths = new Set<string>(destinations.map(({ path }) => path));
  const additionalNavigationPaths = context.visibleNavigationPaths.filter(
    (path) => !directPaths.has(path)
  );
  const showMore = additionalNavigationPaths.length > 0;
  const groupedRetentionAndAudit =
    admin &&
    additionalNavigationPaths.some(
      (path) => path === '/mail/admin/retention' || path === '/mail/admin/delivery-audit'
    );
  const moreSelected =
    showMore &&
    context.pathname.startsWith('/mail/') &&
    ![...directPaths].some((path) => isActivePath(context.pathname, path));
  const MoreIcon = groupedRetentionAndAudit ? ArchiveX : Menu;
  const moreLabel = t(
    `mobileNavigation.items.${groupedRetentionAndAudit ? 'retentionAudit' : 'more'}`
  );

  return (
    <Box
      component="nav"
      aria-label={t(`mobileNavigation.${admin ? 'adminLabel' : 'userLabel'}`)}
      data-testid="mail-mobile-bottom-navigation"
      data-shell-auxiliary-layer="true"
      sx={(theme) => ({
        position: 'fixed',
        inset: 'auto 0 0 0',
        zIndex: theme.zIndex.appBar,
        display: keyboardOpen ? 'none' : { xs: 'grid', lg: 'none' },
        gridTemplateColumns: `repeat(${destinations.length + (showMore ? 1 : 0)}, minmax(0, 1fr))`,
        minHeight: 'calc(58px + env(safe-area-inset-bottom, 0px))',
        pb: 'env(safe-area-inset-bottom, 0px)',
        bgcolor: alpha(theme.palette.background.paper, 0.97),
        borderTop: 1,
        borderColor: 'divider',
        backdropFilter: 'blur(12px)',
        '@media print': { display: 'none' },
        '@media (forced-colors: active)': {
          bgcolor: 'Canvas',
          borderColor: 'CanvasText',
          backdropFilter: 'none',
        },
      })}
    >
      {destinations.map(({ key, path, view, icon: Icon }) => {
        const selected = isActivePath(context.pathname, path);
        const label = t(`mobileNavigation.items.${key}`);
        return (
          <Box
            key={path}
            component={NavLink}
            to={path}
            aria-label={t(`navigation.items.mail.${view}.label`)}
            aria-current={selected ? 'page' : undefined}
            data-testid={`mail-mobile-navigation-${view}`}
            sx={(theme) => ({
              minWidth: 0,
              minHeight: 58,
              px: 0.25,
              py: 0.5,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.25,
              color: selected ? 'var(--dwp-product-accent)' : 'text.secondary',
              bgcolor: selected ? 'var(--dwp-product-selection)' : 'transparent',
              textDecoration: 'none',
              '&:focus-visible': {
                outline: `2px solid ${theme.palette.primary.main}`,
                outlineOffset: -2,
              },
              '@media (forced-colors: active)': selected
                ? { outline: '2px solid Highlight', outlineOffset: -2 }
                : undefined,
            })}
          >
            <Icon size={19} strokeWidth={selected ? 2.25 : 1.8} aria-hidden="true" />
            <Typography
              component="span"
              variant="caption"
              sx={{
                width: 1,
                px: 0.25,
                fontWeight: selected ? 'fontWeightBold' : 'fontWeightMedium',
                lineHeight: 1.15,
                textAlign: 'center',
                overflowWrap: 'anywhere',
              }}
            >
              {label}
            </Typography>
          </Box>
        );
      })}
      {showMore && (
        <Box
          component="button"
          type="button"
          aria-controls={context.navigation.controlsId}
          aria-expanded={context.navigation.expanded}
          aria-current={moreSelected ? 'page' : undefined}
          aria-label={moreLabel}
          data-testid="mail-mobile-navigation-more"
          onClick={(event) => context.navigation.onOpen(event.currentTarget)}
          sx={(theme) => ({
            minWidth: 0,
            minHeight: 58,
            m: 0,
            px: 0.25,
            py: 0.5,
            border: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.25,
            bgcolor: moreSelected ? 'var(--dwp-product-selection)' : 'transparent',
            color: moreSelected ? 'var(--dwp-product-accent)' : 'text.secondary',
            font: 'inherit',
            cursor: 'pointer',
            '&:focus-visible': {
              outline: `2px solid ${theme.palette.primary.main}`,
              outlineOffset: -2,
            },
            '@media (forced-colors: active)': moreSelected
              ? { outline: '2px solid Highlight', outlineOffset: -2 }
              : undefined,
          })}
        >
          <MoreIcon size={19} strokeWidth={moreSelected ? 2.25 : 1.8} aria-hidden="true" />
          <Typography
            component="span"
            variant="caption"
            sx={{
              width: 1,
              px: 0.25,
              fontWeight: moreSelected ? 'fontWeightBold' : 'fontWeightMedium',
              lineHeight: 1.15,
              textAlign: 'center',
              overflowWrap: 'anywhere',
            }}
          >
            {moreLabel}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export function resolveMailProductAreaMobileShell(
  context: ProductAreaMobileShellContext
): ProductAreaMobileShellPresentation {
  return {
    header: null,
    footer:
      context.visibleNavigationPaths.length > 0 ? (
        <MailMobileNavigation context={context} />
      ) : undefined,
  };
}
