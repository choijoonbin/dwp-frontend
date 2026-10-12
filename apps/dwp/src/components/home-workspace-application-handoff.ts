export const HOME_WORKSPACE_EDIT_TARGET = '/?edit=home' as const;

type DocumentNavigation = (target: string) => void;

/**
 * Starts an intentional Account-to-Workspace transition while preserving browser Back behavior.
 * The target is closed over so callers cannot turn this application boundary into an open redirect.
 */
export function assignHomeWorkspaceApplication(
  assign: DocumentNavigation = (target) => window.location.assign(target)
) {
  assign(HOME_WORKSPACE_EDIT_TARGET);
}

/**
 * Replaces a legacy Account Home URL with the Workspace-owned editor without creating a Back loop.
 */
export function replaceHomeWorkspaceApplication(
  replace: DocumentNavigation = (target) => window.location.replace(target)
) {
  replace(HOME_WORKSPACE_EDIT_TARGET);
}
