import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  cleanupReadinessFixtures,
  createReadinessFixtureDirectory,
  run,
} from './check-product-surface-production-readiness.test-support.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checker = resolve(root, 'scripts/check-product-surface-production-readiness.mjs');
const schemaSource = resolve(root, 'architecture/product-surface-production-readiness.schema.json');
const manifestSource = resolve(
  root,
  'docs/06-delivery/release-evidence/product-surface-production-readiness.json'
);
const closureSource = resolve(
  root,
  'architecture/product-surface-internal-closure.v1.generated.json'
);
const authorizationSource = resolve(root, 'architecture/product-surface-authorization.v1.json');
const trustPolicySource = resolve(
  root,
  'architecture/product-surface-release-trust-policy.v1.json'
);
const packageSource = resolve(root, 'package.json');
const releaseWorkflowSource = resolve(root, '.github/workflows/release-readiness.yml');
const trustedEvidenceRepository = 'choijoonbin/dwp-backend';
const trustedEvidenceIssuer = 'dwp-release-attestor';
const trustedTestReviewer = 'release-owner';
const provenanceKindByEvidenceType = new Map([
  ['OWNER_APPROVAL', 'OWNER_APPROVAL_ATTESTATION'],
  ['OPENAPI', 'REVIEWED_ARTIFACT_ATTESTATION'],
  ['CONTRACT_CHECKSUM', 'REVIEWED_ARTIFACT_ATTESTATION'],
  ['PAGE_CONTRACT', 'REVIEWED_ARTIFACT_ATTESTATION'],
  ['DATA_CONTRACT', 'REVIEWED_ARTIFACT_ATTESTATION'],
  ['ACTION_CONTRACT', 'REVIEWED_ARTIFACT_ATTESTATION'],
  ['GATEWAY_PEP_TEST', 'AUTOMATED_RUN_ATTESTATION'],
  ['SERVICE_PEP_TEST', 'AUTOMATED_RUN_ATTESTATION'],
  ['CROSS_TENANT_NEGATIVE_TEST', 'AUTOMATED_RUN_ATTESTATION'],
  ['AUTOMATED_TEST_RUN', 'AUTOMATED_RUN_ATTESTATION'],
  ['ARTIFACT_ROUTING_MATRIX', 'AUTOMATED_RUN_ATTESTATION'],
  ['REVOCATION_SLO', 'AUTOMATED_RUN_ATTESTATION'],
  ['CHAOS_TEST', 'AUTOMATED_RUN_ATTESTATION'],
  ['DEPLOYMENT_TRUST_ATTESTATION', 'DEPLOYMENT_ATTESTATION'],
  ['ROLLBACK_REHEARSAL', 'DEPLOYMENT_ATTESTATION'],
  ['FEATURE_DISABLED_AT_RELEASE', 'DEPLOYMENT_ATTESTATION'],
  ['PRIVACY_APPROVAL', 'INDEPENDENT_REVIEW_ATTESTATION'],
  ['ACCESSIBILITY_MANUAL_AT', 'INDEPENDENT_REVIEW_ATTESTATION'],
  ['TELEMETRY_RETENTION', 'INDEPENDENT_REVIEW_ATTESTATION'],
  ['USABILITY_STUDY', 'INDEPENDENT_REVIEW_ATTESTATION'],
  ['PENETRATION_TEST', 'INDEPENDENT_REVIEW_ATTESTATION'],
]);
const attackVectorIds = [
  'CROSS_TENANT',
  'SCOPE_ESCAPE',
  'STALE_AUTHORITY_REVISION',
  'CONFUSED_DEPUTY',
  'INTERNAL_HEADER_SPOOF',
];
const closureReference = 'architecture/product-surface-internal-closure.v1.generated.json';
const productExternalBlockers = (productId) => [
  `EXTERNAL_${productId.toUpperCase()}_PRODUCT_SECURITY_OWNER_APPROVAL`,
  `EXTERNAL_${productId.toUpperCase()}_IMMUTABLE_RELEASE_ATTESTATION`,
];

afterEach(cleanupReadinessFixtures);

function fixture() {
  const directory = createReadinessFixtureDirectory();
  return {
    directory,
    path: join(directory, 'manifest.json'),
    closurePath: join(directory, 'internal-closure.json'),
    authorizationPath: join(directory, 'authorization.json'),
    trustPolicyPath: join(directory, 'release-trust-policy.json'),
    manifest: JSON.parse(readFileSync(manifestSource, 'utf8')),
    closure: JSON.parse(readFileSync(closureSource, 'utf8')),
    authorization: JSON.parse(readFileSync(authorizationSource, 'utf8')),
    trustPolicy: JSON.parse(readFileSync(trustPolicySource, 'utf8')),
  };
}

function runWithSchema(value, schema) {
  const schemaPath = join(value.directory, 'schema.json');
  writeFileSync(schemaPath, `${JSON.stringify(schema, null, 2)}\n`);
  return run(value, ['--schema', schemaPath]);
}

function allItems(manifest) {
  return [
    ...manifest.productionGates,
    ...manifest.decisions,
    ...manifest.products,
    ...manifest.exitCriteria,
  ];
}

function activateTrustPolicy(value) {
  value.trustPolicy.status = 'ACTIVE';
  value.trustPolicy.automatedWorkflow.checksum = `sha256:${'0'.repeat(64)}`;
  value.trustPolicy.assignments = allItems(value.manifest).map((item) => ({
    itemId: item.id,
    ownerRole: item.owner,
    ownerApprovalReviewers: [trustedTestReviewer],
    artifactReviewers: [trustedTestReviewer],
    independentReviewers: [trustedTestReviewer],
  }));
  value.trustPolicy.deploymentEnvironments = allItems(value.manifest).flatMap((item) =>
    item.requiredEvidenceTypes
      .filter((type) =>
        [
          'DEPLOYMENT_TRUST_ATTESTATION',
          'ROLLBACK_REHEARSAL',
          'FEATURE_DISABLED_AT_RELEASE',
        ].includes(type)
      )
      .map((claim) => ({ itemId: item.id, claim, environment: 'staging' }))
  );
}

