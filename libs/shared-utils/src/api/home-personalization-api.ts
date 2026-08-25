import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { HomePreferenceLayout, HomeSurfaceKey } from './home-preference-api';

export type HomeViewSource = 'USER' | 'TEMPLATE' | 'AI' | 'RESTORE' | 'UNDO';
export type HomeDeviceClass = 'DESKTOP' | 'MOBILE';
export type HomeTemplateLifecycle = 'DRAFT' | 'PUBLISHED' | 'REVOKED';
export type HomeComposerState = 'PREVIEWED' | 'APPLIED' | 'UNDONE' | 'CANCELLED' | 'FAILED';

export type HomeWidgetConfigurationValue = string | number | boolean | string[] | null;
export type HomeWidgetConfiguration = Record<string, HomeWidgetConfigurationValue>;

export type HomeViewLayout = HomePreferenceLayout<string>;

export type HomeView = {
  viewId: string;
  viewKey: string;
  surfaceKey: HomeSurfaceKey;
  name: string;
  isDefault: boolean;
  schemaVersion: number;
  layout: HomeViewLayout;
  version: number;
  createdAt: string;
  updatedAt: string;
  widgetConfigurations: Record<string, HomeWidgetConfiguration>;
  /** Server-owned reset state. Optional while older VIEWS contracts remain in service. */
  customized?: boolean;
};

export type HomeViewRevision = {
  revisionId: string;
  viewId: string;
  revisionNumber: number;
  source: HomeViewSource;
  changeSummary: string;
  schemaVersion: number;
  snapshot: HomeViewSnapshot;
  createdAt: string;
  createdBy?: number | null;
};

export type HomeViewSnapshot = {
  snapshotVersion: number;
  legacyLayoutOnly: boolean;
  view: {
    name?: string | null;
    schemaVersion: number;
    layout: HomeViewLayout;
  };
  widgetConfigurations: Record<string, HomeWidgetConfiguration>;
  deviceLayouts: Partial<Record<HomeDeviceClass, HomeDeviceLayoutOverlay>>;
};

export type HomeDeviceLayout = {
  deviceLayoutId: string;
  viewId: string;
  deviceClass: HomeDeviceClass;
  overlay: HomeDeviceLayoutOverlay;
  version: number;
  viewVersion: number;
  updatedAt: string;
};

export type HomeDeviceLayoutOverlay = {
  widgetOrder: string[];
  widgetSizes: Record<string, string>;
  density: 'comfortable' | 'compact';
};

export type HomeTemplateAudience = {
  type: 'ALL' | 'ROLE';
  values: string[];
};

export type HomeTemplate = {
  templateId: string;
  templateKey: string;
  name: string;
  audience: HomeTemplateAudience;
  lifecycle: HomeTemplateLifecycle;
  schemaVersion: number;
  layout: HomeViewLayout;
  version: number;
  publishedAt?: string | null;
  publishedBy?: number | null;
  updatedAt: string;
};

export type HomeComposerOperation =
  | 'MOVE_WIDGET'
  | 'SHOW_WIDGET'
  | 'HIDE_WIDGET'
  | 'SET_WIDTH'
  | 'SET_DENSITY'
  | 'PIN_APP'
  | 'UNPIN_APP';

export type HomeComposerChange = {
  operation: HomeComposerOperation;
  widgetKey?: string | null;
  appId?: string | null;
  beforeIndex?: number | null;
  afterIndex?: number | null;
  value?: string | null;
};

export type HomeComposerProposal = {
  proposalId: string;
  viewId: string;
  state: HomeComposerState;
  baseViewVersion: number;
  reasonCodes: string[];
  changes: HomeComposerChange[];
  warnings: string[];
  beforeLayout: HomeViewLayout;
  proposedLayout: HomeViewLayout;
  expiresAt: string;
  appliedRevisionId?: string | null;
  createdAt: string;
};

export type CreateHomeViewRequest = {
  viewKey: string;
  name: string;
  makeDefault: boolean;
  layout: HomeViewLayout;
};

export type UpdateHomeViewRequest = {
  name: string;
  layout: HomeViewLayout;
  version: number;
};

const VIEW_BASE = '/api/platform/v1/home-views';
const TEMPLATE_BASE = '/api/platform/v1/home-templates';
const COMPOSER_BASE = '/api/platform/v1/home-composer/proposals';
const COMMAND_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function commandConfig(idempotencyKey: string) {
  const key = idempotencyKey.trim();
  if (!COMMAND_ID_PATTERN.test(key)) {
    throw new Error('Home personalization command requires a UUID idempotency key.');
  }
  return { headers: { 'Idempotency-Key': key } };
}

