#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), '..');
const DECISIONS = new Set(['PENDING', 'PASS', 'FAIL']);

export const HOME_WAVE2_REVIEW_TOLERANCES = Object.freeze({
  desktop: {
    maxVerticalLandmarkDriftCss: 24,
    maxHorizontalLandmarkDriftCss: 24,
  },
  mobile: {
    maxVerticalLandmarkDriftCss: 16,
    maxHorizontalLandmarkDriftCss: 16,
  },
  maxHorizontalOverflowCss: 0,
  maxUnexplainedDocumentHeightDeltaRatio: 0.1,
  maxSectionOrderChanges: 0,
  maxMissingRequiredLandmarks: 0,
});

const ADAPTATIONS = Object.freeze({
  'design-system-primitives': {
    category: 'DESIGN_SYSTEM_PRIMITIVE_SUBSTITUTION',
    scope:
      'Use maintained DWP and MUI primitives while preserving reference hierarchy, geometry, emphasis and control meaning.',
    rationale: 'Production code must use supported components instead of reference HTML internals.',
  },
  'runtime-data-values': {
    category: 'RUNTIME_DATA_VALUE_VARIATION',
    scope:
      'Live names, dates and counts may vary while locale, semantic state, line budget and information density remain equivalent.',
    rationale:
      'Reference fixtures establish content intent rather than immutable enterprise records.',
  },
  'approved-local-media': {
    category: 'LOCAL_APPROVED_MEDIA_SUBSTITUTION',
    scope:
      'Use an approved local image with equivalent subject, crop, contrast and visual footprint when a reference asset is remote.',
    rationale: 'Production evidence cannot depend on the reference export network hosts.',
  },
  'accessibility-semantics': {
    category: 'ACCESSIBILITY_ENHANCEMENT',
    scope:
      'Add focus, labels, live-region semantics and target sizing without moving or hiding required visual landmarks.',
    rationale: 'Runtime accessibility contracts are stronger than the visual reference markup.',
  },
  'dynamic-content-length': {
    category: 'DYNAMIC_CONTENT_LENGTH',
    scope:
      'Document length may reflect bounded live item counts while section order, first-viewport priority and all required landmarks remain.',
    rationale: 'Full-page height can change with governed runtime content budgets.',
  },
  'reference-export-boundary': {
    category: 'REFERENCE_EXPORT_BOUNDARY',
    scope:
      'Explain only canvas padding or truncation proven to come from the accepted export; it cannot excuse a missing product section.',
    rationale:
      'Accepted PNG height and pixel scale do not consistently equal a browser full-page capture.',
  },
  'permission-guard': {
    category: 'SECURITY_PERMISSION_GUARD',
    scope:
      'Keep unauthorized data absent while preserving the reference denial placement, unaffected regions and recovery guidance.',
    rationale: 'Production authorization must remain fail closed.',
  },
});

const CLASSIC_FIRST = [
  'SHELL_NAVIGATION',
  'OPERATIONAL_NOTICE',
  'FEATURED_COMMUNICATION',
  'PRIMARY_ACTION',
  'APP_GRID_ENTRY',
];
const CLASSIC_FULL = [
  'SECTION_ORDER',
  'APP_GROUP_ORDER',
  'SUPPORT_AND_PERSONAL_REGIONS',
  'SINGLE_DOCUMENT_FLOW',
];
const STATE_FIRST = [
  'SHELL_NAVIGATION',
  'TARGET_STATE_REGION',
  'UNAFFECTED_CONTENT',
  'STATE_PROVENANCE',
  'RECOVERY_OR_NEXT_ACTION',
];
const STATE_FULL = [
  'STATE_CONTAINMENT',
  'SECTION_ORDER',
  'PRESERVED_CONTENT',
  'SINGLE_DOCUMENT_FLOW',
];
const FLOW_FIRST = [
  'COLLAPSED_RAIL_OR_MOBILE_SHELL',
  'PRIORITY_HERO',
  'PRIMARY_ACTION',
  'APP_GRID_ENTRY',
];
const FLOW_FULL = [
  'EXECUTION_SECTION_ORDER',
  'APP_GROUP_ORDER',
  'THREE_COLUMN_OR_SINGLE_COLUMN_LAYOUT',
  'SINGLE_DOCUMENT_FLOW',
];

