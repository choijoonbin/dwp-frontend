import crypto from 'node:crypto';
import fs from 'node:fs';

export function fail(message) {
  throw new Error(`Product surface authorization contract error: ${message}`);
}

export function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function requireRecord(value, label) {
  if (!isRecord(value)) fail(`${label} must be an object`);
  return value;
}

export function requireArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

export function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string`);
  return value;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function readJson(filePath, label = filePath) {
  if (!fs.existsSync(filePath)) fail(`${label} is missing: ${filePath}`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function validateUnique(records, key, label) {
  const values = records.map((record, index) =>
    requireString(requireRecord(record, `${label}[${index}]`)[key], `${label}[${index}].${key}`)
  );
  if (new Set(values).size !== values.length) fail(`${label}.${key} values must be unique`);
}

export function bundleChecksum(bundle) {
  const payload = structuredClone(bundle);
  delete payload.checksum;
  delete payload.bundleStatus;
  return sha256(payload);
}
