import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, extname, relative, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

import {
  MEETING_APPROVED_FRAMES,
  MEETING_STITCH_EXPORT,
} from './support/meeting-approved-frame-contract';

const repositoryRoot = process.cwd();
const evidenceRoot = resolve(repositoryRoot, 'e2e');
const localStitchExport = process.env.MEETING_STITCH_EXPORT_PATH;
const runtimeMetadataOwners = new Set([
  'e2e/video-meeting-approved-frame-regression.spec.ts',
  'e2e/video-meeting-admin-intelligence-visual.spec.ts',
]);
const fixedMobileNavigationFrames = new Set(['U01-M', 'U02-M', 'U07-M', 'U08-M', 'U09-M', 'U12-M']);
const implementationSnapshots = readdirSync(evidenceRoot, { recursive: true }).filter(
  (name): name is string => typeof name === 'string' && name.endsWith('.png')
);

function sha256(content: Buffer | string) {
  return createHash('sha256').update(content).digest('hex');
}

function pngRaster(content: Buffer) {
  expect(content.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: content.readUInt32BE(16), height: content.readUInt32BE(20) };
}

function evidenceRelativePath(absolutePath: string) {
  return relative(evidenceRoot, absolutePath).replaceAll('\\', '/');
}

function snapshotCallStem(screenshotName: string) {
  return basename(screenshotName, extname(screenshotName));
}