function completeManifest(value, options = {}) {
  makeInternalClosureComplete(value);
  activateTrustPolicy(value);
  value.manifest.status = 'READY';
  const evidenceRecords = [];
  for (const item of allItems(value.manifest)) {
    item.state = 'COMPLETE';
    item.approval = {
      approvedBy: [trustedTestReviewer],
      approvedAt: '2026-08-27T12:00:00.000Z',
    };
    item.evidence = item.requiredEvidenceTypes.map((type) => {
      const evidenceIdentity = `${item.id}/${type}`;
      const evidence = {
        type,
        owner: item.owner,
        recordedAt: '2026-08-27T12:00:00.000Z',
        reference: null,
        checksum: null,
        provenance: {
          kind: provenanceKindByEvidenceType.get(type),
          claim: type,
          issuer: trustedEvidenceIssuer,
          sourceRevision: null,
          attestationReference: null,
          attestationChecksum: null,
        },
      };
      evidenceRecords.push({ evidenceIdentity, item, evidence });
      return evidence;
    });
    item.blockers = [];
    item.failClosedEvidence = [];
  }
  materializeTrustedEvidence(value, evidenceRecords, options);
}

function completeItem(value, itemId, options = {}) {
  activateTrustPolicy(value);
  const item = allItems(value.manifest).find((candidate) => candidate.id === itemId);
  assert.ok(item, `missing fixture item ${itemId}`);
  item.state = 'COMPLETE';
  item.approval = {
    approvedBy: [trustedTestReviewer],
    approvedAt: '2026-08-27T12:00:00.000Z',
  };
  const evidenceRecords = [];
  item.evidence = item.requiredEvidenceTypes.map((type) => {
    const evidenceIdentity = `${item.id}/${type}`;
    const evidence = {
      type,
      owner: item.owner,
      recordedAt: '2026-08-27T12:00:00.000Z',
      reference: null,
      checksum: null,
      provenance: {
        kind: provenanceKindByEvidenceType.get(type),
        claim: type,
        issuer: trustedEvidenceIssuer,
        sourceRevision: null,
        attestationReference: null,
        attestationChecksum: null,
      },
    };
    evidenceRecords.push({ evidenceIdentity, item, evidence });
    return evidence;
  });
  item.blockers = [];
  item.failClosedEvidence = [];
  materializeTrustedEvidence(value, evidenceRecords, options);
}

function materializeTrustedEvidence(value, evidenceRecords, options) {
  const checkout = join(value.directory, 'trusted-backend');
  mkdirSync(checkout, { recursive: true });
  git(checkout, 'init', '--initial-branch=main');
  git(checkout, 'config', 'user.email', 'release-attestor@dwp.example');
  git(checkout, 'config', 'user.name', 'DWP Release Attestor');
  git(checkout, 'remote', 'add', 'origin', `https://github.com/${trustedEvidenceRepository}.git`);

  for (const record of evidenceRecords) {
    const evidencePath = `release-evidence/${record.evidenceIdentity}.json`;
    const attestationPath = `release-evidence/${record.evidenceIdentity}.attestation.json`;
    const evidenceBytes = `${JSON.stringify(
      {
        schemaVersion: 1,
        readinessItemId: record.item.id,
        evidenceType: record.evidence.type,
        result: 'PASS',
      },
      null,
      2
    )}\n`;
    writeRepositoryFile(checkout, evidencePath, evidenceBytes);
    record.evidence.checksum = digest(evidenceBytes);
    record.evidencePath = evidencePath;
    record.attestationPath = attestationPath;

    const attestation = buildAttestation(record, evidencePath);
    if (attestation.run) {
      const artifactEntryBytes =
        options.artifactEntryBytes?.(record, Buffer.from(evidenceBytes)) ??
        Buffer.from(evidenceBytes);
      record.artifactArchivePath = buildArtifactArchive(value, record, artifactEntryBytes);
      attestation.run.artifactDigest = digest(readFileSync(record.artifactArchivePath));
    }
    options.mutateAttestation?.(attestation, record);
    const attestationBytes = `${JSON.stringify(attestation, null, 2)}\n`;
    writeRepositoryFile(checkout, attestationPath, attestationBytes);
    record.evidence.provenance.attestationChecksum = digest(attestationBytes);
  }

  git(checkout, 'add', 'release-evidence');
  git(checkout, 'commit', '-m', 'Add immutable release evidence fixture');
  const revision = git(checkout, 'rev-parse', 'HEAD');
  for (const record of evidenceRecords) {
    const base = `https://github.com/${trustedEvidenceRepository}/blob/${revision}`;
    record.evidence.reference = `${base}/${record.evidencePath}`;
    record.evidence.provenance.sourceRevision = revision;
    record.evidence.provenance.attestationReference = `${base}/${record.attestationPath}`;
  }
  value.evidenceCheckout = checkout;
  value.evidenceRevision = revision;
  value.evidenceRecords = evidenceRecords;
}

