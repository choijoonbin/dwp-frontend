#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), '..');

const DEFAULT_REGISTRY = 'architecture/home-wave2-design-source-registry.v1.json';
const DEFAULT_EVIDENCE = 'architecture/home-wave2-evidence.v1.json';
const DEFAULT_SOURCE_PACKAGE = 'dwp-home-implementation-readiness-2026-09-15';

const round = (value) => Number(value.toFixed(6));

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

export function readPngDimensions(path) {
  const header = readFileSync(path).subarray(0, 24);
  const pngSignature = '89504e470d0a1a0a';

  if (
    header.length < 24 ||
    header.subarray(0, 8).toString('hex') !== pngSignature ||
    header.subarray(12, 16).toString('ascii') !== 'IHDR'
  ) {
    throw new Error(`Expected a PNG with an IHDR header: ${path}`);
  }

  const width = header.readUInt32BE(16);
  const height = header.readUInt32BE(20);
  if (width < 1 || height < 1) {
    throw new Error(`PNG dimensions must be positive: ${path}`);
  }

  return { width, height };
}

function normalizePath(root, path) {
  return isAbsolute(path) ? path : resolve(root, path);
}

function stablePath(root, path) {
  const candidate = relative(root, path);
  return candidate.startsWith('..') ? path : candidate;
}

function findDefaultSourceRoot(root) {
  const candidates = [
    resolve(root, '../../../output', DEFAULT_SOURCE_PACKAGE),
    resolve(root, '../output', DEFAULT_SOURCE_PACKAGE),
    resolve(root, 'output', DEFAULT_SOURCE_PACKAGE),
  ];
  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) {
    throw new Error(
      `Could not locate ${DEFAULT_SOURCE_PACKAGE}. Pass --source-root=<accepted-package-root>.`
    );
  }
  return match;
}

function parseArguments(argumentsList, root) {
  const values = new Map();
  for (const argument of argumentsList) {
    if (!argument.startsWith('--') || !argument.includes('=')) {
      throw new Error(`Unsupported argument: ${argument}`);
    }
    const [name, ...rest] = argument.slice(2).split('=');
    values.set(name, rest.join('='));
  }

  const allowed = new Set(['registry', 'evidence', 'source-root', 'implementation-root', 'write']);
  for (const name of values.keys()) {
    if (!allowed.has(name)) throw new Error(`Unsupported option: --${name}`);
  }

  return {
    registryPath: normalizePath(root, values.get('registry') ?? DEFAULT_REGISTRY),
    evidencePath: normalizePath(root, values.get('evidence') ?? DEFAULT_EVIDENCE),
    sourceRoot: values.has('source-root')
      ? normalizePath(root, values.get('source-root'))
      : findDefaultSourceRoot(root),
    implementationRoot: values.has('implementation-root')
      ? normalizePath(root, values.get('implementation-root'))
      : root,
    outputPath: values.has('write') ? normalizePath(root, values.get('write')) : undefined,
  };
}

export function calculateImageNormalization(dimensions, viewport) {
  const widthAnchorScale = viewport.width / dimensions.width;
  const normalizedFullHeight = dimensions.height * widthAnchorScale;
  const firstViewportCropHeight = Math.min(dimensions.height, viewport.height / widthAnchorScale);
  const containScale = Math.min(
    viewport.width / dimensions.width,
    viewport.height / dimensions.height
  );
  const containWidth = dimensions.width * containScale;
  const containHeight = dimensions.height * containScale;
  const coverScale = Math.max(
    viewport.width / dimensions.width,
    viewport.height / dimensions.height
  );
  const coverWidth = dimensions.width * coverScale;
  const coverHeight = dimensions.height * coverScale;

  return {
    widthAnchored: {
      scale: round(widthAnchorScale),
      widthCss: viewport.width,
      heightCss: round(normalizedFullHeight),
    },
    firstViewportTopCrop: {
      sourcePixels: {
        x: 0,
        y: 0,
        width: dimensions.width,
        height: round(firstViewportCropHeight),
      },
      normalizedCss: {
        x: 0,
        y: 0,
        width: viewport.width,
        height: round(Math.min(viewport.height, normalizedFullHeight)),
      },
      verticalCoverage: round(Math.min(1, normalizedFullHeight / viewport.height)),
    },
    containOverview: {
      scale: round(containScale),
      renderedCss: {
        x: round((viewport.width - containWidth) / 2),
        y: round((viewport.height - containHeight) / 2),
        width: round(containWidth),
        height: round(containHeight),
      },
      letterboxCss: {
        horizontal: round(viewport.width - containWidth),
        vertical: round(viewport.height - containHeight),
      },
    },
    coverTopCrop: {
      scale: round(coverScale),
      renderedCss: {
        x: round((viewport.width - coverWidth) / 2),
        y: 0,
        width: round(coverWidth),
        height: round(coverHeight),
      },
      croppedCss: {
        horizontal: round(Math.max(0, coverWidth - viewport.width)),
        verticalBelowViewport: round(Math.max(0, coverHeight - viewport.height)),
      },
    },
  };
}

