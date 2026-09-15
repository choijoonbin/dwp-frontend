import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildReferenceContactSheet,
  buildReviewedReferenceReport,
  createPendingReferenceReview,
  validateReferenceReview,
} from './home-wave2-reference-review.mjs';

const reviewSchema = JSON.parse(
  readFileSync(new URL('../architecture/home-wave2-reference-review.schema.json', import.meta.url))
);

function pair(overrides = {}) {
  return {
    id: 'C01-D1440-BASE',
    family: 'CLASSIC',
    role: 'BASE',
    device: 'DESKTOP',
    viewportCss: { width: 1440, height: 900 },
    acceptedSource: {
      path: 'reference/example/screen.png',
      sha256: 'a'.repeat(64),
      dimensionsPx: { width: 1164, height: 1600 },
    },
    implementationEvidence: {
      path: 'e2e/example.png',
      sha256: 'b'.repeat(64),
      manifestSha256: 'b'.repeat(64),
      manifestBinding: 'MATCH',
      dimensionsPx: { width: 1440, height: 1906 },
    },
    normalization: {
      fullDocumentAlignment: { implementationToSourceHeightRatio: 1.05 },
    },
    ...overrides,
  };
}

function normalization(pairs, unsealedImplementation = 0) {
  return {
    inputs: {
      implementationEvidenceBinding:
        unsealedImplementation === 0 ? 'SEALED_MANIFEST_MATCH' : 'UNSEALED_SCREENSHOTS_PRESENT',
    },
    method: { widthAnchor: 'INDEPENDENTLY_SCALE_EACH_IMAGE_TO_VIEWPORT_CSS_WIDTH' },
    counts: {
      registry: pairs.length,
      evidence: pairs.length,
      paired: pairs.length,
      unsealedImplementation,
    },
    pairs,
  };
}

function completePass(record, sourcePair) {
  for (const axisName of ['firstViewport', 'fullDocument']) {
    for (const landmark of record[axisName].landmarks) {
      landmark.decision = 'PASS';
      landmark.finding = `${landmark.id} is present and aligned to the accepted reference.`;
    }
    record[axisName].decision = 'PASS';
    record[axisName].finding =
      `${axisName} preserves all required hierarchy and behavior landmarks.`;
  }
  record.firstViewport.measurements = {
    maxVerticalLandmarkDriftCss: 8,
    maxHorizontalLandmarkDriftCss: 8,
    horizontalOverflowCss: 0,
  };
  record.fullDocument.measurements = {
    unexplainedHeightDeltaRatio: 0.04,
    sectionOrderChanges: 0,
    missingRequiredLandmarks: 0,
    heightDeltaAdaptationId: null,
  };
  record.overallDecision = 'PASS';
  record.overallFinding =
    'The normalized pair preserves the accepted hierarchy and interaction contract.';
  record.reviewer = { name: 'Design reviewer', reviewedAt: '2026-09-16T09:00:00+09:00' };
  record.reviewedArtifacts = {
    sourcePngSha256: sourcePair.acceptedSource.sha256,
    implementationEvidenceSha256: sourcePair.implementationEvidence.sha256,
  };
  return record;
}

test('pending review creates an explicit record and canonical landmarks for every pair', () => {
  const classicMobile = pair({ id: 'C03-M390-BASE', device: 'MOBILE' });
  const mode = pair({ id: 'C17-MODE-PRESET', family: 'SHARED', role: 'MODE_PRESET' });
  const flow = pair({
    id: 'FLOW-PERSONALIZED-MOBILE-FINAL',
    family: 'FLOW',
    role: 'PERSONALIZED',
    device: 'MOBILE',
  });
  const input = normalization([classicMobile, mode, flow]);
  const review = createPendingReferenceReview(input);

  assert.equal(review.records.length, 3);
  assert.equal(review.records[0].overallDecision, 'PENDING');
  assert.ok(
    review.records[0].fullDocument.landmarks.some(({ id }) => id === 'MOBILE_NAV_CLEARANCE')
  );
  assert.deepEqual(
    review.records[1].firstViewport.landmarks.map(({ id }) => id),
    ['MODE_CHOOSER', 'CURRENT_AND_SELECTED_STATE', 'LOCKED_SHARED_APPS', 'DIRTY_AND_APPLY_STATE']
  );
  assert.ok(
    review.records[2].firstViewport.landmarks.some(
      ({ id }) => id === 'LOADED_SUCCESS_OR_EXPLICIT_STATE'
    )
  );
  assert.deepEqual(validateReferenceReview(input, review), {
    pass: 0,
    fail: 0,
    pending: 3,
    total: 3,
  });
});