function buildAttestation({ item, evidence }, evidencePath) {
  const kind = evidence.provenance.kind;
  const attestation = {
    schemaVersion: 1,
    attestationId: `${item.id}.${evidence.type}.v1`,
    repository: trustedEvidenceRepository,
    kind,
    claim: evidence.type,
    issuer: trustedEvidenceIssuer,
    recordedAt: evidence.recordedAt,
    subject: {
      readinessItemId: item.id,
      evidenceOwner: evidence.owner,
    },
    evidence: {
      path: evidencePath,
      checksum: evidence.checksum,
    },
  };
  if (kind === 'OWNER_APPROVAL_ATTESTATION') {
    attestation.approval = {
      ...structuredClone(item.approval),
      sourceReference: `https://github.com/${trustedEvidenceRepository}/pull/123`,
      headRevision: '2'.repeat(40),
    };
  } else if (kind === 'REVIEWED_ARTIFACT_ATTESTATION') {
    attestation.artifact = {
      reviewDecision: 'APPROVED',
      reviewer: trustedTestReviewer,
      sourceReference: `https://github.com/${trustedEvidenceRepository}/pull/123`,
      headRevision: '2'.repeat(40),
    };
  } else if (kind === 'AUTOMATED_RUN_ATTESTATION') {
    attestation.run = {
      command: './gradlew --no-daemon check',
      result: 'PASS',
      passed: 1,
      failed: 0,
      workflowName: 'Backend quality gates',
      workflowReference: `https://github.com/${trustedEvidenceRepository}/actions/runs/123/attempts/1`,
      headRevision: '2'.repeat(40),
      artifactDigest: `sha256:${'a'.repeat(64)}`,
      artifactName: `${item.id}.${evidence.type}.v1`,
      artifactEntryPath: evidencePath,
    };
  } else if (kind === 'DEPLOYMENT_ATTESTATION') {
    attestation.deployment = {
      environment: 'staging',
      result: 'PASS',
      sourceReference: `https://github.com/${trustedEvidenceRepository}/deployments/123`,
      headRevision: '2'.repeat(40),
    };
  } else if (kind === 'INDEPENDENT_REVIEW_ATTESTATION') {
    attestation.review = {
      reviewer: trustedTestReviewer,
      decision: 'APPROVED',
      sourceReference: `https://github.com/${trustedEvidenceRepository}/pull/123`,
      headRevision: '2'.repeat(40),
    };
  }
  return attestation;
}

