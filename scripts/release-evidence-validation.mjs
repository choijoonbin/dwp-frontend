import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export const RELEASE_EVIDENCE_STATES = [
  'COMPLETE',
  'PENDING_INTERNAL',
  'BLOCKED_EXTERNAL',
  'FEATURE_DISABLED',
];

export const PROVIDER_TENANT_ACCEPTANCE_IDS = Array.from(
  { length: 30 },
  (_, index) => `PT-A${String(index + 1).padStart(2, '0')}`
);

const stateSet = new Set(RELEASE_EVIDENCE_STATES);
const sourceName = /^[A-Z][A-Z0-9_]*$/;
const immutableRevision = /^[0-9a-f]{40}$/;
const providerManifestFields = [
  'schemaVersion',
  'manifestId',
  'release',
  'asOf',
  'status',
  'items',
];
const providerItemFields = [
  'id',
  'owner',
  'state',
  'releaseRequired',
  'summary',
  'automatedChecks',
  'evidence',
  'blockers',
  'failClosedEvidence',
];
const externalEvidenceFields = ['repository', 'path', 'revisionSource', 'checkoutSource'];
const automatedCheckFields = ['repository', 'command', 'artifact'];
const automatedCheckCommandPatterns = new Map([
  [
    'dwp-frontend',
    [
      /^corepack yarn test:e2e:provider(?:\s|$)/u,
      /^corepack yarn vitest run(?:\s|$)/u,
      /^corepack yarn playwright test(?:\s|$)/u,
      /^corepack yarn provider:artifacts:scan(?::test)?(?:\s|$)/u,
    ],
  ],
  ['dwp-backend', [/^\.\/gradlew :[A-Za-z0-9_-]+:(?:test|check)(?:\s|$)/u]],
  ['dwp-agent', [/^uv run pytest(?:\s|$)/u]],
]);

const approvedPlaywrightInvocations = new Set([
  [
    'e2e/provider-acceptance-evidence.spec.ts',
    '--project=chromium',
    '--project=mobile',
    '--workers=1',
  ].join('\u0000'),
  [
    'e2e/provider-critical-operations.spec.ts',
    '--project=chromium',
    '--workers=1',
    '--grep',
    'privileged support separates|post-access review',
  ].join('\u0000'),
  ['e2e/responsive-accessibility.spec.ts', '--project=chromium', '--workers=1'].join('\u0000'),
]);

