#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultConfigPath = resolve(repositoryRoot, 'scripts/x04-local-revocation-slo.config.json');

const CONFIG_FIELDS = [
  'schemaVersion',
  'controlId',
  'automationId',
  'claimScope',
  'clock',
  'productionSlo',
  'readinessDisposition',
  'capabilityModes',
  'requiredAssertions',
  'externalBlockers',
  'testFile',
  'testName',
  'evidenceOutput',
];
const PRODUCTION_SLO_FIELDS = ['approved', 'thresholds', 'attestationReference'];
const MODE_FIELDS = ['id', 'deliveryDelayMs', 'localGuardrailMs'];
const GUARDRAIL_FIELDS = ['propagation', 'cachePurge', 'uiDenial'];
const EVIDENCE_FIELDS = [
  'schemaVersion',
  'evidenceId',
  'claimScope',
  'clock',
  'productionSloAttestation',
  'readinessDisposition',
  'externalBlockers',
  'scenarios',
];
const SCENARIO_FIELDS = [
  'mode',
  'deliveryDelayMs',
  'propagationLatencyMs',
  'cachePurgeLatencyMs',
  'uiDenialLatencyMs',
  'assertions',
];

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sameValues(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function validateClosedFields(value, fields, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  const unknown = Object.keys(value).filter((field) => !fields.includes(field));
  const missing = fields.filter((field) => !(field in value));
  if (unknown.length > 0) errors.push(`${label} has unknown fields: ${unknown.join(', ')}.`);
  if (missing.length > 0) errors.push(`${label} is missing fields: ${missing.join(', ')}.`);
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function validateX04LocalConfig(config) {
  const errors = [];
  validateClosedFields(config, CONFIG_FIELDS, 'config', errors);
  if (!isRecord(config)) return errors;
  if (config.schemaVersion !== 1) errors.push('config schemaVersion must be 1.');
  if (config.controlId !== 'X-04') errors.push('config controlId must be X-04.');
  if (config.automationId !== 'x04-local-revocation-multitab.v1') {
    errors.push('config automationId must be x04-local-revocation-multitab.v1.');
  }
  if (config.claimScope !== 'LOCAL_DETERMINISTIC_ONLY') {
    errors.push('config claimScope must remain LOCAL_DETERMINISTIC_ONLY.');
  }
  if (config.clock !== 'VITEST_FAKE_TIMER_LOGICAL_MS') {
    errors.push('config clock must remain VITEST_FAKE_TIMER_LOGICAL_MS.');
  }
  validateClosedFields(config.productionSlo, PRODUCTION_SLO_FIELDS, 'config productionSlo', errors);
  if (
    config.productionSlo?.approved !== false ||
    config.productionSlo?.thresholds !== null ||
    config.productionSlo?.attestationReference !== null
  ) {
    errors.push('config must not claim an approved production SLO or attestation.');
  }
  if (config.readinessDisposition !== 'BLOCKED_EXTERNAL') {
    errors.push('config readinessDisposition must remain BLOCKED_EXTERNAL.');
  }
  if (!Array.isArray(config.capabilityModes) || config.capabilityModes.length !== 2) {
    errors.push('config capabilityModes must contain exactly two modes.');
  }
  const expectedModes = ['BROADCAST_CHANNEL', 'STORAGE_FALLBACK'];
  const actualModes = (config.capabilityModes ?? []).map((mode) => mode?.id);
  if (!sameValues(actualModes, expectedModes)) {
    errors.push(`config capabilityModes must be exactly ${expectedModes.join(', ')}.`);
  }
  for (const mode of config.capabilityModes ?? []) {
    validateClosedFields(mode, MODE_FIELDS, `config mode ${mode?.id ?? 'unknown'}`, errors);
    if (!isPositiveInteger(mode?.deliveryDelayMs)) {
      errors.push(`config mode ${mode?.id ?? 'unknown'} requires a positive deliveryDelayMs.`);
    }
    validateClosedFields(
      mode?.localGuardrailMs,
      GUARDRAIL_FIELDS,
      `config mode ${mode?.id ?? 'unknown'} localGuardrailMs`,
      errors
    );
    for (const metric of GUARDRAIL_FIELDS) {
      if (!isPositiveInteger(mode?.localGuardrailMs?.[metric])) {
        errors.push(`config mode ${mode?.id ?? 'unknown'} ${metric} guardrail must be positive.`);
      }
    }
  }
  const expectedAssertions = [
    'REVISION_PROPAGATED',
    'ACCESS_SENSITIVE_CACHE_PURGED',
    'DENIAL_UI_COMMITTED',
    'PUBLIC_CACHE_RETAINED',
    'AUTHORITY_REFRESH_FAILURE_STAYS_DENIED',
    'SOURCE_TAB_REMAINS_READY',
  ];
  if (!sameValues(config.requiredAssertions, expectedAssertions)) {
    errors.push('config requiredAssertions do not match the closed X-04 local assertion set.');
  }
  const expectedBlockers = [
    'EXTERNAL_X04_OWNER_APPROVAL',
    'EXTERNAL_APPROVED_PRODUCTION_REVOCATION_SLO',
    'EXTERNAL_STAGING_REAL_BROWSER_CAPABILITY_ATTESTATION',
  ];
  if (!sameValues(config.externalBlockers, expectedBlockers)) {
    errors.push('config externalBlockers do not match the closed X-04 external blocker set.');
  }
  if (
    config.testFile !==
    'libs/shared-utils/src/auth/product-surface-context-provider.x04.mounted.test.tsx'
  ) {
    errors.push('config testFile must remain bound to the X-04 mounted provider harness.');
  }
  if (config.testName !== 'X-04 deterministic local revocation and multi-tab latency harness') {
    errors.push('config testName must remain bound to the X-04 mounted provider harness.');
  }
  if (
    config.evidenceOutput !== 'build/reports/product-surface/x04-local-revocation-multitab.json'
  ) {
    errors.push('config evidenceOutput must remain under the local build report boundary.');
  }
  return errors;
}

export function validateX04LocalEvidence(evidence, config) {
  const errors = [...validateX04LocalConfig(config)];
  validateClosedFields(evidence, EVIDENCE_FIELDS, 'evidence', errors);
  if (!isRecord(evidence)) return errors;
  if (evidence.schemaVersion !== 1) errors.push('evidence schemaVersion must be 1.');
  if (evidence.evidenceId !== config.automationId) {
    errors.push('evidence evidenceId must match config automationId.');
  }
  if (evidence.claimScope !== config.claimScope || evidence.clock !== config.clock) {
    errors.push('evidence must preserve the config local-only claim scope and logical clock.');
  }
  if (evidence.productionSloAttestation !== null) {
    errors.push('local evidence cannot contain a production SLO attestation.');
  }
  if (evidence.readinessDisposition !== 'BLOCKED_EXTERNAL') {
    errors.push('local evidence readinessDisposition must remain BLOCKED_EXTERNAL.');
  }
  if (!sameValues(evidence.externalBlockers, config.externalBlockers)) {
    errors.push('evidence externalBlockers must exactly match config.');
  }
  if (!Array.isArray(evidence.scenarios) || evidence.scenarios.length !== 2) {
    errors.push('evidence scenarios must contain exactly two capability modes.');
  }
  const scenariosByMode = new Map(
    (evidence.scenarios ?? []).map((scenario) => [scenario?.mode, scenario])
  );
  if (scenariosByMode.size !== (evidence.scenarios ?? []).length) {
    errors.push('evidence scenarios must not contain duplicate modes.');
  }
  for (const mode of config.capabilityModes ?? []) {
    const scenario = scenariosByMode.get(mode.id);
    if (!scenario) {
      errors.push(`evidence is missing ${mode.id}.`);
      continue;
    }
    validateClosedFields(scenario, SCENARIO_FIELDS, `evidence scenario ${mode.id}`, errors);
    if (scenario.deliveryDelayMs !== mode.deliveryDelayMs) {
      errors.push(`evidence scenario ${mode.id} deliveryDelayMs does not match config.`);
    }
    const metrics = [
      ['propagationLatencyMs', 'propagation'],
      ['cachePurgeLatencyMs', 'cachePurge'],
      ['uiDenialLatencyMs', 'uiDenial'],
    ];
    for (const [field, guardrail] of metrics) {
      const value = scenario[field];
      if (!isNonNegativeInteger(value)) {
        errors.push(`evidence scenario ${mode.id} ${field} must be a non-negative integer.`);
      } else if (value > mode.localGuardrailMs[guardrail]) {
        errors.push(`evidence scenario ${mode.id} ${field} exceeds its local guardrail.`);
      }
    }
    if (scenario.propagationLatencyMs !== mode.deliveryDelayMs) {
      errors.push(`evidence scenario ${mode.id} propagation must equal deterministic delivery.`);
    }
    if (
      scenario.cachePurgeLatencyMs < scenario.propagationLatencyMs ||
      scenario.uiDenialLatencyMs < scenario.propagationLatencyMs
    ) {
      errors.push(`evidence scenario ${mode.id} cannot purge or deny before propagation.`);
    }
    validateClosedFields(
      scenario.assertions,
      config.requiredAssertions,
      `evidence scenario ${mode.id} assertions`,
      errors
    );
    for (const assertion of config.requiredAssertions ?? []) {
      if (scenario.assertions?.[assertion] !== true) {
        errors.push(`evidence scenario ${mode.id} assertion ${assertion} must be true.`);
      }
    }
  }
  return errors;
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is unreadable: ${error.message}`);
  }
}

function safeOutputPath(config) {
  const reportsRoot = resolve(repositoryRoot, 'build/reports');
  const output = resolve(repositoryRoot, config.evidenceOutput);
  if (output !== reportsRoot && !output.startsWith(`${reportsRoot}${sep}`)) {
    throw new Error('X-04 local evidence output must remain under build/reports.');
  }
  return output;
}

function runHarness(config) {
  const executable = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
  return spawnSync(
    executable,
    [
      'yarn',
      'vitest',
      'run',
      config.testFile,
      '--testNamePattern',
      config.testName,
      '--disableConsoleIntercept',
    ],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: process.env,
      maxBuffer: 4 * 1024 * 1024,
      timeout: 120_000,
    }
  );
}

function main() {
  const config = readJson(defaultConfigPath, 'X-04 local config');
  const configErrors = validateX04LocalConfig(config);
  if (configErrors.length > 0) {
    console.error('X-04 local revocation config is invalid:\n');
    configErrors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  const outputPath = safeOutputPath(config);
  // A failed rerun must not leave an earlier passing local report available to consumers.
  rmSync(outputPath, { force: true });
  try {
    const result = runHarness(config);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`mounted X-04 harness exited with status ${result.status}.`);
    }
    const evidenceMatch = result.stdout.match(
      /(?:^|\n)DWP_X04_LOCAL_EVIDENCE=(\{[^\r\n]+\})(?:\r?\n|$)/u
    );
    if (!evidenceMatch?.[1]) throw new Error('mounted X-04 harness did not emit local evidence.');
    const evidence = JSON.parse(evidenceMatch[1]);
    const evidenceErrors = validateX04LocalEvidence(evidence, config);
    if (evidenceErrors.length > 0) {
      console.error('X-04 local revocation evidence is invalid:\n');
      evidenceErrors.forEach((error) => console.error(`- ${error}`));
      process.exitCode = 1;
      return;
    }
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log('\nX-04 local revocation automation passed.');
    console.log(`- evidence: ${relative(repositoryRoot, outputPath)}`);
    for (const scenario of evidence.scenarios) {
      console.log(
        `- ${scenario.mode}: propagation=${scenario.propagationLatencyMs}ms, ` +
          `cache-purge=${scenario.cachePurgeLatencyMs}ms, ui-denial=${scenario.uiDenialLatencyMs}ms`
      );
    }
    console.log('- readiness disposition: BLOCKED_EXTERNAL');
    console.log('- production SLO attestation: absent (external evidence still required)');
  } catch (error) {
    console.error(`X-04 local revocation automation failed: ${error.message}`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) main();
