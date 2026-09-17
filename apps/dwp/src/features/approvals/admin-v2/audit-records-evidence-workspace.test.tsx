// @vitest-environment jsdom
import { act } from 'react';
import { fireEvent, getByRole, queryByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditRecordsEvidenceWorkspace } from './audit-records-evidence-workspace';
import { attention, auditCopy, facts, healthy, metrics } from './admin-v2-test-fixtures';
import { createAdminV2TestHarness, type AdminV2TestHarness } from './admin-v2-test-harness';

const events = [
  {
    id: 'event-1',
    title: 'Policy publication reviewed',
    description: 'An independent reviewer accepted policy version 7.',
    eventTimeLabel: '2026-09-16 10:40 KST',
    actorLabel: 'Reviewer 42',
    targetLabel: 'Policy POL-17',
    correlationLabel: 'corr-audit-184',
    classificationLabel: 'CONFIDENTIAL',
    status: healthy,
    integrityStatus: { label: 'NOT_VERIFIED', tone: 'warning' as const },
  },
] as const;

const unknownBundle = {
  eventId: 'event-1',
  requestId: 'request-1',
  bundleId: 'bundle-1',
  title: 'Policy publication evidence',
  description: 'Manifest and authority evidence returned by the server.',
  generatedAtLabel: 'Generated at 10:41 KST',
  sourceRevisionLabel: 'audit rev-184',
  integrityStatus: { label: 'NOT_VERIFIED', tone: 'warning' as const },
  archiveStatus: { label: 'ARCHIVE_UNKNOWN', tone: 'warning' as const },
  integrityStatement: 'The archive provider has not returned a current verification receipt.',
  facts,
  timeline: [
    {
      id: 'timeline-1',
      title: 'Business mutation committed',
      detail: 'The approval server returned transaction evidence.',
      status: healthy,
    },
  ],
  manifests: [
    {
      id: 'manifest-1',
      name: 'Decision evidence manifest',
      digestLabel: 'sha256: server-provided-digest',
      sourceLabel: 'approval-server',
      status: healthy,
    },
  ],
} as const;

const retentionRecords = [
  {
    id: 'record-1',
    title: 'Privileged access approval record',
    description: 'Record retained under security policy.',
    retainUntilLabel: 'Retain until 2033-09-16',
    legalHoldLabel: 'Hold proposal pending',
    purgeStageLabel: 'Purge blocked',
    foreignCopyLabel: 'Foreign copy verification pending',
    status: attention,
    evidenceStatus: { label: 'PRESERVATION_PENDING', tone: 'warning' as const },
    facts,
  },
] as const;

describe('APR-23 audit, records, and legal evidence workspace', () => {
  let harness: AdminV2TestHarness;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    harness = createAdminV2TestHarness();
  });

  afterEach(async () => {
    await harness.destroy();
    vi.unstubAllGlobals();
  });

  function props(view: 'explorer' | 'evidence' | 'retention' = 'explorer') {
    return {
      state: 'ready' as const,
      copy: auditCopy,
      metrics,
      view,
      events,
      selectedEventId: 'event-1',
      evidenceBundle: unknownBundle,
      retentionRecords,
      onViewChange: vi.fn(),
      onSelectEvent: vi.fn(),
      onRefresh: vi.fn(),
      onVerifyEvidence: vi.fn(),
      onPrepareExport: vi.fn(),
      onRequestHoldReview: vi.fn(),
      exportReady: true,
      exportDisabledReason: 'A current server event is required.',
      holdReviewReady: false,
      holdReviewDisabledReason: 'Use the governed retention workspace.',
      onRetry: vi.fn(),
      onResolveConflict: vi.fn(),
    };
  }

  it('keeps display integrity neutral while allowing the supported server export command', async () => {
    const current = props('evidence');
    await harness.render(<AuditRecordsEvidenceWorkspace {...current} />);
    expect(harness.node.textContent).toContain('NOT_VERIFIED');
    expect(harness.node.textContent).toContain(unknownBundle.integrityStatement);
    const exportButton = getByRole<HTMLButtonElement>(harness.node, 'button', {
      name: auditCopy.prepareExportLabel,
    });
    expect(exportButton.disabled).toBe(false);
    await act(async () => fireEvent.click(exportButton));
    expect(current.onPrepareExport).toHaveBeenCalledWith('bundle-1');
    await act(async () =>
      fireEvent.click(getByRole(harness.node, 'button', { name: auditCopy.verifyLabel }))
    );
    expect(current.onVerifyEvidence).toHaveBeenCalledWith('bundle-1');
  });

  it('blocks export from explicit command readiness and exposes the reason', async () => {
    const current = { ...props('evidence'), exportReady: false };
    await harness.render(<AuditRecordsEvidenceWorkspace {...current} />);
    const exportButton = getByRole<HTMLButtonElement>(harness.node, 'button', {
      name: auditCopy.prepareExportLabel,
    });
    expect(exportButton.disabled).toBe(true);
    expect(harness.node.textContent).toContain(current.exportDisabledReason);
    await act(async () => fireEvent.click(exportButton));
    expect(current.onPrepareExport).not.toHaveBeenCalled();
    expect(
      getByRole<HTMLButtonElement>(harness.node, 'button', { name: auditCopy.mobileExportLabel })
        .disabled
    ).toBe(true);
  });

  it('hides evidence bound to a different selected event and sends no export command', async () => {
    const current = {
      ...props('evidence'),
      events: [...events, { ...events[0], id: 'event-2', title: 'Second audit event' }],
      selectedEventId: 'event-2',
    };
    await harness.render(<AuditRecordsEvidenceWorkspace {...current} />);
    expect(queryByRole(harness.node, 'button', { name: auditCopy.prepareExportLabel })).toBeNull();
    expect(current.onPrepareExport).not.toHaveBeenCalled();
  });

  it('preserves retention evidence during 409 and routes hold changes to review', async () => {
    const current = props('retention');
    await harness.render(<AuditRecordsEvidenceWorkspace {...current} state="conflict" />);
    expect(harness.node.textContent).toContain(retentionRecords[0].foreignCopyLabel);
    await act(async () =>
      fireEvent.click(getByRole(harness.node, 'button', { name: auditCopy.state.conflictAction }))
    );
    expect(current.onResolveConflict).toHaveBeenCalledTimes(1);
    expect(
      getByRole<HTMLButtonElement>(harness.node, 'button', {
        name: auditCopy.requestHoldReviewLabel,
      }).disabled
    ).toBe(true);
    expect(harness.node.textContent).toContain(current.holdReviewDisabledReason);
  });
});
