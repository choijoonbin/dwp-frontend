import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import {
  assertWorkplaceSafetyResendInputStates,
  parseWorkplaceSafetyActivationPreview,
  parseWorkplaceSafetyActivationPreviewCommandResult,
  parseWorkplaceSafetyAssemblyCommandResult,
  parseWorkplaceSafetyClosureCommandResult,
  parseWorkplaceSafetyClosurePreview,
  parseWorkplaceSafetyClosurePreviewCommandResult,
  parseWorkplaceSafetyCommandReceipt,
  parseWorkplaceSafetyConnectorCommandResult,
  parseWorkplaceSafetyConnectors,
  parseWorkplaceSafetyExportCommandResult,
  parseWorkplaceSafetyIncident,
  parseWorkplaceSafetyIncidentCommandResult,
  parseWorkplaceSafetyIncidents,
  parseWorkplaceSafetyMessageCommandResult,
  parseWorkplaceSafetyMessages,
  parseWorkplaceSafetyPostIncidentReport,
  parseWorkplaceSafetyResponseCommandResult,
  parseWorkplaceSafetyScopeRevisionPreview,
  parseWorkplaceSafetyScopePreviewCommandResult,
  parseWorkplaceSafetySheet,
  parseWorkplaceSafetySheets,
} from './workplace-safety-parser';

import type {
  WorkplaceSafetyActivateInput,
  WorkplaceSafetyActivationPreviewInput,
  WorkplaceSafetyApplyScopeInput,
  WorkplaceSafetyAssemblyConfirmationInput,
  WorkplaceSafetyClosureApprovalInput,
  WorkplaceSafetyClosurePreviewInput,
  WorkplaceSafetyClosureRequestInput,
  WorkplaceSafetyConnectorConfigurationInput,
  WorkplaceSafetyExportInput,
  WorkplaceSafetyIncidentState,
  WorkplaceSafetyMessageInput,
  WorkplaceSafetyResendInput,
  WorkplaceSafetyResponseInput,
  WorkplaceSafetyScopePreviewInput,
} from './workplace-safety-contract';

const USER_BASE = '/api/platform/v1/workplace/safety';
const ADMIN_BASE = '/api/platform/v1/admin/workplace/safety';

export type WorkplaceSafetyCommandOptions = Readonly<{
  idempotencyKey: string;
  correlationId?: string;
  activeAccessMode?: 'ELEVATED';
  decisionRevision?: string;
}>;

function requiredId(value: string, label: string) {
  if (!value.trim() || value.length > 320) throw new Error(`${label} is invalid.`);
  return encodeURIComponent(value);
}

function commandHeaders(
  options: WorkplaceSafetyCommandOptions,
  requireElevation = false,
  requireDecisionRevision = false
) {
  if (!options.idempotencyKey.trim() || options.idempotencyKey.length > 160) {
    throw new Error('A valid Workplace safety idempotency key is required.');
  }
  if (requireElevation && options.activeAccessMode !== 'ELEVATED') {
    throw new Error('Elevated access is required for Workplace safety administration.');
  }
  if (requireDecisionRevision && !/^psr-[a-f0-9]{64}$/u.test(options.decisionRevision ?? '')) {
    throw new Error('A verified product-surface decision revision is required.');
  }
  return {
    'Idempotency-Key': options.idempotencyKey,
    ...(options.correlationId ? { 'X-Correlation-ID': options.correlationId } : {}),
    ...(options.activeAccessMode ? { 'X-DWP-Active-Access-Mode': options.activeAccessMode } : {}),
    ...(options.decisionRevision
      ? { 'X-DWP-Current-Decision-Revision': options.decisionRevision }
      : {}),
  };
}

function elevatedHeaders(correlationId?: string) {
  return {
    'X-DWP-Active-Access-Mode': 'ELEVATED',
    ...(correlationId ? { 'X-Correlation-ID': correlationId } : {}),
  };
}

function userIncidentPath(incidentId: string) {
  return `${USER_BASE}/incidents/${requiredId(incidentId, 'Incident id')}`;
}

function adminIncidentPath(incidentId: string) {
  return `${ADMIN_BASE}/incidents/${requiredId(incidentId, 'Incident id')}`;
}