export function calculatePairNormalization(sourceDimensions, implementationDimensions, viewport) {
  const source = calculateImageNormalization(sourceDimensions, viewport);
  const implementation = calculateImageNormalization(implementationDimensions, viewport);
  const sourceHeight = source.widthAnchored.heightCss;
  const implementationHeight = implementation.widthAnchored.heightCss;

  return {
    source,
    implementation,
    fullDocumentAlignment: {
      anchor: 'TOP_LEFT_AFTER_INDEPENDENT_WIDTH_NORMALIZATION',
      overlapHeightCss: round(Math.min(sourceHeight, implementationHeight)),
      sourceOnlyTailCss: round(Math.max(0, sourceHeight - implementationHeight)),
      implementationOnlyTailCss: round(Math.max(0, implementationHeight - sourceHeight)),
      implementationToSourceHeightRatio: round(implementationHeight / sourceHeight),
    },
  };
}

export function buildReferenceNormalizationReport({
  registry,
  evidence,
  registryPath,
  evidencePath,
  sourceRoot,
  implementationRoot,
  reportRoot = repositoryRoot,
}) {
  const registryHash = sha256(registryPath);
  if (evidence.sourceRegistrySha256 && evidence.sourceRegistrySha256 !== registryHash) {
    throw new Error('Evidence sourceRegistrySha256 differs from the registry being normalized.');
  }

  const evidenceById = new Map(evidence.canonicalScreens.map((screen) => [screen.id, screen]));
  const registryIds = registry.screens.map((screen) => screen.id);
  const evidenceIds = evidence.canonicalScreens.map((screen) => screen.id);
  const duplicateRegistryIds = registryIds.filter((id, index) => registryIds.indexOf(id) !== index);
  const duplicateEvidenceIds = evidenceIds.filter((id, index) => evidenceIds.indexOf(id) !== index);
  const missingEvidenceIds = registryIds.filter((id) => !evidenceById.has(id));
  const extraEvidenceIds = evidenceIds.filter((id) => !registryIds.includes(id));

  if (
    duplicateRegistryIds.length > 0 ||
    duplicateEvidenceIds.length > 0 ||
    missingEvidenceIds.length > 0 ||
    extraEvidenceIds.length > 0
  ) {
    throw new Error(
      `Registry/evidence ID mismatch: ${JSON.stringify({
        duplicateRegistryIds,
        duplicateEvidenceIds,
        missingEvidenceIds,
        extraEvidenceIds,
      })}`
    );
  }

  const pairs = registry.screens.map((sourceRecord) => {
    const implementationRecord = evidenceById.get(sourceRecord.id);
    if (!implementationRecord?.visualEvidence) {
      throw new Error(`Evidence ${sourceRecord.id} has no primary visualEvidence path.`);
    }
    if (!implementationRecord.viewport?.width || !implementationRecord.viewport?.height) {
      throw new Error(`Evidence ${sourceRecord.id} has no positive CSS viewport.`);
    }

    const sourcePath = normalizePath(sourceRoot, sourceRecord.png.path);
    const implementationPath = normalizePath(
      implementationRoot,
      implementationRecord.visualEvidence
    );
    if (!existsSync(sourcePath)) throw new Error(`Missing accepted source PNG: ${sourcePath}`);
    if (!existsSync(implementationPath)) {
      throw new Error(`Missing implementation evidence PNG: ${implementationPath}`);
    }

    const sourceDimensions = readPngDimensions(sourcePath);
    const implementationDimensions = readPngDimensions(implementationPath);
    const sourceHash = sha256(sourcePath);
    const implementationHash = sha256(implementationPath);

    if (
      sourceDimensions.width !== sourceRecord.png.width ||
      sourceDimensions.height !== sourceRecord.png.height
    ) {
      throw new Error(
        `${sourceRecord.id} source dimensions differ from the accepted registry: ` +
          `${sourceDimensions.width}x${sourceDimensions.height} != ` +
          `${sourceRecord.png.width}x${sourceRecord.png.height}`
      );
    }
    if (sourceHash !== sourceRecord.png.sha256) {
      throw new Error(`${sourceRecord.id} source SHA-256 differs from the accepted registry.`);
    }
    if (
      implementationRecord.sourcePngSha256 &&
      implementationRecord.sourcePngSha256 !== sourceHash
    ) {
      throw new Error(
        `${sourceRecord.id} accepted-source hash differs between registry and evidence.`
      );
    }
    if (implementationRecord.visualEvidenceSha256 !== implementationHash) {
      throw new Error(
        `${sourceRecord.id} implementation SHA-256 differs from the evidence record.`
      );
    }

    const viewport = {
      width: implementationRecord.viewport.width,
      height: implementationRecord.viewport.height,
    };

    return {
      id: sourceRecord.id,
      family: sourceRecord.family,
      role: sourceRecord.role,
      device: sourceRecord.device,
      viewportCss: {
        ...viewport,
        ...(implementationRecord.viewport.browserZoomPercent
          ? { browserZoomPercent: implementationRecord.viewport.browserZoomPercent }
          : {}),
        ...(implementationRecord.viewport.textScalePercent
          ? { textScalePercent: implementationRecord.viewport.textScalePercent }
          : {}),
      },
      acceptedSource: {
        path: stablePath(sourceRoot, sourcePath),
        sha256: sourceHash,
        dimensionsPx: sourceDimensions,
      },
      implementationEvidence: {
        path: stablePath(implementationRoot, implementationPath),
        sha256: implementationHash,
        dimensionsPx: implementationDimensions,
      },
      normalization: calculatePairNormalization(
        sourceDimensions,
        implementationDimensions,
        viewport
      ),
      reviewStatus: 'PENDING_PAIRWISE_PERCEPTUAL_REVIEW',
    };
  });

  return {
    schemaVersion: 1,
    purpose: 'HOME_WAVE2_ACCEPTED_SOURCE_PAIRWISE_NORMALIZATION',
    decisionPolicy: 'GEOMETRY_ONLY_NO_AUTOMATIC_VISUAL_PASS',
    inputs: {
      registry: stablePath(reportRoot, registryPath),
      registrySha256: registryHash,
      evidence: stablePath(reportRoot, evidencePath),
      evidenceSha256: sha256(evidencePath),
      acceptedSourcesReadOnly: true,
    },
    method: {
      canonicalCoordinateSystem: 'EVIDENCE_CSS_VIEWPORT',
      widthAnchor: 'INDEPENDENTLY_SCALE_EACH_IMAGE_TO_VIEWPORT_CSS_WIDTH',
      verticalAnchor: 'TOP',
      firstViewport: 'TOP_CROP_AFTER_WIDTH_NORMALIZATION',
      contain: 'OVERVIEW_ONLY_IGNORE_LETTERBOX',
      cover: 'NAMED_REGION_ONLY_NEVER_WHOLE_PAGE_ACCEPTANCE',
    },
    counts: {
      registry: registry.screens.length,
      evidence: evidence.canonicalScreens.length,
      paired: pairs.length,
    },
    pairs,
  };
}

export function runReferenceNormalization(
  argumentsList = process.argv.slice(2),
  root = repositoryRoot
) {
  const options = parseArguments(argumentsList, root);
  const report = buildReferenceNormalizationReport({
    registry: readJson(options.registryPath),
    evidence: readJson(options.evidencePath),
    registryPath: options.registryPath,
    evidencePath: options.evidencePath,
    sourceRoot: options.sourceRoot,
    implementationRoot: options.implementationRoot,
    reportRoot: root,
  });
  const serialized = `${JSON.stringify(report, null, 2)}\n`;

  if (options.outputPath) {
    writeFileSync(options.outputPath, serialized);
    return { report, outputPath: options.outputPath };
  }

  process.stdout.write(serialized);
  return { report };
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  try {
    const result = runReferenceNormalization();
    if (result.outputPath) {
      process.stdout.write(
        `Wrote ${result.report.counts.paired} normalized pairs to ${result.outputPath}.\n`
      );
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
