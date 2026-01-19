// ----------------------------------------------------------------------

export type MenuNode = {
  menuKey: string;
  menuName: string;
  path?: string | null;
  icon?: string | null;
  group?: string | null; // MANAGEMENT / APPS 등
  depth?: number | null;
  sortOrder?: number | null;
  children?: MenuNode[];
};
