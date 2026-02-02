import type { LineageStep, VendorMasterSnapshot } from '../../components/evidence/types';

/**
 * Mock Lineage Steps with enhanced evidence data
 */
export const mockLineageSteps: LineageStep[] = [
  {
    id: 'step-1',
    name: 'SAP Raw Event',
    timestamp: '2026-01-28T14:00:00Z',
    status: 'complete',
    system: 'SAP ECC',
    details: {
      eventType: 'FI_DOCUMENT_CREATED',
      documentNumber: '1900001234',
      transactionCode: 'FB01',
    },
    rawJson: JSON.stringify(
      {
        event_type: 'FI_DOCUMENT_CREATED',
        bukrs: '1000',
        belnr: '1900001234',
        gjahr: '2026',
        blart: 'KR',
        bldat: '2026-01-28',
        budat: '2026-01-28',
        xblnr: 'INV-2026-001',
        waers: 'USD',
        kursf: 1.0,
        bktxt: 'Vendor Invoice Posting',
        user: 'SAP_USER01',
        timestamp: '2026-01-28T14:00:00.123Z',
        source_system: 'SAP_ECC_PRD',
      },
      null,
      2
    ),
    ragEvidence: [
      {
        title: 'Financial Transaction Recording Policy',
        policyCode: 'FIN-POL-001',
        docTitle: 'Financial Transaction Recording Policy',
        pageNumber: 12,
        relevanceScore: 95,
        quote:
          'All financial documents must be recorded in SAP within 24 hours of transaction date with proper authorization.',
        source: '/policies/financial-recording-policy.pdf',
      },
      {
        title: 'Vendor Invoice Processing Guidelines',
        policyCode: 'FIN-POL-003',
        docTitle: 'Vendor Invoice Processing Guidelines',
        pageNumber: 8,
        relevanceScore: 88,
        quote: 'Vendor invoices require three-way matching: Purchase Order, Goods Receipt, and Invoice.',
        source: '/policies/vendor-invoice-guidelines.pdf',
      },
    ],
  },
  {
    id: 'step-2',
    name: 'Data Ingestion',
    timestamp: '2026-01-28T14:05:00Z',
    status: 'complete',
    system: 'ETL Pipeline',
    details: {
      batchId: 'BATCH-2026-001234',
      recordsProcessed: 1,
      validationStatus: 'Passed',
    },
    rawJson: JSON.stringify(
      {
        batch_id: 'BATCH-2026-001234',
        pipeline_version: '3.2.1',
        start_time: '2026-01-28T14:05:00.000Z',
        end_time: '2026-01-28T14:05:15.432Z',
        records_processed: 1,
        records_failed: 0,
        validation_status: 'PASSED',
        validations: [
          { name: 'schema_validation', status: 'PASSED' },
          { name: 'data_quality_check', status: 'PASSED' },
          { name: 'duplicate_check', status: 'PASSED' },
        ],
        destination_table: 'dwh.fi_documents',
      },
      null,
      2
    ),
  },
  {
    id: 'step-3',
    name: 'AI Risk Scoring',
    timestamp: '2026-01-28T14:06:00Z',
    status: 'complete',
    system: 'Risk Engine',
    details: {
      modelVersion: 'v2.4.1',
      confidenceScore: 94,
      riskLevel: 'Critical',
    },
    rawJson: JSON.stringify(
      {
        model_version: 'v2.4.1',
        model_type: 'ensemble_classifier',
        inference_time_ms: 234,
        confidence_score: 0.94,
        risk_level: 'CRITICAL',
        risk_factors: [
          {
            factor: 'bank_account_changed_before_payment',
            weight: 0.35,
            score: 0.98,
            evidence: 'Bank account modified 1 day before payment',
          },
          {
            factor: 'amount_exceeds_threshold',
            weight: 0.25,
            score: 0.92,
            evidence: 'Amount $125,000 exceeds risk threshold $100,000',
          },
          {
            factor: 'vendor_risk_category',
            weight: 0.20,
            score: 0.90,
            evidence: 'Vendor risk category upgraded to HIGH',
          },
        ],
        features_used: 247,
        anomaly_types_detected: ['bank_change', 'high_value'],
      },
      null,
      2
    ),
    statsEvidence: {
      zScore: 3.5,
      mean: 45000,
      std: 22857,
      delta: 80000,
    },
    ragEvidence: [
      {
        title: 'Automated Risk Scoring Framework',
        policyCode: 'RISK-POL-002',
        docTitle: 'Automated Risk Scoring Framework',
        pageNumber: 45,
        relevanceScore: 92,
        quote:
          'Transactions with risk scores above 85% must be flagged for manual review and cannot be auto-approved.',
        source: '/policies/risk-scoring-framework.pdf',
      },
      {
        title: 'Fraud Detection Red Flags',
        policyCode: 'FRAUD-POL-001',
        docTitle: 'Fraud Detection Red Flags',
        pageNumber: 23,
        relevanceScore: 89,
        quote:
          'Bank account changes within 72 hours of payment execution are considered high-risk indicators.',
        source: '/policies/fraud-detection-red-flags.pdf',
      },
      {
        title: 'Statistical Anomaly Thresholds',
        policyCode: 'STAT-STD-001',
        docTitle: 'Statistical Anomaly Thresholds',
        pageNumber: 15,
        relevanceScore: 85,
        quote:
          'Values exceeding 3 standard deviations (3σ) from the mean require additional scrutiny and documentation.',
        source: '/policies/statistical-thresholds.pdf',
      },
    ],
  },
  {
    id: 'step-4',
    name: 'Case Created',
    timestamp: '2026-01-28T14:10:00Z',
    status: 'complete',
    system: 'Case Manager',
    details: {
      caseId: 'CS-2026-0001',
      assignee: 'John Smith',
      slaDeadline: '2026-01-30T14:00:00Z',
    },
    rawJson: JSON.stringify(
      {
        case_id: 'CS-2026-0001',
        case_type: 'FRAUD_INVESTIGATION',
        priority: 'HIGH',
        assigned_to: 'john.smith@enterprise.com',
        assigned_at: '2026-01-28T14:10:00Z',
        sla_deadline: '2026-01-30T14:00:00Z',
        sla_hours: 48,
        status: 'OPEN',
        tags: ['bank_change', 'high_value', 'vendor_risk'],
        workflow_stage: 'INITIAL_REVIEW',
        escalation_level: 'L2_SENIOR_ANALYST',
        auto_actions_blocked: true,
        requires_approval: true,
      },
      null,
      2
    ),
    ragEvidence: [
      {
        title: 'Case Management SLA Policy',
        policyCode: 'CASE-POL-001',
        docTitle: 'Case Management SLA Policy',
        pageNumber: 7,
        relevanceScore: 91,
        quote:
          'High-priority fraud cases must be resolved within 48 hours with documented evidence and approval.',
        source: '/policies/case-management-sla.pdf',
      },
    ],
  },
];