export function readJsonFile(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function validateProviderTenantManifest(
  manifest,
  { root, releaseMode = false, environment = process.env } = {}
) {
  const errors = [];
  const externalCheckouts = new Map();
  const revisionBoundPaths = new Map();
  if (!isRecord(manifest)) {
    return result(['Provider-Tenant acceptance manifest must be an object.'], []);
  }
  validateClosedFields(manifest, providerManifestFields, 'Provider-Tenant manifest', errors);
  if (manifest.schemaVersion !== 1) errors.push('PT manifest schemaVersion must be 1.');
  if (manifest.manifestId !== 'provider-tenant-acceptance.v1') {
    errors.push('PT manifestId must be provider-tenant-acceptance.v1.');
  }
  if (!nonBlank(manifest.release)) errors.push('PT manifest requires release.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.asOf ?? '')) {
    errors.push('PT manifest asOf must be an ISO date.');
  }
  if (!['READY', 'BLOCKED'].includes(manifest.status)) {
    errors.push('PT manifest status must be READY or BLOCKED.');
  }
  if (!Array.isArray(manifest.items)) {
    errors.push('PT manifest items must be an array.');
    return result(errors, []);
  }

  const ids = manifest.items.map((item) => item?.id);
  if (new Set(ids).size !== ids.length) errors.push('PT manifest contains duplicate IDs.');
  const missing = PROVIDER_TENANT_ACCEPTANCE_IDS.filter((id) => !ids.includes(id));
  const unknown = ids.filter((id) => !PROVIDER_TENANT_ACCEPTANCE_IDS.includes(id));
  if (missing.length) errors.push(`PT manifest is missing ${missing.join(', ')}.`);
  if (unknown.length) errors.push(`PT manifest has unknown IDs ${unknown.join(', ')}.`);

  for (const item of manifest.items) {
    validateProviderItem(item, {
      root,
      releaseMode,
      environment,
      externalCheckouts,
      revisionBoundPaths,
      errors,
    });
  }

  const releaseBlocked = manifest.items.filter(
    (item) => item?.releaseRequired && item.state !== 'COMPLETE'
  );
  if (manifest.status === 'READY' && releaseBlocked.length > 0) {
    errors.push('PT manifest cannot be READY while a release-required item is incomplete.');
  }
  if (manifest.status === 'BLOCKED' && releaseBlocked.length === 0) {
    errors.push('PT manifest cannot be BLOCKED when every release-required item is complete.');
  }
  return result(errors, manifest.items, releaseBlocked);
}

export function validateEvidenceReference(
  reference,
  {
    root,
    releaseMode = false,
    environment = process.env,
    externalCheckouts = new Map(),
    revisionBoundPaths = new Map(),
  },
  label
) {
  const errors = [];
  if (typeof reference === 'string') {
    if (!nonBlank(reference)) return [`${label} has an empty same-repository evidence path.`];
    if (!isSafeRelativePath(reference, root)) {
      return [
        `${label} same-repository evidence must remain under the repository root: ${reference}.`,
      ];
    }
    if (!existsSync(resolve(root, reference))) {
      errors.push(`${label} evidence does not exist: ${reference}.`);
    }
    if (releaseMode && errors.length === 0) {
      errors.push(
        ...validateRevisionBoundPath(root, reference, label, 'same-repository', revisionBoundPaths)
      );
    }
    return errors;
  }
  if (!isRecord(reference)) return [`${label} evidence must be a path or repository reference.`];
  validateClosedFields(reference, externalEvidenceFields, `${label} external evidence`, errors);
  for (const field of externalEvidenceFields) {
    if (!nonBlank(reference[field])) errors.push(`${label} external evidence requires ${field}.`);
  }
  if (reference.repository === 'dwp-frontend') {
    errors.push(`${label} must use a plain path for same-repository evidence.`);
  }
  if (!isSafePortablePath(reference.path)) {
    errors.push(`${label} external evidence path must be repository-relative: ${reference.path}.`);
  }
  for (const field of ['revisionSource', 'checkoutSource']) {
    if (nonBlank(reference[field]) && !sourceName.test(reference[field])) {
      errors.push(`${label} ${field} must name an uppercase environment source.`);
    }
  }
  if (!releaseMode || errors.length > 0) return errors;

  const revision = environment[reference.revisionSource];
  const checkout = environment[reference.checkoutSource];
  if (!immutableRevision.test(revision ?? '')) {
    errors.push(
      `${label} ${reference.revisionSource} must resolve to a full lowercase 40-hex revision.`
    );
  }
  if (!nonBlank(checkout) || !isAbsolute(checkout)) {
    errors.push(`${label} ${reference.checkoutSource} must resolve to an absolute checkout path.`);
    return errors;
  }
  if (!existsSync(checkout) || !statSync(checkout).isDirectory()) {
    errors.push(`${label} official checkout does not exist: ${checkout}.`);
    return errors;
  }
  const checkoutKey = `${reference.repository}:${checkout}:${revision}`;
  if (!externalCheckouts.has(checkoutKey)) {
    const resolvedRevision = spawnSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    });
    const checkoutError =
      resolvedRevision.status === 0 && resolvedRevision.stdout.trim() === revision
        ? null
        : `${label} official ${reference.repository} checkout is not revision ${revision}.`;
    externalCheckouts.set(checkoutKey, checkoutError);
  }
  const checkoutError = externalCheckouts.get(checkoutKey);
  if (checkoutError) errors.push(checkoutError);
  if (!existsSync(resolve(checkout, reference.path))) {
    errors.push(
      `${label} external evidence does not exist: ${reference.repository}/${reference.path}.`
    );
  } else if (!checkoutError) {
    errors.push(
      ...validateRevisionBoundPath(
        checkout,
        reference.path,
        label,
        reference.repository,
        revisionBoundPaths
      )
    );
  }
  return errors;
}

export function summarizeStates(items) {
  return items.reduce(
    (counts, item) => {
      counts[item.state] = (counts[item.state] ?? 0) + 1;
      return counts;
    },
    Object.fromEntries(RELEASE_EVIDENCE_STATES.map((state) => [state, 0]))
  );
}