function writeRepositoryFile(checkout, repositoryPath, value) {
  const path = join(checkout, repositoryPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function git(checkout, ...arguments_) {
  return execFileSync('git', ['-C', checkout, ...arguments_], { encoding: 'utf8' }).trim();
}

function fakeGithub(value, options = {}) {
  const fakeBin = join(value.directory, 'fake-github-bin');
  const responsesPath = join(value.directory, 'fake-github-responses.json');
  mkdirSync(fakeBin, { recursive: true });

  const attestedHead = '2'.repeat(40);
  const pullHead = '3'.repeat(40);
  const evidenceCommit = value.evidenceRevision;
  const evidenceFiles = value.evidenceRecords.map((record) => ({
    filename: record.attestationPath,
    status: 'added',
  }));
  const comparison = {
    status: 'ahead',
    ahead_by: 1,
    behind_by: 0,
    total_commits: 1,
    merge_base_commit: { sha: attestedHead },
    commits: [{ sha: evidenceCommit, parents: [{ sha: attestedHead }] }],
    files: evidenceFiles,
  };
  options.mutateComparison?.(comparison);

  const responses = {
    [`repos/${trustedEvidenceRepository}/compare/${attestedHead}...${evidenceCommit}`]: comparison,
    [`repos/${trustedEvidenceRepository}/pulls/123`]: {
      merged_at: '2026-08-27T12:01:00.000Z',
      merge_commit_sha: attestedHead,
      base: { ref: 'dwp-dev', repo: { full_name: trustedEvidenceRepository } },
      head: { sha: pullHead },
    },
    [`repos/${trustedEvidenceRepository}/pulls/123/reviews?per_page=100`]: [
      {
        user: { login: trustedTestReviewer },
        state: 'APPROVED',
        commit_id: pullHead,
        submitted_at: '2026-08-27T11:59:00.000Z',
      },
    ],
    [`repos/${trustedEvidenceRepository}/pulls/123/reviews?per_page=100&page=1`]: [
      {
        user: { login: trustedTestReviewer },
        state: 'APPROVED',
        commit_id: pullHead,
        submitted_at: '2026-08-27T11:59:00.000Z',
      },
    ],
    [`repos/${trustedEvidenceRepository}/pulls/123/reviews?per_page=100&page=2`]: [],
  };

  for (const record of value.evidenceRecords) {
    const evidenceBytes = readFileSync(join(value.evidenceCheckout, record.evidencePath));
    responses[
      `repos/${trustedEvidenceRepository}/contents/${record.evidencePath}?ref=${attestedHead}`
    ] = githubFile(evidenceBytes);

    const attestation = JSON.parse(
      readFileSync(join(value.evidenceCheckout, record.attestationPath), 'utf8')
    );
    if (attestation.run) {
      const artifactId = 456;
      const archivePath = record.artifactArchivePath;
      const artifact = {
        id: artifactId,
        expired: false,
        name: attestation.run.artifactName,
        digest: attestation.run.artifactDigest,
        archive_download_url: `https://api.github.com/repos/${trustedEvidenceRepository}/actions/artifacts/${artifactId}/zip`,
      };
      responses[`repos/${trustedEvidenceRepository}/actions/runs/123`] = {
        name: 'Backend quality gates',
        path: '.github/workflows/backend-quality-gates.yml',
        event: 'push',
        head_branch: 'dwp-dev',
        head_sha: attestedHead,
        run_attempt: 1,
        status: 'completed',
        conclusion: 'success',
        html_url: `https://github.com/${trustedEvidenceRepository}/actions/runs/123`,
      };
      responses[`repos/${trustedEvidenceRepository}/actions/runs/123/artifacts?per_page=100`] = {
        artifacts: [artifact],
      };
      const workflowBytes = Buffer.from(
        `steps:\n  - run: ${attestation.run.command}\n  - uses: actions/upload-artifact@v4\n    with:\n      name: ${attestation.run.artifactName}\n      path: ${attestation.run.artifactEntryPath}\n`
      );
      value.trustPolicy.automatedWorkflow.checksum = digest(workflowBytes);
      responses[
        `repos/${trustedEvidenceRepository}/contents/.github/workflows/backend-quality-gates.yml?ref=${attestedHead}`
      ] = githubFile(workflowBytes);
      responses[`repos/${trustedEvidenceRepository}/actions/artifacts/${artifactId}/zip`] = {
        binaryFile: archivePath,
      };
      responses[artifact.archive_download_url] = { binaryFile: archivePath };
    }
  }

  options.mutateResponses?.(responses, {
    attestedHead,
    evidenceCommit,
    pullHead,
  });
  writeFileSync(responsesPath, JSON.stringify(responses));

  const ghPath = join(fakeBin, 'gh');
  writeFileSync(
    ghPath,
    `#!/usr/bin/env node
const fs = require('node:fs');
const responses = JSON.parse(fs.readFileSync(process.env.DWP_FAKE_GH_RESPONSES, 'utf8'));
const args = process.argv.slice(2);
const endpoint = args.find((arg) => arg.startsWith('repos/') || arg.startsWith('https://'));
const response = responses[endpoint];
if (response === undefined) {
  process.stderr.write('unexpected fake GitHub endpoint: ' + endpoint + '\\n');
  process.exit(1);
}
if (response && response.binaryFile) {
  const outputIndex = args.indexOf('--output');
  if (outputIndex >= 0 && args[outputIndex + 1]) {
    fs.copyFileSync(response.binaryFile, args[outputIndex + 1]);
  } else {
    process.stdout.write(fs.readFileSync(response.binaryFile));
  }
} else {
  process.stdout.write(JSON.stringify(response));
}
`
  );
  chmodSync(ghPath, 0o755);
  return {
    PATH: `${fakeBin}:${process.env.PATH}`,
    GITHUB_ACTIONS: 'true',
    GH_TOKEN: 'test-token',
    DWP_FAKE_GH_RESPONSES: responsesPath,
  };
}

function githubFile(bytes) {
  return { type: 'file', encoding: 'base64', content: Buffer.from(bytes).toString('base64') };
}

function buildArtifactArchive(value, record, entryBytes) {
  const archiveRoot = join(value.directory, `artifact-${record.evidence.type}`);
  const archivePath = join(value.directory, `artifact-${record.evidence.type}.zip`);
  writeRepositoryFile(archiveRoot, record.evidencePath, entryBytes);
  execFileSync('zip', ['-q', '-r', archivePath, record.evidencePath], { cwd: archiveRoot });
  return archivePath;
}

function recalculateClosure(value) {
  const closure = value.closure;
  const exactProducts = closure.products.filter(
    ({ contractStatus }) => contractStatus === 'EXACT'
  ).length;
  const qualifiedAttackCells = closure.products.reduce(
    (total, product) => total + product.qualifiedAttackIds.length,
    0
  );
  const productBlockers = closure.products.filter(({ blocker }) => blocker !== null).length;
  const internallyClosedProducts = closure.products.filter(
    (product) =>
      product.contractStatus === 'EXACT' &&
      product.missingAttackIds.length === 0 &&
      product.blocker === null
  ).length;
  const totalAttackCells = closure.products.length * closure.attackVectors.length;
  const completionState =
    exactProducts === closure.products.length &&
    qualifiedAttackCells === totalAttackCells &&
    productBlockers === 0
      ? 'COMPLETE'
      : 'PARTIAL';
  closure.summary = {
    productCount: closure.products.length,
    exactProducts,
    internallyClosedProducts,
    totalAttackCells,
    qualifiedAttackCells,
    missingAttackCells: totalAttackCells - qualifiedAttackCells,
    productBlockers,
    completionState,
  };
  const projection = {
    schemaVersion: 1,
    matrixId: closure.generatedFrom.negativeMatrix.matrixId,
    completionState,
    rolloutInventory: {
      reference:
        'contracts/product-authorization/product-surface-rollout-inventory.v1.generated.json',
      checksum: closure.generatedFrom.rolloutInventory.checksum,
    },
    exactContract: {
      reference: 'contracts/product-authorization/product-surfaces-v1.bundle-v4.json',
      checksum: closure.generatedFrom.authorizationBundle.checksum,
      products: closure.products.map(({ productId }) => productId),
    },
    attackVectors: closure.attackVectors,
    products: closure.products.map((product) => ({
      productId: product.productId,
      contractStatus: product.contractStatus,
      ownerService: product.ownerService,
      attackEvidence: product.attackEvidence,
      missingAttackIds: product.missingAttackIds,
      blocker: product.blocker,
    })),
  };
  closure.generatedFrom.negativeMatrix.projectionChecksum = canonicalChecksum(projection);
}

function makeInternalClosureComplete(value) {
  for (const product of value.closure.products) {
    for (const attackId of attackVectorIds) {
      if (product.attackEvidence[attackId].length === 0) {
        product.attackEvidence[attackId] = [
          `tests/test_product_surface_pep.py#test_${product.productId}_${attackId.toLowerCase()}`,
        ];
      }
    }
    product.qualifiedAttackIds = [...attackVectorIds];
    product.missingAttackIds = [];
    product.blocker = null;
  }
  recalculateClosure(value);
}

function makeInternalClosurePartial(value) {
  const product = value.closure.products.find(({ productId }) => productId === 'dwaion');
  product.attackEvidence = Object.fromEntries(attackVectorIds.map((attackId) => [attackId, []]));
  product.qualifiedAttackIds = [];
  product.missingAttackIds = [...attackVectorIds];
  product.blocker = 'MISSING_DWAION_AGENT_RUNTIME_PEP_MATRIX';
  recalculateClosure(value);
}

function makeManifestInternalPending(value) {
  for (const product of value.manifest.products) {
    product.state = 'PENDING_INTERNAL';
    product.blockers = ['INTERNAL_TEST_CLOSURE_PENDING'];
  }
  for (const id of ['X-01', 'X-03']) {
    const item = value.manifest.exitCriteria.find((candidate) => candidate.id === id);
    item.state = 'PENDING_INTERNAL';
    item.blockers = ['INTERNAL_TEST_CLOSURE_PENDING'];
  }
}

function handoffInternalClosureToExternalEvidence(value) {
  makeInternalClosureComplete(value);
  for (const product of value.manifest.products) {
    product.state = 'BLOCKED_EXTERNAL';
    product.blockers = productExternalBlockers(product.productId);
    if (!product.failClosedEvidence.includes(closureReference)) {
      product.failClosedEvidence.push(closureReference);
    }
  }
  const x01 = value.manifest.exitCriteria.find(({ id }) => id === 'X-01');
  x01.state = 'BLOCKED_EXTERNAL';
  x01.blockers = [
    'EXTERNAL_X01_SECURITY_AND_PRODUCT_OWNER_APPROVALS',
    'EXTERNAL_X01_IMMUTABLE_AGGREGATE_RELEASE_ATTESTATION',
  ];
  if (!x01.failClosedEvidence.includes(closureReference)) {
    x01.failClosedEvidence.push(closureReference);
  }
  const x03 = value.manifest.exitCriteria.find(({ id }) => id === 'X-03');
  x03.state = 'BLOCKED_EXTERNAL';
  x03.blockers = [
    'EXTERNAL_X03_SECURITY_OWNER_APPROVAL',
    'EXTERNAL_X03_IMMUTABLE_AUTOMATED_RUN_ATTESTATION',
  ];
  if (!x03.failClosedEvidence.includes(closureReference)) {
    x03.failClosedEvidence.push(closureReference);
  }
}

function digest(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function canonicalChecksum(value) {
  const canonicalize = (candidate) => {
    if (Array.isArray(candidate)) return candidate.map(canonicalize);
    if (!candidate || typeof candidate !== 'object') return candidate;
    return Object.fromEntries(
      Object.keys(candidate)
        .sort()
        .map((key) => [key, canonicalize(candidate[key])])
    );
  };
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

test('integrity mode accepts the attested v4 closure while latest v5 remains draft', () => {
  const value = fixture();
  const result = run(value);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /exact product contracts: 12\/12/);
  assert.match(result.stdout, /release-approved product closure: 0\/12/);
  assert.match(result.stdout, /schema and integrity only/);
});

test('integrity mode rejects duplicate immutable bundles for the attested closure version', () => {
  const value = fixture();
  const v4 = value.authorization.bundles.find((bundle) => bundle.version === 4);
  assert.ok(v4);
  value.authorization.bundles.push(structuredClone(v4));

  const result = run(value);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /internal closure snapshot is not bound to its immutable authorization bundle/
  );
});

test('integrity mode rejects an index entry that is not bound to the attested bundle', () => {
  const value = fixture();
  const v4Index = value.authorization.index.versions.find((entry) => entry.version === 4);
  assert.ok(v4Index);
  v4Index.artifact = 'product-surfaces-v1.bundle-v4-tampered.json';

  const result = run(value);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /internal closure snapshot is not bound to its immutable authorization bundle/
  );
});

test('keeps X-03 internal while the calculated five-vector matrix is partial', () => {
  const value = fixture();
  makeInternalClosurePartial(value);
  makeManifestInternalPending(value);
  const x03 = value.manifest.exitCriteria.find((item) => item.id === 'X-03');

  assert.equal(x03?.state, 'PENDING_INTERNAL');
  assert.equal(value.closure.summary.missingAttackCells, 5);
  assert.equal(value.closure.summary.completionState, 'PARTIAL');
  const result = run(value);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /owner-service PEP cells: 55\/60/);
});

