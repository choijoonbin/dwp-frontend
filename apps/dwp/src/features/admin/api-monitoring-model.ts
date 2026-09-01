import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';

import type { ApiHistoryOutcome, ApiHistoryWindow, AuditWindow } from '@dwp-frontend/shared-utils';

export function apiMonitoringErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function apiMonitoringEventTimestamp(value: string): string {
  return formatDate(value, { dateStyle: 'medium', timeStyle: 'medium' });
}

export function apiMonitoringCompactTimestamp(value: string): string {
  return formatDate(value, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function apiMonitoringDuration(value: number): string {
  if (value < 1_000) return `${formatNumber(value)} ms`;
  return `${formatNumber(value / 1_000, { maximumFractionDigits: 2 })} s`;
}

export function auditWindowForApiHistory(value: ApiHistoryWindow): AuditWindow {
  if (value === 'D7') return 'D7';
  if (value === 'D30') return 'D30';
  return 'H24';
}

export function apiMonitoringBytes(value?: number | null): string {
  if (value == null) return '—';
  if (value < 1_024) return `${formatNumber(value)} B`;
  if (value < 1_048_576) {
    return `${formatNumber(value / 1_024, { maximumFractionDigits: 1 })} KB`;
  }
  return `${formatNumber(value / 1_048_576, { maximumFractionDigits: 1 })} MB`;
}

export function apiMonitoringOutcomeColor(
  outcome: ApiHistoryOutcome
): 'success' | 'warning' | 'error' | 'default' {
  if (outcome === 'SUCCESS') return 'success';
  if (outcome === 'REDIRECTION' || outcome === 'CLIENT_ERROR') return 'warning';
  if (outcome === 'SERVER_ERROR' || outcome === 'CANCELLED') return 'error';
  return 'default';
}