test.describe('approved Stitch frame traceability', () => {
  test('the contract contains exactly one desktop and mobile entry for every U01-U15 screen', () => {
    expect(MEETING_APPROVED_FRAMES).toHaveLength(30);
    expect(new Set(MEETING_APPROVED_FRAMES.map(({ id }) => id)).size).toBe(30);
    expect(new Set(MEETING_APPROVED_FRAMES.map(({ stitchNodeId }) => stitchNodeId)).size).toBe(30);
    expect(
      new Set(MEETING_APPROVED_FRAMES.map(({ sourceArtifact }) => sourceArtifact.exportDirectory))
        .size
    ).toBe(30);
    expect(MEETING_STITCH_EXPORT.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(
      MEETING_APPROVED_FRAMES.filter(
        ({ implementationGolden }) => implementationGolden.captureClass === 'IMMERSIVE_VIEWPORT'
      ).map(({ id }) => id)
    ).toEqual(['U06-D', 'U06-M']);
    expect(
      MEETING_APPROVED_FRAMES.filter(
        ({ implementationGolden }) => implementationGolden.captureClass === 'FULL_DOCUMENT'
      )
    ).toHaveLength(28);
    const actualFixedOverlayFrames = MEETING_APPROVED_FRAMES.filter(
      ({ implementationGolden }) => implementationGolden.clearance.fixedOverlaySelector
    ).map(({ id }) => id);
    expect(actualFixedOverlayFrames.sort()).toEqual([...fixedMobileNavigationFrames].sort());
    const goldenPaths = MEETING_APPROVED_FRAMES.map(({ implementationGolden }) =>
      implementationGolden.path.slice('e2e/'.length)
    );
    expect(new Set(goldenPaths).size, 'every approved frame owns one distinct golden').toBe(30);
    const canonicalGoldens = implementationSnapshots.filter((path) =>
      /(?:^|\/)meeting-approved-u\d{2}-ko-light-(?:chromium|mobile)-darwin\.png$/u.test(path)
    );
    expect(
      canonicalGoldens.sort(),
      'the dedicated approved-frame namespace has no orphan baselines'
    ).toEqual(goldenPaths.filter((path) => basename(path).startsWith('meeting-approved-')).sort());
    for (const goldenPath of goldenPaths) {
      const sameName = implementationSnapshots.filter(
        (candidate) => basename(candidate) === basename(goldenPath)
      );
      expect(sameName, `${goldenPath}: duplicate or orphaned same-name baseline`).toEqual([
        goldenPath,
      ]);
    }
    for (const screenshotName of new Set(
      MEETING_APPROVED_FRAMES.map(({ implementationGolden }) => implementationGolden.screenshotName)
    )) {
      const stem = snapshotCallStem(screenshotName);
      const ownerCallSnapshots = implementationSnapshots.filter((candidate) => {
        const candidateName = basename(candidate);
        return (
          candidateName.startsWith(`${stem}-`) &&
          /-(?:chromium|mobile)-darwin\.png$/u.test(candidateName)
        );
      });
      const boundCallSnapshots = MEETING_APPROVED_FRAMES.filter(
        ({ implementationGolden }) => implementationGolden.screenshotName === screenshotName
      ).map(({ implementationGolden }) => implementationGolden.path.slice('e2e/'.length));
      expect(
        ownerCallSnapshots.sort(),
        `${screenshotName}: owner call has a missing, duplicate, or orphan baseline`
      ).toEqual(boundCallSnapshots.sort());
    }
    for (let screenNumber = 1; screenNumber <= 15; screenNumber += 1) {
      const screen = `U${String(screenNumber).padStart(2, '0')}`;
      const pair = MEETING_APPROVED_FRAMES.filter((frame) => frame.screen === screen);
      expect(pair.map(({ mode }) => mode).sort(), `${screen}: exact D/M pair`).toEqual([
        'desktop',
        'mobile',
      ]);
      expect(pair[0].implementationGolden.path).not.toBe(pair[1].implementationGolden.path);
      expect(pair[0].implementationGolden.sha256).not.toBe(pair[1].implementationGolden.sha256);
      const hashes = pair.map(({ implementationGolden }) =>
        sha256(readFileSync(resolve(repositoryRoot, implementationGolden.path)))
      );
      expect(hashes[0], `${screen}: desktop and mobile raster bytes must differ`).not.toBe(
        hashes[1]
      );
    }
    if (localStitchExport) {
      expect(existsSync(localStitchExport)).toBe(true);
      expect(sha256(readFileSync(localStitchExport))).toBe(MEETING_STITCH_EXPORT.sha256);
    }
  });

  for (const frame of MEETING_APPROVED_FRAMES) {
    test(`${frame.id} binds approved node, route, state, viewport, and executable structural evidence`, async ({
      browserName: _browserName,
    }, testInfo) => {
      expect(frame.stitchNodeId).toMatch(/^[a-f0-9]{32}$/);
      expect(frame.approvedViewport.width).toBe(frame.mode === 'desktop' ? 1440 : 390);
      expect(frame.approvedViewport.height).toBeGreaterThan(800);
      expect(frame.sourceArtifact.screenSha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(frame.sourceArtifact.codeSha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(frame.sourceArtifact.raster.width).toBeGreaterThan(300);
      expect(frame.sourceArtifact.raster.height).toBeGreaterThan(800);
      expect(frame.route).toMatch(/^\/meetings\//);
      expect(frame.state).toMatch(/^[A-Z0-9_]+$/);
      expect(frame.implementationGolden.sha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(Number.isInteger(frame.implementationGolden.expectedRasterHeight)).toBe(true);
      expect(frame.implementationGolden.expectedRasterHeight).toBeGreaterThan(0);
      expect(frame.implementationGolden.orderedLandmarks.length).toBeGreaterThanOrEqual(2);
      expect(
        new Set(frame.implementationGolden.orderedLandmarks).size,
        `${frame.id}: ordered landmarks must be unique`
      ).toBe(frame.implementationGolden.orderedLandmarks.length);
      for (const selector of frame.implementationGolden.orderedLandmarks) {
        expect(selector.trim(), `${frame.id}: empty ordered landmark`).not.toBe('');
      }
      const { clearance } = frame.implementationGolden;
      expect(clearance.horizontalOverflowTolerancePx).toBeGreaterThanOrEqual(0);
      expect(clearance.horizontalOverflowTolerancePx).toBeLessThanOrEqual(1);
      expect(clearance.lastContentSelector.trim()).not.toBe('');
      expect(clearance.lastContentSelector).not.toBe('#dwp-main-content');
      expect(clearance.maxTrailingGapPx).toBeGreaterThanOrEqual(0);
      expect(Boolean(clearance.fixedOverlaySelector)).toBe(
        Boolean(clearance.fixedOverlayContentSelector)
      );
      expect(Boolean(clearance.fixedOverlaySelector)).toBe(
        fixedMobileNavigationFrames.has(frame.id)
      );
      if (clearance.fixedOverlaySelector) {
        expect(clearance.fixedOverlaySelector).toBe('[data-testid="meeting-mobile-navigation"]');
        expect(clearance.fixedOverlayContentSelector).toBe(
          '[data-testid="meeting-mobile-navigation-content"]'
        );
      }
      if (frame.screen === 'U06') {
        expect(frame.implementationGolden.captureClass).toBe('IMMERSIVE_VIEWPORT');
        expect(frame.implementationGolden.expectedRasterHeight).toBe(
          frame.mode === 'desktop' ? 960 : 844
        );
        expect(clearance.lastContentSelector).toBe('.dwp-video-meeting-room');
        expect(clearance.maxTrailingGapPx).toBe(1);
      } else {
        expect(frame.implementationGolden.captureClass).toBe('FULL_DOCUMENT');
      }

      let approvedSourceVerified = false;
      if (localStitchExport) {
        const entryRoot =
          'stitch_enterprise_grid_calendar_application/' + frame.sourceArtifact.exportDirectory;
        const approvedScreen = execFileSync('unzip', [
          '-p',
          localStitchExport,
          `${entryRoot}/screen.png`,
        ]);
        const approvedCode = execFileSync('unzip', [
          '-p',
          localStitchExport,
          `${entryRoot}/code.html`,
        ]);
        expect(sha256(approvedScreen)).toBe(frame.sourceArtifact.screenSha256);
        expect(sha256(approvedCode)).toBe(frame.sourceArtifact.codeSha256);
        expect(approvedScreen.readUInt32BE(16)).toBe(frame.sourceArtifact.raster.width);
        expect(approvedScreen.readUInt32BE(20)).toBe(frame.sourceArtifact.raster.height);
        approvedSourceVerified = true;
      }

      const sourceContents = frame.sourceFiles.map((sourceFile) => {
        const absolutePath = resolve(repositoryRoot, sourceFile);
        expect(existsSync(absolutePath), `${frame.id}: missing source ${sourceFile}`).toBe(true);
        return readFileSync(absolutePath, 'utf8');
      });
      const sourceProjection = sourceContents.join('\n');
      for (const token of frame.sourceTokens) expect(sourceProjection).toContain(token);

      const proofPath = resolve(repositoryRoot, frame.proofSpec);
      expect(existsSync(proofPath), `${frame.id}: missing proof ${frame.proofSpec}`).toBe(true);
      const proof = readFileSync(proofPath, 'utf8');
      for (const token of frame.proofTokens) expect(proof).toContain(token);

      const implementationGoldenPath = resolve(repositoryRoot, frame.implementationGolden.path);
      expect(
        existsSync(implementationGoldenPath),
        `${frame.id}: missing exact implementation golden ${frame.implementationGolden.path}`
      ).toBe(true);
      const implementationGolden = readFileSync(implementationGoldenPath);
      const implementationRaster = pngRaster(implementationGolden);
      expect(implementationRaster.width).toBe(frame.mode === 'desktop' ? 1440 : 390);
      expect(implementationRaster.width).toBe(frame.implementationGolden.expectedRasterWidth);
      expect(implementationRaster.height).toBe(frame.implementationGolden.expectedRasterHeight);
      expect(evidenceRelativePath(implementationGoldenPath)).toBe(
        frame.implementationGolden.path.slice('e2e/'.length)
      );
      const expectedProjectSuffix = `-${frame.implementationGolden.expectedProject}-darwin.png`;
      expect(
        frame.implementationGolden.path.endsWith(expectedProjectSuffix),
        `${frame.id}: exact baseline must match its owner project`
      ).toBe(true);
      expect(sha256(implementationGolden)).toBe(frame.implementationGolden.sha256);
      const ownerPath = resolve(repositoryRoot, frame.implementationGolden.ownerSpec);
      expect(existsSync(ownerPath), `${frame.id}: missing golden owner spec`).toBe(true);
      const ownerProof = readFileSync(ownerPath, 'utf8');
      expect(ownerProof).toContain('toHaveScreenshot');
      if (runtimeMetadataOwners.has(frame.implementationGolden.ownerSpec)) {
        expect(ownerProof, `${frame.id}: runtime owner must consume the exact contract`).toContain(
          'MEETING_APPROVED_FRAMES'
        );
        expect(ownerProof).toContain('implementationGolden.screenshotName');
        expect(ownerProof).toContain('captureClass');
        expect(ownerProof).toContain('orderedLandmarks');
        expect(ownerProof).toContain('clearance');
      } else {
        expect(ownerProof).toContain(frame.implementationGolden.screenshotName);
      }

      await testInfo.attach(`${frame.id}-traceability.json`, {
        contentType: 'application/json',
        body: Buffer.from(
          JSON.stringify(
            {
              ...frame,
              approvedSource: {
                archive: MEETING_STITCH_EXPORT,
                classification: 'USER_PROVIDED_STITCH_EXPORT',
                locallyVerifiedFromImmutableArchive: approvedSourceVerified,
                screenSha256: frame.sourceArtifact.screenSha256,
                codeSha256: frame.sourceArtifact.codeSha256,
                raster: frame.sourceArtifact.raster,
              },
              comparisonClass: 'APPROVED_SOURCE_PROVENANCE_AND_STRUCTURAL_PARITY',
              sourceSha256: sourceContents.map(sha256),
              proofSha256: sha256(proof),
              implementationGolden: {
                ...frame.implementationGolden,
                raster: implementationRaster,
                sha256: sha256(implementationGolden),
                classification: 'IMPLEMENTATION_REGRESSION_ONLY',
              },
              disclosure:
                'The immutable Stitch export screen/code hashes are approved-source provenance. Implementation screenshots remain regression evidence and are never relabeled as Stitch originals; shell, live-data, accessibility, and security deltas require separate review.',
            },
            null,
            2
          )
        ),
      });
    });
  }
});
