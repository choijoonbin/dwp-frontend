// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  approvalDraftBackupFingerprint,
  approvalDraftBackupSource,
  createApprovalDraftBackupArtifact,
  downloadApprovalDraftBackup,
  sameApprovalDraftBackupSource,
} from './approval-request-draft-backup';

import type { ApprovalRequestDetail } from '@dwp-frontend/shared-utils';
import type { ApprovalDraftBackupDocument } from './approval-request-draft-backup';

const detail = (overrides: Partial<ApprovalRequestDetail> = {}): ApprovalRequestDetail => ({
  request: {
    requestId: '00000000-0000-0000-0000-000000000007',
    requestNumber: 'APR-2026-한글-007',
    title: '운영 로그 접근 신청',
    summary: '수검 목적의 읽기 전용 접근입니다.',
    workflowNameKo: '보안 검토',
    workflowNameEn: 'Security review',
    totalSteps: 2,
    status: 'DRAFT',
    priority: 'HIGH',
    dataClassification: 'CONFIDENTIAL',
    version: 7,
  },
  workflowId: '00000000-0000-0000-0000-000000000101',
  formId: '00000000-0000-0000-0000-000000000102',
  formVersionId: '00000000-0000-0000-0000-000000000103',
  formSchemaSha256: 'a'.repeat(64),
  payload: { reason: '정기 수검', systems: ['ledger', 'audit'], days: 30 },
  timeline: [],
  ...overrides,
});

describe('owned approval draft JSON backup', () => {
  beforeEach(() => vi.stubGlobal('crypto', webcrypto));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates deterministic UTF-8 JSON with exact binding, input and truthful lifecycle metadata', async () => {
    const source = approvalDraftBackupSource(detail());
    const artifact = await createApprovalDraftBackupArtifact(source, '2026-09-14T01:02:03Z');
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(artifact.bytes);
    const backup = JSON.parse(decoded) as ApprovalDraftBackupDocument;

    expect(decoded).toBe(artifact.content);
    expect(artifact.fileName).toBe('dwp-approval-draft-APR-2026----007-v7.json');
    expect(backup).toMatchObject({
      format: 'DWP_APPROVAL_DRAFT_BACKUP',
      schemaVersion: 1,
      source: {
        authority: 'CURRENT_OWNER_DETAIL_REVALIDATED',
        requestId: source.requestId,
        expectedVersion: 7,
        status: 'DRAFT',
      },
      binding: {
        workflowId: source.workflowId,
        formId: source.formId,
        formVersionId: source.formVersionId,
        formSchemaSha256: 'a'.repeat(64),
      },
      inputSnapshot: {
        title: '운영 로그 접근 신청',
        summary: '수검 목적의 읽기 전용 접근입니다.',
        payload: { days: 30, reason: '정기 수검', systems: ['ledger', 'audit'] },
      },
      lifecycle: {
        discardContract: 'RESTORABLE_SOFT_DELETE',
        physicalDeletionPerformed: false,
        revisionHistoryPreserved: true,
      },
      integrity: { algorithm: 'SHA-256' },
    });
    expect(backup.integrity.sourceSha256).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('binds equality to version, form/workflow identity and the complete input snapshot', () => {
    const source = approvalDraftBackupSource(detail());
    const reordered = approvalDraftBackupSource(
      detail({ payload: { days: 30, systems: ['ledger', 'audit'], reason: '정기 수검' } })
    );
    expect(sameApprovalDraftBackupSource(source, reordered)).toBe(true);
    expect(approvalDraftBackupFingerprint(source)).toBe(approvalDraftBackupFingerprint(reordered));
    expect(
      sameApprovalDraftBackupSource(
        source,
        approvalDraftBackupSource(detail({ payload: { ...detail().payload, days: 31 } }))
      )
    ).toBe(false);
    expect(
      sameApprovalDraftBackupSource(
        source,
        approvalDraftBackupSource(detail({ formVersionId: 'changed-form-version' }))
      )
    ).toBe(false);
  });

  it('rejects non-draft, invalid version and non-JSON input sources', () => {
    expect(() =>
      approvalDraftBackupSource(detail({ request: { ...detail().request, status: 'SUBMITTED' } }))
    ).toThrow();
    expect(() =>
      approvalDraftBackupSource(detail({ request: { ...detail().request, version: Number.NaN } }))
    ).toThrow();
    expect(() => approvalDraftBackupSource(detail({ payload: { invalid: undefined } }))).toThrow();
  });

  it('never creates a browser file after the current owner scope changes', async () => {
    const createObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    const artifact = await createApprovalDraftBackupArtifact(approvalDraftBackupSource(detail()));
    expect(() => downloadApprovalDraftBackup(artifact, () => false)).toThrow(
      'Approval draft backup context changed'
    );
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