function validateProviderItem(item, context) {
  const { errors } = context;
  if (!isRecord(item)) {
    errors.push('PT manifest contains a non-object item.');
    return;
  }
  const label = item.id ?? 'unknown PT item';
  validateClosedFields(item, providerItemFields, label, errors);
  for (const field of providerItemFields) {
    if (!(field in item)) errors.push(`${label} requires ${field}.`);
  }
  for (const field of ['id', 'owner', 'summary']) {
    if (!nonBlank(item[field])) errors.push(`${label} requires non-empty ${field}.`);
  }
  if (!stateSet.has(item.state)) errors.push(`${label} has invalid state ${item.state}.`);
  if (typeof item.releaseRequired !== 'boolean') {
    errors.push(`${label} releaseRequired must be boolean.`);
  }
  for (const field of ['automatedChecks', 'evidence', 'blockers', 'failClosedEvidence']) {
    if (!Array.isArray(item[field])) errors.push(`${label} ${field} must be an array.`);
  }
  validateUniqueArray(item.blockers, `${label} blockers`, errors);
  validateUniqueArray(item.evidence, `${label} evidence`, errors, canonicalReference);
  validateUniqueArray(
    item.failClosedEvidence,
    `${label} failClosedEvidence`,
    errors,
    canonicalReference
  );
  validateAutomatedChecks(item, errors);
  for (const [field, references] of [
    ['evidence', item.evidence],
    ['failClosedEvidence', item.failClosedEvidence],
  ]) {
    if (!Array.isArray(references)) continue;
    references.forEach((reference, index) => {
      errors.push(...validateEvidenceReference(reference, context, `${label} ${field}[${index}]`));
    });
  }

  if (item.state === 'COMPLETE') {
    if (!nonEmpty(item.automatedChecks)) errors.push(`${label} COMPLETE requires automatedChecks.`);
    if (!nonEmpty(item.evidence)) errors.push(`${label} COMPLETE requires evidence.`);
    if (nonEmpty(item.blockers)) errors.push(`${label} COMPLETE cannot retain blockers.`);
    if (nonEmpty(item.failClosedEvidence)) {
      errors.push(`${label} COMPLETE cannot use failClosedEvidence as completion evidence.`);
    }
  }
  if (item.state === 'PENDING_INTERNAL') {
    if (!item.releaseRequired)
      errors.push(`${label} PENDING_INTERNAL must remain release-required.`);
    requireBlockedEvidence(item, label, errors);
    if (item.blockers?.some((blocker) => !/^INTERNAL_[A-Z0-9_]+$/.test(blocker))) {
      errors.push(`${label} PENDING_INTERNAL blockers must use INTERNAL_* codes.`);
    }
  }
  if (item.state === 'BLOCKED_EXTERNAL') {
    if (!item.releaseRequired)
      errors.push(`${label} BLOCKED_EXTERNAL must remain release-required.`);
    requireBlockedEvidence(item, label, errors);
    if (item.blockers?.some((blocker) => !/^EXTERNAL_[A-Z0-9_]+$/.test(blocker))) {
      errors.push(`${label} BLOCKED_EXTERNAL blockers must use EXTERNAL_* codes.`);
    }
  }
  if (item.state === 'FEATURE_DISABLED') {
    if (item.releaseRequired) errors.push(`${label} FEATURE_DISABLED cannot be release-required.`);
    requireBlockedEvidence(item, label, errors);
    if (!nonEmpty(item.automatedChecks)) {
      errors.push(`${label} FEATURE_DISABLED requires an automated fail-closed check.`);
    }
  }
}

function validateAutomatedChecks(item, errors) {
  if (!Array.isArray(item.automatedChecks)) return;
  const seen = new Set();
  item.automatedChecks.forEach((check, index) => {
    const label = `${item.id} automatedChecks[${index}]`;
    if (!isRecord(check)) {
      errors.push(`${label} must be an object.`);
      return;
    }
    validateClosedFields(check, automatedCheckFields, label, errors, true);
    if (!nonBlank(check.repository) || !nonBlank(check.command)) {
      errors.push(`${label} requires repository and command.`);
    } else {
      validateAutomatedCheckCommand(check, label, errors);
    }
    if (check.artifact !== undefined && !nonBlank(check.artifact)) {
      errors.push(`${label} artifact must be non-empty when present.`);
    }
    const fingerprint = canonicalReference(check);
    if (seen.has(fingerprint)) errors.push(`${item.id} automatedChecks contains duplicates.`);
    seen.add(fingerprint);
  });
}

