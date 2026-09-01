import type { ServiceRequestField, ServiceRequestSummary } from '@dwp-frontend/shared-utils';

export function serviceRequestErrorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function serviceRequestFieldLabel(field: ServiceRequestField, language: string): string {
  return language.startsWith('en') ? field.labelEn : field.labelKo;
}

export function serviceRequestOptionLabel(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

export function serviceRequestName(request: ServiceRequestSummary, language: string): string {
  return language.startsWith('en') ? request.serviceNameEn : request.serviceNameKo;
}
