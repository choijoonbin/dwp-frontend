import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import {
  parseWorkplaceAdminVisit,
  parseWorkplaceAdminVisitCommandResult,
  parseWorkplaceKioskDevice,
  parseWorkplaceKioskDevices,
  parseWorkplaceKioskSession,
  parseWorkplaceKioskVisit,
  parseWorkplaceKioskVisitCommandResult,
  parseWorkplaceRequesterVisit,
  parseWorkplaceRequesterVisitPage,
  parseWorkplaceVisitAccessZones,
  parseWorkplaceVisitCommandResult,
  parseWorkplaceVisitExceptionPage,
  parseWorkplaceVisitManagementResult,
  parseWorkplaceVisitPolicyImpact,
  parseWorkplaceVisitPolicies,
  parseWorkplaceVisitPreview,
  parseWorkplaceVisitProviderBindings,
  workplaceVisitManagementParsers,
} from './workplace-visits-parser';

import type {
  WorkplaceAdminVisit,
  WorkplaceKioskDevice,
  WorkplaceKioskDeviceInput,
  WorkplaceKioskHeartbeatInput,
  WorkplaceKioskVisit,
  WorkplaceRequesterVisit,
  WorkplaceVisitAccessZone,
  WorkplaceVisitAccessZoneInput,
  WorkplaceVisitApprovalInput,
  WorkplaceVisitCreateInput,
  WorkplaceVisitManagementResult,
  WorkplaceVisitPolicy,
  WorkplaceVisitPolicyInput,
  WorkplaceVisitPreviewInput,
  WorkplaceVisitProviderBinding,
  WorkplaceVisitProviderBindingInput,
  WorkplaceVisitProviderEvidenceInput,
  WorkplaceVisitReservationAuthority,
  WorkplaceVisitVersionInput,
} from './workplace-visits-contract';

const USER_BASE = '/api/platform/v1/workplace/visits';
const ADMIN_BASE = '/api/platform/v1/admin/workplace';
const KIOSK_BASE = '/api/platform/v1/workplace/kiosk';

export type WorkplaceVisitCommandOptions = Readonly<{
  idempotencyKey: string;
  correlationId?: string;
  activeAccessMode?: 'ELEVATED';
}>;

export type WorkplaceKioskDeviceAuth = Readonly<{
  tenantId: string;
  deviceIdentitySha256: string;
}>;

function requiredId(value: string, label: string): string {
  if (!value.trim() || value.length > 320) throw new Error(`${label} is invalid.`);
  return encodeURIComponent(value);
}

function commandHeaders(options: WorkplaceVisitCommandOptions) {
  if (!options.idempotencyKey.trim() || options.idempotencyKey.length > 160) {
    throw new Error('A valid Workplace visit idempotency key is required.');
  }
  return {
    'Idempotency-Key': options.idempotencyKey,
    ...(options.correlationId ? { 'X-Correlation-ID': options.correlationId } : {}),
    ...(options.activeAccessMode ? { 'X-DWP-Active-Access-Mode': options.activeAccessMode } : {}),
  };
}

function kioskHeaders(auth: WorkplaceKioskDeviceAuth) {
  if (!auth.tenantId.trim() || !/^[0-9a-f]{64}$/u.test(auth.deviceIdentitySha256)) {
    throw new Error('A valid Workplace kiosk device identity is required.');
  }
  return {
    'X-DWP-Tenant-ID': auth.tenantId.trim(),
    'X-DWP-Device-Identity-SHA256': auth.deviceIdentitySha256,
  };
}

function visitPath(visitId: string, administrator = false) {
  return `${administrator ? `${ADMIN_BASE}/visits` : USER_BASE}/${requiredId(visitId, 'Visit id')}`;
}

function managementPath(
  resource: 'visit-policies' | 'access-zones' | 'provider-bindings' | 'kiosk-devices'
) {
  return `${ADMIN_BASE}/${resource}`;
}

