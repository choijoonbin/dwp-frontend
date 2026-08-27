import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const schemaUrl = new URL('./widget-rollout-evidence.v1.schema.json', import.meta.url);
const querySetUrl = new URL('./widget-rollout-query-set.v1.golden.json', import.meta.url);
const schemaSource = readFileSync(schemaUrl, 'utf8');
const querySetSource = readFileSync(querySetUrl, 'utf8');

const anchors = Object.freeze({
  schemaFile: '607f7dc49953800e043113394e9f11590192e6055ce8dd4eb8f4205832dd7b20',
  querySetFile: '65a35c973706db67f692fdf30740b9fab6dd312dc55f176714dab17a9670c041',
  querySetRevision: 'dbea80caee9b8da19e53fa0101c8bd7e9728fb62c207e809f15c76cbdd451480',
});

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalize(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    assert(
      Number.isSafeInteger(value) && value >= 0,
      'Query set numbers must be non-negative integers.'
    );
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  assert(value && typeof value === 'object', 'Query set contains non-JSON data.');
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
    .join(',')}}`;
}

assert(sha256(schemaSource) === anchors.schemaFile, 'Rollout evidence schema bytes changed.');
assert(sha256(querySetSource) === anchors.querySetFile, 'Rollout query set bytes changed.');

const schema = JSON.parse(schemaSource);
const fixture = JSON.parse(querySetSource);
assert(
  schema.$id.endsWith('/widget-rollout-evidence.v1.schema.json'),
  'Unexpected evidence schema ID.'
);
assert(
  JSON.stringify(schema.properties.revisions.properties.ring.enum) ===
    JSON.stringify(['staging-bootstrap', 'staging-shadow']),
  'Evidence ring must be one of the two query template rings.'
);
assert(fixture.fixtureVersion === 1, 'Query fixture version must be 1.');
assert(fixture.querySet.schemaVersion === 1, 'Query set schema version must be 1.');
assert(fixture.querySet.sourceProvider === 'PROMETHEUS', 'Query provider must be PROMETHEUS.');
assert(fixture.querySet.evidenceWindowSeconds === 86400, 'Evidence window must be 24 hours.');
assert(fixture.querySet.evaluationCadenceSeconds === 60, 'Evaluation cadence must be 60 seconds.');
assert(
  JSON.stringify(fixture.querySet.templateVariables) ===
    JSON.stringify({ ring: ['staging-bootstrap', 'staging-shadow'] }),
  'Only the two closed ring values are allowed.'
);

const actualRevision = sha256(Buffer.from(canonicalize(fixture.querySet), 'utf8'));
assert(actualRevision === anchors.querySetRevision, 'Independent query set revision changed.');
assert(fixture.expectedQuerySetRevision === actualRevision, 'Fixture query set revision mismatch.');

const expectedQueryIds = [
  'diff-counts',
  'drill-decision-p99',
  'drill-would-delay-max',
  'evaluation-count',
  'evaluation-duration-15m-p99-max',
  'evaluation-duration-1m-p99-max',
  'evaluation-duration-24h-p99',
  'evaluation-error-count',
  'evaluation-error-rate-15m-max',
  'evaluation-error-rate-1m-max',
  'evaluation-totals',
  'legacy-mismatch-counts',
  'outbox-dead-letter-increase',
  'outbox-delivery-attempt-count',
  'outbox-delivery-error-count',
  'outbox-delivery-error-rate-5m-max',
  'outbox-oldest-age-max',
  'queue-depth-consecutive-max',
  'queue-depth-max',
  'queue-enqueue-attempt-count',
  'queue-rejection-count',
  'queue-rejection-rate-15m-max',
  'queue-rejection-rate-1m-max',
  'unsafe-allow-count',
].sort();
const actualQueryIds = fixture.querySet.queries.map((query) => query.queryId).sort();
assert(
  actualQueryIds.length === expectedQueryIds.length &&
    new Set(actualQueryIds).size === expectedQueryIds.length &&
    actualQueryIds.every((value, index) => value === expectedQueryIds[index]),
  'Rollout query IDs are incomplete or duplicated.'
);

for (const query of fixture.querySet.queries) {
  const commonKeys = ['queryId', 'outputField', 'unit', 'resultRounding', 'promql'];
  const mappedKeys = [...commonKeys, 'seriesLabel', 'seriesToFields'];
  const actualKeys = Object.keys(query).sort();
  const expectedKeys = (query.seriesToFields ? mappedKeys : commonKeys).sort();
  assert(
    actualKeys.length === expectedKeys.length &&
      actualKeys.every((key, index) => key === expectedKeys[index]),
    `${query.queryId}: query keys must be closed.`
  );
  const variables = [...query.promql.matchAll(/\$[A-Za-z][A-Za-z0-9_]*/g)].map((match) => match[0]);
  assert(
    variables.every((variable) => variable === '$ring'),
    `${query.queryId}: unknown template variable.`
  );
  assert(!query.promql.includes('\n'), `${query.queryId}: PromQL must be a single canonical line.`);
  assert(
    query.outputField.length > 0 && query.unit.length > 0,
    `${query.queryId}: output contract missing.`
  );
  assert(
    ['CEIL', 'FLOOR'].includes(query.resultRounding),
    `${query.queryId}: rounding must be explicit.`
  );
  if (query.seriesToFields) {
    assert(
      query.seriesLabel.length > 0,
      `${query.queryId}: grouped query requires a series label.`
    );
    assert(
      Object.keys(query.seriesToFields).length > 0,
      `${query.queryId}: grouped mapping is empty.`
    );
  }
}

const rollingRateQueryIds = new Set([
  'evaluation-error-rate-15m-max',
  'evaluation-error-rate-1m-max',
  'outbox-delivery-error-rate-5m-max',
  'queue-rejection-rate-15m-max',
  'queue-rejection-rate-1m-max',
]);
for (const query of fixture.querySet.queries) {
  if (!rollingRateQueryIds.has(query.queryId)) continue;
  assert(
    query.promql.includes('0.000000001'),
    `${query.queryId}: low-throughput denominator must not be clamped to one request per second.`
  );
}

const expectedFormulaIds = [
  'evaluation-error-rate-24h',
  'queue-rejection-rate-24h',
  'sample-total',
].sort();
const actualFormulaIds = fixture.querySet.integerFormulas
  .map((formula) => formula.formulaId)
  .sort();
assert(
  actualFormulaIds.length === expectedFormulaIds.length &&
    actualFormulaIds.every((value, index) => value === expectedFormulaIds[index]),
  'Rollout integer formulas are incomplete.'
);

const expectedFormulas = Object.freeze({
  'evaluation-error-rate-24h': Object.freeze({
    outputField: 'queue.evaluationErrorRateBps',
    expression:
      'require(evaluationCount>0&&evaluationErrorCount<=evaluationCount);ceilBigInt(10000*evaluationErrorCount/evaluationCount)',
  }),
  'queue-rejection-rate-24h': Object.freeze({
    outputField: 'queue.rejectionRateBps',
    expression:
      'require(enqueueAttemptCount>0&&rejectionCount<=enqueueAttemptCount);ceilBigInt(10000*rejectionCount/enqueueAttemptCount)',
  }),
  'sample-total': Object.freeze({
    outputField: 'samples.total',
    expression: 'CLASSIC_PERSONAL+FLOW_PERSONAL+FLOW_GOVERNED',
  }),
});
for (const formula of fixture.querySet.integerFormulas) {
  assert(
    JSON.stringify(formula) ===
      JSON.stringify({ formulaId: formula.formulaId, ...expectedFormulas[formula.formulaId] }),
    `${formula.formulaId}: formula contract changed.`
  );
}
assert(
  fixture.querySet.integerFormulas.every(
    (formula) => !formula.expression.includes('max(1,') && !formula.expression.includes('ceil(')
  ),
  'Integer rate formulas must not turn a zero denominator into a synthetic request.'
);

function ceilBasisPointsBigInt(numerator, denominator) {
  assert(denominator > 0n, 'BigInt rate denominator must be positive.');
  assert(numerator >= 0n && numerator <= denominator, 'BigInt rate counts are inconsistent.');
  return (10000n * numerator + denominator - 1n) / denominator;
}

assert(
  ceilBasisPointsBigInt(31525197391590n, 9007199254740000n) === 35n,
  'Large safe-integer rates must use exact BigInt CEIL rather than floating-point rounding.'
);
assert(
  schema.properties.window.properties.missingSampleBuckets.$ref === '#/$defs/nonNegativeInteger',
  'Missing telemetry must remain representable so the semantic Gate can fail it closed.'
);

const floorQueryIds = new Set([
  'evaluation-count',
  'evaluation-totals',
  'outbox-delivery-attempt-count',
  'queue-enqueue-attempt-count',
]);
for (const query of fixture.querySet.queries) {
  const expectedRounding = floorQueryIds.has(query.queryId) ? 'FLOOR' : 'CEIL';
  assert(
    query.resultRounding === expectedRounding,
    `${query.queryId}: expected conservative ${expectedRounding} rounding.`
  );
}

const allowedMetrics = new Set([
  'dwp_widget_outbox_dead_letter_total',
  'dwp_widget_outbox_delivery_total',
  'dwp_widget_outbox_oldest_unpublished_age_seconds',
  'dwp_widget_shadow_diff_total',
  'dwp_widget_shadow_drill_delay_seconds_bucket',
  'dwp_widget_shadow_drill_max_delay_seconds',
  'dwp_widget_shadow_evaluation_duration_seconds_bucket',
  'dwp_widget_shadow_evaluations_total',
  'dwp_widget_shadow_legacy_mismatch_total',
  'dwp_widget_shadow_queue_depth',
  'dwp_widget_shadow_queue_depth_above_230_consecutive_seconds',
  'dwp_widget_shadow_queue_rejections_total',
  'dwp_widget_shadow_unsafe_allow_total',
]);
for (const query of fixture.querySet.queries) {
  const metrics = new Set(query.promql.match(/dwp_widget_[a-z0-9_]+/g) ?? []);
  assert(metrics.size > 0, `${query.queryId}: no metric found.`);
  for (const metric of metrics) {
    assert(allowedMetrics.has(metric), `${query.queryId}: metric ${metric} is not whitelisted.`);
  }
}

function requiredLeafPaths(node, prefix) {
  if (node.type !== 'object') return [prefix];
  return node.required.flatMap((key) =>
    requiredLeafPaths(node.properties[key], `${prefix}.${key}`)
  );
}

const requiredOutputPaths = [
  ...requiredLeafPaths(schema.properties.samples, 'samples'),
  ...requiredLeafPaths(schema.properties.diffCounts, 'diffCounts'),
  'unsafeAllowCount',
  ...requiredLeafPaths(schema.properties.queue, 'queue'),
  ...requiredLeafPaths(schema.properties.outbox, 'outbox'),
  ...requiredLeafPaths(schema.properties.drill, 'drill'),
].sort();
const actualOutputPaths = [
  ...fixture.querySet.queries.flatMap((query) =>
    query.seriesToFields ? Object.values(query.seriesToFields) : [query.outputField]
  ),
  ...fixture.querySet.integerFormulas.map((formula) => formula.outputField),
].sort();
assert(
  actualOutputPaths.length === requiredOutputPaths.length &&
    new Set(actualOutputPaths).size === requiredOutputPaths.length &&
    actualOutputPaths.every((value, index) => value === requiredOutputPaths[index]),
  `Query outputs must cover evidence fields exactly.\nExpected: ${requiredOutputPaths.join(', ')}\nReceived: ${actualOutputPaths.join(', ')}`
);

const queueRequired = new Set(schema.properties.queue.required);
for (const field of [
  'maxRolling15MinuteRejectionRateBps',
  'maxOneMinuteRejectionRateBps',
  'maxRolling15MinuteEvaluationErrorRateBps',
  'maxOneMinuteEvaluationErrorRateBps',
  'maxRolling15MinuteDurationP99Milliseconds',
  'maxOneMinuteDurationP99Milliseconds',
  'maximumConsecutiveSecondsAboveDepth230',
]) {
  assert(queueRequired.has(field), `Evidence schema queue field ${field} is missing.`);
}
const drillRequired = new Set(schema.properties.drill.required);
for (const field of [
  'killDecisionP99Milliseconds',
  'quarantineDecisionP99Milliseconds',
  'wouldDenyMaximumMilliseconds',
  'wouldStopDataMaximumMilliseconds',
  'legacyPayloadMismatchCount',
  'legacyDataMismatchCount',
]) {
  assert(drillRequired.has(field), `Evidence schema drill field ${field} is missing.`);
}

process.stdout.write(`querySetRevision ${actualRevision}\n`);
process.stdout.write(`queries ${actualQueryIds.length}\n`);
process.stdout.write('rollout-evidence-contract ok\n');
