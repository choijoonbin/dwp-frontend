import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, FileStack, Network, Scale, ShieldCheck } from 'lucide-react';
import { ActionButton, ConfirmDialog, PageCanvas } from '@dwp-frontend/design-system';
import { useBlocker, useSearchParams } from 'react-router-dom';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';

import { useWorkplaceGovernanceCapabilities } from './rooms-capabilities';
import { RoomsPageHeading, RoomsPermissionNotice } from './rooms-ui';
import { WorkplaceAdminGovernanceAccess } from './workplace-admin-governance-access';
import { WorkplaceAdminGovernanceDelegation } from './workplace-admin-governance-delegation';
import { WorkplaceAdminGovernanceFloorPlans } from './workplace-admin-governance-floor-plans';
import { WorkplaceAdminGovernanceHierarchy } from './workplace-admin-governance-hierarchy';
import { WorkplaceAdminGovernancePolicy } from './workplace-admin-governance-policy';

import {
  parseWorkplaceGovernanceTab,
  WORKPLACE_GOVERNANCE_TABS,
} from './workplace-admin-governance-model';

import type { WorkplaceGovernanceTab } from './workplace-admin-governance-model';

const TABS = [
  { value: 'hierarchy', icon: Network },
  { value: 'access', icon: ShieldCheck },
  { value: 'policy', icon: Scale },
  { value: 'floorPlans', icon: FileStack },
  { value: 'delegation', icon: Building2 },
] as const;

export function WorkplaceAdminGovernance() {
  const { t } = useTranslation('rooms');
  const capabilities = useWorkplaceGovernanceCapabilities();
  const [searchParams, setSearchParams] = useSearchParams();
  const [draftDirty, setDraftDirty] = useState(false);
  const draftDirtyRef = useRef(false);
  const [pendingTab, setPendingTab] = useState<WorkplaceGovernanceTab | null>(null);
  const [approvedTab, setApprovedTab] = useState<WorkplaceGovernanceTab | null>(null);
  const visibleTabs = useMemo(
    () => WORKPLACE_GOVERNANCE_TABS.filter((candidate) => capabilities[candidate].canView),
    [capabilities]
  );
  const requestedTab = parseWorkplaceGovernanceTab(searchParams.get('area'));
  const tab = visibleTabs.includes(requestedTab) ? requestedTab : (visibleTabs[0] ?? 'hierarchy');
  const tabNavigationBlocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      draftDirtyRef.current &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search)
  );
  const selectTab = (nextTab: WorkplaceGovernanceTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('area', nextTab);
    setSearchParams(next, { replace: true });
  };
  const handleDraftDirty = useCallback((dirty: boolean) => {
    draftDirtyRef.current = dirty;
    setDraftDirty(dirty);
  }, []);
  useEffect(() => {
    if (!capabilities.isLoaded || !visibleTabs.length || requestedTab === tab) return;
    selectTab(tab);
    // Search parameters are intentionally normalized once capabilities resolve.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capabilities.isLoaded, requestedTab, tab, visibleTabs.length]);
  useEffect(() => {
    if (!approvedTab || draftDirty) return;
    selectTab(approvedTab);
    setApprovedTab(null);
    // The approved tab is applied only after the dirty editor has unmounted its guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvedTab, draftDirty]);

  return (
    <PageCanvas>
      <RoomsPageHeading
        eyebrow={t('workplace.admin.governance.eyebrow')}
        title={t('workplace.admin.governance.title')}
        description={t('workplace.admin.governance.description')}
      />

      {capabilities.isLoaded && !capabilities.canViewAny ? (
        <Alert severity="error">{t('permissions.adminCatalogReadOnly')}</Alert>
      ) : null}
      {capabilities.isError ? (
        <Alert
          severity="error"
          action={
            <ActionButton intent="secondary" onClick={() => void capabilities.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('workplace.admin.governance.common.loadError')}
        </Alert>
      ) : null}
      {capabilities.isLoaded && capabilities.canViewAny && !capabilities[tab].canManage ? (
        <RoomsPermissionNotice>
          {t('workplace.admin.governance.common.readOnly')}
        </RoomsPermissionNotice>
      ) : null}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2, overflowX: 'auto' }}>
        <Tabs
          value={tab}
          onChange={(_, value: WorkplaceGovernanceTab) => {
            if (draftDirtyRef.current) setPendingTab(value);
            else selectTab(value);
          }}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label={t('workplace.admin.governance.tabs.label')}
        >
          {TABS.filter(({ value }) => visibleTabs.includes(value)).map(({ value, icon: Icon }) => (
            <Tab
              key={value}
              value={value}
              icon={<Icon size={17} />}
              iconPosition="start"
              label={t(`workplace.admin.governance.tabs.${value}`)}
            />
          ))}
        </Tabs>
      </Box>

      {capabilities.canViewAny ? (
        <>
          {tab === 'hierarchy' ? (
            <WorkplaceAdminGovernanceHierarchy
              canManage={capabilities.hierarchy.canManage}
              canManageCampus={capabilities.hierarchy.canManageCampus}
            />
          ) : null}
          {tab === 'access' ? (
            <WorkplaceAdminGovernanceAccess canManage={capabilities.access.canManage} />
          ) : null}
          {tab === 'policy' ? (
            <WorkplaceAdminGovernancePolicy
              canManage={capabilities.policy.canManage}
              globalAdministrator={capabilities.globalAdministrator}
              effectiveScopes={capabilities.effectiveScopes}
            />
          ) : null}
          {tab === 'floorPlans' ? (
            <WorkplaceAdminGovernanceFloorPlans
              canManage={capabilities.floorPlans.canManage}
              onDirtyChange={handleDraftDirty}
            />
          ) : null}
          {tab === 'delegation' ? (
            <WorkplaceAdminGovernanceDelegation
              canManage={capabilities.delegation.canManage}
              canViewAssignments={capabilities.delegation.canViewAssignments}
            />
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingTab) || tabNavigationBlocker.state === 'blocked'}
        title={t('workplace.admin.locations.unsavedTitle')}
        description={t('workplace.admin.locations.unsavedDescription')}
        cancelLabel={t('actions.keep')}
        confirmLabel={t('workplace.admin.locations.discardChanges')}
        intent="danger"
        onClose={() => {
          if (pendingTab) setPendingTab(null);
          else tabNavigationBlocker.reset?.();
        }}
        onConfirm={() => {
          if (pendingTab) {
            setApprovedTab(pendingTab);
            setPendingTab(null);
            handleDraftDirty(false);
            return;
          }
          handleDraftDirty(false);
          tabNavigationBlocker.proceed?.();
        }}
      />
    </PageCanvas>
  );
}