export async function getActiveWorkplaceSafetySheets() {
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${USER_BASE}/incidents/active`);
  return parseWorkplaceSafetySheets(response.data.data);
}

export async function getWorkplaceSafetySheet(incidentId: string) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(userIncidentPath(incidentId));
  return parseWorkplaceSafetySheet(response.data.data);
}

export async function respondToWorkplaceSafetyIncident(
  incidentId: string,
  input: WorkplaceSafetyResponseInput,
  options: WorkplaceSafetyCommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceSafetyResponseInput>(
    `${userIncidentPath(incidentId)}/responses`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceSafetyResponseCommandResult(response.data.data);
}

export async function getWorkplaceSafetyMessages(incidentId: string) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${userIncidentPath(incidentId)}/messages`
  );
  return parseWorkplaceSafetyMessages(response.data.data);
}

export async function sendWorkplaceSafetyMessage(
  incidentId: string,
  input: WorkplaceSafetyMessageInput,
  options: WorkplaceSafetyCommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceSafetyMessageInput>(
    `${userIncidentPath(incidentId)}/messages`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceSafetyMessageCommandResult(response.data.data);
}

export async function previewWorkplaceSafetyActivation(
  input: WorkplaceSafetyActivationPreviewInput,
  options: WorkplaceSafetyCommandOptions
) {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceSafetyActivationPreviewInput
  >(`${ADMIN_BASE}/incidents:preview`, input, { headers: commandHeaders(options, true) });
  return parseWorkplaceSafetyActivationPreviewCommandResult(response.data.data);
}

export async function getWorkplaceSafetyActivationPreview(previewId: string) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ADMIN_BASE}/activation-previews/${requiredId(previewId, 'Preview id')}`
  );
  return parseWorkplaceSafetyActivationPreview(response.data.data);
}

export async function activateWorkplaceSafetyIncident(
  input: WorkplaceSafetyActivateInput,
  options: WorkplaceSafetyCommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceSafetyActivateInput>(
    `${ADMIN_BASE}/incidents`,
    input,
    { headers: commandHeaders(options, true) }
  );
  return parseWorkplaceSafetyIncidentCommandResult(response.data.data);
}

export async function getAdminWorkplaceSafetyIncidents(state?: WorkplaceSafetyIncidentState) {
  const query = state ? `?state=${encodeURIComponent(state)}` : '';
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${ADMIN_BASE}/incidents${query}`);
  return parseWorkplaceSafetyIncidents(response.data.data);
}

export async function getAdminWorkplaceSafetyIncident(incidentId: string) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(adminIncidentPath(incidentId));
  return parseWorkplaceSafetyIncident(response.data.data);
}

export async function getAdminWorkplaceSafetyCommand(incidentId: string, commandId: string) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${adminIncidentPath(incidentId)}/commands/${requiredId(commandId, 'Command id')}`
  );
  return parseWorkplaceSafetyCommandReceipt(response.data.data);
}

export async function previewWorkplaceSafetyScopeRevision(
  incidentId: string,
  input: WorkplaceSafetyScopePreviewInput,
  options: WorkplaceSafetyCommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceSafetyScopePreviewInput>(
    `${adminIncidentPath(incidentId)}/scope-revisions:preview`,
    input,
    { headers: commandHeaders(options, true) }
  );
  return parseWorkplaceSafetyScopePreviewCommandResult(response.data.data);
}

export async function getWorkplaceSafetyScopeRevisionPreview(
  incidentId: string,
  revisionId: string
) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${adminIncidentPath(incidentId)}/scope-revisions/${requiredId(revisionId, 'Scope revision id')}`
  );
  return parseWorkplaceSafetyScopeRevisionPreview(response.data.data);
}

export async function applyWorkplaceSafetyScopeRevision(
  incidentId: string,
  input: WorkplaceSafetyApplyScopeInput,
  options: WorkplaceSafetyCommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceSafetyApplyScopeInput>(
    `${adminIncidentPath(incidentId)}/scope-revisions`,
    input,
    { headers: commandHeaders(options, true) }
  );
  return parseWorkplaceSafetyIncidentCommandResult(response.data.data);
}

export async function resendWorkplaceSafetyDispatch(
  incidentId: string,
  input: WorkplaceSafetyResendInput,
  options: WorkplaceSafetyCommandOptions
) {
  assertWorkplaceSafetyResendInputStates(input.retryStates);
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceSafetyResendInput>(
    `${adminIncidentPath(incidentId)}/dispatches:resend`,
    input,
    { headers: commandHeaders(options, true) }
  );
  return parseWorkplaceSafetyIncidentCommandResult(response.data.data);
}