export async function previewWorkplaceVisit(
  input: WorkplaceVisitPreviewInput,
  options: WorkplaceVisitCommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceVisitPreviewInput>(
    `${USER_BASE}:preview`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceVisitPreview(response.data.data);
}

export async function createWorkplaceVisit(
  input: WorkplaceVisitCreateInput,
  options: WorkplaceVisitCommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceVisitCreateInput>(
    USER_BASE,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceVisitCommandResult(response.data.data);
}

export async function getWorkplaceVisits(
  reservationAuthority: WorkplaceVisitReservationAuthority,
  reservationId: string
) {
  const query = new URLSearchParams({
    reservationAuthority,
    reservationId: requiredId(reservationId, 'Reservation id'),
  });
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${USER_BASE}?${query}`);
  return parseWorkplaceRequesterVisitPage(response.data.data);
}

export async function getWorkplaceVisit(visitId: string) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(visitPath(visitId));
  return parseWorkplaceRequesterVisit(response.data.data);
}

async function requesterCommand(
  visitId: string,
  suffix: ':send-invitation' | '/access-requests' | ':cancel',
  input: WorkplaceVisitVersionInput,
  options: WorkplaceVisitCommandOptions
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceVisitVersionInput>(
    `${visitPath(visitId)}${suffix}`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceVisitCommandResult(response.data.data);
}

export const sendWorkplaceVisitInvitation = (
  visitId: string,
  input: WorkplaceVisitVersionInput,
  options: WorkplaceVisitCommandOptions
) => requesterCommand(visitId, ':send-invitation', input, options);

export const requestWorkplaceVisitAccess = (
  visitId: string,
  input: WorkplaceVisitVersionInput,
  options: WorkplaceVisitCommandOptions
) => requesterCommand(visitId, '/access-requests', input, options);

export const cancelWorkplaceVisit = (
  visitId: string,
  input: WorkplaceVisitVersionInput,
  options: WorkplaceVisitCommandOptions
) => requesterCommand(visitId, ':cancel', input, options);

export async function getAdminWorkplaceVisitExceptions() {
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${ADMIN_BASE}/visits/exceptions`);
  return parseWorkplaceVisitExceptionPage(response.data.data);
}

export async function getAdminWorkplaceVisit(visitId: string) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(visitPath(visitId, true));
  return parseWorkplaceAdminVisit(response.data.data);
}

async function adminCommand(
  visitId: string,
  suffix: ':approve' | ':retry-access' | ':notify-host' | ':confirm-checkout',
  input: WorkplaceVisitVersionInput | WorkplaceVisitApprovalInput,
  options: WorkplaceVisitCommandOptions
) {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceVisitVersionInput | WorkplaceVisitApprovalInput
  >(`${visitPath(visitId, true)}${suffix}`, input, { headers: commandHeaders(options) });
  return parseWorkplaceAdminVisitCommandResult(response.data.data);
}

export const approveAdminWorkplaceVisit = (
  visitId: string,
  input: WorkplaceVisitApprovalInput,
  options: WorkplaceVisitCommandOptions
) => adminCommand(visitId, ':approve', input, options);

export const retryAdminWorkplaceVisitAccess = (
  visitId: string,
  input: WorkplaceVisitVersionInput,
  options: WorkplaceVisitCommandOptions
) => adminCommand(visitId, ':retry-access', input, options);

export const notifyAdminWorkplaceVisitHost = (
  visitId: string,
  input: WorkplaceVisitVersionInput,
  options: WorkplaceVisitCommandOptions
) => adminCommand(visitId, ':notify-host', input, options);

export const confirmAdminWorkplaceVisitCheckout = (
  visitId: string,
  input: WorkplaceVisitVersionInput,
  options: WorkplaceVisitCommandOptions
) => adminCommand(visitId, ':confirm-checkout', input, options);

export async function getWorkplaceVisitPolicies() {
  const response = await axiosInstance.get<ApiResponse<unknown>>(managementPath('visit-policies'));
  return parseWorkplaceVisitPolicies(response.data.data);
}