test('release mode fails closed without converting pending approvals to completion', () => {
  const value = fixture();
  const result = run(value, ['--release']);
  assert.equal(result.status, 2);
  assert.match(
    result.stderr,
    /AUTHORIZATION_CLOSURE_ATTESTATION: latest authorization registry v5/
  );
  assert.match(result.stderr, /does not match attested closure v4/);
  assert.match(result.stderr, /G-02 BLOCKED_EXTERNAL/);
  assert.match(
    result.stderr,
    new RegExp(`P-MEETINGS ${value.manifest.products.find(({ id }) => id === 'P-MEETINGS').state}`)
  );
  assert.match(result.stderr, /X-08 BLOCKED_EXTERNAL/);
});

test('official release paths execute the Product Surface release gate and block this manifest', () => {
  const packageManifest = JSON.parse(readFileSync(packageSource, 'utf8'));
  const releaseGate = packageManifest.scripts?.['release:gate'] ?? '';
  assert.ok(
    releaseGate.indexOf('check-official-backend-contracts.mjs') >= 0 &&
      releaseGate.indexOf('check-official-backend-contracts.mjs') <
        releaseGate.indexOf('check-product-surface-production-readiness.mjs --release'),
    'release:gate must validate official Backend contracts before calculating readiness'
  );

  const releaseWorkflow = readFileSync(releaseWorkflowSource, 'utf8');
  assert.match(
    releaseWorkflow,
    /run: corepack yarn product-surfaces:readiness:test/,
    'the release workflow must retain the fail-closed binding regression test'
  );
  assert.match(
    releaseWorkflow,
    /run: corepack yarn product-surfaces:readiness:release/,
    'the release workflow must enforce Product Surface production readiness explicitly'
  );
  assert.ok(
    releaseWorkflow.indexOf('run: corepack yarn release:contracts:check') >= 0 &&
      releaseWorkflow.indexOf('run: corepack yarn release:contracts:check') <
        releaseWorkflow.indexOf('run: corepack yarn product-surfaces:readiness:release'),
    'the release workflow must validate the official Backend checkout before readiness'
  );
  assert.match(
    releaseWorkflow,
    /DWP_BACKEND_CHECKOUT: \$\{\{ github\.workspace \}\}\/\.official-backend/,
    'the standalone readiness step must receive the trusted Backend checkout'
  );
  assert.match(
    releaseWorkflow,
    /GH_TOKEN: \$\{\{ secrets\.DWP_BACKEND_READ_TOKEN \|\| github\.token \}\}/,
    'every release step must receive the token required for online evidence verification'
  );
  assert.match(
    releaseWorkflow,
    /test "\$FRONTEND_REF" = refs\/heads\/dwp-dev/,
    'release authorization must run only from the canonical frontend branch'
  );
  assert.match(
    releaseWorkflow,
    /repos\/choijoonbin\/dwp-frontend\/branches\/dwp-dev/,
    'release authorization must bind the frontend checkout to the protected branch head'
  );
  assert.match(
    releaseWorkflow,
    /\.name == "Frontend quality".*\.head_sha == env\.FRONTEND_COMMIT/,
    'release authorization must require frontend quality at the exact source revision'
  );
  assert.match(
    releaseWorkflow,
    /\.name == "Backend quality gates" and \.path == "\.github\/workflows\/backend-quality-gates\.yml" and \.event == "push" and \.head_branch == "dwp-dev"/,
    'release authorization must bind Backend quality to the canonical workflow path, event and branch'
  );
  assert.match(
    releaseWorkflow,
    /\.name == "Frontend quality" and \.path == "\.github\/workflows\/frontend-quality\.yml" and \.event == "push" and \.head_branch == "dwp-dev"/,
    'release authorization must bind Frontend quality to the canonical workflow path, event and branch'
  );
  assert.match(
    releaseWorkflow,
    /\.name == "Agent quality" and \.path == "\.github\/workflows\/agent-quality\.yml" and \.event == "push" and \.head_branch == "dwp-dev"/,
    'release authorization must bind Agent quality to the canonical workflow path, event and branch'
  );

  const result = spawnSync(process.execPath, [checker, '--release'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 2, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /Product Surface production release is blocked/);
  const currentManifest = JSON.parse(readFileSync(manifestSource, 'utf8'));
  const x03 = currentManifest.exitCriteria.find(({ id }) => id === 'X-03');
  assert.match(result.stderr, new RegExp(`X-03 ${x03.state}`));
  assert.match(result.stderr, /X-05 BLOCKED_EXTERNAL/);
});

test('requires an atomic external handoff after 12-product and 60-cell closure', () => {
  const value = fixture();
  makeInternalClosureComplete(value);
  makeManifestInternalPending(value);
  const result = run(value);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /P-APPROVALS cannot remain PENDING_INTERNAL after 12\/12 and 60\/60/);
  assert.match(
    result.stderr,
    /X-01 cannot remain PENDING_INTERNAL after calculated internal closure/
  );
  assert.match(
    result.stderr,
    /X-03 cannot remain PENDING_INTERNAL after calculated internal closure/
  );
});