function landmarkProfile(pair) {
  let firstViewport;
  let fullDocument;
  if (pair.role === 'MODE_PRESET') {
    firstViewport = [
      'MODE_CHOOSER',
      'CURRENT_AND_SELECTED_STATE',
      'LOCKED_SHARED_APPS',
      'DIRTY_AND_APPLY_STATE',
    ];
    fullDocument = [
      'CLASSIC_FLOW_SIDE_BY_SIDE',
      'MODE_INDEPENDENCE',
      'APPLY_RESULT',
      'KEYBOARD_ORDER',
    ];
  } else if (pair.role === 'ACCESSIBILITY_SPEC') {
    firstViewport = ['SKIP_LINK', 'FOCUS_ORDER', 'VISIBLE_FOCUS', 'REDUCED_MOTION_SCOPE'];
    fullDocument = [
      'SHELL_MAIN_DIALOG_COVERAGE',
      'KEYBOARD_REACHABILITY',
      'TOUCH_TARGET_COVERAGE',
      'FORCED_COLORS_SEMANTICS',
    ];
  } else if (pair.role === 'STATE_SPEC') {
    firstViewport = ['STATE_VARIANT_OVERVIEW', 'SEMANTIC_STATUS', 'PROVENANCE', 'RECOVERY_ACTION'];
    fullDocument = [
      'ALL_REQUIRED_VARIANTS',
      'PRESERVE_VERSUS_BLOCK_RULES',
      'TRANSITION_RULES',
      'LOCALIZED_COPY',
    ];
  } else if (pair.role === 'EDITOR_DIRTY') {
    firstViewport = [
      'SHELL_NAVIGATION',
      'EDITOR_DIRTY_INDICATOR',
      'EDITED_CONTENT',
      'SAVE_CANCEL_CONTROLS',
    ];
    fullDocument = [
      'DRAFT_PRESERVATION',
      'EDITOR_SECTION_ORDER',
      'CONTROL_REACHABILITY',
      'MOBILE_NAV_CLEARANCE',
    ];
  } else if (pair.role === 'SAVE_CONFLICT') {
    firstViewport = [
      'UNDERLYING_COMPOSITION',
      'CONFLICT_DIALOG',
      'FOCUS_CONTEXT',
      'RESOLUTION_ACTIONS',
    ];
    fullDocument = [
      'DRAFT_PRESERVATION',
      'BACKGROUND_INERTNESS',
      'DIALOG_VIEWPORT_FIT',
      'RETURN_FOCUS_PATH',
    ];
  } else if (pair.family === 'FLOW' && pair.role === 'EDITOR') {
    firstViewport = ['STUDIO_SHELL', 'CATALOG_PANEL', 'CANVAS_PREVIEW', 'INSPECTOR_PANEL'];
    fullDocument = [
      'TWELVE_WIDGET_CATALOG',
      'LAYOUT_CONTRACT',
      'SAVE_RESET_RESTORE_CONTROLS',
      'BOUNDED_STUDIO_SCROLL',
    ];
  } else if (pair.family === 'FLOW' && pair.role === 'PERSONALIZED') {
    firstViewport = [
      'COLLAPSED_RAIL_OR_MOBILE_SHELL',
      'PRIORITY_HERO',
      'PERSONALIZED_WIDGET_ENTRY',
      'LOADED_SUCCESS_OR_EXPLICIT_STATE',
    ];
    fullDocument = [
      'PERSONALIZED_WIDGET_ORDER',
      'PROVIDER_STATE_SEMANTICS',
      'APP_GROUP_ORDER',
      'SINGLE_DOCUMENT_FLOW',
    ];
  } else if (pair.family === 'FLOW') {
    firstViewport = FLOW_FIRST;
    fullDocument = FLOW_FULL;
  } else if (
    ['EMPTY', 'PARTIAL', 'FORBIDDEN', 'STALE', 'BACKGROUND_REFRESH', 'INITIAL_LOADING'].includes(
      pair.role
    )
  ) {
    firstViewport = STATE_FIRST;
    fullDocument = STATE_FULL;
  } else {
    firstViewport = CLASSIC_FIRST;
    fullDocument = CLASSIC_FULL;
  }

  if (pair.device === 'MOBILE' && !fullDocument.includes('MOBILE_NAV_CLEARANCE')) {
    fullDocument = [...fullDocument, 'MOBILE_NAV_CLEARANCE'];
  }
  return { firstViewport: [...firstViewport], fullDocument: [...fullDocument] };
}