export async function getAdminWorkplaceSafetyMessages(incidentId: string) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${adminIncidentPath(incidentId)}/messages`
  );
  return parseWorkplaceSafetyMessages(response.data.data);
}

export async function confirmWorkplaceSafetyAssembly(
  incidentId: string,
  input: WorkplaceSafetyAssemblyConfirmationInput,
  options: WorkplaceSafetyCommandOptions
) {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceSafetyAssemblyConfirmationInput
  >(`${adminIncidentPath(incidentId)}/assembly-confirmations`, input, {
    headers: commandHeaders(options, true),
  });
  return parseWorkplaceSafetyAssemblyCommandResult(response.data.data);
}

export async function sendAdminWorkplaceSafetyMessage(
  incidentId: string,
  input: WorkplaceSafetyMessageInput,
  options: WorkplaceSafetyCommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceSafetyMessageInput>(
    `${adminIncidentPath(incidentId)}/messages`,
    input,
    { headers: commandHeaders(options, true) }
  );
  return parseWorkplaceSafetyMessageCommandResult(response.data.data);
}

export async function previewWorkplaceSafetyClosure(
  incidentId: string,
  input: WorkplaceSafetyClosurePreviewInput,
  options: WorkplaceSafetyCommandOptions
) {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceSafetyClosurePreviewInput
  >(`${adminIncidentPath(incidentId)}/closures:preview`, input, {
    headers: commandHeaders(options, true),
  });
  return parseWorkplaceSafetyClosurePreviewCommandResult(response.data.data);
}

export async function getWorkplaceSafetyClosurePreview(incidentId: string, previewId: string) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${adminIncidentPath(incidentId)}/closure-previews/${requiredId(previewId, 'Closure preview id')}`
  );
  return parseWorkplaceSafetyClosurePreview(response.data.data);
}

export async function requestWorkplaceSafetyClosure(
  incidentId: string,
  input: WorkplaceSafetyClosureRequestInput,
  options: WorkplaceSafetyCommandOptions
) {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceSafetyClosureRequestInput
  >(`${adminIncidentPath(incidentId)}/closure-requests`, input, {
    headers: commandHeaders(options, true),
  });
  return parseWorkplaceSafetyClosureCommandResult(response.data.data);
}

export async function approveWorkplaceSafetyClosure(
  incidentId: string,
  closureId: string,
  input: WorkplaceSafetyClosureApprovalInput,
  options: WorkplaceSafetyCommandOptions
) {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceSafetyClosureApprovalInput
  >(
    `${adminIncidentPath(incidentId)}/closure-requests/${requiredId(closureId, 'Closure id')}:approve`,
    input,
    { headers: commandHeaders(options, true) }
  );
  return parseWorkplaceSafetyIncidentCommandResult(response.data.data);
}

export async function getWorkplaceSafetyReport(incidentId: string) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${adminIncidentPath(incidentId)}/report`
  );
  return parseWorkplaceSafetyPostIncidentReport(response.data.data);
}

export async function createWorkplaceSafetyExport(
  incidentId: string,
  input: WorkplaceSafetyExportInput,
  options: WorkplaceSafetyCommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceSafetyExportInput>(
    `${adminIncidentPath(incidentId)}/exports`,
    input,
    { headers: commandHeaders(options, true, true) }
  );
  return parseWorkplaceSafetyExportCommandResult(response.data.data);
}

export async function downloadWorkplaceSafetyExport(exportId: string, correlationId?: string) {
  const response = await axiosInstance.get<Blob>(
    `${ADMIN_BASE}/exports/${requiredId(exportId, 'Export id')}/content`,
    { responseType: 'blob', headers: elevatedHeaders(correlationId) }
  );
  return response.data;
}

export async function getWorkplaceSafetyConnectors() {
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${ADMIN_BASE}/connectors`);
  return parseWorkplaceSafetyConnectors(response.data.data);
}

export async function configureWorkplaceSafetyConnector(
  input: WorkplaceSafetyConnectorConfigurationInput,
  options: WorkplaceSafetyCommandOptions
) {
  const response = await axiosInstance.put<
    ApiResponse<unknown>,
    WorkplaceSafetyConnectorConfigurationInput
  >(`${ADMIN_BASE}/connectors/${encodeURIComponent(input.kind)}`, input, {
    headers: commandHeaders(options, true),
  });
  return parseWorkplaceSafetyConnectorCommandResult(response.data.data);
}

export async function getWorkplaceSafetyConnectorCommand(commandId: string) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${ADMIN_BASE}/connectors/commands/${requiredId(commandId, 'Command id')}`
  );
  return parseWorkplaceSafetyCommandReceipt(response.data.data);
}
