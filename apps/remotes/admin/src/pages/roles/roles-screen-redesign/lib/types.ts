// Role Types
export interface Role {
  id: string;
  name: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
  description?: string;
  memberCount: number;
  departmentCount: number;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

// Member Types
export type MemberType = "USER" | "DEPARTMENT";

export interface Member {
  id: string;
  type: MemberType;
  name: string;
  code: string;
  email?: string;
  department?: string;
}

// Permission Types
export type PermissionValue = "ALLOW" | "DENY" | null;

export interface Resource {
  id: string;
  name: string;
  code: string;
  type: "MENU" | "UI_COMPONENT";
  parentId?: string;
  children?: Resource[];
}

export interface PermissionCode {
  id: string;
  code: string;
  name: string;
  description?: string;
}

export interface Permission {
  resourceId: string;
  permissionCodeId: string;
  value: PermissionValue;
  isDirty?: boolean;
}

// UI State Types
export type ViewState = "loading" | "error" | "empty" | "ready";

export interface SaveState {
  isSaving: boolean;
  lastSaved?: Date;
  hasUnsavedChanges: boolean;
}

// Filter Types
export interface RoleFilter {
  search: string;
  status: "ALL" | "ACTIVE" | "INACTIVE";
  sortBy: "updatedAt" | "name" | "code";
  sortOrder: "asc" | "desc";
}

// Event Tracking Types
export type TrackingEvent =
  | "ROLE_VIEW"
  | "ROLE_CREATE"
  | "ROLE_UPDATE"
  | "ROLE_DELETE"
  | "MEMBER_ADD"
  | "MEMBER_REMOVE"
  | "PERM_SAVE";
