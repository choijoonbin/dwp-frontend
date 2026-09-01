import type { AuditCase, AuditFinding } from '@dwp-frontend/shared-utils';

export type AuditInvestigationView = 'findings' | 'cases';

export const AUDIT_FINDING_STATES: AuditFinding['status'][] = [
  'OPEN',
  'ACKNOWLEDGED',
  'INVESTIGATING',
  'RESOLVED',
  'DISMISSED',
];

export const AUDIT_CASE_STATES: AuditCase['status'][] = [
  'OPEN',
  'INVESTIGATING',
  'CONTAINED',
  'RESOLVED',
  'CLOSED',
];

export const AUDIT_CASE_PRIORITIES: AuditCase['severity'][] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
