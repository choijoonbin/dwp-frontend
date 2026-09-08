import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  MEETING_STITCH_EXPORT,
  type MeetingApprovedFrame,
  type MeetingApprovedFrameSourceArtifact,
} from './meeting-approved-frame-contract';

export type MeetingSourceBinding = {
  archive: { fileName: string; sha256: string; capturedAt: string };
  archiveEnvironmentVariable: string;
  screenEntry: string;
  codeEntry: string;
  sourceArtifact: MeetingApprovedFrameSourceArtifact;
};

export function meetingSourceBinding(frame: MeetingApprovedFrame): MeetingSourceBinding {
  if (frame.sourceRevision) return frame.sourceRevision;
  const root = `stitch_enterprise_grid_calendar_application/${frame.sourceArtifact.exportDirectory}`;
  return {
    archive: MEETING_STITCH_EXPORT,
    archiveEnvironmentVariable: 'MEETING_STITCH_EXPORT_PATH',
    screenEntry: `${root}/screen.png`,
    codeEntry: `${root}/code.html`,
    sourceArtifact: frame.sourceArtifact,
  };
}

function digest(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Reads pinned archive entries in memory. Never extracts or edits downloaded/source files. */
export function readVerifiedMeetingSource(binding: MeetingSourceBinding, archivePath: string) {
  if (digest(readFileSync(archivePath)) !== binding.archive.sha256)
    throw new Error('Meeting Stitch archive checksum mismatch');
  const screen = execFileSync('unzip', ['-p', archivePath, binding.screenEntry]);
  const code = execFileSync('unzip', ['-p', archivePath, binding.codeEntry]);
  if (digest(screen) !== binding.sourceArtifact.screenSha256)
    throw new Error('Meeting Stitch screen checksum mismatch');
  if (digest(code) !== binding.sourceArtifact.codeSha256)
    throw new Error('Meeting Stitch code checksum mismatch');
  if (
    screen.length < 24 ||
    !screen.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    throw new Error('Meeting Stitch source is not a PNG');
  const raster = { width: screen.readUInt32BE(16), height: screen.readUInt32BE(20) };
  if (
    raster.width !== binding.sourceArtifact.raster.width ||
    raster.height !== binding.sourceArtifact.raster.height
  )
    throw new Error('Meeting Stitch source raster mismatch');
  return { screen, code, raster, archivePath, archive: binding.archive };
}