export function createHomeCommandKey(command: string): string {
  if (!command.trim()) throw new Error('A home command name is required.');
  return crypto.randomUUID();
}

export async function getHomeViews(
  surfaceKey: HomeSurfaceKey = 'workspace-home'
): Promise<HomeView[]> {
  const response = await axiosInstance.get<ApiResponse<HomeView[]>>(
    `${VIEW_BASE}?surfaceKey=${encodeURIComponent(surfaceKey)}`
  );
  return response.data.data;
}

export async function getHomeView(viewId: string): Promise<HomeView> {
  const response = await axiosInstance.get<ApiResponse<HomeView>>(
    `${VIEW_BASE}/${encodeURIComponent(viewId)}`
  );
  return response.data.data;
}

export async function createHomeView(
  request: CreateHomeViewRequest,
  idempotencyKey: string
): Promise<HomeView> {
  const response = await axiosInstance.post<ApiResponse<HomeView>, CreateHomeViewRequest>(
    VIEW_BASE,
    request,
    commandConfig(idempotencyKey)
  );
  return response.data.data;
}

export async function updateHomeView(
  viewId: string,
  request: UpdateHomeViewRequest,
  idempotencyKey: string
): Promise<HomeView> {
  const response = await axiosInstance.put<ApiResponse<HomeView>, UpdateHomeViewRequest>(
    `${VIEW_BASE}/${encodeURIComponent(viewId)}`,
    request,
    commandConfig(idempotencyKey)
  );
  return response.data.data;
}

export async function resetHomeView(
  viewId: string,
  version: number,
  idempotencyKey: string
): Promise<HomeView> {
  const response = await axiosInstance.post<ApiResponse<HomeView>, { version: number }>(
    `${VIEW_BASE}/${encodeURIComponent(viewId)}/reset`,
    { version },
    commandConfig(idempotencyKey)
  );
  return response.data.data;
}

export async function deleteHomeView(
  viewId: string,
  version: number,
  idempotencyKey: string
): Promise<void> {
  await axiosInstance.delete<ApiResponse<{ deletedViewId: string; activeViewId: string }>>(
    `${VIEW_BASE}/${encodeURIComponent(viewId)}?version=${encodeURIComponent(String(version))}`,
    commandConfig(idempotencyKey)
  );
}

export async function activateHomeView(
  viewId: string,
  version: number,
  idempotencyKey: string
): Promise<HomeView> {
  const response = await axiosInstance.post<ApiResponse<HomeView>, { version: number }>(
    `${VIEW_BASE}/${encodeURIComponent(viewId)}/activate`,
    { version },
    commandConfig(idempotencyKey)
  );
  return response.data.data;
}

export async function updateHomeWidgetConfiguration(
  viewId: string,
  widgetKey: string,
  configuration: HomeWidgetConfiguration,
  version: number,
  idempotencyKey: string
): Promise<HomeView> {
  const response = await axiosInstance.put<
    ApiResponse<HomeView>,
    { configuration: HomeWidgetConfiguration; viewVersion: number }
  >(
    `${VIEW_BASE}/${encodeURIComponent(viewId)}/widgets/${encodeURIComponent(widgetKey)}/configuration`,
    {
      configuration,
      viewVersion: version,
    },
    commandConfig(idempotencyKey)
  );
  return response.data.data;
}

export async function getHomeDeviceLayouts(viewId: string): Promise<HomeDeviceLayout[]> {
  const response = await axiosInstance.get<ApiResponse<HomeDeviceLayout[]>>(
    `${VIEW_BASE}/${encodeURIComponent(viewId)}/device-layouts`
  );
  return response.data.data;
}

export async function updateHomeDeviceLayout(
  viewId: string,
  deviceClass: HomeDeviceClass,
  overlay: HomeDeviceLayoutOverlay,
  viewVersion: number,
  deviceVersion: number | null,
  idempotencyKey: string
): Promise<HomeDeviceLayout> {
  const response = await axiosInstance.put<
    ApiResponse<HomeDeviceLayout>,
    { overlay: HomeDeviceLayoutOverlay; viewVersion: number; version: number | null }
  >(
    `${VIEW_BASE}/${encodeURIComponent(viewId)}/device-layouts/${deviceClass}`,
    {
      overlay,
      viewVersion,
      version: deviceVersion,
    },
    commandConfig(idempotencyKey)
  );
  return response.data.data;
}

export async function getHomeViewRevisions(viewId: string): Promise<HomeViewRevision[]> {
  const response = await axiosInstance.get<ApiResponse<HomeViewRevision[]>>(
    `${VIEW_BASE}/${encodeURIComponent(viewId)}/revisions`
  );
  return response.data.data;
}