function adaptationIdsFor(pair) {
  const ids = ['design-system-primitives', 'runtime-data-values', 'accessibility-semantics'];
  if (pair.role === 'BASE' || pair.family === 'FLOW') ids.push('approved-local-media');
  if (!['ACCESSIBILITY_SPEC', 'STATE_SPEC', 'MODE_PRESET'].includes(pair.role)) {
    ids.push('dynamic-content-length');
  }
  ids.push('reference-export-boundary');
  if (pair.role === 'FORBIDDEN') ids.push('permission-guard');
  return ids;
}

const pendingLandmark = (id) => ({ id, decision: 'PENDING', finding: null });

export function createPendingReferenceReview(normalization) {
  return {
    schemaVersion: 1,
    schema: 'architecture/home-wave2-reference-review.schema.json',
    purpose: 'HOME_WAVE2_PER_CANONICAL_REFERENCE_REVIEW',
    status: 'DRAFT_PENDING_REVIEW',
    decisionPolicy: 'EVERY_LANDMARK_AND_AXIS_REQUIRES_EXPLICIT_PASS_OR_FAIL',
    tolerances: HOME_WAVE2_REVIEW_TOLERANCES,
    adaptationDefinitions: ADAPTATIONS,
    records: normalization.pairs.map((pair) => {
      const profile = landmarkProfile(pair);
      return {
        id: pair.id,
        reviewedArtifacts: {
          sourcePngSha256: null,
          implementationEvidenceSha256: null,
        },
        reviewer: { name: null, reviewedAt: null },
        allowedAdaptationIds: adaptationIdsFor(pair),
        appliedAdaptationIds: [],
        firstViewport: {
          decision: 'PENDING',
          finding: null,
          measurements: {
            maxVerticalLandmarkDriftCss: null,
            maxHorizontalLandmarkDriftCss: null,
            horizontalOverflowCss: null,
          },
          landmarks: profile.firstViewport.map(pendingLandmark),
        },
        fullDocument: {
          decision: 'PENDING',
          finding: null,
          measurements: {
            unexplainedHeightDeltaRatio: null,
            sectionOrderChanges: null,
            missingRequiredLandmarks: null,
            heightDeltaAdaptationId: null,
          },
          landmarks: profile.fullDocument.map(pendingLandmark),
        },
        overallDecision: 'PENDING',
        overallFinding: null,
      };
    }),
  };
}

function requireFinding(value, context, minimum = 12) {
  if (typeof value !== 'string' || value.trim().length < minimum) {
    throw new Error(`${context} requires a concrete finding of at least ${minimum} characters.`);
  }
}

