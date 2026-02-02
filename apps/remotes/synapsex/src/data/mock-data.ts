/**
 * Synapse 대시보드/케이스/조치 등 Mock 데이터
 * 참고: docs/saa-s-ui-design_phase1-4_complete/lib/mock-data.ts
 * tenantId는 프론트 mock용으로 number 사용 (BigInt 미사용)
 */

// ----------------------------------------------------------------------
// 공통 타입 (참고 소스와 동일 구조, tenantId만 number)
// ----------------------------------------------------------------------

export interface Tenant {
  id: number;
  name: string;
  code: string;
}

export interface CompanyCode {
  id: string;
  code: string;
  name: string;
  tenantId: number;
}

export interface SynapseCase {
  id: string;
  caseNumber: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'pending_approval' | 'resolved' | 'dismissed' | 'triage' | 'review';
  anomalyType: string;
  tenantId: number;
  companyCode: string;
  counterparty: string;
  counterpartyId: string;
  amount: number;
  currency: string;
  detectedAt: string;
  createdAt: string;
  slaDue: string;
  assignee: string | null;
  confidence: number;
  fiDocId: string;
  docNumber: string;
  docType: string;
  description: string;
}

export interface SimulationResult {
  predictedSuccess: boolean;
  impactedObjects: string[];
  validations: { name: string; passed: boolean; message: string }[];
  riskNotes: string[];
}

export interface SynapseAction {
  id: string;
  caseId: string;
  actionType: 'post_reversal' | 'block_payment' | 'flag_review' | 'clear_item' | 'update_master';
  type: 'post_reversal' | 'block_payment' | 'flag_review' | 'clear_item' | 'update_master';
  autonomyMode: 'auto' | 'semi_auto' | 'manual';
  requiredApproval: boolean;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  targetSystem: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed' | 'completed';
  description: string;
  companyCode: string;
  amount?: number;
  currency?: string;
  simulation?: SimulationResult;
  simulationResult?: SimulationResult;
  estimatedImpact?: {
    amount: number;
    currency: string;
  };
}

