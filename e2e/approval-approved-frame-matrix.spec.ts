import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import {
  APPROVAL_APPROVED_FRAME_CONTRACTS,
  APPROVAL_STITCH_INTENTIONAL_DIFFERENCES,
  APPROVAL_STITCH_QUARANTINED_FRAME_IDS,
  APPROVAL_STITCH_REQUIRED_DIFFERENCES,
  APPROVAL_STITCH_SOURCE_IS_PIXEL_BASELINE,
} from './support/approval-approved-frame-contract';

interface SourceFrame {
  readonly id: string;
  readonly apr: string | null;
  readonly renderClass: string;
  readonly viewportIntent: string;
  readonly pairPath: string;
  readonly duplicateOf?: string;
  readonly screen: {
    readonly status: 'raster';
    readonly width: number;
    readonly height: number;
  };
  readonly code: { readonly sourceTokens: readonly string[] };
}

interface SourceManifest {
  readonly pairCount: number;
  readonly approvalFrameCount: number;
  readonly quarantinedFrameCount: number;
  readonly rasterFrameCount: number;
  readonly fetchErrorPlaceholderCount: number;
  readonly frames: readonly SourceFrame[];
}

const root = process.cwd();
const manifest = JSON.parse(
  fs.readFileSync(path.resolve(root, 'e2e/support/approval-stitch-source-manifest.json'), 'utf8')
) as SourceManifest;
const routeSources = [
  'apps/dwp/src/features/approvals/approval-navigation.ts',
  'apps/dwp/src/routes/approvals-routes.tsx',
].map((file) => fs.readFileSync(path.resolve(root, file), 'utf8'));
const visualOwner = fs.readFileSync(path.resolve(root, 'e2e/menu-visual-baseline.spec.ts'), 'utf8');
const visualInventory = fs.readFileSync(
  path.resolve(root, 'e2e/support/menu-visual-baseline-inventory.ts'),
  'utf8'
);
const routeHarness = fs.readFileSync(
  path.resolve(root, 'e2e/support/menu-route-harness.ts'),
  'utf8'
);