test('review JSON schema is closed and requires all 33 canonical records', () => {
  assert.equal(reviewSchema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(reviewSchema.additionalProperties, false);
  assert.equal(reviewSchema.properties.records.minItems, 33);
  assert.equal(reviewSchema.properties.records.maxItems, 33);
  assert.equal(reviewSchema.$defs.reviewRecord.additionalProperties, false);
  assert.deepEqual(reviewSchema.$defs.decision.enum, ['PENDING', 'PASS', 'FAIL']);
});

test('pending records cannot satisfy strict reviewed mode or become seal eligible', () => {
  const input = normalization([pair()]);
  const review = createPendingReferenceReview(input);

  assert.throws(
    () => validateReferenceReview(input, review, { requireReviewed: true }),
    /1 remain pending/u
  );
  const report = buildReviewedReferenceReport(input, review);
  assert.equal(report.status, 'PENDING_REVIEW');
  assert.equal(report.reviewDecision, 'PENDING');
  assert.equal(report.sealEligible, false);
});

test('a PASS requires every landmark, finding, measurement and artifact hash binding', () => {
  const sourcePair = pair();
  const input = normalization([sourcePair]);
  const review = createPendingReferenceReview(input);
  completePass(review.records[0], sourcePair);
  review.status = 'REVIEW_COMPLETE';
  const report = buildReviewedReferenceReport(input, review, { requireReviewed: true });

  assert.equal(report.reviewDecision, 'PASS');
  assert.equal(report.status, 'REVIEW_PASS_SEALED_INPUTS');
  assert.equal(report.sealEligible, true);
  review.records[0].reviewedArtifacts.implementationEvidenceSha256 = 'c'.repeat(64);
  assert.throws(
    () => validateReferenceReview(input, review, { requireReviewed: true }),
    /not bound to the compared image hashes/u
  );
});

test('axis and overall labels cannot blanket-pass pending landmark decisions', () => {
  const input = normalization([pair()]);
  const review = createPendingReferenceReview(input);
  review.records[0].firstViewport.decision = 'PASS';
  review.records[0].fullDocument.decision = 'PASS';
  review.records[0].overallDecision = 'PASS';

  assert.throws(
    () => validateReferenceReview(input, review),
    /does not match its landmark decisions/u
  );
});

test('PASS is rejected when a measured first-viewport drift exceeds device tolerance', () => {
  const sourcePair = pair();
  const input = normalization([sourcePair]);
  const review = createPendingReferenceReview(input);
  completePass(review.records[0], sourcePair);
  review.status = 'REVIEW_COMPLETE';
  review.records[0].firstViewport.measurements.maxVerticalLandmarkDriftCss = 25;

  assert.throws(
    () => validateReferenceReview(input, review, { requireReviewed: true }),
    /outside first-viewport tolerance/u
  );
});

test('a large raw document-height delta needs a specifically applied allowed adaptation', () => {
  const sourcePair = pair({
    normalization: {
      fullDocumentAlignment: { implementationToSourceHeightRatio: 1.5 },
    },
  });
  const input = normalization([sourcePair]);
  const review = createPendingReferenceReview(input);
  completePass(review.records[0], sourcePair);
  review.status = 'REVIEW_COMPLETE';

  assert.throws(
    () => validateReferenceReview(input, review, { requireReviewed: true }),
    /explicitly apply an allowed adaptation/u
  );
  review.records[0].appliedAdaptationIds = ['dynamic-content-length'];
  review.records[0].fullDocument.measurements.heightDeltaAdaptationId = 'dynamic-content-length';
  assert.equal(validateReferenceReview(input, review, { requireReviewed: true }).pass, 1);
});

test('a reviewed PASS over unsealed screenshots is explicit but remains ineligible for sealing', () => {
  const sourcePair = pair({
    implementationEvidence: {
      path: 'e2e/example.png',
      sha256: 'c'.repeat(64),
      manifestSha256: 'b'.repeat(64),
      manifestBinding: 'MISMATCH_UNSEALED_SCREENSHOT',
      dimensionsPx: { width: 1440, height: 1906 },
    },
  });
  const input = normalization([sourcePair], 1);
  const review = createPendingReferenceReview(input);
  completePass(review.records[0], sourcePair);
  review.status = 'REVIEW_COMPLETE';
  const report = buildReviewedReferenceReport(input, review, { requireReviewed: true });

  assert.equal(report.reviewDecision, 'PASS');
  assert.equal(report.status, 'REVIEW_PASS_UNSEALED_INPUTS');
  assert.equal(report.sealEligible, false);
});

test('contact sheet references both immutable inputs and shows first/full document views', () => {
  const sourcePair = pair();
  const input = normalization([sourcePair]);
  const review = createPendingReferenceReview(input);
  const report = buildReviewedReferenceReport(input, review);
  const html = buildReferenceContactSheet(report, {
    sourceRoot: '/tmp/accepted',
    implementationRoot: '/tmp/implementation',
  });

  assert.match(html, /Accepted · first viewport/u);
  assert.match(html, /Implementation · full document/u);
  assert.match(html, /file:\/\/\/tmp\/accepted\/reference\/example\/screen\.png/u);
  assert.match(html, /file:\/\/\/tmp\/implementation\/e2e\/example\.png/u);
  assert.match(html, /This sheet does not change either input image/u);
});