test('accepts internal zero only as an externally blocked release handoff', () => {
  const value = fixture();
  handoffInternalClosureToExternalEvidence(value);
  const integrity = run(value);
  assert.equal(integrity.status, 0, `${integrity.stdout}\n${integrity.stderr}`);
  assert.match(integrity.stdout, /internally closed products: 12\/12/);
  assert.match(integrity.stdout, /owner-service PEP cells: 60\/60/);
  assert.match(integrity.stdout, /internal evidence pending: 0/);
  assert.match(integrity.stdout, /release-approved product closure: 0\/12/);

  const release = run(value, ['--release']);
  assert.equal(release.status, 2);
  assert.match(release.stderr, /P-MEETINGS BLOCKED_EXTERNAL/);
  assert.match(release.stderr, /X-03 BLOCKED_EXTERNAL/);
});

test('rejects external handoff when a product or vector remains incomplete', () => {
  const value = fixture();
  handoffInternalClosureToExternalEvidence(value);
  makeInternalClosurePartial(value);
  const result = run(value);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /P-DWAION cannot hand off externally before exact internal closure/);
  assert.match(result.stderr, /X-01 must remain PENDING_INTERNAL/);
  assert.match(result.stderr, /X-03 must remain PENDING_INTERNAL/);
});

test('keeps every product internal until the 12-product 60-cell handoff is atomic', () => {
  const value = fixture();
  makeInternalClosurePartial(value);
  makeManifestInternalPending(value);
  const approvals = value.manifest.products.find(({ productId }) => productId === 'approvals');
  approvals.state = 'BLOCKED_EXTERNAL';
  approvals.blockers = productExternalBlockers('approvals');
  approvals.failClosedEvidence.push(closureReference);

  const result = run(value);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /P-APPROVALS must remain PENDING_INTERNAL until 12\/12 and 60\/60/);
});

test('does not let COMPLETE bypass an incomplete product owner-service matrix', () => {
  const value = fixture();
  completeManifest(value);
  makeInternalClosurePartial(value);

  const result = run(value, ['--release']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /P-DWAION cannot hand off externally before exact internal closure/);
  assert.match(result.stderr, /P-DWAION must remain PENDING_INTERNAL until 12\/12 and 60\/60/);
});

test('rejects forged internal closure totals and projection checksums', () => {
  const value = fixture();
  value.closure.summary.qualifiedAttackCells += 1;
  value.closure.generatedFrom.negativeMatrix.projectionChecksum = 'a'.repeat(64);
  const result = run(value);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /internal closure summary contains non-calculated values/);
  assert.match(result.stderr, /matrix projection checksum does not match its evidence/);
});

test('rejects Management automatic restoration and incomplete navigation acceptance IDs', () => {
  const value = fixture();
  value.manifest.navigationConveniencePolicy.managementAutomaticRestore = 'ALLOWED';
  value.manifest.navigationConveniencePolicy.acceptanceCriteria.pop();
  const result = run(value);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Management automatic last-route restoration must remain FORBIDDEN/);
  assert.match(result.stderr, /navigation acceptance is missing NC-05/);
});

test('rejects scoped JIT exposure or a weakened re-enablement contract', () => {
  const value = fixture();
  value.manifest.scopedJitReleasePolicy.activation = 'ENABLED';
  value.manifest.scopedJitReleasePolicy.environmentOverride = 'ALLOWED';
  value.manifest.scopedJitReleasePolicy.allowedScopes = ['TENANT'];
  value.manifest.scopedJitReleasePolicy.reenablementRequirements.pop();
  const result = run(value);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /scoped JIT must remain disabled without an environment override/);
  assert.match(result.stderr, /scoped JIT cannot expose any release scope while disabled/);
  assert.match(result.stderr, /re-enablement requirements do not match the fixed release contract/);
});