function pngDimensions(filePath: string) {
  const buffer = fs.readFileSync(filePath);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(buffer.subarray(0, signature.length)).toEqual(signature);
  expect(buffer.toString('ascii', 12, 16)).toBe('IHDR');
  return { bytes: buffer.length, width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function baselineRouteId(filePath: string) {
  const fileName = path.basename(filePath);
  const slug = fileName.replace(/-(?:chromium|mobile)-darwin\.png$/u, '');
  return slug.replace(/^approvals-/u, 'approvals.');
}

test('immutable source inventory completely classifies all reviewed Approval frames', () => {
  expect(manifest.pairCount).toBe(43);
  expect(manifest.approvalFrameCount).toBe(43);
  expect(manifest.quarantinedFrameCount).toBe(0);
  expect(manifest.rasterFrameCount).toBe(43);
  expect(manifest.fetchErrorPlaceholderCount).toBe(0);

  const approvalFrames = manifest.frames.filter((frame) => frame.apr !== null);
  const contractedIds = APPROVAL_APPROVED_FRAME_CONTRACTS.flatMap((entry) => entry.frameIds);
  expect(new Set(contractedIds).size, 'a source frame is owned by more than one APR contract').toBe(
    contractedIds.length
  );
  expect([...contractedIds].sort()).toEqual(approvalFrames.map((frame) => frame.id).sort());
  expect(manifest.frames.filter((frame) => frame.apr === null).map((frame) => frame.id)).toEqual(
    APPROVAL_STITCH_QUARANTINED_FRAME_IDS
  );
  expect(new Set(approvalFrames.map((frame) => frame.renderClass))).toEqual(
    new Set(['normal', 'mobile', 'exception', 'board'])
  );
  expect(new Set(approvalFrames.map((frame) => frame.apr))).toEqual(
    new Set(Array.from({ length: 16 }, (_, index) => `APR-${String(index + 1).padStart(2, '0')}`))
  );
});

test('visual owner keeps real route, H1, accessibility, overflow and pixel-baseline checks', () => {
  expect(visualOwner).toContain('exerciseGovernedMenuRoute(page, testInfo, productRoute');
  expect(visualOwner).toContain("include('#dwp-main-content')");
  expect(visualOwner).toContain('toHaveScreenshot(`${productRoute.id}.png`');
  expect(routeHarness).toContain("page.locator('#dwp-main-content')");
  expect(routeHarness).toContain("productMain.locator('h1').first()");
  expect(routeHarness).toContain('document.documentElement.scrollWidth');
  expect(routeHarness).toContain('has horizontal overflow');
});

test('Stitch is a source reference, never the DWP pixel baseline or runtime truth', () => {
  expect(APPROVAL_STITCH_SOURCE_IS_PIXEL_BASELINE).toBe(false);
  expect(Object.keys(APPROVAL_STITCH_INTENTIONAL_DIFFERENCES).sort()).toEqual(
    [...APPROVAL_STITCH_REQUIRED_DIFFERENCES].sort()
  );
  for (const explanation of Object.values(APPROVAL_STITCH_INTENTIONAL_DIFFERENCES)) {
    expect(explanation.length).toBeGreaterThan(30);
    expect(explanation.toLowerCase()).not.toContain('pixel identical');
  }
});

for (const contract of APPROVAL_APPROVED_FRAME_CONTRACTS) {
  test(`${contract.apr} links every approved source frame to a current route, owner spec and DWP screenshot`, () => {
    const frames = contract.frameIds.map((id) => {
      const frame = manifest.frames.find((candidate) => candidate.id === id);
      expect(frame, `missing immutable source frame ${id}`).toBeDefined();
      return frame!;
    });
    expect(frames.every((frame) => frame.apr === contract.apr)).toBe(true);
    expect(contract.differenceKeys).toEqual(APPROVAL_STITCH_REQUIRED_DIFFERENCES);
    expect(routeSources.some((source) => source.includes(contract.routeRegistrationToken))).toBe(
      true
    );
    for (const override of contract.frameRouteOverrides ?? []) {
      expect(contract.frameIds).toContain(override.frameId);
      expect(routeSources.some((source) => source.includes(override.routeRegistrationToken))).toBe(
        true
      );
      expect(override.route.startsWith('/approvals/')).toBe(true);
    }

    for (const owner of contract.ownerSpecs) {
      const ownerPath = path.resolve(root, owner.path);
      expect(fs.existsSync(ownerPath), `owner spec does not exist: ${owner.path}`).toBe(true);
      const source = fs.readFileSync(ownerPath, 'utf8');
      for (const token of owner.verificationTokens) {
        expect(source, `${owner.path} no longer owns verification token: ${token}`).toContain(
          token
        );
      }
    }

    const evidenceProjects = new Set<string>();
    for (const evidence of contract.screenshotEvidence) {
      const evidencePath = path.resolve(root, evidence);
      expect(fs.existsSync(evidencePath), `missing implementation screenshot: ${evidence}`).toBe(
        true
      );
      const dimensions = pngDimensions(evidencePath);
      expect(dimensions.bytes).toBeGreaterThan(5_000);
      const project = evidence.includes('-mobile-') ? 'mobile' : 'desktop';
      evidenceProjects.add(project);
      expect(dimensions).toMatchObject(
        project === 'mobile' ? { width: 390, height: 664 } : { width: 1280, height: 720 }
      );
      const routeId = baselineRouteId(evidence);
      expect(visualInventory).toContain(`routeId: '${routeId}'`);
      expect(visualInventory).toContain(`fileName: '${path.basename(evidence)}'`);
    }
    for (const requiredProject of contract.requiredViewportEvidence) {
      expect(evidenceProjects).toContain(requiredProject);
    }

    for (const frame of frames) {
      expect(frame.code.sourceTokens.length).toBeGreaterThanOrEqual(2);
      expect(frame.screen.status).toBe('raster');
      expect(frame.screen.width).toBeGreaterThan(0);
      expect(frame.screen.height).toBeGreaterThan(0);
      if (frame.viewportIntent.startsWith('mobile')) expect(evidenceProjects).toContain('mobile');
      else expect(evidenceProjects).toContain('desktop');
    }
  });
}
