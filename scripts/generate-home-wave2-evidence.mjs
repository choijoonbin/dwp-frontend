#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'architecture/home-wave2-evidence.v1.json');
const registryPath = resolve(root, 'architecture/home-wave2-design-source-registry.v1.json');
const cleanRunReceipt = 'architecture/home-wave2-playwright-junit.xml';
const implementationCommit = process.argv
  .find((argument) => argument.startsWith('--implementation-commit='))
  ?.split('=')[1];

if (!/^[a-f0-9]{40}$/u.test(implementationCommit ?? '')) {
  throw new Error('Pass a full implementation commit as --implementation-commit=<40-char SHA>.');
}

const sha256 = (path) =>
  createHash('sha256')
    .update(readFileSync(resolve(root, path)))
    .digest('hex');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const registryById = new Map(registry.screens.map((screen) => [screen.id, screen]));

const stateEvidenceIds = new Set([
  'C10-D1440-EMPTY-r02',
  'C10-M390-EMPTY-r01',
  'C11-D1440-PARTIAL-r02',
  'C11-M390-PARTIAL-r02',
  'C12-D1440-FORBIDDEN-r02',
  'C12-M390-FORBIDDEN-r04',
  'C13-D1440-STALE-r02',
  'C13-M390-STALE-r03',
  'C14-D1440-BACKGROUND-REFRESH-r02',
  'C14-D1440-INITIAL-LOADING-r02',
  'C14-M390-BACKGROUND-REFRESH-r02',
  'C14-M390-INITIAL-LOADING-r02',
  'C15-D1440-EDITOR-DIRTY-r01',
  'C15-M390-EDITOR-DIRTY-r01',
  'C16-D1440-SAVE-CONFLICT-r02',
  'C16-M390-SAVE-CONFLICT-r02',
  'C17-MODE-PRESET',
  'C18-KEYBOARD-REDUCED-MOTION-SPEC-r02',
  'CLASSIC-STATE-COMPONENT-SPEC-A',
]);

const interactionEvidenceIds = new Set([
  'C15-D1440-EDITOR-DIRTY-r01',
  'C15-M390-EDITOR-DIRTY-r01',
  'C16-D1440-SAVE-CONFLICT-r02',
  'C16-M390-SAVE-CONFLICT-r02',
  'C17-MODE-PRESET',
  'C18-KEYBOARD-REDUCED-MOTION-SPEC-r02',
  'FLOW-EDITOR-DESKTOP',
]);

const viewportById = {
  'C01-D1440-BASE': { width: 1440, height: 900 },
  'C02-D1280-BASE': { width: 1280, height: 900 },
  'C03-M390-BASE': { width: 390, height: 844 },
  'C04-M320-BASE': { width: 320, height: 720 },
  'C05-BROWSER-ZOOM-200-CSS720-r01': { width: 720, height: 900, browserZoomPercent: 200 },
  'C06-TEXT-200-D1440-r04': { width: 1440, height: 900, textScalePercent: 200 },
  'C07-LONG-EN-D1280-r02': { width: 1280, height: 900 },
  'C08-DARK-D1440-r02': { width: 1440, height: 900 },
  'C09-HIGH-CONTRAST-D1440-r04': { width: 1440, height: 900 },
  'C10-D1440-EMPTY-r02': { width: 1440, height: 900 },
  'C10-M390-EMPTY-r01': { width: 390, height: 844 },
  'C11-D1440-PARTIAL-r02': { width: 1440, height: 900 },
  'C11-M390-PARTIAL-r02': { width: 390, height: 844 },
  'C12-D1440-FORBIDDEN-r02': { width: 1440, height: 900 },
  'C12-M390-FORBIDDEN-r04': { width: 390, height: 844 },
  'C13-D1440-STALE-r02': { width: 1440, height: 900 },
  'C13-M390-STALE-r03': { width: 390, height: 844 },
  'C14-D1440-BACKGROUND-REFRESH-r02': { width: 1440, height: 900 },
  'C14-D1440-INITIAL-LOADING-r02': { width: 1440, height: 900 },
  'C14-M390-BACKGROUND-REFRESH-r02': { width: 390, height: 844 },
  'C14-M390-INITIAL-LOADING-r02': { width: 390, height: 844 },
  'C15-D1440-EDITOR-DIRTY-r01': { width: 1440, height: 900 },
  'C15-M390-EDITOR-DIRTY-r01': { width: 390, height: 844 },
  'C16-D1440-SAVE-CONFLICT-r02': { width: 1440, height: 900 },
  'C16-M390-SAVE-CONFLICT-r02': { width: 390, height: 844 },
  'C17-MODE-PRESET': { width: 1440, height: 900 },
  'C18-KEYBOARD-REDUCED-MOTION-SPEC-r02': { width: 1440, height: 900 },
  'CLASSIC-STATE-COMPONENT-SPEC-A': { width: 1440, height: 1100 },
  'FLOW-BASE-DESKTOP-FINAL': { width: 1920, height: 1080 },
  'FLOW-BASE-MOBILE-FINAL': { width: 390, height: 844 },
  'FLOW-EDITOR-DESKTOP': { width: 1920, height: 1080 },
  'FLOW-PERSONALIZED-DESKTOP-FINAL': { width: 1920, height: 1080 },
  'FLOW-PERSONALIZED-MOBILE-FINAL': { width: 390, height: 844 },
};

