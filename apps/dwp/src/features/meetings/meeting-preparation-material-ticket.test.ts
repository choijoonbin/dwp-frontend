import { describe, expect, it } from 'vitest';
import type {
  VideoMeetingMaterialAccessTicket,
  VideoMeetingPreparationMaterial,
} from '@dwp-frontend/shared-utils/api/video-meeting-preparation-api';
import {
  preparationMaterialFormat,
  usablePreparationMaterialTicket,
} from './meeting-preparation-material-ticket';

const material: VideoMeetingPreparationMaterial = {
  materialId: 'material',
  displayName: 'Board evidence',
  contentType: 'application/pdf',
  referenceProvider: 'DWP_FILES',
  opaqueReference: null,
  sourceVersion: null,
  classification: 'CONFIDENTIAL',
  sizeBytes: 100,
  contentSha256: null,
  retentionUntil: '2027-01-01T00:00:00Z',
  accessVerificationState: 'PENDING_REVALIDATION',
  version: 3,
};
const now = Date.parse('2026-09-07T00:00:00Z');
const ticket: VideoMeetingMaterialAccessTicket = {
  meetingId: 'meeting',
  materialId: 'material',
  materialVersion: 3,
  accessUrl: 'https://files.example.test/access/opaque',
  expiresAt: '2026-09-07T00:01:00Z',
  contentType: 'application/pdf',
  displayName: 'Board evidence',
};
describe('governed preparation material presentation', () => {
  it('opens only an unexpired ticket for this meeting, material and version', () => {
    expect(usablePreparationMaterialTicket(ticket, 'meeting', material, now)).toBe(true);
    expect(usablePreparationMaterialTicket(ticket, 'other-meeting', material, now)).toBe(false);
    expect(
      usablePreparationMaterialTicket(ticket, 'meeting', { ...material, materialId: 'other' }, now)
    ).toBe(false);
    expect(
      usablePreparationMaterialTicket(ticket, 'meeting', { ...material, version: 4 }, now)
    ).toBe(false);
  });
  it('rejects missing, malformed and exactly expired grants', () => {
    expect(usablePreparationMaterialTicket(undefined, 'meeting', material, now)).toBe(false);
    expect(
      usablePreparationMaterialTicket({ ...ticket, expiresAt: 'invalid' }, 'meeting', material, now)
    ).toBe(false);
    expect(
      usablePreparationMaterialTicket(ticket, 'meeting', material, Date.parse(ticket.expiresAt))
    ).toBe(false);
  });
  it.each([
    'javascript:alert(1)',
    'http://files.example.test/access',
    'https://user:pass@files.example.test/access',
  ])('rejects unsafe access links %s', (accessUrl) => {
    expect(
      usablePreparationMaterialTicket({ ...ticket, accessUrl }, 'meeting', material, now)
    ).toBe(false);
  });
  it('uses actual content types for format badges, not synthetic previews', () => {
    expect(preparationMaterialFormat('application/pdf')).toBe('PDF');
    expect(
      preparationMaterialFormat(
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      )
    ).toBe('PPT');
    expect(preparationMaterialFormat('image/png')).toBe('IMG');
  });
});