function requireNumber(value, context) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${context} requires a non-negative numeric measurement.`);
  }
}

function validateDecision(value, context) {
  if (!DECISIONS.has(value)) throw new Error(`${context} has invalid decision ${String(value)}.`);
}

function derivedDecision(decisions) {
  if (decisions.some((decision) => decision === 'PENDING')) return 'PENDING';
  return decisions.some((decision) => decision === 'FAIL') ? 'FAIL' : 'PASS';
}

function validateLandmarks(actual, expected, context) {
  if (!Array.isArray(actual) || actual.map(({ id }) => id).join('|') !== expected.join('|')) {
    throw new Error(`${context} landmark IDs or order differ from the canonical review profile.`);
  }
  for (const landmark of actual) {
    validateDecision(landmark.decision, `${context}.${landmark.id}`);
    if (landmark.decision !== 'PENDING') {
      requireFinding(landmark.finding, `${context}.${landmark.id}`);
    }
  }
}

export function validateReferenceReview(normalization, review, { requireReviewed = false } = {}) {
  if (
    review.schemaVersion !== 1 ||
    review.schema !== 'architecture/home-wave2-reference-review.schema.json' ||
    review.purpose !== 'HOME_WAVE2_PER_CANONICAL_REFERENCE_REVIEW' ||
    review.decisionPolicy !== 'EVERY_LANDMARK_AND_AXIS_REQUIRES_EXPLICIT_PASS_OR_FAIL' ||
    !Array.isArray(review.records)
  ) {
    throw new Error('Reference review must have schemaVersion 1 and a records array.');
  }
  if (JSON.stringify(review.tolerances) !== JSON.stringify(HOME_WAVE2_REVIEW_TOLERANCES)) {
    throw new Error('Reference review changes the governed tolerance policy.');
  }
  if (JSON.stringify(review.adaptationDefinitions) !== JSON.stringify(ADAPTATIONS)) {
    throw new Error('Reference review changes the governed adaptation definitions.');
  }
  const reviewById = new Map(review.records.map((record) => [record.id, record]));
  if (reviewById.size !== review.records.length)
    throw new Error('Reference review has duplicate IDs.');
  const pairIds = normalization.pairs.map((pair) => pair.id);
  const reviewIds = review.records.map((record) => record.id);
  const missing = pairIds.filter((id) => !reviewById.has(id));
  const extra = reviewIds.filter((id) => !pairIds.includes(id));
  if (missing.length || extra.length) {
    throw new Error(`Normalization/review ID mismatch: ${JSON.stringify({ missing, extra })}`);
  }

  let pass = 0;
  let fail = 0;
  let pending = 0;
  for (const pair of normalization.pairs) {
    const record = reviewById.get(pair.id);
    const profile = landmarkProfile(pair);
    const allowedIds = new Set();
    if (!Array.isArray(record.allowedAdaptationIds)) {
      throw new Error(`${pair.id}.allowedAdaptationIds must be an array.`);
    }
    for (const adaptationId of record.allowedAdaptationIds) {
      if (!ADAPTATIONS[adaptationId] || allowedIds.has(adaptationId)) {
        throw new Error(`${pair.id} has an unknown or duplicate allowed adaptation.`);
      }
      allowedIds.add(adaptationId);
    }
    if (record.allowedAdaptationIds.join('|') !== adaptationIdsFor(pair).join('|')) {
      throw new Error(`${pair.id} changes its canonical allowed-adaptation profile.`);
    }
    if (
      !Array.isArray(record.appliedAdaptationIds) ||
      new Set(record.appliedAdaptationIds).size !== record.appliedAdaptationIds.length ||
      record.appliedAdaptationIds.some((id) => !allowedIds.has(id))
    ) {
      throw new Error(`${pair.id} applies an adaptation that is not explicitly allowed.`);
    }

    validateLandmarks(
      record.firstViewport?.landmarks,
      profile.firstViewport,
      `${pair.id}.firstViewport`
    );
    validateLandmarks(
      record.fullDocument?.landmarks,
      profile.fullDocument,
      `${pair.id}.fullDocument`
    );
    validateDecision(record.firstViewport.decision, `${pair.id}.firstViewport`);
    validateDecision(record.fullDocument.decision, `${pair.id}.fullDocument`);
    validateDecision(record.overallDecision, `${pair.id}.overallDecision`);
    const expectedFirst = derivedDecision(
      record.firstViewport.landmarks.map(({ decision }) => decision)
    );
    const expectedFull = derivedDecision(
      record.fullDocument.landmarks.map(({ decision }) => decision)
    );
    const expectedOverall = derivedDecision([expectedFirst, expectedFull]);
    if (
      record.firstViewport.decision !== expectedFirst ||
      record.fullDocument.decision !== expectedFull ||
      record.overallDecision !== expectedOverall
    ) {
      throw new Error(`${pair.id} axis or overall decision does not match its landmark decisions.`);
    }

    if (record.overallDecision === 'PENDING') {
      if (
        (record.reviewedArtifacts?.sourcePngSha256 &&
          record.reviewedArtifacts.sourcePngSha256 !== pair.acceptedSource.sha256) ||
        (record.reviewedArtifacts?.implementationEvidenceSha256 &&
          record.reviewedArtifacts.implementationEvidenceSha256 !==
            pair.implementationEvidence.sha256)
      ) {
        throw new Error(`${pair.id} pending review contains a stale artifact hash binding.`);
      }
      pending += 1;
      continue;
    }
    if (
      record.firstViewport.landmarks.some(({ decision }) => decision === 'PENDING') ||
      record.fullDocument.landmarks.some(({ decision }) => decision === 'PENDING')
    ) {
      throw new Error(`${pair.id} cannot be final while a landmark remains pending.`);
    }
    requireFinding(record.firstViewport.finding, `${pair.id}.firstViewport`, 20);
    requireFinding(record.fullDocument.finding, `${pair.id}.fullDocument`, 20);
    requireFinding(record.overallFinding, `${pair.id}.overallFinding`, 20);
    requireFinding(record.reviewer?.name, `${pair.id}.reviewer.name`, 2);
    if (
      typeof record.reviewer?.reviewedAt !== 'string' ||
      Number.isNaN(Date.parse(record.reviewer.reviewedAt))
    ) {
      throw new Error(`${pair.id}.reviewer.reviewedAt requires an ISO-compatible date.`);
    }
    if (
      record.reviewedArtifacts?.sourcePngSha256 !== pair.acceptedSource.sha256 ||
      record.reviewedArtifacts?.implementationEvidenceSha256 !== pair.implementationEvidence.sha256
    ) {
      throw new Error(`${pair.id} final review is not bound to the compared image hashes.`);
    }

    if (record.overallDecision === 'PASS') {
      const deviceTolerance =
        pair.device === 'MOBILE'
          ? HOME_WAVE2_REVIEW_TOLERANCES.mobile
          : HOME_WAVE2_REVIEW_TOLERANCES.desktop;
      const first = record.firstViewport.measurements;
      requireNumber(first.maxVerticalLandmarkDriftCss, `${pair.id}.maxVerticalLandmarkDriftCss`);
      requireNumber(
        first.maxHorizontalLandmarkDriftCss,
        `${pair.id}.maxHorizontalLandmarkDriftCss`
      );
      requireNumber(first.horizontalOverflowCss, `${pair.id}.horizontalOverflowCss`);
      if (
        first.maxVerticalLandmarkDriftCss > deviceTolerance.maxVerticalLandmarkDriftCss ||
        first.maxHorizontalLandmarkDriftCss > deviceTolerance.maxHorizontalLandmarkDriftCss ||
        first.horizontalOverflowCss > HOME_WAVE2_REVIEW_TOLERANCES.maxHorizontalOverflowCss
      ) {
        throw new Error(`${pair.id} cannot PASS outside first-viewport tolerance.`);
      }
      const full = record.fullDocument.measurements;
      requireNumber(full.unexplainedHeightDeltaRatio, `${pair.id}.unexplainedHeightDeltaRatio`);
      requireNumber(full.sectionOrderChanges, `${pair.id}.sectionOrderChanges`);
      requireNumber(full.missingRequiredLandmarks, `${pair.id}.missingRequiredLandmarks`);
      if (
        full.unexplainedHeightDeltaRatio >
          HOME_WAVE2_REVIEW_TOLERANCES.maxUnexplainedDocumentHeightDeltaRatio ||
        full.sectionOrderChanges > HOME_WAVE2_REVIEW_TOLERANCES.maxSectionOrderChanges ||
        full.missingRequiredLandmarks > HOME_WAVE2_REVIEW_TOLERANCES.maxMissingRequiredLandmarks
      ) {
        throw new Error(`${pair.id} cannot PASS outside full-document tolerance.`);
      }
      const rawHeightDelta = Math.abs(
        pair.normalization.fullDocumentAlignment.implementationToSourceHeightRatio - 1
      );
      if (
        rawHeightDelta > HOME_WAVE2_REVIEW_TOLERANCES.maxUnexplainedDocumentHeightDeltaRatio &&
        (!full.heightDeltaAdaptationId ||
          !record.appliedAdaptationIds.includes(full.heightDeltaAdaptationId))
      ) {
        throw new Error(
          `${pair.id} must explicitly apply an allowed adaptation for its document-height delta.`
        );
      }
    }

    if (record.overallDecision === 'PASS') pass += 1;
    else fail += 1;
  }

  if (requireReviewed && pending > 0) {
    throw new Error(
      `Strict review requires PASS or FAIL for every canonical ID; ${pending} remain pending.`
    );
  }
  const expectedStatus = pending > 0 ? 'DRAFT_PENDING_REVIEW' : 'REVIEW_COMPLETE';
  if (review.status !== expectedStatus) {
    throw new Error(`Reference review status must be ${expectedStatus}.`);
  }
  return { pass, fail, pending, total: normalization.pairs.length };
}

export function buildReviewedReferenceReport(normalization, review, options = {}) {
  const decisions = validateReferenceReview(normalization, review, options);
  const manifestBound = normalization.counts.unsealedImplementation === 0;
  const reviewDecision = decisions.pending > 0 ? 'PENDING' : decisions.fail > 0 ? 'FAIL' : 'PASS';
  const sealEligible = reviewDecision === 'PASS' && manifestBound;
  return {
    schemaVersion: 1,
    reviewSchema: review.schema,
    purpose: 'HOME_WAVE2_ACCEPTED_SOURCE_PAIRWISE_REVIEW',
    status: sealEligible
      ? 'REVIEW_PASS_SEALED_INPUTS'
      : reviewDecision === 'PASS'
        ? 'REVIEW_PASS_UNSEALED_INPUTS'
        : reviewDecision === 'FAIL'
          ? 'REVIEW_FAIL'
          : 'PENDING_REVIEW',
    reviewDecision,
    sealEligible,
    tolerances: HOME_WAVE2_REVIEW_TOLERANCES,
    adaptationDefinitions: review.adaptationDefinitions,
    normalizationInputs: normalization.inputs,
    normalizationMethod: normalization.method,
    counts: { ...normalization.counts, decisions },
    pairs: normalization.pairs.map((pair) => ({
      ...pair,
      review: review.records.find((record) => record.id === pair.id),
    })),
  };
}

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

function imageHref(root, path) {
  return pathToFileURL(isAbsolute(path) ? path : resolve(root, path)).href;
}

export function buildReferenceContactSheet(report, { sourceRoot, implementationRoot }) {
  const sections = report.pairs
    .map((pair) => {
      const source = imageHref(sourceRoot, pair.acceptedSource.path);
      const implementation = imageHref(implementationRoot, pair.implementationEvidence.path);
      const viewport = `${pair.viewportCss.width} × ${pair.viewportCss.height} CSS px`;
      const decision = pair.review.overallDecision;
      const adaptations = pair.review.allowedAdaptationIds.join(', ');
      return `<section id="${escapeHtml(pair.id)}">
  <header><h2>${escapeHtml(pair.id)}</h2><strong data-decision="${decision}">${decision}</strong></header>
  <p>${escapeHtml(pair.family)} · ${escapeHtml(pair.role)} · ${escapeHtml(pair.device)} · ${viewport}</p>
  <p>Source ${pair.acceptedSource.dimensionsPx.width}×${pair.acceptedSource.dimensionsPx.height}; implementation ${pair.implementationEvidence.dimensionsPx.width}×${pair.implementationEvidence.dimensionsPx.height}; height ratio ${pair.normalization.fullDocumentAlignment.implementationToSourceHeightRatio}</p>
  <div class="comparison first" style="--aspect:${pair.viewportCss.width}/${pair.viewportCss.height}">
    <figure><figcaption>Accepted · first viewport</figcaption><div class="crop"><img src="${source}" alt=""></div></figure>
    <figure><figcaption>Implementation · first viewport</figcaption><div class="crop"><img src="${implementation}" alt=""></div></figure>
  </div>
  <div class="comparison full">
    <figure><figcaption>Accepted · full document</figcaption><img src="${source}" alt=""></figure>
    <figure><figcaption>Implementation · full document</figcaption><img src="${implementation}" alt=""></figure>
  </div>
  <details><summary>Allowed adaptations</summary><p>${escapeHtml(adaptations)}</p></details>