function validateAutomatedCheckCommand(check, label, errors) {
  const patterns = automatedCheckCommandPatterns.get(check.repository);
  if (!patterns) {
    errors.push(
      `${label} repository must be one of ${[...automatedCheckCommandPatterns.keys()].join(', ')}.`
    );
    return;
  }
  if (check.command !== check.command.trim()) {
    errors.push(`${label} command must not have leading or trailing whitespace.`);
  }
  if (!patterns.some((pattern) => pattern.test(check.command))) {
    errors.push(`${label} command is not an approved ${check.repository} test command.`);
  }
  const argv = parseFailClosedShellWords(check.command);
  if (argv === null) {
    errors.push(
      `${label} command must be one fail-closed invocation without shell control syntax.`
    );
  } else if (!matchesClosedAutomatedCheckArgv(check.repository, argv)) {
    errors.push(
      `${label} command must execute its declared checks without listing, skipping, or replacing the trusted build.`
    );
  }
}

function parseFailClosedShellWords(command) {
  if (/\r|\n|`|\$\(|\\\r?\n/u.test(command)) return null;
  const words = [];
  let word = '';
  let wordStarted = false;
  let quote = null;
  let escaped = false;
  for (const character of command) {
    if (escaped) {
      word += character;
      wordStarted = true;
      escaped = false;
      continue;
    }
    if (quote === "'") {
      if (character === "'") quote = null;
      else word += character;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      wordStarted = true;
      continue;
    }
    if (character === '"') {
      quote = quote === '"' ? null : (quote ?? '"');
      wordStarted = true;
      continue;
    }
    if (character === "'") {
      if (quote === null) {
        quote = "'";
        wordStarted = true;
      } else {
        word += character;
      }
      continue;
    }
    if (character === '$' && quote !== "'") return null;
    if (
      quote === null &&
      ['&', '|', ';', '<', '>', '#', '(', ')', '{', '}', '*', '?', '[', ']', '~', '!'].includes(
        character
      )
    )
      return null;
    if (quote === null && /\s/u.test(character)) {
      if (wordStarted) words.push(word);
      word = '';
      wordStarted = false;
      continue;
    }
    word += character;
    wordStarted = true;
  }
  if (quote !== null || escaped) return null;
  if (wordStarted) words.push(word);
  return words;
}

function matchesClosedAutomatedCheckArgv(repository, argv) {
  if (repository === 'dwp-frontend') return matchesFrontendCheckArgv(argv);
  if (repository === 'dwp-backend') return matchesBackendCheckArgv(argv);
  if (repository === 'dwp-agent') return matchesAgentCheckArgv(argv);
  return false;
}

function matchesFrontendCheckArgv(argv) {
  if (argv[0] !== 'corepack' || argv[1] !== 'yarn') return false;
  if (argv[2] === 'test:e2e:provider') return argv.length === 3;
  if (argv[2] === 'provider:artifacts:scan:test') return argv.length === 3;
  if (argv[2] === 'provider:artifacts:scan') {
    return (
      argv.length === 5 &&
      argv[3] === 'playwright-report-provider' &&
      argv[4] === 'test-results/provider'
    );
  }
  if (argv[2] === 'vitest' && argv[3] === 'run') {
    return argv.length > 4 && argv.slice(4).every(isSafeFrontendTestPath);
  }
  if (argv[2] !== 'playwright' || argv[3] !== 'test') return false;
  return matchesPlaywrightTestArgv(argv.slice(4));
}

function matchesPlaywrightTestArgv(arguments_) {
  return approvedPlaywrightInvocations.has(arguments_.join('\u0000'));
}

function matchesBackendCheckArgv(argv) {
  if (argv[0] !== './gradlew') return false;
  const tasks = new Set();
  const selectors = new Set();
  const operationalOptions = new Set();
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (/^:[A-Za-z0-9_-]+:(?:test|check)$/u.test(argument)) {
      if (tasks.has(argument)) return false;
      tasks.add(argument);
      continue;
    }
    if (argument === '--tests') {
      const selector = argv[index + 1];
      if (!isExactJavaTestSelector(selector) || selectors.has(selector)) return false;
      selectors.add(selector);
      index += 1;
      continue;
    }
    if (['--rerun-tasks', '--no-daemon', '--max-workers=1'].includes(argument)) {
      if (operationalOptions.has(argument)) return false;
      operationalOptions.add(argument);
      continue;
    }
    return false;
  }
  if (tasks.size === 0) return false;
  return ![...tasks].some((task) => task.endsWith(':test')) || selectors.size > 0;
}

function matchesAgentCheckArgv(argv) {
  return (
    argv[0] === 'uv' &&
    argv[1] === 'run' &&
    argv[2] === 'pytest' &&
    argv.length > 3 &&
    argv.slice(3).every(isSafePythonTestSelector)
  );
}

function isSafeRepositoryPath(value) {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9_./-]+$/u.test(value) &&
    !value.startsWith('-') &&
    !value.startsWith('/') &&
    !value.split('/').includes('..')
  );
}

function isSafeFrontendTestPath(value) {
  return isSafeRepositoryPath(value) && /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(value);
}

function isExactJavaTestSelector(value) {
  return (
    typeof value === 'string' &&
    /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)+$/u.test(value)
  );
}

function isSafePythonTestSelector(value) {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9_./-]+\.py(?:::[A-Za-z_][A-Za-z0-9_]*)*$/u.test(value) &&
    !value.startsWith('-') &&
    !value.startsWith('/') &&
    !value.split('::', 1)[0].split('/').includes('..')
  );
}

function requireBlockedEvidence(item, label, errors) {
  if (!nonEmpty(item.blockers)) errors.push(`${label} requires explicit blockers.`);
  if (!nonEmpty(item.failClosedEvidence)) {
    errors.push(`${label} requires failClosedEvidence while incomplete.`);
  }
}

function validateClosedFields(value, allowed, label, errors, optionalArtifact = false) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) errors.push(`${label} has unknown fields: ${unknown.join(', ')}.`);
  if (optionalArtifact) {
    for (const field of ['repository', 'command']) {
      if (!(field in value)) errors.push(`${label} requires ${field}.`);
    }
  }
}

function validateUniqueArray(value, label, errors, serialize = String) {
  if (!Array.isArray(value)) return;
  if (value.some((entry) => (typeof entry === 'string' ? !entry.trim() : entry == null))) {
    errors.push(`${label} contains an empty value.`);
  }
  const serialized = value.map(serialize);
  if (new Set(serialized).size !== serialized.length) errors.push(`${label} contains duplicates.`);
}

function canonicalReference(value) {
  return typeof value === 'string'
    ? value
    : JSON.stringify(
        Object.fromEntries(
          Object.entries(value ?? {}).sort(([left], [right]) => left.localeCompare(right))
        )
      );
}

function validateRevisionBoundPath(checkout, path, label, repository, cache) {
  const cacheKey = `${checkout}:${path}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey).map((error) => `${label} ${error}`);
  }
  const tracked = spawnSync('git', ['-C', checkout, 'ls-files', '--error-unmatch', '--', path], {
    encoding: 'utf8',
  });
  if (tracked.status !== 0) {
    const errors = [`${repository} evidence is not tracked by the official revision: ${path}.`];
    cache.set(cacheKey, errors);
    return errors.map((error) => `${label} ${error}`);
  }

  const unchanged = spawnSync('git', ['-C', checkout, 'diff', '--quiet', 'HEAD', '--', path], {
    encoding: 'utf8',
  });
  if (unchanged.status !== 0) {
    const errors = [`${repository} evidence does not match the official revision: ${path}.`];
    cache.set(cacheKey, errors);
    return errors.map((error) => `${label} ${error}`);
  }
  cache.set(cacheKey, []);
  return [];
}

function isSafeRelativePath(value, root) {
  if (!isSafePortablePath(value) || !root) return false;
  const target = resolve(root, value);
  const fromRoot = relative(root, target);
  return fromRoot !== '' && !fromRoot.startsWith('..') && !isAbsolute(fromRoot);
}

function isSafePortablePath(value) {
  return (
    nonBlank(value) &&
    !isAbsolute(value) &&
    !value.includes('\\') &&
    !value.split('/').includes('..') &&
    !value.startsWith('./') &&
    !value.includes('://')
  );
}

function nonBlank(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function nonEmpty(value) {
  return Array.isArray(value) && value.length > 0;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function result(errors, items, releaseBlocked = []) {
  return { errors, items, releaseBlocked, counts: summarizeStates(items) };
}
