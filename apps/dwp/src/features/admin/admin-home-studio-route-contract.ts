export type AdminHomeStudioLegacyView = 'experience' | 'composition' | 'apps';

export type AdminHomeStudioLegacyRouteContract = {
  view: AdminHomeStudioLegacyView;
  sourcePath: `/admin/${string}`;
  defaultTarget: `/admin/experience/home/${string}`;
  inventoryRole: 'replaced-by-studio-root' | 'retained-functional-entry';
};

/**
 * Home Studio replaces three former sidebar entries with one visible entry. The composition and
 * app-layout URLs still represent distinct accepted admin capabilities, so they remain part of the
 * 24-route tenant inventory without being duplicated in the sidebar.
 */
export const ADMIN_HOME_STUDIO_LEGACY_ROUTE_CONTRACTS = [
  {
    view: 'experience',
    sourcePath: '/admin/experience/home-experience',
    defaultTarget: '/admin/experience/home/content',
    inventoryRole: 'replaced-by-studio-root',
  },
  {
    view: 'composition',
    sourcePath: '/admin/experience/home-composition',
    defaultTarget: '/admin/experience/home/modes',
    inventoryRole: 'retained-functional-entry',
  },
  {
    view: 'apps',
    sourcePath: '/admin/experience/home-apps',
    defaultTarget: '/admin/experience/home/app-dock',
    inventoryRole: 'retained-functional-entry',
  },
] as const satisfies readonly AdminHomeStudioLegacyRouteContract[];

export const ADMIN_HOME_STUDIO_RETAINED_INVENTORY_ROUTES =
  ADMIN_HOME_STUDIO_LEGACY_ROUTE_CONTRACTS.filter(
    ({ inventoryRole }) => inventoryRole === 'retained-functional-entry'
  ).map(({ sourcePath }) => sourcePath);