</section>`;
    })
    .join('\n');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Home Wave 2 normalized review</title>
<style>body{margin:0;background:#eef2f7;color:#172033;font:14px system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:24px}section{margin:0 0 32px;padding:20px;background:white;border:1px solid #cbd5e1;border-radius:12px}header{display:flex;align-items:center;justify-content:space-between;gap:16px}h1,h2{margin:0 0 8px}[data-decision=PENDING]{color:#92400e}[data-decision=PASS]{color:#166534}[data-decision=FAIL]{color:#b91c1c}.comparison{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}.comparison figure{min-width:0;margin:0;border:1px solid #94a3b8;background:#f8fafc}.comparison figcaption{padding:8px;font-weight:700}.comparison img{display:block;width:100%;height:auto}.crop{aspect-ratio:var(--aspect);overflow:hidden;background:#dbe3ed}.crop img{width:100%;height:auto}details{margin-top:12px}@media(max-width:800px){.comparison{grid-template-columns:1fr}}</style>
<main><h1>Home Wave 2 normalized pairwise review</h1><p>Status: ${escapeHtml(report.status)}. This sheet does not change either input image.</p>${sections}</main></html>\n`;
}

function parseArguments(argumentsList) {
  const values = new Map();
  for (const argument of argumentsList) {
    if (!argument.startsWith('--') || !argument.includes('='))
      throw new Error(`Unsupported argument: ${argument}`);
    const [key, ...rest] = argument.slice(2).split('=');
    values.set(key, rest.join('='));
  }
  const allowed = new Set([
    'normalization',
    'review',
    'init-review',
    'write',
    'contact-sheet',
    'source-root',
    'implementation-root',
    'require-reviewed',
  ]);
  for (const key of values.keys())
    if (!allowed.has(key)) throw new Error(`Unsupported option: --${key}`);
  if (!values.has('normalization')) throw new Error('Pass --normalization=<geometry-report.json>.');
  const requiredValue = values.get('require-reviewed') ?? 'false';
  if (!['true', 'false'].includes(requiredValue))
    throw new Error('--require-reviewed must be true or false.');
  const absolute = (value) => (isAbsolute(value) ? value : resolve(repositoryRoot, value));
  return {
    normalizationPath: absolute(values.get('normalization')),
    reviewPath: values.has('review')
      ? absolute(values.get('review'))
      : resolve(repositoryRoot, 'architecture/home-wave2-reference-review.v1.json'),
    initReviewPath: values.has('init-review') ? absolute(values.get('init-review')) : undefined,
    outputPath: values.has('write') ? absolute(values.get('write')) : undefined,
    contactSheetPath: values.has('contact-sheet')
      ? absolute(values.get('contact-sheet'))
      : undefined,
    sourceRoot: values.has('source-root') ? absolute(values.get('source-root')) : undefined,
    implementationRoot: values.has('implementation-root')
      ? absolute(values.get('implementation-root'))
      : repositoryRoot,
    requireReviewed: requiredValue === 'true',
  };
}