export async function restoreHomeViewRevision(
  viewId: string,
  revisionId: string,
  version: number,
  idempotencyKey: string
): Promise<HomeView> {
  const response = await axiosInstance.post<ApiResponse<HomeView>, { version: number }>(
    `${VIEW_BASE}/${encodeURIComponent(viewId)}/revisions/${encodeURIComponent(revisionId)}/restore`,
    { version },
    commandConfig(idempotencyKey)
  );
  return response.data.data;
}

export async function getHomeTemplates(): Promise<HomeTemplate[]> {
  const response = await axiosInstance.get<ApiResponse<HomeTemplate[]>>(TEMPLATE_BASE);
  return response.data.data;
}

export async function createHomeTemplate(
  request: Pick<HomeTemplate, 'templateKey' | 'name' | 'audience' | 'layout'>,
  idempotencyKey: string
): Promise<HomeTemplate> {
  const response = await axiosInstance.post<ApiResponse<HomeTemplate>, typeof request>(
    TEMPLATE_BASE,
    request,
    commandConfig(idempotencyKey)
  );
  return response.data.data;
}

export async function updateHomeTemplate(
  templateId: string,
  request: Pick<HomeTemplate, 'name' | 'audience' | 'layout' | 'version'>,
  idempotencyKey: string
): Promise<HomeTemplate> {
  const response = await axiosInstance.put<ApiResponse<HomeTemplate>, typeof request>(
    `${TEMPLATE_BASE}/${encodeURIComponent(templateId)}`,
    request,
    commandConfig(idempotencyKey)
  );
  return response.data.data;
}

export async function publishHomeTemplate(
  templateId: string,
  version: number,
  idempotencyKey: string
): Promise<HomeTemplate> {
  const response = await axiosInstance.post<ApiResponse<HomeTemplate>, { version: number }>(
    `${TEMPLATE_BASE}/${encodeURIComponent(templateId)}/publish`,
    { version },
    commandConfig(idempotencyKey)
  );
  return response.data.data;
}

export async function revokeHomeTemplate(
  templateId: string,
  version: number,
  idempotencyKey: string
): Promise<HomeTemplate> {
  const response = await axiosInstance.post<ApiResponse<HomeTemplate>, { version: number }>(
    `${TEMPLATE_BASE}/${encodeURIComponent(templateId)}/revoke`,
    { version },
    commandConfig(idempotencyKey)
  );
  return response.data.data;
}

export async function applyHomeTemplate(
  templateId: string,
  viewId: string,
  viewVersion: number,
  idempotencyKey: string
): Promise<HomeView> {
  const response = await axiosInstance.post<
    ApiResponse<HomeView>,
    { viewId: string; viewVersion: number }
  >(
    `${TEMPLATE_BASE}/${encodeURIComponent(templateId)}/apply`,
    { viewId, viewVersion },
    commandConfig(idempotencyKey)
  );
  return response.data.data;
}

export async function createHomeComposerProposal(
  request: {
    viewId: string;
    baseViewVersion: number;
    reasonCodes: string[];
    changes: HomeComposerChange[];
  },
  idempotencyKey: string
): Promise<HomeComposerProposal> {
  const response = await axiosInstance.post<ApiResponse<HomeComposerProposal>, typeof request>(
    COMPOSER_BASE,
    request,
    commandConfig(idempotencyKey)
  );
  return response.data.data;
}

export async function getHomeComposerProposal(proposalId: string): Promise<HomeComposerProposal> {
  const response = await axiosInstance.get<ApiResponse<HomeComposerProposal>>(
    `${COMPOSER_BASE}/${encodeURIComponent(proposalId)}`
  );
  return response.data.data;
}

async function transitionHomeComposerProposal(
  proposalId: string,
  transition: 'apply' | 'undo',
  viewVersion: number,
  idempotencyKey: string
): Promise<HomeComposerProposal> {
  const response = await axiosInstance.post<
    ApiResponse<HomeComposerProposal>,
    { viewVersion: number }
  >(
    `${COMPOSER_BASE}/${encodeURIComponent(proposalId)}/${transition}`,
    { viewVersion },
    commandConfig(idempotencyKey)
  );
  return response.data.data;
}

export function applyHomeComposerProposal(
  proposalId: string,
  viewVersion: number,
  idempotencyKey: string
): Promise<HomeComposerProposal> {
  return transitionHomeComposerProposal(proposalId, 'apply', viewVersion, idempotencyKey);
}

export function undoHomeComposerProposal(
  proposalId: string,
  viewVersion: number,
  idempotencyKey: string
): Promise<HomeComposerProposal> {
  return transitionHomeComposerProposal(proposalId, 'undo', viewVersion, idempotencyKey);
}
