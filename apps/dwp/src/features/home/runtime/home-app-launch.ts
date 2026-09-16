import type { WorkspaceApp } from '@dwp-frontend/shared-utils';
import type { HomeAppDefinition } from '../../../components/workspace-composer/app-launchpad-model';

type HomeAppLauncherInput = Readonly<{
  navigate: (route: string) => void;
  onError: () => void;
  onLaunch: (appId: string) => void;
  v2Active: boolean;
  workspaceApps: readonly WorkspaceApp[];
}>;

export function createHomeAppLauncher({
  navigate,
  onError,
  onLaunch,
  v2Active,
  workspaceApps,
}: HomeAppLauncherInput): (app: HomeAppDefinition) => void {
  const runtimeAppById = new Map(workspaceApps.map((app) => [app.id, app]));
  return (app) => {
    if (v2Active) {
      navigate(app.managementOnly && app.managementRoute ? app.managementRoute : app.route);
      return;
    }
    const runtimeApp = runtimeAppById.get(app.id);
    if (!runtimeApp) {
      onError();
      return;
    }
    if (app.managementOnly && app.managementRoute) {
      navigate(app.managementRoute);
    } else if (runtimeApp.health === 'configuration-required') {
      navigate(`/apps?app=${encodeURIComponent(runtimeApp.id)}`);
    } else {
      onLaunch(runtimeApp.id);
    }
  };
}