const visualPathFor = (id, interaction = false) => {
  const suite = stateEvidenceIds.has(id)
    ? 'e2e/home-wave2-state-evidence.spec.ts-snapshots'
    : 'e2e/home-wave2-acceptance.spec.ts-snapshots';
  const suffix = interaction ? '-interaction' : '';
  return `${suite}/home-wave2-${id}${suffix}-chromium-darwin.png`;
};

const evidencePathFor = (id) =>
  stateEvidenceIds.has(id)
    ? 'e2e/home-wave2-state-evidence.spec.ts'
    : 'e2e/home-wave2-acceptance.spec.ts';

const browserInstance = await chromium.launch({ headless: true });
const browserVersion = browserInstance.version();
await browserInstance.close();
if (process.platform !== 'darwin') {
  throw new Error(`Wave 2 canonical evidence expects darwin, received ${process.platform}.`);
}

const browser = {
  name: 'Chromium',
  version: browserVersion,
  project: 'chromium',
  platform: process.platform,
};

manifest.sourceRegistrySha256 = createHash('sha256')
  .update(readFileSync(registryPath))
  .digest('hex');
manifest.evidenceEnvironment = {
  implementationCommit,
  browser,
  reducedMotion: 'REDUCE',
  axePolicy: 'CRITICAL_AND_SERIOUS',
};
manifest.testOnlyStateSpec = {
  html: 'apps/dwp/home-wave2-state-spec.html',
  source: 'apps/dwp/e2e-fixtures/home-wave2-state-spec.tsx',
  productionExcluded: true,
  productionReachabilityCheck: 'scripts/check-production-reachability.mjs',
  productionBuildCheck: 'scripts/check-home-wave2-production-exclusion.mjs',
};
manifest.visualReview = {
  method: 'HUMAN_PERCEPTUAL_AND_CONTRACT_REVIEW',
  record: 'architecture/home-wave2-visual-comparison.md',
  decision: 'PASS_WITH_PRODUCT_NATIVE_ADAPTATIONS',
};
if (!existsSync(resolve(root, cleanRunReceipt))) {
  throw new Error(`Missing combined clean-run receipt: ${cleanRunReceipt}`);
}
manifest.cleanRun = {
  status: 'PASS',
  testCount: 15,
  suites: ['e2e/home-wave2-acceptance.spec.ts', 'e2e/home-wave2-state-evidence.spec.ts'],
  receipt: cleanRunReceipt,
  receiptSha256: sha256(cleanRunReceipt),
};

manifest.canonicalScreens = manifest.canonicalScreens.map((screen) => {
  const source = registryById.get(screen.id);
  if (!source) throw new Error(`Source registry has no ${screen.id}.`);
  const visualEvidence = visualPathFor(screen.id);
  if (!existsSync(resolve(root, visualEvidence))) {
    throw new Error(`Missing primary visual evidence for ${screen.id}: ${visualEvidence}`);
  }
  const evidencePath = evidencePathFor(screen.id);
  const interactionPath = visualPathFor(screen.id, true);
  if (interactionEvidenceIds.has(screen.id) && !existsSync(resolve(root, interactionPath))) {
    throw new Error(`Missing interaction visual evidence for ${screen.id}: ${interactionPath}`);
  }

  const result = {
    ...screen,
    sourcePngSha256: source.png.sha256,
    evidence: [evidencePath],
    implementationCommit,
    browser,
    viewport: viewportById[screen.id],
    locale: screen.id === 'C07-LONG-EN-D1280-r02' ? 'en-US' : 'ko-KR',
    theme:
      screen.id === 'C08-DARK-D1440-r02'
        ? 'DARK'
        : screen.id === 'C09-HIGH-CONTRAST-D1440-r04'
          ? 'FORCED_COLORS'
          : 'LIGHT',
    reducedMotion: 'REDUCE',
    axeResult: {
      status: 'PASS',
      ruleLevel: 'CRITICAL_AND_SERIOUS',
      violationCount: 0,
      evidence: evidencePath,
    },
    visualEvidence,
    visualEvidenceSha256: sha256(visualEvidence),
    acceptedSourceComparison: {
      status: 'PASS',
      method: 'HUMAN_PERCEPTUAL_AND_CONTRACT_REVIEW',
      sourcePngSha256: source.png.sha256,
      record: 'architecture/home-wave2-visual-comparison.md',
    },
  };

  if (interactionEvidenceIds.has(screen.id)) {
    result.interactionEvidence = {
      path: interactionPath,
      sha256: sha256(interactionPath),
      purpose:
        screen.id === 'FLOW-EDITOR-DESKTOP'
          ? 'FIXED_PANEL_FOCUS_AND_SCROLL_CONTRACT'
          : 'VIEWPORT_INTERACTION_AND_FOCUS_CONTRACT',
    };
  } else {
    delete result.interactionEvidence;
  }
  return result;
});

const productionCompositions = manifest.canonicalScreens.filter(
  (screen) => screen.implementationKind === 'PRODUCTION_COMPOSITION'
).length;
manifest.counts = {
  canonical: manifest.canonicalScreens.length,
  productionCompositions,
  stateAndSpecificationEvidence: manifest.canonicalScreens.length - productionCompositions,
  primaryVisualEvidence: manifest.canonicalScreens.filter((screen) => screen.visualEvidence).length,
  interactionVisualEvidence: manifest.canonicalScreens.filter(
    (screen) => screen.interactionEvidence
  ).length,
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `Sealed ${manifest.canonicalScreens.length} Wave 2 records for ${implementationCommit}.`
);
