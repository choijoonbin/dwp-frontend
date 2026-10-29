import { InlineFeedback } from '@dwp-frontend/design-system';
import { useTranslation } from 'react-i18next';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { NavigationPolicyStudio } from '../components/navigation-policy-studio';
import { useNavigationPolicyWorkspace } from '../hooks/use-navigation-policy-workspace';
import { HRIS_NAVIGATION_POLICY_RUNTIME_STATE } from '../../../shell/navigation-policy/hris-navigation-policy-feature';

import type {
  NavigationPolicyCommandOwner,
  NavigationPolicyScopeKind,
} from '../model/navigation-policy-model';

export type HrisNavigationPolicyWorkspaceProps = Readonly<{
  runtimeEnabled?: boolean;
  scopeKind?: NavigationPolicyScopeKind;
  scopePublicId?: string | null;
  locale?: string;
  commandOwner?: NavigationPolicyCommandOwner;
}>;

export { HRIS_NAVIGATION_POLICY_RUNTIME_STATE };

/**
 * SYS-owned policy studio. Control supplies the requested public scope and governed command
 * owner. The selector is not identity evidence: the server-side People owner must revalidate it.
 */
export function HrisNavigationPolicyWorkspace({
  runtimeEnabled = HRIS_NAVIGATION_POLICY_RUNTIME_STATE === 'ON',
  scopeKind = 'TENANT',
  scopePublicId,
  locale,
  commandOwner,
}: HrisNavigationPolicyWorkspaceProps) {
  if (!runtimeEnabled) return <UnavailableBoundary />;
  if (scopeKind === 'LEGAL_ENTITY' && !scopePublicId?.trim()) {
    return <MissingTrustedScopeBoundary />;
  }
  return (
    <ActiveNavigationPolicyWorkspace
      scopeKind={scopeKind}
      scopePublicId={scopePublicId}
      locale={locale}
      commandOwner={commandOwner}
    />
  );
}

function ActiveNavigationPolicyWorkspace({
  scopeKind,
  scopePublicId,
  locale,
  commandOwner,
}: Required<Pick<HrisNavigationPolicyWorkspaceProps, 'scopeKind'>> &
  Pick<HrisNavigationPolicyWorkspaceProps, 'scopePublicId'> &
  Pick<HrisNavigationPolicyWorkspaceProps, 'locale' | 'commandOwner'>) {
  const workspace = useNavigationPolicyWorkspace(scopeKind, scopePublicId);
  return (
    <Stack
      data-testid="hris-navigation-policy-workspace"
      data-runtime-state="ON"
      minWidth={0}
      maxWidth="100%"
    >
      <NavigationPolicyStudio
        state={workspace.status}
        workspace={workspace.workspace}
        locale={locale}
        commandOwner={commandOwner}
        onRefresh={() => void workspace.refresh()}
        onCommandCommitted={() => workspace.refresh().then(() => undefined)}
      />
    </Stack>
  );
}

function UnavailableBoundary() {
  const { t } = useTranslation('hcm');
  return (
    <Stack
      gap={2}
      data-testid="hris-navigation-policy-workspace"
      data-runtime-state="OFF"
      minWidth={0}
    >
      <InlineFeedback severity="info" title={t('administration.navigation.disabled.title')}>
        {t('administration.navigation.disabled.description')}
      </InlineFeedback>
      <Paper component="section" variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
          {t('administration.navigation.disabled.governedTitle')}
        </Typography>
        <Typography color="text.secondary">
          {t('administration.navigation.disabled.governedDescription')}
        </Typography>
      </Paper>
    </Stack>
  );
}

function MissingTrustedScopeBoundary() {
  const { t } = useTranslation('hcm');
  return (
    <Stack
      data-testid="hris-navigation-policy-workspace"
      data-runtime-state="SCOPE_REQUIRED"
      minWidth={0}
    >
      <InlineFeedback severity="error" title={t('administration.navigation.scopeRequired.title')}>
        {t('administration.navigation.scopeRequired.description')}
      </InlineFeedback>
    </Stack>
  );
}