test('rejects schema drift that would weaken Management or evidence validation', () => {
  const value = fixture();
  const schema = JSON.parse(readFileSync(schemaSource, 'utf8'));
  schema.$defs.navigationConveniencePolicy.properties.managementAutomaticRestore.const = 'ALLOWED';
  schema.$defs.scopedJitReleasePolicy.properties.activation.const = 'ENABLED';
  schema.$defs.evidence.properties.type.enum.pop();
  schema.$defs.evidenceProvenance.properties.kind.enum.pop();
  const result = runWithSchema(value, schema);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /schema evidence types have drifted/);
  assert.match(result.stderr, /schema evidence provenance kinds have drifted/);
  assert.match(result.stderr, /schema Management restoration policy has drifted/);
  assert.match(result.stderr, /schema scoped JIT disablement has drifted/);
});

test('rejects product inventory drift, rollout widening and under-declared evidence', () => {
  const value = fixture();
  value.manifest.products[11].productId = 'unknown-product';
  value.manifest.products[0].rolloutDefault = '111';
  value.manifest.products[1].requiredEvidenceTypes = ['OWNER_APPROVAL'];
  const result = run(value);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /products is missing meetings/);
  assert.match(result.stderr, /products has unknown IDs unknown-product/);
  assert.match(result.stderr, /rolloutDefault must match the fail-closed inventory value 000/);
  assert.match(result.stderr, /requiredEvidenceTypes do not match the fixed release contract/);
});

test('cannot mark an item complete without dated approval and every immutable evidence type', () => {
  const value = fixture();
  const item = value.manifest.productionGates[0];
  item.state = 'COMPLETE';
  item.blockers = [];
  item.failClosedEvidence = [];
  const result = run(value);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /G-02 COMPLETE requires named approvers/);
  assert.match(result.stderr, /G-02 COMPLETE requires approvedAt/);
  assert.match(result.stderr, /G-02 COMPLETE is missing OWNER_APPROVAL, OPENAPI/);
});

test('rejects a forged local evidence checksum', () => {
  const value = fixture();
  completeManifest(value);
  const evidence = value.manifest.productionGates[0].evidence.find(
    (entry) => entry.type === 'CONTRACT_CHECKSUM'
  );
  evidence.checksum = `sha256:${'a'.repeat(64)}`;
  const result = run(value, ['--release']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /evidence checksum does not match/);
});

test('rejects an ADR or attestation reused across distinct evidence claims and items', () => {
  const value = fixture();
  completeManifest(value);
  const evidenceEntries = [
    value.manifest.productionGates[0].evidence.find((entry) => entry.type === 'OPENAPI'),
    value.manifest.productionGates[1].evidence.find((entry) => entry.type === 'CONTRACT_CHECKSUM'),
  ];
  const [source, reused] = evidenceEntries;
  reused.reference = source.reference;
  reused.checksum = source.checksum;
  reused.provenance.attestationReference = source.provenance.attestationReference;
  reused.provenance.attestationChecksum = source.provenance.attestationChecksum;
  const result = run(value, ['--release']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /manifest evidence reference .* is reused across distinct claims/);
  assert.match(result.stderr, /manifest evidence attestation .* is reused across distinct claims/);
});

test('rejects mismatched, unpinned or untrusted evidence provenance', () => {
  const value = fixture();
  completeManifest(value);
  const evidence = value.manifest.exitCriteria[2].evidence.find(
    (entry) => entry.type === 'CROSS_TENANT_NEGATIVE_TEST'
  );
  evidence.provenance.kind = 'OWNER_APPROVAL_ATTESTATION';
  evidence.provenance.claim = 'OWNER_APPROVAL';
  evidence.provenance.sourceRevision = 'main';
  evidence.provenance.attestationReference =
    'https://attacker.example/attestations/cross-tenant.json';
  evidence.provenance.attestationChecksum = 'unverified';
  const result = run(value, ['--release']);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /CROSS_TENANT_NEGATIVE_TEST evidence requires AUTOMATED_RUN_ATTESTATION provenance/
  );
  assert.match(result.stderr, /provenance claim must equal CROSS_TENANT_NEGATIVE_TEST/);
  assert.match(result.stderr, /requires a full lowercase source revision/);
  assert.match(result.stderr, /is not in trusted repository choijoonbin\/dwp-backend/);
  assert.match(result.stderr, /requires an immutable attestation checksum/);
});

test('rejects arbitrary evidence hosts even when the claimant supplies a sha256 string', () => {
  const value = fixture();
  completeManifest(value);
  const evidence = value.manifest.productionGates[0].evidence[0];
  evidence.reference = 'https://attacker.example/release-evidence/owner-approval.json';

  const result = run(value, ['--release']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /evidence reference is not in trusted repository/);
});

test('rejects a self-referential attestation checksum and evidence file', () => {
  const value = fixture();
  completeManifest(value);
  const evidence = value.manifest.productionGates[0].evidence[0];
  evidence.provenance.attestationReference = evidence.reference;
  evidence.provenance.attestationChecksum = evidence.checksum;

  const result = run(value, ['--release']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not bind a distinct evidence file and checksum/);
});

test('rejects a fake immutable revision that is not the trusted checkout HEAD', () => {
  const value = fixture();
  completeManifest(value);
  const fakeRevision = 'f'.repeat(40);
  const actualRevision = value.evidenceRevision;
  for (const item of allItems(value.manifest)) {
    for (const evidence of item.evidence) {
      evidence.reference = evidence.reference.replace(actualRevision, fakeRevision);
      evidence.provenance.sourceRevision = fakeRevision;
      evidence.provenance.attestationReference = evidence.provenance.attestationReference.replace(
        actualRevision,
        fakeRevision
      );
    }
  }
  value.evidenceRevision = fakeRevision;

  const result = run(value, ['--release']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /trusted Backend checkout is not the declared immutable revision/);
});

test('rejects a local evidence checkout that only impersonates the trusted repository', () => {
  const value = fixture();
  completeManifest(value);
  git(value.evidenceCheckout, 'remote', 'set-url', 'origin', 'https://attacker.example/fake.git');

  const result = run(value, ['--release']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /trusted Backend checkout origin is not approved/);
});