export interface AuditEvent {
  id: string;
  caseId?: string;
  timestamp: string;
  eventType:
    | 'case_created'
    | 'action_proposed'
    | 'simulation_run'
    | 'approval_requested'
    | 'action_approved'
    | 'action_rejected'
    | 'action_executed'
    | 'comment_added';
  actor: string;
  actorType: 'system' | 'user' | 'agent';
  description: string;
  severity?: string;
  details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface Policy {
  id: string;
  name: string;
  title: string;
  category: string;
  content: string;
  source: string;
  lastUpdated: string;
  updatedAt: string;
  version: string;
  description: string;
}

export interface FiDocHeader {
  id: string;
  belnr: string;
  bukrs: string;
  gjahr: string;
  budat: string;
  bldat: string;
  blart: string;
  tcode: string;
  usnam: string;
  counterparty: string;
  counterpartyId: string;
  wrbtr: number;
  waers: string;
  xblnr: string;
  bktxt: string;
  tenantId: number;
  integrityStatus: 'pass' | 'warn' | 'fail';
  reversalFlag: boolean;
  reversedByDoc?: string;
  reversesDoc?: string;
  createdAt: string;
  linkedCasesCount: number;
}

export interface OpenItem {
  id: string;
  entityId: string;
  entityName: string;
  docId: string;
  docNumber: string;
  type: 'AR' | 'AP';
  amount: number;
  currency: string;
  dueDate: string;
  daysPastDue: number;
  status: 'open' | 'partially_cleared' | 'cleared';
  disputeFlag: boolean;
  paymentBlock: boolean;
  blockReason?: string;
  recommendedAction?: string;
  guardrailStatus?: 'allowed' | 'approval_required' | 'blocked';
  companyCode: string;
  tenantId: number;
  clearingHistory?: { date: string; amount: number; clearingDoc: string }[];
}

export interface Entity {
  id: string;
  type: 'vendor' | 'customer';
  code: string;
  name: string;
  country: string;
  tenantId: number;
  companyCode: string;
  riskScore: number;
  riskTrend: 'up' | 'down' | 'stable';
  concentrationRisk: 'low' | 'medium' | 'high';
  lastUpdated: string;
  openItemsTotal: number;
  openItemsCount: number;
  overdueTotal: number;
  overdueCount: number;
  recentAnomaliesCount: number;
  currency: string;
  linkedDocIds: string[];
  linkedCaseIds: string[];
  linkedOpenItemIds: string[];
  bankAccount?: string;
  bankName?: string;
  taxId?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  paymentTerms?: string;
}

export interface FiDocItem {
  id: string;
  docId: string;
  buzei: number; // Line Item Number
  hkont: string; // G/L Account
  hkontName: string; // G/L Account Name
  shkzg: 'S' | 'H'; // Debit/Credit Indicator (S=Debit, H=Credit)
  wrbtr: number; // Amount
  mwskz?: string; // Tax Code
  kostl?: string; // Cost Center
  prctr?: string; // Profit Center
  zuonr?: string; // Assignment
  sgtxt: string; // Item Text
}

export interface IntegrityCheck {
  id: string;
  docId: string;
  ruleName: string;
  severity: 'info' | 'warn' | 'critical';
  passed: boolean;
  evidence: string;
  recommendation: string;
  relatedCaseId?: string;
}

export interface EntityChangeLog {
  id: string;
  entityId: string;
  timestamp: string;
  fieldName: string;
  beforeValue: string;
  afterValue: string;
  actor: string;
  actorType: 'system' | 'user' | 'agent';
  source: string;
  severity: 'info' | 'warn' | 'critical';
}

export interface SavedView {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  columns: string[];
  isDefault?: boolean;
}

export interface AgentActivityItem {
  id: number;
  timestamp: string;
  action: string;
  target: string;
  status: 'complete' | 'success' | 'alert' | 'error';
  message: string;
}

export interface RiskDriverItem {
  id: number;
  type: string;
  label: string;
  count: number;
  amount: number;
  trend: 'up' | 'down' | 'stable';
}

export interface TeamSnapshotItem {
  id: number;
  name: string;
  role: string;
  openCases: number;
  slaRisk: number;
  avgLeadTime: number;
}

// ----------------------------------------------------------------------

export const mockKPIs = {
  financialHealthIndex: 87,
  financialHealthTrend: 2.3,
  openCasesBySeverity: {
    critical: 2,
    high: 2,
    medium: 1,
    low: 1,
  },
  aiActionSuccessRate: 94.5,
  aiActionSuccessTrend: 1.2,
  estimatedPreventedLoss: 1_250_000,
  preventedLossTrend: 15.5,
  pendingApprovals: 3,
  slaAtRisk: 2,
  avgLeadTime: 4.2,
  backlogCount: 12,
};

// ----------------------------------------------------------------------
// Mock: Tenants, Company Codes, Saved Views
// ----------------------------------------------------------------------

export const mockTenants: Tenant[] = [
  { id: 1001, name: 'Acme Corporation', code: 'ACME' },
  { id: 1002, name: 'Global Industries', code: 'GLBL' },
];

export const mockCompanyCodes: CompanyCode[] = [
  { id: '1000', code: '1000', name: 'ACME US', tenantId: 1001 },
  { id: '2000', code: '2000', name: 'ACME EU', tenantId: 1001 },
  { id: '4000', code: '4000', name: 'Global US', tenantId: 1002 },
];

export const mockSavedViews: SavedView[] = [
  {
    id: 'view-1',
    name: 'All Open Cases',
    filters: { status: ['open', 'in_progress'] },
    columns: ['caseNumber', 'severity', 'status', 'anomalyType', 'counterparty', 'amount', 'slaDue', 'assignee'],
    isDefault: true,
  },
  {
    id: 'view-2',
    name: 'Critical & High Priority',
    filters: { severity: ['critical', 'high'] },
    columns: ['caseNumber', 'severity', 'anomalyType', 'counterparty', 'amount', 'slaDue', 'confidence'],
  },
  {
    id: 'view-3',
    name: 'My Assignments',
    filters: { assignee: 'current_user' },
    columns: ['caseNumber', 'severity', 'status', 'counterparty', 'amount', 'slaDue'],
  },
  {
    id: 'view-4',
    name: 'Pending Approvals',
    filters: { status: ['pending_approval'] },
    columns: ['caseNumber', 'severity', 'anomalyType', 'counterparty', 'amount', 'assignee'],
  },
];

// ----------------------------------------------------------------------
// Mock: Cases (전체 필드)
// ----------------------------------------------------------------------

export const mockCases: SynapseCase[] = [
  {
    id: 'case-001',
    caseNumber: 'CS-2026-0001',
    title: 'Duplicate Invoice - Vendor Alpha Inc',
    severity: 'critical',
    status: 'pending_approval',
    anomalyType: 'duplicate_invoice',
    tenantId: 1001,
    companyCode: '1000',
    counterparty: 'Vendor Alpha Inc',
    counterpartyId: 'V-10001',
    amount: 125_000,
    currency: 'USD',
    detectedAt: '2026-01-28T14:32:00Z',
    createdAt: '2026-01-28T14:32:00Z',
    docNumber: '1900001234',
    docType: 'KR',
    slaDue: '2026-01-30T14:32:00Z',
    assignee: 'John Smith',
    confidence: 94,
    fiDocId: 'fi-001',
    description: 'Potential duplicate invoice detected with 94% confidence.',
  },
  {
    id: 'case-002',
    caseNumber: 'CS-2026-0002',
    title: 'Bank Account Change - Supplier Beta LLC',
    severity: 'high',
    status: 'open',
    anomalyType: 'bank_change',
    tenantId: 1001,
    companyCode: '1000',
    counterparty: 'Supplier Beta LLC',
    counterpartyId: 'V-10002',
    amount: 89_500,
    currency: 'USD',
    detectedAt: '2026-01-29T09:15:00Z',
    createdAt: '2026-01-29T09:15:00Z',
    docNumber: '1900001235',
    docType: 'KZ',
    slaDue: '2026-02-01T09:15:00Z',
    assignee: null,
    confidence: 87,
    fiDocId: 'fi-002',
    description: 'Bank account change detected 24 hours before scheduled payment.',
  },
  {
    id: 'case-003',
    caseNumber: 'CS-2026-0003',
    title: 'Authorization Limit Exceeded - Contractor Gamma',
    severity: 'high',
    status: 'in_progress',
    anomalyType: 'policy_violation',
    tenantId: 1001,
    companyCode: '2000',
    counterparty: 'Contractor Gamma',
    counterpartyId: 'V-10003',
    amount: 52_000,
    currency: 'EUR',
    detectedAt: '2026-01-29T11:45:00Z',
    createdAt: '2026-01-29T11:45:00Z',
    docNumber: '1900001236',
    docType: 'KR',
    slaDue: '2026-02-02T11:45:00Z',
    assignee: 'Sarah Johnson',
    confidence: 91,
    fiDocId: 'fi-003',
    description: 'Payment exceeds single transaction limit without required dual approval.',
  },
  {
    id: 'case-004',
    caseNumber: 'CS-2026-0004',
    title: 'PO/Invoice Mismatch - Vendor Delta Corp',
    severity: 'medium',
    status: 'open',
    anomalyType: 'integrity_mismatch',
    tenantId: 1001,
    companyCode: '1000',
    counterparty: 'Vendor Delta Corp',
    counterpartyId: 'V-10004',
    amount: 34_200,
    currency: 'USD',
    detectedAt: '2026-01-30T08:20:00Z',
    createdAt: '2026-01-30T08:20:00Z',
    docNumber: '1900001237',
    docType: 'KR',
    slaDue: '2026-02-03T08:20:00Z',
    assignee: null,
    confidence: 78,
    fiDocId: 'fi-004',
    description: 'Invoice line items do not match PO quantities. Variance of 15% detected.',
  },
  {
    id: 'case-005',
    caseNumber: 'CS-2026-0005',
    title: 'Off-hours Payment - Supplier Epsilon',
    severity: 'low',
    status: 'resolved',
    anomalyType: 'timing_anomaly',
    tenantId: 1001,
    companyCode: '3000',
    counterparty: 'Supplier Epsilon',
    counterpartyId: 'V-10005',
    amount: 15_800,
    currency: 'USD',
    detectedAt: '2026-01-27T16:00:00Z',
    createdAt: '2026-01-27T16:00:00Z',
    docNumber: '1900001238',
    docType: 'KZ',
    slaDue: '2026-01-31T16:00:00Z',
    assignee: 'Mike Chen',
    confidence: 65,
    fiDocId: 'fi-005',
    description: 'Payment scheduled outside normal business hours. Verified as legitimate after review.',
  },
];

// ----------------------------------------------------------------------
// Mock: Actions (전체 필드, simulationResult 포함)
// ----------------------------------------------------------------------

export const mockActions: SynapseAction[] = [
  {
    id: 'act-001',
    caseId: 'case-001',
    actionType: 'block_payment',
    type: 'block_payment',
    autonomyMode: 'semi_auto',
    requiredApproval: true,
    riskLevel: 'critical',
    targetSystem: 'SAP FI',
    createdAt: '2026-01-28T14:35:00Z',
    status: 'pending',
    description: 'Block payment run for invoice #INV-2026-1234 pending duplicate verification',
    companyCode: '1000',
    amount: 125000,
    currency: 'USD',
    simulation: {
      predictedSuccess: true,
      impactedObjects: ['Payment Run PR-2026-001', 'Invoice INV-2026-1234', 'Vendor Balance V-10001'],
      validations: [
        { name: 'Authorization Check', passed: true, message: 'User has required permissions' },
        { name: 'Business Rule Check', passed: true, message: 'Within policy guidelines' },
        { name: 'System Availability', passed: true, message: 'SAP FI system available' },
      ],
      riskNotes: ['Payment delay may affect vendor relationship', 'Manual follow-up required within 24h'],
    },
    simulationResult: {
      predictedSuccess: true,
      impactedObjects: ['Payment Run PR-2026-001', 'Invoice INV-2026-1234', 'Vendor Balance V-10001'],
      validations: [
        { name: 'Authorization Check', passed: true, message: 'User has required permissions' },
        { name: 'Business Rule Check', passed: true, message: 'Within policy guidelines' },
        { name: 'System Availability', passed: true, message: 'SAP FI system available' },
      ],
      riskNotes: ['Payment delay may affect vendor relationship', 'Manual follow-up required within 24h'],
    },
    estimatedImpact: {
      amount: 125000,
      currency: 'USD',
    },
  },
  {
    id: 'act-002',
    caseId: 'case-002',
    actionType: 'flag_review',
    type: 'flag_review',
    autonomyMode: 'auto',
    requiredApproval: false,
    riskLevel: 'high',
    targetSystem: 'SAP MM',
    createdAt: '2026-01-29T09:20:00Z',
    status: 'executed',
    description: 'Flag vendor master data for compliance review due to bank change',
    companyCode: '1000',
    amount: 89500,
    currency: 'USD',
    estimatedImpact: {
      amount: 89500,
      currency: 'USD',
    },
  },
  {
    id: 'act-003',
    caseId: 'case-003',
    actionType: 'post_reversal',
    type: 'post_reversal',
    autonomyMode: 'manual',
    requiredApproval: true,
    riskLevel: 'high',
    targetSystem: 'SAP FI',
    createdAt: '2026-01-29T12:00:00Z',
    status: 'approved',
    description: 'Post reversal document for unauthorized payment',
    companyCode: '2000',
    amount: 52000,
    currency: 'EUR',
    estimatedImpact: {
      amount: 52000,
      currency: 'EUR',
    },
  },
  {
    id: 'act-004',
    caseId: 'case-001',
    actionType: 'clear_item',
    type: 'clear_item',
    autonomyMode: 'semi_auto',
    requiredApproval: true,
    riskLevel: 'medium',
    targetSystem: 'SAP FI',
    createdAt: '2026-01-30T08:00:00Z',
    status: 'pending',
    description: 'Clear open item after duplicate confirmation',
    companyCode: '1000',
    amount: 125000,
    currency: 'USD',
    estimatedImpact: {
      amount: 125000,
      currency: 'USD',
    },
  },
];

// ----------------------------------------------------------------------
// Mock: Audit Events, Policies
// ----------------------------------------------------------------------

export const mockAuditEvents: AuditEvent[] = [
  {
    id: 'evt-001',
    caseId: 'case-001',
    timestamp: '2026-01-28T14:32:00Z',
    eventType: 'case_created',
    actor: 'AI Agent',
    actorType: 'agent',
    description: 'Case CS-2026-0001 created: Potential duplicate invoice detected',
  },
  {
    id: 'evt-002',
    caseId: 'case-001',
    timestamp: '2026-01-28T14:35:00Z',
    eventType: 'action_proposed',
    actor: 'AI Agent',
    actorType: 'agent',
    description: 'Action proposed: Block payment for INV-2026-1234',
  },
  {
    id: 'evt-003',
    caseId: 'case-001',
    timestamp: '2026-01-28T14:40:00Z',
    eventType: 'simulation_run',
    actor: 'AI Agent',
    actorType: 'agent',
    description: 'Pre-execution simulation completed successfully',
  },
  {
    id: 'evt-004',
    caseId: 'case-001',
    timestamp: '2026-01-28T15:00:00Z',
    eventType: 'approval_requested',
    actor: 'AI Agent',
    actorType: 'agent',
    description: 'Approval requested from John Smith for payment block',
  },
  {
    id: 'evt-005',
    caseId: 'case-001',
    timestamp: '2026-01-28T15:30:00Z',
    eventType: 'comment_added',
    actor: 'John Smith',
    actorType: 'user',
    description: 'Comment added: "Reviewing vendor history before approval"',
  },
];

export const mockPolicies: Policy[] = [
  {
    id: 'pol-001',
    name: 'Duplicate Invoice Detection Policy',
    title: 'Duplicate Invoice Detection Policy',
    category: 'AP Controls',
    content:
      'Invoices with matching amounts within a 30-day window from the same vendor must be flagged for review. Threshold: >$10,000 or >90% amount match.',
    source: 'Corporate Finance Policy Manual v4.2',
    lastUpdated: '2025-12-01',
    updatedAt: '2025-12-01',
    version: '4.2',
    description: 'Policy for detecting and preventing duplicate invoice payments',
  },
  {
    id: 'pol-002',
    name: 'Bank Account Change Policy',
    title: 'Bank Account Change Policy',
    category: 'Vendor Management',
    content:
      'Any vendor bank account changes within 72 hours of a scheduled payment require dual approval and vendor callback verification.',
    source: 'Treasury Operations Guidelines',
    lastUpdated: '2025-11-15',
    updatedAt: '2025-11-15',
    version: '2.1',
    description: 'Policy for managing vendor bank account changes',
  },
  {
    id: 'pol-003',
    name: 'Payment Authorization Matrix',
    title: 'Payment Authorization Matrix',
    category: 'Authorization',
    content:
      'Single transactions exceeding $50,000 require manager approval. Transactions exceeding $100,000 require director approval.',
    source: 'Delegation of Authority Policy',
    lastUpdated: '2025-10-20',
    updatedAt: '2025-10-20',
    version: '3.0',
    description: 'Authorization matrix for payment approvals',
  },
];

// ----------------------------------------------------------------------
// Mock: FI Documents, Open Items, Entities
// ----------------------------------------------------------------------

export const mockFiDocs: FiDocHeader[] = [
  {
    id: 'fi-001',
    belnr: '1900001234',
    bukrs: '1000',
    gjahr: '2026',
    budat: '2026-01-28',
    bldat: '2026-01-25',
    blart: 'KR',
    tcode: 'FB60',
    usnam: 'BATCH_USER',
    counterparty: 'Vendor Alpha Inc',
    counterpartyId: 'V-10001',
    wrbtr: 125_000,
    waers: 'USD',
    xblnr: 'INV-2026-1234',
    bktxt: 'Vendor Invoice - Materials Q1',
    tenantId: 1001,
    integrityStatus: 'warn',
    reversalFlag: false,
    createdAt: '2026-01-28T14:30:00Z',
    linkedCasesCount: 1,
  },
  {
    id: 'fi-002',
    belnr: '1900001235',
    bukrs: '1000',
    gjahr: '2026',
    budat: '2026-01-29',
    bldat: '2026-01-27',
    blart: 'KR',
    tcode: 'FB60',
    usnam: 'AP_USER01',
    counterparty: 'Supplier Beta LLC',
    counterpartyId: 'V-10002',
    wrbtr: 89_500,
    waers: 'USD',
    xblnr: 'INV-2026-5678',
    bktxt: 'Services Invoice - Consulting',
    tenantId: 1001,
    integrityStatus: 'pass',
    reversalFlag: false,
    createdAt: '2026-01-29T09:10:00Z',
    linkedCasesCount: 1,
  },
  {
    id: 'fi-003',
    belnr: '1900001236',
    bukrs: '2000',
    gjahr: '2026',
    budat: '2026-01-29',
    bldat: '2026-01-28',
    blart: 'KR',
    tcode: 'MIRO',
    usnam: 'AP_USER02',
    counterparty: 'Contractor Gamma',
    counterpartyId: 'V-10003',
    wrbtr: 52_000,
    waers: 'EUR',
    xblnr: 'INV-EU-2026-001',
    bktxt: 'Project Services - Phase 2',
    tenantId: 1001,
    integrityStatus: 'fail',
    reversalFlag: false,
    createdAt: '2026-01-29T11:45:00Z',
    linkedCasesCount: 1,
  },
];

export const mockOpenItems: OpenItem[] = [
  {
    id: 'oi-001',
    entityId: 'V-10001',
    entityName: 'Vendor Alpha Inc',
    docId: 'fi-001',
    docNumber: '1900001234',
    type: 'AP',
    amount: 125_000,
    currency: 'USD',
    dueDate: '2026-02-27',
    daysPastDue: 0,
    status: 'open',
    disputeFlag: false,
    paymentBlock: true,
    blockReason: 'Pending duplicate invoice review',
    recommendedAction: 'request_approval',
    guardrailStatus: 'approval_required',
    companyCode: '1000',
    tenantId: 1001,
    clearingHistory: [],
  },
  {
    id: 'oi-002',
    entityId: 'V-10002',
    entityName: 'Supplier Beta LLC',
    docId: 'fi-002',
    docNumber: '1900001235',
    type: 'AP',
    amount: 89_500,
    currency: 'USD',
    dueDate: '2026-03-15',
    daysPastDue: 0,
    status: 'open',
    disputeFlag: false,
    paymentBlock: false,
    companyCode: '1000',
    tenantId: 1001,
    clearingHistory: [],
  },
  {
    id: 'oi-003',
    entityId: 'V-10003',
    entityName: 'Contractor Gamma',
    docId: 'fi-003',
    docNumber: '1900001236',
    type: 'AP',
    amount: 52_000,
    currency: 'EUR',
    dueDate: '2026-01-28',
    daysPastDue: 3,
    status: 'open',
    disputeFlag: true,
    paymentBlock: true,
    blockReason: 'Authorization limit exceeded',
    recommendedAction: 'request_approval',
    guardrailStatus: 'blocked',
    companyCode: '2000',
    tenantId: 1001,
    clearingHistory: [],
  },
];

export const mockEntities: Entity[] = [
  {
    id: 'V-10001',
    type: 'vendor',
    code: 'V-10001',
    name: 'Vendor Alpha Inc',
    country: 'US',
    tenantId: 1001,
    companyCode: '1000',
    riskScore: 78,
    riskTrend: 'up',
    concentrationRisk: 'high',
    lastUpdated: '2026-01-28T14:30:00Z',
    openItemsTotal: 170_000,
    openItemsCount: 3,
    overdueTotal: 45_000,
    overdueCount: 1,
    recentAnomaliesCount: 2,
    currency: 'USD',
    linkedDocIds: ['fi-001'],
    linkedCaseIds: ['case-001'],
    linkedOpenItemIds: ['oi-001'],
    bankAccount: '****4567',
    bankName: 'Chase Bank',
    contactName: 'Robert Wilson',
    contactEmail: 'r.wilson@alpha-inc.com',
    contactPhone: '+1 555-0101',
    address: '123 Business Ave, New York, NY 10001',
    taxId: '12-3456789',
    paymentTerms: 'Net 30',
  },
  {
    id: 'V-10002',
    type: 'vendor',
    code: 'V-10002',
    name: 'Supplier Beta LLC',
    country: 'US',
    tenantId: 1001,
    companyCode: '1000',
    riskScore: 65,
    riskTrend: 'stable',
    concentrationRisk: 'medium',
    lastUpdated: '2026-01-29T09:10:00Z',
    openItemsTotal: 89_500,
    openItemsCount: 1,
    overdueTotal: 0,
    overdueCount: 0,
    recentAnomaliesCount: 1,
    currency: 'USD',
    linkedDocIds: ['fi-002'],
    linkedCaseIds: ['case-002'],
    linkedOpenItemIds: ['oi-002'],
    bankAccount: '****8901',
    bankName: 'Bank of America',
    contactName: 'Lisa Chen',
    contactEmail: 'l.chen@betallc.com',
    contactPhone: '+1 555-0102',
    address: '456 Commerce St, Los Angeles, CA 90001',
    taxId: '98-7654321',
    paymentTerms: 'Net 45',
  },
  {
    id: 'V-10003',
    type: 'vendor',
    code: 'V-10003',
    name: 'Contractor Gamma',
    country: 'DE',
    tenantId: 1001,
    companyCode: '2000',
    riskScore: 82,
    riskTrend: 'up',
    concentrationRisk: 'low',
    lastUpdated: '2026-01-29T11:45:00Z',
    openItemsTotal: 52_000,
    openItemsCount: 1,
    overdueTotal: 52_000,
    overdueCount: 1,
    recentAnomaliesCount: 1,
    currency: 'EUR',
    linkedDocIds: ['fi-003'],
    linkedCaseIds: ['case-003'],
    linkedOpenItemIds: ['oi-003'],
    bankAccount: '****2345',
    bankName: 'Deutsche Bank',
    contactName: 'Hans Mueller',
    contactEmail: 'h.mueller@gamma.de',
    contactPhone: '+49 30 12345678',
    address: 'Berliner Str. 100, 10115 Berlin, Germany',
    taxId: 'DE123456789',
    paymentTerms: 'Net 30',
  },
  {
    id: 'C-50001',
    type: 'customer',
    code: 'C-50001',
    name: 'Customer XYZ Corp',
    country: 'US',
    tenantId: 1001,
    companyCode: '1000',
    riskScore: 35,
    riskTrend: 'stable',
    concentrationRisk: 'medium',
    lastUpdated: '2026-01-26T11:30:00Z',
    openItemsTotal: 78_500,
    openItemsCount: 2,
    overdueTotal: 25_000,
    overdueCount: 1,
    recentAnomaliesCount: 0,
    currency: 'USD',
    linkedDocIds: [],
    linkedCaseIds: [],
    linkedOpenItemIds: [],
    bankAccount: '****9876',
    bankName: 'PNC Bank',
    contactName: 'David Lee',
    contactEmail: 'd.lee@xyzcorp.com',
    contactPhone: '+1 555-0301',
    address: '999 Customer Way, Seattle, WA 98101',
    taxId: '11-2233445',
    paymentTerms: 'Net 30',
  },
];

export const mockAgentActivity: AgentActivityItem[] = [
  {
    id: 1,
    timestamp: '2026-01-30T10:45:32Z',
    action: 'SCAN',
    target: 'FI Documents',
    status: 'complete',
    message: 'Processed 1,247 documents in batch scan',
  },
  {
    id: 2,
    timestamp: '2026-01-30T10:45:28Z',
    action: 'DETECT',
    target: 'Case CS-2026-0006',
    status: 'alert',
    message: 'Critical anomaly detected: Amount variance 3x historical average',
  },
  {
    id: 3,
    timestamp: '2026-01-30T10:44:15Z',
    action: 'EXECUTE',
    target: 'Action ACT-002',
    status: 'success',
    message: 'Auto-flagged vendor V-10002 for compliance review',
  },
  {
    id: 4,
    timestamp: '2026-01-30T10:43:00Z',
    action: 'SIMULATE',
    target: 'Action ACT-001',
    status: 'complete',
    message: 'Pre-execution simulation passed all validations',
  },
  {
    id: 5,
    timestamp: '2026-01-30T10:42:30Z',
    action: 'ANALYZE',
    target: 'Vendor V-10001',
    status: 'complete',
    message: 'RAG analysis complete: 3 policy citations found',
  },
  {
    id: 6,
    timestamp: '2026-01-30T10:41:00Z',
    action: 'MATCH',
    target: 'Open Items',
    status: 'complete',
    message: 'Auto-matched 45 open items, 3 exceptions flagged',
  },
];

export const mockRiskDrivers: RiskDriverItem[] = [
  { id: 1, type: 'duplicate_invoice', label: 'Duplicate Invoices', count: 12, amount: 450_000, trend: 'up' },
  { id: 2, type: 'bank_change', label: 'Bank Change Risk', count: 5, amount: 280_000, trend: 'stable' },
  { id: 3, type: 'policy_violation', label: 'Policy Violations', count: 8, amount: 320_000, trend: 'down' },
  { id: 4, type: 'integrity_mismatch', label: 'Data Integrity', count: 15, amount: 180_000, trend: 'up' },
];

export const mockTeamSnapshot: TeamSnapshotItem[] = [
  { id: 1, name: 'John Smith', role: 'Senior Analyst', openCases: 5, slaRisk: 1, avgLeadTime: 3.2 },
  { id: 2, name: 'Sarah Johnson', role: 'AP Manager', openCases: 8, slaRisk: 2, avgLeadTime: 4.5 },
  { id: 3, name: 'Mike Chen', role: 'Analyst', openCases: 3, slaRisk: 0, avgLeadTime: 2.8 },
  { id: 4, name: 'Emily Davis', role: 'Analyst', openCases: 6, slaRisk: 1, avgLeadTime: 3.9 },
];

// ----------------------------------------------------------------------
// Mock: FI Document Items, Integrity Checks, Entity Change Logs
// ----------------------------------------------------------------------

export const mockFiDocItems: FiDocItem[] = [
  // Items for fi-001
  {
    id: 'item-001',
    docId: 'fi-001',
    buzei: 1,
    hkont: '21000',
    hkontName: 'Accounts Payable',
    shkzg: 'H',
    wrbtr: 125000.0,
    mwskz: 'V0',
    kostl: '',
    prctr: '',
    zuonr: 'V-10001',
    sgtxt: 'Vendor Invoice INV-2026-1234',
  },
  {
    id: 'item-002',
    docId: 'fi-001',
    buzei: 2,
    hkont: '60100',
    hkontName: 'Cost of Goods Sold',
    shkzg: 'S',
    wrbtr: 112500.0,
    mwskz: 'V0',
    kostl: 'CC1000',
    prctr: 'PC1000',
    zuonr: 'PO-2026-001',
    sgtxt: 'Material costs',
  },
  {
    id: 'item-003',
    docId: 'fi-001',
    buzei: 3,
    hkont: '15400',
    hkontName: 'Input Tax',
    shkzg: 'S',
    wrbtr: 12500.0,
    mwskz: 'V1',
    kostl: '',
    prctr: '',
    zuonr: '',
    sgtxt: 'Input tax 10%',
  },
  // Items for fi-002
  {
    id: 'item-004',
    docId: 'fi-002',
    buzei: 1,
    hkont: '21000',
    hkontName: 'Accounts Payable',
    shkzg: 'H',
    wrbtr: 89500.0,
    mwskz: 'V0',
    kostl: '',
    prctr: '',
    zuonr: 'V-10002',
    sgtxt: 'Vendor Invoice INV-2026-5678',
  },
  {
    id: 'item-005',
    docId: 'fi-002',
    buzei: 2,
    hkont: '62000',
    hkontName: 'Professional Services',
    shkzg: 'S',
    wrbtr: 80550.0,
    mwskz: 'V0',
    kostl: 'CC2000',
    prctr: 'PC2000',
    zuonr: 'WBS-2026-001',
    sgtxt: 'Consulting services',
  },
  {
    id: 'item-006',
    docId: 'fi-002',
    buzei: 3,
    hkont: '15400',
    hkontName: 'Input Tax',
    shkzg: 'S',
    wrbtr: 8950.0,
    mwskz: 'V1',
    kostl: '',
    prctr: '',
    zuonr: '',
    sgtxt: 'Input tax 10%',
  },
  // Items for fi-003
  {
    id: 'item-007',
    docId: 'fi-003',
    buzei: 1,
    hkont: '21000',
    hkontName: 'Accounts Payable',
    shkzg: 'H',
    wrbtr: 52000.0,
    mwskz: 'V0',
    kostl: '',
    prctr: '',
    zuonr: 'V-10003',
    sgtxt: 'Vendor Invoice INV-EU-2026-001',
  },
  {
    id: 'item-008',
    docId: 'fi-003',
    buzei: 2,
    hkont: '62000',
    hkontName: 'Project Expenses',
    shkzg: 'S',
    wrbtr: 52000.0,
    mwskz: '',
    kostl: 'CC3000',
    prctr: 'PC3000',
    zuonr: 'PROJ-2026-002',
    sgtxt: 'Phase 2 deliverables',
  },
];

export const mockIntegrityChecks: IntegrityCheck[] = [
  {
    id: 'chk-001',
    docId: 'fi-001',
    ruleName: 'Duplicate Invoice Detection',
    severity: 'warn',
    passed: false,
    evidence: 'Found matching invoice INV-2025-9999 with same amount ($125,000) from same vendor within 30 days',
    recommendation: 'Review potential duplicate and confirm legitimacy',
    relatedCaseId: 'case-001',
  },
  {
    id: 'chk-002',
    docId: 'fi-001',
    ruleName: 'Header-Line Total Match',
    severity: 'info',
    passed: true,
    evidence: 'Header total $125,000 matches sum of line items',
    recommendation: '',
  },
  {
    id: 'chk-003',
    docId: 'fi-003',
    ruleName: 'Authorization Limit Check',
    severity: 'critical',
    passed: false,
    evidence: 'Document amount EUR 52,000 exceeds single approval limit of EUR 50,000',
    recommendation: 'Requires dual authorization per Policy PAM-001',
    relatedCaseId: 'case-003',
  },
  {
    id: 'chk-004',
    docId: 'fi-003',
    ruleName: 'Tax Code Validation',
    severity: 'warn',
    passed: false,
    evidence: 'Line item 2 missing tax code for EU cross-border transaction',
    recommendation: 'Verify tax treatment with Tax department',
  },
];

export const mockEntityChangeLogs: EntityChangeLog[] = [
  {
    id: 'ecl-001',
    entityId: 'V-10001',
    timestamp: '2026-01-28T10:00:00Z',
    fieldName: 'bankAccount',
    beforeValue: '****1234',
    afterValue: '****4567',
    actor: 'System Import',
    actorType: 'system',
    source: 'SAP MM',
    severity: 'critical',
  },
  {
    id: 'ecl-002',
    entityId: 'V-10001',
    timestamp: '2026-01-25T14:30:00Z',
    fieldName: 'paymentTerms',
    beforeValue: 'Net 45',
    afterValue: 'Net 30',
    actor: 'AP_MANAGER',
    actorType: 'user',
    source: 'Manual Update',
    severity: 'warn',
  },
  {
    id: 'ecl-003',
    entityId: 'V-10002',
    timestamp: '2026-01-29T08:00:00Z',
    fieldName: 'bankAccount',
    beforeValue: '****5678',
    afterValue: '****8901',
    actor: 'Vendor Portal',
    actorType: 'system',
    source: 'Vendor Self-Service',
    severity: 'critical',
  },
  {
    id: 'ecl-004',
    entityId: 'V-10002',
    timestamp: '2026-01-20T11:00:00Z',
    fieldName: 'address',
    beforeValue: '123 Old Street, LA, CA',
    afterValue: '456 Commerce St, Los Angeles, CA 90001',
    actor: 'AP_USER01',
    actorType: 'user',
    source: 'Manual Update',
    severity: 'info',
  },
];