export async function createWorkplaceVisitPolicy(
  input: WorkplaceVisitPolicyInput,
  options: WorkplaceVisitCommandOptions
): Promise<WorkplaceVisitManagementResult<WorkplaceVisitPolicy>> {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceVisitPolicyInput>(
    managementPath('visit-policies'),
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceVisitManagementResult(
    response.data.data,
    workplaceVisitManagementParsers.policy
  );
}

export async function updateWorkplaceVisitPolicy(
  policyId: string,
  input: WorkplaceVisitPolicyInput,
  options: WorkplaceVisitCommandOptions
): Promise<WorkplaceVisitManagementResult<WorkplaceVisitPolicy>> {
  const response = await axiosInstance.put<ApiResponse<unknown>, WorkplaceVisitPolicyInput>(
    `${managementPath('visit-policies')}/${requiredId(policyId, 'Policy id')}`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceVisitManagementResult(
    response.data.data,
    workplaceVisitManagementParsers.policy
  );
}

export async function previewWorkplaceVisitPolicyImpact(
  policyId: string,
  input: WorkplaceVisitVersionInput,
  activeAccessMode: 'ELEVATED'
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceVisitVersionInput>(
    `${managementPath('visit-policies')}/${requiredId(policyId, 'Policy id')}:impact-preview`,
    input,
    { headers: { 'X-DWP-Active-Access-Mode': activeAccessMode } }
  );
  return parseWorkplaceVisitPolicyImpact(response.data.data);
}

export async function getWorkplaceVisitAccessZones() {
  const response = await axiosInstance.get<ApiResponse<unknown>>(managementPath('access-zones'));
  return parseWorkplaceVisitAccessZones(response.data.data);
}

export async function createWorkplaceVisitAccessZone(
  input: WorkplaceVisitAccessZoneInput,
  options: WorkplaceVisitCommandOptions
): Promise<WorkplaceVisitManagementResult<WorkplaceVisitAccessZone>> {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceVisitAccessZoneInput>(
    managementPath('access-zones'),
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceVisitManagementResult(
    response.data.data,
    workplaceVisitManagementParsers.zone
  );
}

export async function updateWorkplaceVisitAccessZone(
  zoneId: string,
  input: WorkplaceVisitAccessZoneInput,
  options: WorkplaceVisitCommandOptions
): Promise<WorkplaceVisitManagementResult<WorkplaceVisitAccessZone>> {
  const response = await axiosInstance.put<ApiResponse<unknown>, WorkplaceVisitAccessZoneInput>(
    `${managementPath('access-zones')}/${requiredId(zoneId, 'Zone id')}`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceVisitManagementResult(
    response.data.data,
    workplaceVisitManagementParsers.zone
  );
}

export async function getWorkplaceVisitProviderBindings() {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    managementPath('provider-bindings')
  );
  return parseWorkplaceVisitProviderBindings(response.data.data);
}

export async function createWorkplaceVisitProviderBinding(
  input: WorkplaceVisitProviderBindingInput,
  options: WorkplaceVisitCommandOptions
): Promise<WorkplaceVisitManagementResult<WorkplaceVisitProviderBinding>> {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceVisitProviderBindingInput
  >(managementPath('provider-bindings'), input, { headers: commandHeaders(options) });
  return parseWorkplaceVisitManagementResult(
    response.data.data,
    workplaceVisitManagementParsers.provider
  );
}

export async function updateWorkplaceVisitProviderBinding(
  bindingId: string,
  input: WorkplaceVisitProviderBindingInput,
  options: WorkplaceVisitCommandOptions
): Promise<WorkplaceVisitManagementResult<WorkplaceVisitProviderBinding>> {
  const response = await axiosInstance.put<
    ApiResponse<unknown>,
    WorkplaceVisitProviderBindingInput
  >(
    `${managementPath('provider-bindings')}/${requiredId(bindingId, 'Provider binding id')}`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceVisitManagementResult(
    response.data.data,
    workplaceVisitManagementParsers.provider
  );
}

export async function testWorkplaceVisitProviderBinding(
  bindingId: string,
  input: WorkplaceVisitProviderEvidenceInput,
  options: WorkplaceVisitCommandOptions
): Promise<WorkplaceVisitManagementResult<WorkplaceVisitProviderBinding>> {
  const response = await axiosInstance.post<
    ApiResponse<unknown>,
    WorkplaceVisitProviderEvidenceInput
  >(
    `${managementPath('provider-bindings')}/${requiredId(bindingId, 'Provider binding id')}:test`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceVisitManagementResult(
    response.data.data,
    workplaceVisitManagementParsers.provider
  );
}

export async function getWorkplaceKioskDevices() {
  const response = await axiosInstance.get<ApiResponse<unknown>>(managementPath('kiosk-devices'));
  return parseWorkplaceKioskDevices(response.data.data);
}

export async function createWorkplaceKioskDevice(
  input: WorkplaceKioskDeviceInput,
  options: WorkplaceVisitCommandOptions
): Promise<WorkplaceVisitManagementResult<WorkplaceKioskDevice>> {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceKioskDeviceInput>(
    managementPath('kiosk-devices'),
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceVisitManagementResult(
    response.data.data,
    workplaceVisitManagementParsers.kiosk
  );
}

export async function updateWorkplaceKioskDevice(
  deviceId: string,
  input: WorkplaceKioskDeviceInput,
  options: WorkplaceVisitCommandOptions
): Promise<WorkplaceVisitManagementResult<WorkplaceKioskDevice>> {
  const response = await axiosInstance.put<ApiResponse<unknown>, WorkplaceKioskDeviceInput>(
    `${managementPath('kiosk-devices')}/${requiredId(deviceId, 'Kiosk device id')}`,
    input,
    { headers: commandHeaders(options) }
  );
  return parseWorkplaceVisitManagementResult(
    response.data.data,
    workplaceVisitManagementParsers.kiosk
  );
}

export async function getWorkplaceKioskSession(auth: WorkplaceKioskDeviceAuth) {
  const response = await axiosInstance.get<ApiResponse<unknown>>(`${KIOSK_BASE}/session`, {
    headers: kioskHeaders(auth),
  });
  return parseWorkplaceKioskSession(response.data.data);
}

export async function getWorkplaceKioskVisit(
  visitId: string,
  auth: WorkplaceKioskDeviceAuth
): Promise<WorkplaceKioskVisit> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${KIOSK_BASE}/visits/${requiredId(visitId, 'Visit id')}`,
    { headers: kioskHeaders(auth) }
  );
  return parseWorkplaceKioskVisit(response.data.data);
}

async function kioskVisitCommand(
  visitId: string,
  action: 'arrive' | 'checkout',
  input: WorkplaceVisitVersionInput,
  options: WorkplaceVisitCommandOptions,
  auth: WorkplaceKioskDeviceAuth
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceVisitVersionInput>(
    `${KIOSK_BASE}/visits/${requiredId(visitId, 'Visit id')}:${action}`,
    input,
    { headers: { ...commandHeaders(options), ...kioskHeaders(auth) } }
  );
  return parseWorkplaceKioskVisitCommandResult(response.data.data);
}

export const arriveWorkplaceKioskVisit = (
  visitId: string,
  input: WorkplaceVisitVersionInput,
  options: WorkplaceVisitCommandOptions,
  auth: WorkplaceKioskDeviceAuth
) => kioskVisitCommand(visitId, 'arrive', input, options, auth);

export const checkoutWorkplaceKioskVisit = (
  visitId: string,
  input: WorkplaceVisitVersionInput,
  options: WorkplaceVisitCommandOptions,
  auth: WorkplaceKioskDeviceAuth
) => kioskVisitCommand(visitId, 'checkout', input, options, auth);

export async function heartbeatWorkplaceKioskSession(
  deviceId: string,
  input: WorkplaceKioskHeartbeatInput,
  options: WorkplaceVisitCommandOptions,
  auth: WorkplaceKioskDeviceAuth
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceKioskHeartbeatInput>(
    `${KIOSK_BASE}/devices/${requiredId(deviceId, 'Kiosk device id')}:heartbeat`,
    input,
    { headers: { ...commandHeaders(options), ...kioskHeaders(auth) } }
  );
  return parseWorkplaceKioskDevice(response.data.data);
}

export async function requestWorkplaceKioskHelp(
  deviceId: string,
  input: WorkplaceVisitVersionInput,
  options: WorkplaceVisitCommandOptions,
  auth: WorkplaceKioskDeviceAuth
) {
  const response = await axiosInstance.post<ApiResponse<unknown>, WorkplaceVisitVersionInput>(
    `${KIOSK_BASE}/devices/${requiredId(deviceId, 'Kiosk device id')}:help`,
    input,
    { headers: { ...commandHeaders(options), ...kioskHeaders(auth) } }
  );
  return parseWorkplaceKioskDevice(response.data.data);
}

export type { WorkplaceAdminVisit, WorkplaceRequesterVisit };