/**
 * Mock Vendor Master Data Snapshots (Time-Travel)
 */
export const mockVendorMasterSnapshots: Record<string, VendorMasterSnapshot> = {
  transaction: {
    timestamp: '2026-01-28T14:00:00Z',
    data: {
      vendorId: 'V-10001',
      vendorName: 'Vendor Alpha Inc',
      bankAccount: 'DE89370400440532013000',
      bankName: 'Deutsche Bank',
      paymentTerms: 'NET30',
      taxId: 'US123456789',
      address: '123 Main St, New York, NY 10001',
      contactEmail: 'ap@vendoralpha.com',
      riskCategory: 'Medium',
      creditLimit: 500000,
      lastModified: '2026-01-25T10:30:00Z',
      modifiedBy: 'SYSTEM_BATCH',
    },
  },
  current: {
    timestamp: '2026-01-30T09:00:00Z',
    data: {
      vendorId: 'V-10001',
      vendorName: 'Vendor Alpha Inc',
      bankAccount: 'GB82WEST12345698765432',
      bankName: 'Barclays Bank',
      paymentTerms: 'NET30',
      taxId: 'US123456789',
      address: '123 Main St, New York, NY 10001',
      contactEmail: 'ap@vendoralpha.com',
      riskCategory: 'High',
      creditLimit: 500000,
      lastModified: '2026-01-29T08:15:00Z',
      modifiedBy: 'USER_AP001',
    },
  },
};
