import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  CalendarCheck2,
  FileClock,
  House,
  Network,
  ShieldCheck,
  UsersRound,
  Wrench,
} from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system/components/actions';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { useWorkplaceGovernanceCapabilities } from './rooms-capabilities';
import {
  parseWorkplaceGovernanceTab,
  WORKPLACE_GOVERNANCE_TABS,
} from './workplace-admin-governance-model';

import type { ProductAreaNavigationItemChildrenContext } from '../../layouts/product-area-layout';
import type { LucideIcon } from 'lucide-react';

type Subview = { value: string; label: string; icon: LucideIcon };

/** Existing PAGE authority remains on the parent; query values select its native subviews. */
export function WorkplaceNavigationSubviews({
  item,
  onNavigate,
}: ProductAreaNavigationItemChildrenContext) {
  const { t } = useTranslation('rooms');
  const location = useLocation();
  const governance = useWorkplaceGovernanceCapabilities();
  const current = new URLSearchParams(location.search);
  let key = 'view';
  let active = '';
  let views: Subview[] = [];
  if (item.view === 'home') {
    active = ['team', 'requests'].includes(current.get(key) ?? '') ? current.get(key)! : 'home';
    views = [
      { value: 'home', label: 'workplace.experience.memberHome', icon: House },
      { value: 'team', label: 'workplace.experience.teamMenu', icon: UsersRound },
      { value: 'requests', label: 'workplace.experience.facilityRequests', icon: Wrench },
    ];
  } else if (item.view === 'admin-overview') {
    active = current.get(key) === 'insights' ? 'insights' : 'overview';
    views = [
      { value: 'overview', label: 'workplace.experience.overview', icon: House },
      { value: 'insights', label: 'workplace.experience.insights', icon: BarChart3 },
    ];
  } else if (item.view === 'admin-operations') {
    active = ['audit', 'facilities'].includes(current.get(key) ?? '')
      ? current.get(key)!
      : 'bookings';
    views = [
      {
        value: 'bookings',
        label: 'workplace.admin.operations.tabs.bookings',
        icon: CalendarCheck2,
      },
      { value: 'facilities', label: 'workplace.experience.closures', icon: Wrench },
      { value: 'audit', label: 'workplace.admin.operations.tabs.audit', icon: FileClock },
    ];
  } else if (item.view === 'admin-governance') {
    if (!governance.isLoaded) return null;
    key = 'area';
    const visible = WORKPLACE_GOVERNANCE_TABS.filter((value) => governance[value].canView);
    const requested = parseWorkplaceGovernanceTab(current.get(key));
    active = visible.includes(requested) ? requested : (visible[0] ?? '');
    views = visible.map((value) => ({
      value,
      label: `workplace.admin.governance.tabs.${value}`,
      icon: value === 'hierarchy' ? Network : ShieldCheck,
    }));
  }
  if (!views.length) return null;
  return (
    <Box
      component="nav"
      aria-label={t(`navigation.items.rooms.${item.view}.label`)}
      sx={{ ml: 2.5, pl: 1, mt: 0.5, mb: 0.75, borderLeft: 1, borderColor: 'divider' }}
    >
      <Stack gap={0.25}>
        {views.map(({ value, label, icon: Icon }) => {
          const selected = location.pathname === item.path && value === active;
          const search =
            location.pathname === item.path ? new URLSearchParams(current) : new URLSearchParams();
          if (current.has('scope')) search.set('scope', current.get('scope')!);
          search.set(key, value);
          return (
            <ActionButton
              key={value}
              component={NavLink}
              to={`${item.path}?${search.toString()}`}
              data-testid={`workplace-subview-${item.view}-${value}`}
              aria-current={selected ? 'page' : false}
              intent="quiet"
              fullWidth
              size="small"
              startIcon={<Icon size={14} aria-hidden="true" />}
              onClick={onNavigate}
              sx={{
                justifyContent: 'flex-start',
                minHeight: 36,
                px: 1,
                borderRadius: foundationTokens.radius.control + 'px',
                color: selected ? 'var(--dwp-product-accent)' : 'text.secondary',
                bgcolor: selected ? 'var(--dwp-product-selection)' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
                '@media (forced-colors: active)': selected
                  ? { outline: '2px solid Highlight', outlineOffset: -2 }
                  : undefined,
              }}
            >
              {t(label)}
            </ActionButton>
          );
        })}
      </Stack>
    </Box>
  );
}
