export const RELEASE_READINESS_EXPECTED_IDS = {
  qualityGates: range('R2-', 1, 5),
  productionHardening: range('R3-', 1, 6),
  externalDecisions: range('D-', 1, 18),
  approvals: range('A-', 1, 7),
};

export const RELEASE_READINESS_STATUSES = new Set([
  'READY',
  'BLOCKED_INTERNAL_EVIDENCE',
  'BLOCKED_EXTERNAL_EVIDENCE',
  'BLOCKED_INTERNAL_AND_EXTERNAL_EVIDENCE',
]);

const receiptFields = [
  'commit',
  'environment',
  'runId',
  'occurredAt',
  'sha256',
  'issuer',
  'signatureRef',
];

export function validateReleaseReadinessPolicy(registry) {
  const errors = [];
  for (const [section, expectedIds] of Object.entries(RELEASE_READINESS_EXPECTED_IDS)) {
    const items = registry?.[section];
    if (!Array.isArray(items)) {
      errors.push(`${section} must be an array.`);
      continue;
    }
    const ids = items.map((item) => item?.id);
    if (new Set(ids).size !== ids.length) errors.push(`${section} contains duplicate IDs.`);
    const missing = expectedIds.filter((id) => !ids.includes(id));
    const unknown = ids.filter((id) => !expectedIds.includes(id));
    if (missing.length) errors.push(`${section} is missing ${missing.join(', ')}.`);
    if (unknown.length) errors.push(`${section} has unknown IDs ${unknown.join(', ')}.`);
  }

  if (!RELEASE_READINESS_STATUSES.has(registry?.status)) {
    errors.push(`Registry has invalid status ${registry?.status}.`);
  } else {
    const expectedStatus = deriveReleaseReadinessStatus(registry);
    if (registry.status !== expectedStatus) {
      errors.push(`Registry status must be ${expectedStatus}, not ${registry.status}.`);
    }
  }

  releaseRequiredItems(registry)
    .filter((item) => item?.state === 'COMPLETE')
    .forEach((item) => errors.push(...validateCompletionReceipt(item.completionReceipt, item.id)));
  return errors;
}

export function deriveReleaseReadinessStatus(registry) {
  const incomplete = releaseRequiredItems(registry).filter((item) => item?.state !== 'COMPLETE');
  const hasInternal = incomplete.some((item) => item?.state === 'PENDING_INTERNAL');
  const hasExternal = incomplete.some((item) => item?.state === 'BLOCKED_EXTERNAL');
  if (hasInternal && hasExternal) return 'BLOCKED_INTERNAL_AND_EXTERNAL_EVIDENCE';
  if (hasInternal) return 'BLOCKED_INTERNAL_EVIDENCE';
  if (hasExternal) return 'BLOCKED_EXTERNAL_EVIDENCE';
  return 'READY';
}

export function validateCompletionReceipt(receipt, label) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return [`${label} COMPLETE requires a signed completionReceipt.`];
  }
  const errors = [];
  const unknown = Object.keys(receipt).filter((field) => !receiptFields.includes(field));
  const missing = receiptFields.filter((field) => !(field in receipt));
  if (unknown.length)
    errors.push(`${label} completionReceipt has unknown fields: ${unknown.join(', ')}.`);
  if (missing.length) errors.push(`${label} completionReceipt is missing ${missing.join(', ')}.`);
  if (!/^[0-9a-f]{40}$/.test(receipt.commit ?? '')) {
    errors.push(`${label} completionReceipt commit must be a lowercase 40-hex revision.`);
  }
  for (const field of ['environment', 'runId', 'issuer', 'signatureRef']) {
    if (typeof receipt[field] !== 'string' || !receipt[field].trim()) {
      errors.push(`${label} completionReceipt requires ${field}.`);
    }
  }
  if (
    typeof receipt.signatureRef === 'string' &&
    receipt.signatureRef.trim() &&
    !/^[a-z][a-z0-9+.-]*:\/\//i.test(receipt.signatureRef)
  ) {
    errors.push(`${label} completionReceipt signatureRef must be an immutable receipt URI.`);
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(receipt.sha256 ?? '')) {
    errors.push(`${label} completionReceipt sha256 must be a sha256: lowercase digest.`);
  }
  if (
    typeof receipt.occurredAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(receipt.occurredAt) ||
    Number.isNaN(Date.parse(receipt.occurredAt))
  ) {
    errors.push(`${label} completionReceipt occurredAt must be a UTC ISO timestamp.`);
  }
  return errors;
}

function releaseRequiredItems(registry) {
  return Object.keys(RELEASE_READINESS_EXPECTED_IDS).flatMap((section) =>
    Array.isArray(registry?.[section])
      ? registry[section].filter((item) => item?.releaseRequired)
      : []
  );
}

function range(prefix, start, end) {
  return Array.from(
    { length: end - start + 1 },
    (_, index) => `${prefix}${String(start + index).padStart(2, '0')}`
  );
}
