import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  CloudCog,
  LogOut,
  Mail,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { useAppearance } from '@dwp-frontend/design-system/appearance';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { redirectToSignIn } from '@dwp-frontend/shared-utils/auth/auth-redirect';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import {
  hasProviderControlPlaneRole,
  resolvePrimaryAuthorityRole,
} from '@dwp-frontend/shared-utils/auth/control-plane-access';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { isAppResourceEntitled } from '../components/workspace-composer/app-launchpad-model';
import { exitSessionWithTransition } from '../features/auth/session-exit-transition';
import { useProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';
import { canEnterCompanyAdministration } from '../features/admin/admin-access-policy';

const menuIconProps = { size: 19, strokeWidth: 1.8, 'aria-hidden': true } as const;

const authorityTranslationKeys: Record<string, string> = {
  PROVIDER_ADMIN: 'providerAdmin',
  PROVIDER_OPERATOR: 'providerOperator',
  PROVIDER_SUPPORT: 'providerSupport',
  PROVIDER_AUDITOR: 'providerAuditor',
  PROVIDER_TENANT_PROVISIONER: 'providerTenantProvisioner',
  PROVIDER_ENTITLEMENT_ADMIN: 'providerEntitlementAdmin',
  PROVIDER_CHANGE_APPROVER: 'providerChangeApprover',
  PROVIDER_RELEASE_APPROVER: 'providerReleaseApprover',
  PROVIDER_DATA_APPROVER: 'providerDataApprover',
  PLATFORM_ADMIN: 'platformAdmin',
  TENANT_ADMIN: 'tenantAdmin',
  ADMIN: 'tenantAdmin',
  AUDIT_ADMIN: 'auditAdmin',
  AUDITOR: 'auditor',
  IDENTITY_ADMIN: 'identityAdmin',
  APP_CATALOG_ADMIN: 'appCatalogAdmin',
  COMMUNICATIONS_EDITOR: 'communicationsEditor',
  COMMUNICATIONS_PUBLISHER: 'communicationsPublisher',
  SERVICE_CATALOG_MANAGER: 'serviceCatalogManager',
  SERVICE_AGENT: 'serviceAgent',
  APP_OWNER: 'appOwner',
  APP_CONFIG_ADMIN: 'appConfigAdmin',
  APP_ACCESS_MANAGER: 'appAccessManager',
  APP_ACCESS_APPROVER: 'appAccessApprover',
  APP_ACCESS_REVIEWER: 'appAccessReviewer',
  WORKSPACE_MEMBER: 'member',
};

export function AccountMenu({ showIdentity = false }: { showIdentity?: boolean }) {
  const { t } = useTranslation('shell');
  const auth = useAuth();
  const { effectiveReduceMotion } = useAppearance();
  const { permissions } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const buttonId = useId();
  const panelId = useId();
  const settingsDescriptionId = useId();
  const administrationDescriptionId = useId();
  const providerDescriptionId = useId();
  const displayName = auth.user?.displayName || t('account.fallbackName');
  const roles = auth.user?.roles ?? [];
  const providerRole = hasProviderControlPlaneRole(roles);
  const supportContext = useProviderSupportContext(providerRole);
  const authorityRole = resolvePrimaryAuthorityRole(roles, auth.user?.resourceRoles);
  const positionTitle = t(`account.roles.${authorityTranslationKeys[authorityRole] ?? 'member'}`);
  const identitySubtitle = auth.user?.jobTitle?.trim() || positionTitle;
  const isAdmin = canEnterCompanyAdministration(
    roles,
    isAppResourceEntitled('APP.ADMINISTRATION', permissions),
    Boolean(supportContext.data),
    auth.user?.resourceRoles
  );
  const isProviderAdmin = providerRole;
  const workspaceName =
    supportContext.data?.tenantName || auth.user?.tenantName || auth.user?.tenantCode;

  const close = () => setAnchor(null);
  const dismiss = () => {
    const trigger = anchor;
    setAnchor(null);
    window.requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus();
    });
  };
  const goTo = (path: string) => {
    close();
    navigate(path);
  };
  const logout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    close();
    await exitSessionWithTransition({
      endSession: auth.logout,
      navigateToSignIn: () => redirectToSignIn(navigate, location),
      reduceMotion: effectiveReduceMotion,
    });
  };
  return (
    <>
      <Tooltip title={showIdentity ? '' : displayName}>
        <Box
          component="button"
          type="button"
          id={buttonId}
          aria-label={t('account.buttonLabel', { name: displayName, position: identitySubtitle })}
          aria-haspopup="dialog"
          aria-controls={anchor ? panelId : undefined}
          aria-expanded={Boolean(anchor)}
          onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}
          sx={{
            py: 0.5,
            px: 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            color: 'text.primary',
            bgcolor: anchor ? 'action.selected' : 'transparent',
            border: 0,
            borderRadius: 1,
            cursor: 'pointer',
            font: 'inherit',
            textAlign: 'start',
            transition: (theme) => theme.transitions.create(['background-color', 'box-shadow']),
            boxShadow: (theme) =>
              anchor ? `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.22)}` : 'none',
            '&:hover': { bgcolor: anchor ? 'action.selected' : 'action.hover' },
            '&:focus-visible': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: 3,
            },
          }}
        >
          <Avatar
            sx={{
              width: 36,
              height: 36,
              flex: '0 0 36px',
              fontSize: 14,
              bgcolor: 'primary.main',
              border: 1,
              borderColor: 'divider',
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </Avatar>
          {showIdentity && (
            <Box
              sx={{
                minWidth: 0,
                maxWidth: 190,
                display: { xs: 'none', md: 'block' },
                '@container dwp-shell-header (max-width: 1000px)': { display: 'none' },
              }}
            >
              <Typography component="span" variant="subtitle2" noWrap sx={{ display: 'block' }}>
                {displayName}
              </Typography>
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                noWrap
                sx={{ display: 'block' }}
              >
                {identitySubtitle}
              </Typography>
            </Box>
          )}
          <Box
            component={ChevronDown}
            size={16}
            strokeWidth={1.8}
            aria-hidden="true"
            sx={{
              transform: anchor ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: (theme) => theme.transitions.create('transform'),
            }}
          />
        </Box>
      </Tooltip>

      <Popover
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={dismiss}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            id: panelId,
            role: 'dialog',
            'aria-label': t('account.panelLabel'),
            sx: {
              width: { xs: 'calc(100vw - 24px)', sm: 344 },
              maxWidth: 344,
              mt: 1,
              overflow: 'hidden',
            },
          },
        }}
      >
        <Box
          role="presentation"
          sx={{
            px: 2,
            py: 2,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.055),
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            <Avatar
              sx={{
                width: 48,
                height: 48,
                flex: '0 0 auto',
                fontSize: 17,
                fontWeight: 700,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                border: 2,
                borderColor: 'background.paper',
                boxShadow: (theme) => `0 0 0 1px ${theme.palette.divider}`,
              }}
            >
              {displayName.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography component="p" variant="subtitle1" noWrap>
                {displayName}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                {positionTitle}
              </Typography>
            </Box>
            <Tooltip title={t('account.menu.logout')} placement="left">
              <IconButton
                aria-label={t('account.menu.logout')}
                disabled={isLoggingOut}
                onClick={() => void logout()}
                sx={{
                  width: 32,
                  height: 32,
                  flex: '0 0 auto',
                  color: 'error.main',
                  bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
                  borderRadius: 1,
                  '&:hover': {
                    bgcolor: (theme) => alpha(theme.palette.error.main, 0.16),
                  },
                }}
              >
                <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
              </IconButton>
            </Tooltip>
          </Box>

          <Box sx={{ mt: 1.5, display: 'grid', gap: 0.75 }}>
            {auth.user?.email && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Mail size={15} strokeWidth={1.8} aria-hidden="true" />
                <Typography variant="caption" color="text.secondary" noWrap>
                  {auth.user.email}
                </Typography>
              </Box>
            )}
            {auth.user?.jobTitle && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <BriefcaseBusiness size={15} strokeWidth={1.8} aria-hidden="true" />
                <Typography variant="caption" color="text.secondary" noWrap>
                  {auth.user.jobTitle}
                </Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <ShieldCheck size={15} strokeWidth={1.8} aria-hidden="true" />
              <Typography variant="caption" color="text.secondary" noWrap>
                {t('account.access', { role: positionTitle })}
              </Typography>
            </Box>
            {workspaceName && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Building2 size={15} strokeWidth={1.8} aria-hidden="true" />
                <Typography variant="caption" color="text.secondary" noWrap>
                  {t('account.workspace', {
                    workspace: workspaceName,
                  })}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        <MenuList
          autoFocusItem={Boolean(anchor)}
          aria-label={t('account.actionsLabel')}
          sx={{ pt: 0, pb: 1 }}
        >
          {!supportContext.data && (
            <MenuItem
              aria-label={t('account.menu.settings')}
              aria-describedby={settingsDescriptionId}
              onClick={() => goTo('/account/profile')}
              sx={{ mx: 1, mt: 1, px: 1, py: 1, gap: 1.25, alignItems: 'center' }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  flex: '0 0 auto',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 1,
                  color: 'primary.main',
                  bgcolor: 'action.selected',
                }}
              >
                <Settings2 {...menuIconProps} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {t('account.menu.settings')}
                </Typography>
                <Typography
                  id={settingsDescriptionId}
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ display: 'block' }}
                >
                  {t('account.menu.settingsDescription')}
                </Typography>
              </Box>
              <ChevronRight size={17} strokeWidth={1.8} aria-hidden="true" />
            </MenuItem>
          )}
          {isAdmin && (
            <MenuItem
              aria-label={t('account.menu.administration')}
              aria-describedby={administrationDescriptionId}
              onClick={() => goTo('/admin')}
              sx={{
                mx: 1,
                mt: supportContext.data ? 1 : 0,
                px: 1,
                py: 1,
                gap: 1.25,
                alignItems: 'center',
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  flex: '0 0 auto',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 1,
                  color: 'secondary.main',
                  bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.12),
                }}
              >
                <ShieldCheck {...menuIconProps} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {t('account.menu.administration')}
                </Typography>
                <Typography
                  id={administrationDescriptionId}
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ display: 'block' }}
                >
                  {t(
                    supportContext.data
                      ? 'account.menu.supportAdministrationDescription'
                      : 'account.menu.administrationDescription',
                    { tenant: supportContext.data?.tenantName }
                  )}
                </Typography>
              </Box>
              <ChevronRight size={17} strokeWidth={1.8} aria-hidden="true" />
            </MenuItem>
          )}
          {isProviderAdmin && (
            <MenuItem
              aria-label={t('account.menu.provider')}
              aria-describedby={providerDescriptionId}
              onClick={() => goTo('/provider')}
              sx={{ mx: 1, px: 1, py: 1, gap: 1.25, alignItems: 'center' }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  flex: '0 0 auto',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 1,
                  color: 'info.main',
                  bgcolor: (theme) => alpha(theme.palette.info.main, 0.12),
                }}
              >
                <CloudCog {...menuIconProps} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {t('account.menu.provider')}
                </Typography>
                <Typography
                  id={providerDescriptionId}
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ display: 'block' }}
                >
                  {t('account.menu.providerDescription')}
                </Typography>
              </Box>
              <ChevronRight size={17} strokeWidth={1.8} aria-hidden="true" />
            </MenuItem>
          )}
        </MenuList>
      </Popover>
    </>
  );
}