export function runReferenceReview(argumentsList = process.argv.slice(2)) {
  const options = parseArguments(argumentsList);
  const normalization = JSON.parse(readFileSync(options.normalizationPath, 'utf8'));
  if (options.initReviewPath) {
    if (existsSync(options.initReviewPath))
      throw new Error(`Refusing to overwrite review input: ${options.initReviewPath}`);
    const review = createPendingReferenceReview(normalization);
    writeFileSync(options.initReviewPath, `${JSON.stringify(review, null, 2)}\n`);
    return { initialized: review.records.length, path: options.initReviewPath };
  }
  const review = JSON.parse(readFileSync(options.reviewPath, 'utf8'));
  const report = buildReviewedReferenceReport(normalization, review, {
    requireReviewed: options.requireReviewed,
  });
  if (options.outputPath) writeFileSync(options.outputPath, `${JSON.stringify(report, null, 2)}\n`);
  if (options.contactSheetPath) {
    if (!options.sourceRoot) throw new Error('--contact-sheet also requires --source-root.');
    writeFileSync(options.contactSheetPath, buildReferenceContactSheet(report, options));
  }
  if (!options.outputPath && !options.contactSheetPath)
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return { report, outputPath: options.outputPath, contactSheetPath: options.contactSheetPath };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(scriptPath)) {
  try {
    const result = runReferenceReview();
    if (result.initialized)
      process.stdout.write(
        `Initialized ${result.initialized} pending review records at ${result.path}.\n`
      );
    else
      process.stdout.write(
        `Review ${result.report.status}; ${result.report.counts.decisions.pending} pending.\n`
      );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
