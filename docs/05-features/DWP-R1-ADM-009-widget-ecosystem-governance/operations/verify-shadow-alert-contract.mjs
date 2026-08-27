import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const artifactUrl = new URL('./widget-shadow-alerts.v1.json', import.meta.url);
const schemaUrl = new URL('./widget-shadow-alerts.v1.schema.json', import.meta.url);
const negativeUrl = new URL('./widget-shadow-alerts.v1.negative.json', import.meta.url);
const artifactSource = readFileSync(artifactUrl, 'utf8');
const schemaSource = readFileSync(schemaUrl, 'utf8');
const negativeSource = readFileSync(negativeUrl, 'utf8');

const anchors = Object.freeze({
  artifactFile: '6da8a33e2946e6a763210d0776f72e413623226a21c50b136095815de25199cb',
  schemaFile: 'e64d65c589ff058095aac9905a28c66f503616b3768836bb63dd90160ccfa8e3',
  negativeFile: 'a161c39c2605115b58b2235e89aba2e3de52422625d8901287a940c39d9d6dcb',
});

class ContractError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function fail(code, message) {
  throw new ContractError(code, message);
}

function assert(condition, code, message) {
  if (!condition) fail(code, message);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

for (const [name, source] of Object.entries({
  artifactFile: artifactSource,
  schemaFile: schemaSource,
  negativeFile: negativeSource,
})) {
  assert(
    sha256(source) === anchors[name],
    'FILE_DIGEST_MISMATCH',
    `${name} differs from its independent anchor.`
  );
}

const expectedRules = Object.freeze([
  {
    key: 'unsafe-allow-immediate',
    severity: 'PAGE',
    promql:
      'sum(increase(dwp_widget_shadow_unsafe_allow_total{ring=~"staging-bootstrap|staging-shadow"}[1m]))',
    comparator: '>',
    threshold: 0,
    unit: 'count',
    forSeconds: 0,
    action: 'STOP_AND_PAGE_SECURITY',
  },
  {
    key: 'catalog-diff-immediate',
    severity: 'PAGE',
    promql:
      'sum(increase(dwp_widget_shadow_diff_total{ring=~"staging-bootstrap|staging-shadow"}[1m]))',
    comparator: '>',
    threshold: 0,
    unit: 'count',
    forSeconds: 0,
    action: 'STOP_AND_PAGE_CONTROL_PLANE',
  },
  {
    key: 'outbox-dlq-immediate',
    severity: 'PAGE',
    promql: 'sum(increase(dwp_widget_outbox_dead_letter_total{service="platform"}[1m]))',
    comparator: '>',
    threshold: 0,
    unit: 'count',
    forSeconds: 0,
    action: 'STOP_AND_PAGE_DATA',
  },
  {
    key: 'queue-rejection-rate-1m',
    severity: 'PAGE',
    promql:
      '10000 * sum(rate(dwp_widget_shadow_queue_rejections_total{service="platform",ring=~"staging-bootstrap|staging-shadow"}[1m])) / clamp_min(sum(rate(dwp_widget_shadow_evaluations_total{ring=~"staging-bootstrap|staging-shadow"}[1m])) + sum(rate(dwp_widget_shadow_queue_rejections_total{service="platform",ring=~"staging-bootstrap|staging-shadow"}[1m])), 0.000000001)',
    comparator: '>',
    threshold: 100,
    unit: 'basis_points',
    forSeconds: 60,
    action: 'STOP_AND_PAGE_CONTROL_PLANE',
  },
  {
    key: 'evaluation-error-rate-1m',
    severity: 'PAGE',
    promql:
      '10000 * sum(rate(dwp_widget_shadow_evaluations_total{ring=~"staging-bootstrap|staging-shadow",outcome=~"ERROR|TIMEOUT"}[1m])) / clamp_min(sum(rate(dwp_widget_shadow_evaluations_total{ring=~"staging-bootstrap|staging-shadow"}[1m])), 0.000000001)',
    comparator: '>',
    threshold: 200,
    unit: 'basis_points',
    forSeconds: 60,
    action: 'STOP_AND_PAGE_CONTROL_PLANE',
  },
  {
    key: 'evaluation-duration-p99-5m',
    severity: 'PAGE',
    promql:
      '1000 * max(histogram_quantile(0.99, sum by (ring, le) (rate(dwp_widget_shadow_evaluation_duration_seconds_bucket{ring=~"staging-bootstrap|staging-shadow"}[1m]))))',
    comparator: '>',
    threshold: 250,
    unit: 'milliseconds',
    forSeconds: 300,
    action: 'STOP_AND_PAGE_CONTROL_PLANE',
  },
  {
    key: 'queue-depth-5m',
    severity: 'PAGE',
    promql: 'max(dwp_widget_shadow_queue_depth{service="platform"})',
    comparator: '>',
    threshold: 230,
    unit: 'tasks',
    forSeconds: 300,
    action: 'STOP_AND_PAGE_CONTROL_PLANE',
  },
  {
    key: 'outbox-age-warning-5m',
    severity: 'WARNING',
    promql: 'max(dwp_widget_outbox_oldest_unpublished_age_seconds{service="platform"})',
    comparator: '>',
    threshold: 30,
    unit: 'seconds',
    forSeconds: 300,
    action: 'WARN_DATA',
  },
  {
    key: 'outbox-age-stop-2m',
    severity: 'PAGE',
    promql: 'max(dwp_widget_outbox_oldest_unpublished_age_seconds{service="platform"})',
    comparator: '>',
    threshold: 60,
    unit: 'seconds',
    forSeconds: 120,
    action: 'STOP_AND_PAGE_DATA',
  },
  {
    key: 'outbox-delivery-error-rate-5m',
    severity: 'PAGE',
    promql:
      '10000 * sum(rate(dwp_widget_outbox_delivery_total{service="platform",outcome=~"ERROR|DEAD_LETTER"}[1m])) / clamp_min(sum(rate(dwp_widget_outbox_delivery_total{service="platform"}[1m])), 0.000000001)',
    comparator: '>',
    threshold: 100,
    unit: 'basis_points',
    forSeconds: 300,
    action: 'STOP_AND_PAGE_DATA',
  },
]);

const rootKeys = Object.freeze([
  'alertSetKey',
  'environment',
  'evaluationCadenceSeconds',
  'ringValues',
  'rules',
  'schemaVersion',
]);
const ruleKeys = Object.freeze([
  'action',
  'comparator',
  'forSeconds',
  'key',
  'promql',
  'severity',
  'threshold',
  'unit',
]);
const severities = new Set(['WARNING', 'PAGE']);
const units = new Set(['count', 'basis_points', 'milliseconds', 'tasks', 'seconds']);
const durations = new Set([0, 60, 120, 300]);
const actions = new Set([
  'WARN_DATA',
  'STOP_AND_PAGE_SECURITY',
  'STOP_AND_PAGE_CONTROL_PLANE',
  'STOP_AND_PAGE_DATA',
]);

function exactKeys(value, expected, path) {
  assert(
    value && typeof value === 'object' && !Array.isArray(value),
    'SCHEMA_TYPE',
    `${path} must be an object.`
  );
  const actual = Object.keys(value).sort();
  const unknown = actual.find((key) => !expected.includes(key));
  if (unknown) fail('SCHEMA_UNKNOWN_FIELD', `${path}.${unknown} is unknown.`);
  const missing = expected.find((key) => !actual.includes(key));
  if (missing) fail('SCHEMA_REQUIRED', `${path}.${missing} is required.`);
}

function validateAlertSet(candidate) {
  exactKeys(candidate, rootKeys, '$');
  assert(candidate.schemaVersion === 1, 'SCHEMA_CONST', '$.schemaVersion must equal 1.');
  assert(
    candidate.alertSetKey === 'widget-catalog-shadow-stop-gates',
    'SCHEMA_CONST',
    '$.alertSetKey is invalid.'
  );
  assert(candidate.environment === 'STAGING', 'SCHEMA_CONST', '$.environment must be STAGING.');
  assert(
    candidate.evaluationCadenceSeconds === 60,
    'SCHEMA_CONST',
    '$.evaluationCadenceSeconds must equal 60.'
  );
  assert(Array.isArray(candidate.ringValues), 'SCHEMA_TYPE', '$.ringValues must be an array.');
  if (candidate.ringValues.length < 2) fail('SCHEMA_MIN_ITEMS', '$.ringValues has too few items.');
  if (candidate.ringValues.length > 2) fail('SCHEMA_MAX_ITEMS', '$.ringValues has too many items.');
  assert(
    candidate.ringValues[0] === 'staging-bootstrap' && candidate.ringValues[1] === 'staging-shadow',
    'SCHEMA_CONST',
    '$.ringValues must be the closed staging ring pair.'
  );
  assert(Array.isArray(candidate.rules), 'SCHEMA_TYPE', '$.rules must be an array.');
  if (candidate.rules.length < 10) fail('SCHEMA_MIN_ITEMS', '$.rules has too few items.');
  if (candidate.rules.length > 10) fail('SCHEMA_MAX_ITEMS', '$.rules has too many items.');
  for (const [index, rule] of candidate.rules.entries()) {
    exactKeys(rule, ruleKeys, `$.rules[${index}]`);
    assert(
      typeof rule.key === 'string' && rule.key.length > 0,
      'SCHEMA_TYPE',
      `$.rules[${index}].key is invalid.`
    );
    assert(severities.has(rule.severity), 'SCHEMA_ENUM', `$.rules[${index}].severity is invalid.`);
    assert(
      typeof rule.promql === 'string' && rule.promql.length > 0,
      'SCHEMA_TYPE',
      `$.rules[${index}].promql is invalid.`
    );
    assert(rule.comparator === '>', 'SCHEMA_CONST', `$.rules[${index}].comparator must equal >.`);
    assert(
      Number.isInteger(rule.threshold) && rule.threshold >= 0,
      'SCHEMA_TYPE',
      `$.rules[${index}].threshold is invalid.`
    );
    assert(units.has(rule.unit), 'SCHEMA_ENUM', `$.rules[${index}].unit is invalid.`);
    assert(
      durations.has(rule.forSeconds),
      'SCHEMA_ENUM',
      `$.rules[${index}].forSeconds is invalid.`
    );
    assert(actions.has(rule.action), 'SCHEMA_ENUM', `$.rules[${index}].action is invalid.`);
  }
  assert(
    new Set(candidate.rules.map((rule) => rule.key)).size === 10,
    'ALERT_MATRIX_MISMATCH',
    'Rule keys must be unique.'
  );
  assert(
    JSON.stringify(candidate.rules) === JSON.stringify(expectedRules),
    'ALERT_MATRIX_MISMATCH',
    'Alert rules differ from the closed stop matrix.'
  );
}

const artifact = JSON.parse(artifactSource);
const schema = JSON.parse(schemaSource);
const negative = JSON.parse(negativeSource);
assert(
  schema.additionalProperties === false,
  'SCHEMA_DEFINITION_INVALID',
  'Root schema must be closed.'
);
assert(
  schema.$defs?.rule?.additionalProperties === false,
  'SCHEMA_DEFINITION_INVALID',
  'Rule schema must be closed.'
);
validateAlertSet(artifact);

const mutations = Object.freeze({
  ADD_UNKNOWN_ROOT(candidate) {
    candidate.unknown = true;
  },
  REMOVE_QUEUE_REJECTION(candidate) {
    candidate.rules = candidate.rules.filter((rule) => rule.key !== 'queue-rejection-rate-1m');
  },
  QUEUE_THRESHOLD_10(candidate) {
    candidate.rules.find((rule) => rule.key === 'queue-rejection-rate-1m').threshold = 10;
  },
  QUEUE_FOR_300(candidate) {
    candidate.rules.find((rule) => rule.key === 'queue-rejection-rate-1m').forSeconds = 300;
  },
  CLAMP_DENOMINATOR_ONE(candidate) {
    const rule = candidate.rules.find((item) => item.key === 'queue-rejection-rate-1m');
    rule.promql = rule.promql.replace('0.000000001)', '1)');
  },
  DIFF_EVIDENCE_FIELD(candidate) {
    candidate.rules.find((rule) => rule.key === 'catalog-diff-immediate').promql =
      'diffCounts.total';
  },
  WARNING_STOPS(candidate) {
    candidate.rules.find((rule) => rule.key === 'outbox-age-warning-5m').action =
      'STOP_AND_PAGE_DATA';
  },
  ADD_PRODUCTION_RING(candidate) {
    candidate.ringValues.push('production');
  },
});

assert(
  negative.schemaVersion === 1 && Array.isArray(negative.cases),
  'NEGATIVE_FIXTURE_INVALID',
  'Negative fixture is invalid.'
);
assert(
  negative.cases.length === 8,
  'NEGATIVE_FIXTURE_INVALID',
  'Exactly eight negative cases are required.'
);
for (const testCase of negative.cases) {
  const mutate = mutations[testCase.mutation];
  assert(mutate, 'NEGATIVE_FIXTURE_INVALID', `Unknown mutation ${testCase.mutation}.`);
  const candidate = structuredClone(artifact);
  mutate(candidate);
  let actualErrorCode = 'NO_ERROR';
  try {
    validateAlertSet(candidate);
  } catch (error) {
    if (!(error instanceof ContractError)) throw error;
    actualErrorCode = error.code;
  }
  assert(
    actualErrorCode === testCase.expectedErrorCode,
    'NEGATIVE_EXPECTATION_MISMATCH',
    `${testCase.id}: expected ${testCase.expectedErrorCode}, received ${actualErrorCode}.`
  );
}

process.stdout.write(
  `widget shadow alert contract PASS: ${artifact.rules.length} rules / ${negative.cases.length} negative cases\n`
);