test('requires the evidence-kind-specific automated run fields and trusted workflow URL', () => {
  const value = fixture();
  completeManifest(value, {
    mutateAttestation(attestation, { evidence }) {
      if (evidence.type !== 'AUTOMATED_TEST_RUN') return;
      delete attestation.run.command;
      attestation.run.workflowReference = 'https://attacker.example/actions/runs/123';
    },
  });

  const result = run(value, ['--release']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /automated run must record a passing immutable workflow result/);
});

test('release mode rejects a fully self-asserted local repository without online verification', () => {
  const value = fixture();
  completeManifest(value);
  const result = run(value, ['--release']);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /requires online GitHub verification in the trusted release workflow/
  );
});

test('accepts only a direct evidence-attestation successor of the attested workflow head', () => {
  const valid = fixture();
  completeItem(valid, 'G-03');
  const validResult = run(valid, ['--release'], fakeGithub(valid));
  assert.equal(validResult.status, 2, `${validResult.stdout}\n${validResult.stderr}`);
  assert.doesNotMatch(validResult.stderr, /G-03 .* online evidence/);

  const oldAncestor = fixture();
  completeItem(oldAncestor, 'G-03');
  const oldAncestorResult = run(
    oldAncestor,
    ['--release'],
    fakeGithub(oldAncestor, {
      mutateComparison(comparison) {
        comparison.ahead_by = 2;
        comparison.total_commits = 2;
        comparison.commits.unshift({ sha: '4'.repeat(40), parents: [{ sha: '2'.repeat(40) }] });
        comparison.commits[1].parents = [{ sha: '4'.repeat(40) }];
      },
    })
  );
  assert.equal(oldAncestorResult.status, 1, oldAncestorResult.stderr);
  assert.match(oldAncestorResult.stderr, /direct, attestation-only successor|source lineage/);

  const interveningCode = fixture();
  completeItem(interveningCode, 'G-03');
  const interveningCodeResult = run(
    interveningCode,
    ['--release'],
    fakeGithub(interveningCode, {
      mutateComparison(comparison) {
        comparison.files.push({
          filename: 'src/main/java/UnauthorizedRelease.java',
          status: 'added',
        });
      },
    })
  );
  assert.equal(interveningCodeResult.status, 1, interveningCodeResult.stderr);
  assert.match(interveningCodeResult.stderr, /attestation-only successor|source lineage/);

  const renamedCode = fixture();
  completeItem(renamedCode, 'G-03');
  const renamedCodeResult = run(
    renamedCode,
    ['--release'],
    fakeGithub(renamedCode, {
      mutateComparison(comparison) {
        comparison.files[0] = {
          filename: comparison.files[0].filename,
          previous_filename: 'src/main/java/SecurityPolicy.java',
          status: 'renamed',
        };
      },
    })
  );
  assert.equal(renamedCodeResult.status, 1, renamedCodeResult.stderr);
  assert.match(renamedCodeResult.stderr, /attestation-only successor|source lineage/);
});

test('rejects a trusted run artifact whose claimed entry bytes differ from the evidence', () => {
  const value = fixture();
  completeItem(value, 'G-03', {
    artifactEntryBytes() {
      return Buffer.from('{"result":"FORGED"}\n');
    },
  });

  const result = run(value, ['--release'], fakeGithub(value));
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /artifact entry .*evidence checksum|artifact .*evidence bytes/);
  assert.doesNotMatch(result.stderr, /artifact digest is not present/);
});

test('pins automated evidence to the immutable workflow bytes', () => {
  const value = fixture();
  completeItem(value, 'G-03');
  const result = run(
    value,
    ['--release'],
    fakeGithub(value, {
      mutateResponses(responses, { attestedHead }) {
        responses[
          `repos/${trustedEvidenceRepository}/contents/.github/workflows/backend-quality-gates.yml?ref=${attestedHead}`
        ] = githubFile(Buffer.from('# stale command and upload strings are not executable\n'));
      },
    })
  );
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /workflow bytes differ from the immutable release trust policy/);
});

test('rejects self-declared reviewers and deployment environments outside the trust policy', () => {
  const reviewer = fixture();
  completeItem(reviewer, 'G-03');
  const g03 = allItems(reviewer.manifest).find(({ id }) => id === 'G-03');
  g03.approval.approvedBy = ['unassigned-reviewer'];
  const reviewerResult = run(reviewer, ['--release']);
  assert.equal(reviewerResult.status, 1, reviewerResult.stderr);
  assert.match(reviewerResult.stderr, /approvedBy does not match its immutable reviewer policy/);

  const deployment = fixture();
  completeItem(deployment, 'G-06', {
    mutateAttestation(attestation) {
      if (attestation.deployment) attestation.deployment.environment = 'production';
    },
  });
  const deploymentResult = run(deployment, ['--release']);
  assert.equal(deploymentResult.status, 1, deploymentResult.stderr);
  assert.match(deploymentResult.stderr, /immutable environment policy/);
});

test('uses the latest paginated review state instead of an older approval', () => {
  const value = fixture();
  completeItem(value, 'G-03');
  const owner = trustedTestReviewer;
  const result = run(
    value,
    ['--release'],
    fakeGithub(value, {
      mutateResponses(responses, { pullHead }) {
        responses[`repos/${trustedEvidenceRepository}/pulls/123/reviews?per_page=100&page=1`] =
          Array.from({ length: 100 }, (_, index) => ({
            id: index + 1,
            user: { login: owner },
            state: 'APPROVED',
            commit_id: pullHead,
            submitted_at: `2026-08-27T11:${String(index % 59).padStart(2, '0')}:00.000Z`,
          }));
        responses[`repos/${trustedEvidenceRepository}/pulls/123/reviews?per_page=100&page=2`] = [
          {
            id: 101,
            user: { login: owner },
            state: 'DISMISSED',
            commit_id: pullHead,
            submitted_at: '2026-08-27T12:00:30.000Z',
          },
        ];
      },
    })
  );

  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /required approving reviewers are not verified/);
});

test('rejects READY status while any release-required item remains incomplete', () => {
  const value = fixture();
  value.manifest.status = 'READY';
  const result = run(value);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /cannot be READY while release-required evidence is incomplete/);
});
